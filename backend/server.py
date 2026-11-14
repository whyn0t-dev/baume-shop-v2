"""Baume e-commerce API — FastAPI + Supabase + Stripe + Resend + Supabase Auth."""

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from auth import (
    auth_router,
    get_current_user,
    get_optional_user,
    get_current_profile,
    require_admin,
)

import os
import logging
import uuid
import asyncio
import requests
import json
import httpx
import time

from decimal import Decimal
from models import WorkshopBookingRequest, AdminWorkshopRequest

from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from calendar import monthrange
from zoneinfo import ZoneInfo
from typing import List, Optional, Dict, Any
from fastapi import UploadFile, File

import stripe

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from supabase import create_client, Client

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from emails import (
    send_contact_notification,
    send_contact_acknowledgement,
    send_order_confirmation,
)

limiter = Limiter(key_func=get_remote_address)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")

# FIX: assign the API key to the stripe client so all Stripe calls work
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY


# ---------- Lifespan (replaces deprecated @app.on_event) ----------


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Baume API", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://baumeshop-v2.weblax.fr",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")


# ---------- Helpers ----------


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def sb_insert(table: str, data):
    return await asyncio.to_thread(lambda: supabase.table(table).insert(data).execute())


async def sb_update(table: str, values: dict, column: str, value):
    return await asyncio.to_thread(
        lambda: supabase.table(table).update(values).eq(column, value).execute()
    )


async def sb_select_one(table: str, column: str, value, select: str = "*"):
    result = await asyncio.to_thread(
        lambda: supabase.table(table)
        .select(select)
        .eq(column, value)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def sync_variant_inventory(variant_id: Optional[str]) -> bool:
    """
    Aligne inventory_levels sur product_variants.stock (fonction SQL
    sync_variant_inventory). finalize_paid_order refuse toute vente si les
    deux stocks diffèrent ou si la ligne d'inventaire manque.
    Ne bloque jamais l'appelant : un échec est journalisé.
    """
    if not variant_id:
        return False
    try:
        await asyncio.to_thread(
            lambda: supabase.rpc(
                "sync_variant_inventory", {"p_variant_id": variant_id}
            ).execute()
        )
        return True
    except Exception:
        logger.exception("Synchronisation inventaire impossible : variante=%s", variant_id)
        return False


async def sync_product_inventory(product_id: str) -> None:
    """Synchronise l'inventaire de toutes les variantes d'un produit."""
    try:
        result = await asyncio.to_thread(
            lambda: supabase.table("product_variants")
            .select("id")
            .eq("product_id", product_id)
            .execute()
        )
    except Exception:
        logger.exception("Variantes illisibles pour la synchronisation : %s", product_id)
        return
    for row in result.data or []:
        await sync_variant_inventory(row["id"])


async def sb_count(table: str, filters: Optional[Dict[str, Any]] = None) -> int:
    def run():
        q = supabase.table(table).select("id", count="exact")
        if filters:
            for k, v in filters.items():
                q = q.eq(k, v)
        return q.execute()

    result = await asyncio.to_thread(run)
    return result.count or 0


async def sb_delete(table: str, column: str, value):
    return await asyncio.to_thread(
        lambda: supabase.table(table).delete().eq(column, value).execute()
    )


def auth_user_id(user) -> Optional[str]:
    if not user:
        return None
    if isinstance(user, dict):
        return user.get("id")
    return getattr(user, "id", None)


def auth_user_email(user) -> str:
    if not user:
        return ""
    if isinstance(user, dict):
        return user.get("email", "") or ""
    return getattr(user, "email", "") or ""


async def get_or_create_customer(profile: dict) -> dict:
    customer = await sb_select_one("customers", "profile_id", profile["id"])

    if customer:
        return customer

    inserted = await sb_insert(
        "customers",
        {
            "profile_id": profile["id"],
            "email": profile.get("email"),
            "first_name": profile.get("first_name"),
            "last_name": profile.get("last_name"),
            "phone": profile.get("phone"),
            "created_at": now_iso(),
        },
    )

    return inserted.data[0]


# ---------- Models ----------
class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    slug: str
    name: Optional[str] = None
    title: Optional[str] = None
    tagline: Optional[str] = None

    price: Optional[float] = None
    compare_price: Optional[float] = None
    currency: Optional[str] = "CHF"

    image: Optional[str] = None
    gallery: List[str] = Field(default_factory=list)

    product_category: Optional[str] = None
    product_type: Optional[str] = None

    needs: List[str] = Field(default_factory=list)
    flux: Optional[str] = None
    usage: Optional[str] = None
    sizes: List[str] = Field(default_factory=list)
    colors: List[str] = Field(default_factory=list)
    benefits: List[str] = Field(default_factory=list)

    description: Optional[str] = None
    composition: Optional[str] = None
    how_to_use: Optional[str] = None
    fabrication: Optional[str] = None
    # Bloc « L'essentiel » sous « Laisser un avis » (fiche produit)
    highlights: List[str] = Field(default_factory=list)
    specs: List[Dict[str, Any]] = Field(default_factory=list)
    care_instructions: Optional[str] = None

    rating: Optional[float] = 0
    reviews_count: Optional[int] = 0
    stock: Optional[int] = 0
    available: Optional[bool] = False

    bestseller: Optional[bool] = False
    featured: Optional[bool] = False

    preorder: Optional[bool] = False
    preorder_shipping_date: Optional[str] = None
    preorder_message: Optional[str] = None


class ContactRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    subject: str = Field(..., min_length=1, max_length=160)
    message: str = Field(..., min_length=1, max_length=5000)
    topic: Optional[str] = None


class CheckoutItem(BaseModel):
    product_id: str
    name: str = ""
    quantity: int = Field(..., gt=0, le=100, strict=True)
    variant_id: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    price: Optional[float] = None
    sku: Optional[str] = None


class CheckoutRequest(BaseModel):
    items: List[CheckoutItem]
    origin_url: str
    email: Optional[EmailStr] = None
    shipping_country: Optional[str] = "CH"
    shipping_address: Optional[Dict[str, Any]] = None
    discount_code: Optional[str] = None  # ← ajouter
    success_url: Optional[str] = None  # ← ajouter
    cancel_url: Optional[str] = None  # ← ajouter


class AddressRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    postal_code: str
    country: str = "CH"
    phone: Optional[str] = None
    is_default: bool = False


class CartItemRequest(BaseModel):
    variant_id: str
    quantity: int = Field(..., gt=0)


class DiscountCheckRequest(BaseModel):
    code: str


class ReviewSubmitRequest(BaseModel):
    product_id: str
    rating: float = Field(..., ge=1, le=5)
    title: str = Field(..., min_length=1, max_length=120)
    body: str = Field(..., min_length=20, max_length=800)


class ReviewUpdateRequest(BaseModel):
    rating: Optional[float] = Field(None, ge=1, le=5)
    title: Optional[str] = Field(None, min_length=1, max_length=120)
    body: Optional[str] = Field(None, min_length=20, max_length=800)


class OrderStatusUpdate(BaseModel):
    status: str


# ---------- Startup / Seed ----------


# async def _seed_db():
#     if await sb_count("products") == 0:
#         products = []
#         for p in PRODUCTS:
#             doc = dict(p)
#             doc.pop("id", None)
#             doc.setdefault("created_at", now_iso())
#             doc.setdefault("updated_at", now_iso())
#             products.append(doc)

#         await sb_insert("products", products)
#         logger.info(f"Seeded {len(products)} products")

#     if await sb_count("categories", {"kind": "besoin"}) == 0:
#         await sb_insert(
#             "categories",
#             [
#                 {
#                     **n,
#                     "id": n.get("id", str(uuid.uuid4())),
#                     "kind": "besoin",
#                     "created_at": now_iso(),
#                 }
#                 for n in NEEDS
#             ],
#         )

#     if await sb_count("categories", {"kind": "produit"}) == 0:
#         await sb_insert(
#             "categories",
#             [
#                 {
#                     **c,
#                     "id": c.get("id", str(uuid.uuid4())),
#                     "kind": "produit",
#                     "created_at": now_iso(),
#                 }
#                 for c in PRODUCT_CATEGORIES
#             ],
#         )

#     if await sb_count("reviews") == 0:
#         await sb_insert(
#             "reviews",
#             [
#                 {
#                     **r,
#                     "id": r.get("id", str(uuid.uuid4())),
#                     "created_at": r.get("created_at", now_iso()),
#                 }
#                 for r in REVIEWS
#             ],
#         )

#     if await sb_count("guides") == 0:
#         await sb_insert(
#             "guides",
#             [
#                 {
#                     **g,
#                     "id": g.get("id", str(uuid.uuid4())),
#                     "created_at": g.get("created_at", now_iso()),
#                 }
#                 for g in GUIDES
#             ],
#         )

#     if await sb_count("experts") == 0:
#         await sb_insert(
#             "experts",
#             [
#                 {
#                     **e,
#                     "id": e.get("id", str(uuid.uuid4())),
#                     "created_at": e.get("created_at", now_iso()),
#                 }
#                 for e in EXPERTS
#             ],
#         )


@api_router.get("")
@api_router.get("/")
async def root():
    return {"service": "baume-api", "status": "ok"}


# ---------- Auth test routes ----------


@api_router.get("/me")
async def me(profile=Depends(get_current_profile)):
    return profile


@api_router.get("/admin/test")
async def admin_test(profile=Depends(require_admin)):
    return {"message": "Admin OK", "user": profile}


# ---------- Products ----------


@api_router.get("/products", response_model=List[Product])
async def list_products(
    category: Optional[str] = None,
    need: Optional[str] = None,
    flux: Optional[str] = None,
    usage: Optional[str] = None,
    size: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    available: Optional[bool] = None,
    bestseller: Optional[bool] = None,
    featured: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = Query(1000, gt=0, le=1000),
):
    def run():
        q = supabase.table("products").select("*")
        q = q.eq("status", "active")
        if category:
            q = q.eq("product_category", category)
        if need:
            q = q.filter("needs", "cs", f'["{need}"]')
        if flux:
            q = q.eq("flux", flux)
        if usage:
            q = q.eq("usage", usage)
        if size:
            q = q.filter("sizes", "cs", f'["{size}"]')
        if available is not None:
            q = q.eq("available", available)
        if bestseller is not None:
            q = q.eq("bestseller", bestseller)
        if featured is not None:
            q = q.eq("featured", featured)
        if min_price is not None:
            q = q.gte("price", min_price)
        if max_price is not None:
            q = q.lte("price", max_price)
        if search:
            s = f"%{search}%"
            q = q.or_(f"name.ilike.{s},tagline.ilike.{s},description.ilike.{s}")

        return q.limit(limit).execute()

    result = await asyncio.to_thread(run)
    return result.data or []


@api_router.get("/products/{slug}", response_model=Product)
async def get_product(slug: str):
    doc = await sb_select_one("products", "slug", slug)

    if not doc:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    # ← ajouter
    if doc.get("status") not in ("active", None):
        raise HTTPException(status_code=404, detail="Produit introuvable")

    return doc


@api_router.get("/products/{product_id}/full")
async def get_product_full(product_id: str):
    product = await sb_select_one("products", "id", product_id)

    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    variants = await asyncio.to_thread(
        lambda: supabase.table("product_variants")
        .select("*")
        .eq("product_id", product_id)
        .execute()
    )

    images = await asyncio.to_thread(
        lambda: supabase.table("product_images")
        .select("*")
        .eq("product_id", product_id)
        .order("position")
        .execute()
    )

    options = await asyncio.to_thread(
        lambda: supabase.table("product_options")
        .select("*, product_option_values(*)")
        .eq("product_id", product_id)
        .execute()
    )

    return {
        **product,
        "variants": variants.data or [],
        "images": images.data or [],
        "options": options.data or [],
    }


@api_router.get("/products/{product_id}/variants")
async def list_product_variants(product_id: str):
    result = await asyncio.to_thread(
        lambda: supabase.table("product_variants")
        .select("*")
        .eq("product_id", product_id)
        .eq("active", True)
        .execute()
    )
    return result.data or []


@api_router.get("/products/{product_id}/images")
async def list_product_images(product_id: str):
    result = await asyncio.to_thread(
        lambda: supabase.table("product_images")
        .select("*")
        .eq("product_id", product_id)
        .order("position")
        .execute()
    )
    return result.data or []


# ---------- Categories / Reviews / Guides / Experts ----------


@api_router.get("/categories")
async def list_categories(kind: Optional[str] = None):
    def run():
        q = supabase.table("categories").select("*")
        if kind:
            q = q.eq("kind", kind)
        return q.execute()

    result = await asyncio.to_thread(run)
    return result.data or []


@api_router.get("/categories/{kind}/{slug}")
async def get_category(kind: str, slug: str):
    def run():
        return (
            supabase.table("categories")
            .select("*")
            .eq("kind", kind)
            .eq("slug", slug)
            .limit(1)
            .execute()
        )

    result = await asyncio.to_thread(run)

    if not result.data:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")

    return result.data[0]


@api_router.get("/reviews")
async def list_reviews(product_id: Optional[str] = None, limit: int = 20):
    def run():
        q = supabase.table("reviews").select("*").eq("status", "published")
        if product_id:
            q = q.eq("product_id", product_id)
        return q.order("created_at", desc=True).limit(limit).execute()

    result = await asyncio.to_thread(run)
    return result.data or []


# ── après list_reviews, avant list_guides ────────────────────────────────────
async def _customer_bought_product(customer_id: str, product_id: str) -> Optional[dict]:
    # 1. Récupérer les order_ids appartenant à ce customer
    orders_res = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("id")
        .eq("customer_id", customer_id)
        .execute()
    )
    order_ids = [o["id"] for o in (orders_res.data or [])]

    if not order_ids:
        return None

    # 2. Chercher un order_item sur ce produit dans ces commandes
    result = await asyncio.to_thread(
        lambda: supabase.table("order_items")
        .select("*, orders!inner(id, customer_id, status)")
        .eq("product_id", product_id)
        .in_("order_id", order_ids)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def _recalc_product_rating(product_id: str):
    result = await asyncio.to_thread(
        lambda: supabase.table("reviews")
        .select("rating")
        .eq("product_id", product_id)
        .eq("status", "published")
        .execute()
    )
    rows = result.data or []
    count = len(rows)
    avg = round(sum(r["rating"] for r in rows) / count, 2) if count else 0.0
    await sb_update(
        "products",
        {"rating": avg, "reviews_count": count, "updated_at": now_iso()},
        "id",
        product_id,
    )


@api_router.get("/products/{product_id}/order-status")
async def get_product_order_status(
    product_id: str,
    profile=Depends(get_current_profile),
):
    # Les avis sont ouverts à toutes les personnes connectées : l'achat
    # n'est plus obligatoire. On renvoie quand même l'info "a commandé"
    # pour afficher le badge « Achat vérifié ».
    customer = await get_or_create_customer(profile)
    order_item = await _customer_bought_product(customer["id"], product_id)

    order_summary = (
        {
            "id": order_item["orders"]["id"],
            "status": order_item["orders"]["status"],
        }
        if order_item
        else None
    )

    review_result = await asyncio.to_thread(
        lambda: supabase.table("reviews")
        .select("*")
        .eq("product_id", product_id)
        .eq("customer_id", customer["id"])
        .limit(1)
        .execute()
    )

    return {
        "has_ordered": bool(order_item),
        "can_review": True,
        "order": order_summary,
        "review": review_result.data[0] if review_result.data else None,
    }


@api_router.post("/reviews")
async def submit_review(
    payload: ReviewSubmitRequest,
    profile=Depends(get_current_profile),
):
    customer = await get_or_create_customer(profile)
    customer_id = customer["id"]

    # L'achat n'est plus obligatoire pour laisser un avis. S'il existe,
    # l'avis est simplement marqué « Achat vérifié ».
    product = await sb_select_one("products", "id", payload.product_id, "id")
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    order_item = await _customer_bought_product(customer_id, payload.product_id)

    existing = await asyncio.to_thread(
        lambda: supabase.table("reviews")
        .select("id")
        .eq("product_id", payload.product_id)
        .eq("customer_id", customer_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409, detail="Vous avez déjà laissé un avis pour ce produit."
        )

    first = profile.get("first_name") or ""
    last = profile.get("last_name") or ""
    author = f"{first} {last}".strip() or profile.get("email", "Cliente")

    review = {
        "id": str(uuid.uuid4()),
        "product_id": payload.product_id,
        "customer_id": customer_id,
        "order_id": order_item["orders"]["id"] if order_item else None,
        "author": author,
        "rating": payload.rating,
        "title": payload.title,
        "body": payload.body,
        "images": [],
        "verified_purchase": bool(order_item),
        "status": "pending",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    inserted = await sb_insert("reviews", review)
    return inserted.data[0]


@api_router.patch("/reviews/{review_id}")
async def update_review(
    review_id: str,
    payload: ReviewUpdateRequest,
    profile=Depends(get_current_profile),
):
    customer = await get_or_create_customer(profile)
    review = await sb_select_one("reviews", "id", review_id)

    if not review:
        raise HTTPException(status_code=404, detail="Avis introuvable")
    if review.get("customer_id") != customer["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["status"] = "pending"
    updates["updated_at"] = now_iso()

    await sb_update("reviews", updates, "id", review_id)
    return await sb_select_one("reviews", "id", review_id)


@api_router.post("/reviews/{review_id}/images")
async def upload_review_images(
    review_id: str,
    files: List[UploadFile] = File(...),
    profile=Depends(get_current_profile),
):
    customer = await get_or_create_customer(profile)
    review = await sb_select_one("reviews", "id", review_id)

    if not review:
        raise HTTPException(status_code=404, detail="Avis introuvable")
    if review.get("customer_id") != customer["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    current_images: list = review.get("images") or []

    if len(current_images) + len(files) > 4:
        raise HTTPException(status_code=400, detail=f"Limite de 4 photos atteinte.")

    uploaded_urls = []
    for f in files:
        if not f.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400, detail=f"{f.filename} n'est pas une image valide."
            )

        data = await f.read()
        path = f"reviews/{review_id}/{uuid.uuid4()}-{f.filename}"

        await asyncio.to_thread(
            lambda p=path, d=data, ct=f.content_type: supabase.storage.from_(
                "review-images"
            ).upload(p, d, {"content-type": ct})
        )

        uploaded_urls.append(
            supabase.storage.from_("review-images").get_public_url(path)
        )

    new_images = current_images + uploaded_urls
    await sb_update(
        "reviews", {"images": new_images, "updated_at": now_iso()}, "id", review_id
    )
    return {"images": new_images}


@api_router.delete("/reviews/{review_id}")
async def delete_review(
    review_id: str,
    profile=Depends(get_current_profile),
):
    customer = await get_or_create_customer(profile)
    review = await sb_select_one("reviews", "id", review_id)

    if not review:
        raise HTTPException(status_code=404, detail="Avis introuvable")

    if profile.get("role") != "admin" and review.get("customer_id") != customer["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    await sb_delete("reviews", "id", review_id)
    await _recalc_product_rating(review["product_id"])
    return {"status": "deleted"}


@api_router.patch("/ecom/admin/reviews/{review_id}/moderate")
async def moderate_review(
    review_id: str,
    payload: dict,
    profile=Depends(require_admin),
):
    new_status = payload.get("status")
    if new_status not in ("published", "rejected"):
        raise HTTPException(
            status_code=400, detail="Statut invalide. Valeurs : published, rejected"
        )

    review = await sb_select_one("reviews", "id", review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Avis introuvable")

    await sb_update(
        "reviews", {"status": new_status, "updated_at": now_iso()}, "id", review_id
    )
    await _recalc_product_rating(review["product_id"])
    return {"status": new_status, "review_id": review_id}


@api_router.get("/guides")
async def list_guides(limit: int = 20):
    result = await asyncio.to_thread(
        lambda: supabase.table("guides").select("*").limit(limit).execute()
    )
    return result.data or []


@api_router.get("/guides/{slug}")
async def get_guide(slug: str):
    doc = await sb_select_one("guides", "slug", slug)

    if not doc:
        raise HTTPException(status_code=404, detail="Guide introuvable")

    return doc


@api_router.get("/experts")
async def list_experts():
    result = await asyncio.to_thread(
        lambda: supabase.table("experts").select("*").limit(50).execute()
    )
    return result.data or []


# ---------- Contact ----------


@api_router.post("/contact")
@limiter.limit("10/minute")
async def submit_contact(request: Request, payload: ContactRequest):
    msg = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "email": payload.email,
        "subject": payload.subject,
        "message": payload.message,
        "topic": payload.topic,
        "created_at": now_iso(),
    }

    await sb_insert("contact_messages", msg)

    await send_contact_notification(
        name=payload.name,
        email=payload.email,
        subject=payload.subject,
        topic=payload.topic or "",
        message=payload.message,
    )

    await send_contact_acknowledgement(
        to_email=payload.email,
        name=payload.name,
    )

    return {
        "status": "ok",
        "id": msg["id"],
        "message": "Message enregistré. Nos expertes vous répondent sous peu.",
    }


# ---------- Customer / Addresses / Cart ----------


@api_router.get("/customers/me")
async def get_my_customer(profile=Depends(get_current_profile)):
    return await get_or_create_customer(profile)


@api_router.get("/addresses")
async def list_my_addresses(profile=Depends(get_current_profile)):
    customer = await get_or_create_customer(profile)

    result = await asyncio.to_thread(
        lambda: supabase.table("addresses")
        .select("*")
        .eq("customer_id", customer["id"])
        .execute()
    )

    return result.data or []


@api_router.get("/cart")
async def get_cart(profile=Depends(get_current_profile)):
    customer = await get_or_create_customer(profile)

    result = await asyncio.to_thread(
        lambda: supabase.table("carts")
        .select("*, cart_items(*, product_variants(*))")
        .eq("customer_id", customer["id"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else {}


# ---------- Orders ----------


@api_router.get("/orders/mine")
async def my_orders(profile=Depends(get_current_profile)):
    customer = await get_or_create_customer(profile)
    email = profile.get("email", "")

    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*, order_items(*), payments(*)")
        .or_(f"customer_id.eq.{customer['id']},email.eq.{email}")
        .order("created_at", desc=True)
        .execute()
    )

    return result.data or []


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, profile=Depends(get_current_profile)):
    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*, order_items(*)")
        .eq("id", order_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    order = result.data[0]

    is_admin = profile.get("role") == "admin"

    if not is_admin:
        customer = await get_or_create_customer(profile)

        owns_by_customer_id = order.get("customer_id") == customer.get("id")
        owns_by_email = order.get("email") == profile.get("email")

        if not owns_by_customer_id and not owns_by_email:
            raise HTTPException(status_code=403, detail="Accès refusé")

    order["items"] = order.get("order_items", [])

    return order


@api_router.get("/orders/{order_id}/full")
async def get_order_full(order_id: str, profile=Depends(get_current_profile)):
    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*, order_items(*), payments(*), refunds(*)")
        .eq("id", order_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    order = result.data[0]

    is_admin = profile.get("role") == "admin"

    if not is_admin:
        customer = await get_or_create_customer(profile)

        owns_by_customer_id = order.get("customer_id") == customer.get("id")
        owns_by_email = order.get("email") == profile.get("email")

        if not owns_by_customer_id and not owns_by_email:
            raise HTTPException(status_code=403, detail="Accès refusé")

    order["items"] = order.get("order_items", [])

    return order


# ---------- Stripe Checkout ----------

SHIPPING_RULES = {
    "CH": {"fee": 6.90, "threshold": 60.0},
    "default": {"fee": 12.90, "threshold": 90.0},
}

EU_COUNTRIES = {"FR", "BE", "DE", "IT", "ES", "AT", "NL", "LU"}


async def _price_cart(items: list[dict]) -> dict:
    if not items:
        raise HTTPException(status_code=400, detail="Le panier est vide.")

    subtotal = Decimal("0.00")
    priced_items = []

    # Cumuler les quantités par variante pour empêcher
    # de contourner le contrôle de stock.
    quantities_by_variant = {}
    prepared = []

    for item in items:
        product_id = item.get("product_id")
        variant_id = item.get("variant_id")
        qty = int(item["quantity"])

        if qty < 1 or qty > 100:
            raise HTTPException(status_code=400, detail="Quantité invalide.")

        product = await sb_select_one("products", "id", product_id)

        if not product or product.get("status") != "active":
            raise HTTPException(status_code=400, detail="Produit indisponible.")

        if variant_id:
            variant = await sb_select_one("product_variants", "id", variant_id)

            if not variant:
                raise HTTPException(status_code=404, detail="Variante introuvable.")

            if variant["product_id"] != product_id:
                raise HTTPException(
                    status_code=400, detail="La variante ne correspond pas au produit."
                )
        else:
            result = await asyncio.to_thread(
                lambda: supabase.table("product_variants")
                .select("*")
                .eq("product_id", product_id)
                .eq("active", True)
                .order("created_at")
                .limit(1)
                .execute()
            )

            if not result.data:
                raise HTTPException(
                    status_code=400, detail="Aucune variante disponible."
                )

            variant = result.data[0]
            variant_id = variant["id"]

        if not variant.get("active") or not variant.get("available"):
            raise HTTPException(status_code=400, detail="Variante indisponible.")

        quantities_by_variant[variant_id] = (
            quantities_by_variant.get(variant_id, 0) + qty
        )

        unit_price = Decimal(
            str(
                variant.get("price")
                if variant.get("price") is not None
                else product.get("price") or 0
            )
        )

        if not unit_price.is_finite() or unit_price <= 0:
            raise HTTPException(status_code=400, detail="Prix du produit invalide.")

        prepared.append(
            {
                "product": product,
                "variant": variant,
                "variant_id": variant_id,
                "quantity": qty,
                "unit_price": unit_price,
                "size": item.get("size"),
                "color": item.get("color"),
            }
        )

    # Contrôler le total demandé pour chaque variante.
    for row in prepared:
        variant = row["variant"]
        variant_id = row["variant_id"]
        total_requested = quantities_by_variant[variant_id]

        if total_requested > int(variant.get("stock") or 0):
            raise HTTPException(
                status_code=400, detail="Stock insuffisant pour une variante."
            )

    # Construire le panier exclusivement depuis les
    # informations vérifiées dans Supabase.
    for row in prepared:
        product = row["product"]
        variant = row["variant"]
        qty = row["quantity"]
        unit_price = row["unit_price"]

        total_price = unit_price * qty
        subtotal += total_price

        product_name = product.get("name") or product.get("title") or "Produit"

        priced_items.append(
            {
                "product_id": product["id"],
                "variant_id": variant["id"],
                "name": product_name,
                "product_title": product_name,
                "quantity": qty,
                "size": row["size"],
                "color": row["color"],
                "sku": variant.get("sku"),
                "unit_price": float(unit_price),
                "total_price": float(total_price),
            }
        )

    return {
        "items": priced_items,
        "subtotal": float(subtotal),
    }


@api_router.post("/checkout/session")
@limiter.limit("10/minute")
async def create_checkout(
    request: Request, payload: CheckoutRequest
):  # ← http_request → request
    if os.environ.get("CHECKOUT_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=503, detail="Paiement temporairement indisponible."
        )

    if not STRIPE_API_KEY.startswith("sk_test_"):
        raise HTTPException(
            status_code=503, detail="Seul Stripe en mode test est autorisé."
        )
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")

    user = await get_optional_user(request)  # ← http_request → request
    user_id = auth_user_id(user)
    user_email = auth_user_email(user)

    country = (payload.shipping_country or "CH").upper()

    if country not in {"CH"} | EU_COUNTRIES:
        raise HTTPException(status_code=400, detail="Pays non desservi")

    # ── Pricer le panier ──────────────────────────────────────────────────
    priced = await _price_cart([item.model_dump() for item in payload.items])

    # ── Calcul livraison ──────────────────────────────────────────────────
    shipping_rules = SHIPPING_RULES.get(country, SHIPPING_RULES["default"])
    shipping = (
        0.0
        if priced["subtotal"] >= shipping_rules["threshold"]
        else shipping_rules["fee"]
    )

    # ── Calcul réduction ──────────────────────────────────────────────────

    # ── Réservation atomique de la réduction ─────────────────────────
    subtotal = Decimal(str(priced["subtotal"]))
    shipping_amount = Decimal(str(shipping))

    discount_amount = Decimal("0.00")
    discount_code = None
    reservation_id = None

    if payload.discount_code:
        code = payload.discount_code.strip().upper()

        if not code or len(code) > 80:
            raise HTTPException(
                status_code=400,
                detail="Code promo invalide",
            )

        try:
            result = await asyncio.to_thread(
                lambda: supabase.rpc(
                    "reserve_checkout_discount",
                    {
                        "p_code": code,
                        "p_profile_id": user_id,
                        "p_subtotal": str(subtotal),
                    },
                ).execute()
            )
        except Exception:
            logger.exception("Réservation du coupon refusée")
            raise HTTPException(
                status_code=400,
                detail=(
                    "Coupon invalide, expiré, déjà réservé "
                    "ou non autorisé pour votre compte."
                ),
            )

        reserved = result.data

        if not isinstance(reserved, dict):
            raise HTTPException(
                status_code=503,
                detail="Réservation du coupon indisponible",
            )

        reservation_id = reserved["reservation_id"]
        discount_code = reserved["discount_code"]
        discount_amount = Decimal(str(reserved["discount_amount"]))

    total_decimal = (subtotal - discount_amount + shipping_amount).quantize(
        Decimal("0.01")
    )

    if total_decimal <= 0:
        if reservation_id:
            await asyncio.to_thread(
                lambda: supabase.rpc(
                    "release_unattached_discount",
                    {"p_reservation_id": reservation_id},
                ).execute()
            )

        raise HTTPException(
            status_code=400,
            detail="Montant à payer invalide",
        )

    discount_amount = float(discount_amount)
    total = float(total_decimal)

    success_url = (
        f"{FRONTEND_URL}/commande/confirmation" "?session_id={CHECKOUT_SESSION_ID}"
    )

    cancel_url = f"{FRONTEND_URL}/commande/confirmation" "?cancelled=true"

    email = payload.email or user_email

    metadata = {
        "source": "baume_checkout",
        "country": country,
        "email": email or "",
        "user_id": user_id or "",
        "items_count": str(sum(i.quantity for i in payload.items)),
        "discount_code": discount_code or "",
        "discount_amount": str(discount_amount),
    }

    # ── Coupon Stripe ─────────────────────────────────────────────────────
    stripe_coupon_id = None
    if discount_amount > 0 and discount_code:
        try:
            coupon = await asyncio.to_thread(
                stripe.Coupon.create,
                amount_off=int(round(discount_amount * 100)),
                currency="chf",
                duration="once",
                name=f"Fidélité {str(discount_code)[:20]}",
                max_redemptions=1,
            )
            stripe_coupon_id = coupon.id

        except Exception:
            logger.exception("Impossible de créer le coupon Stripe")

            if reservation_id:
                await asyncio.to_thread(
                    lambda: supabase.rpc(
                        "release_unattached_discount",
                        {
                            "p_reservation_id": reservation_id,
                        },
                    ).execute()
                )

            raise HTTPException(
                status_code=503,
                detail=(
                    "Impossible d'appliquer la réduction "
                    "pour le moment. Veuillez réessayer."
                ),
            )

    # ── Line items Stripe ─────────────────────────────────────────────────
    stripe_line_items = [
        {
            "price_data": {
                "currency": "chf",
                "product_data": {
                    "name": item["name"],
                    **({"description": item["size"]} if item.get("size") else {}),
                },
                "unit_amount": int(round(item["unit_price"] * 100)),
            },
            "quantity": item["quantity"],
        }
        for item in priced["items"]
    ]

    if shipping > 0:
        stripe_line_items.append(
            {
                "price_data": {
                    "currency": "chf",
                    "product_data": {"name": "Livraison"},
                    "unit_amount": int(round(shipping * 100)),
                },
                "quantity": 1,
            }
        )

    # ── Créer session Stripe ──────────────────────────────────────────────
    session_params = dict(
        mode="payment",
        payment_method_types=["card", "klarna", "twint", "link"],
        customer_email=email or None,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        line_items=stripe_line_items,
        expires_at=int(time.time()) + (30 * 60),
    )

    if stripe_coupon_id:
        session_params["discounts"] = [{"coupon": stripe_coupon_id}]

    try:
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            **session_params,
            idempotency_key=(
                f"baume-checkout-{reservation_id}"
                if reservation_id
                else str(uuid.uuid4())
            ),
        )

    except Exception:
        logger.exception("Impossible de créer la session Stripe")

        # En cas de problème réseau, Stripe a peut-être
        # créé la session malgré l'absence de réponse.
        # Ne pas libérer automatiquement le coupon :
        # cette situation nécessite une réconciliation.

        raise HTTPException(
            status_code=503,
            detail="Création du paiement indisponible",
        )

    # ── Sauvegarder la transaction ────────────────────────────────────────
    tx = {
        "id": str(uuid.uuid4()),
        "session_id": session.id,
        "amount": total,
        "subtotal": priced["subtotal"],
        "shipping": shipping,
        "discount_code": discount_code,
        "discount_amount": discount_amount,
        "currency": "chf",
        "email": email,
        "user_id": user_id,
        "country": country,
        "items": priced["items"],
        "shipping_address": payload.shipping_address or {},
        "status": "initiated",
        "payment_status": "pending",
        "metadata": metadata,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    try:
        await sb_insert("payment_transactions", tx)

    except Exception:
        logger.exception(
            "Impossible d'enregistrer la transaction %s",
            session.id,
        )

        # La session ne doit pas être remise au client.
        # Confirmer son expiration avant de libérer
        # la réservation.
        try:
            await asyncio.to_thread(
                stripe.checkout.Session.expire,
                session.id,
            )

            if reservation_id:
                await asyncio.to_thread(
                    lambda: supabase.rpc(
                        "release_unattached_discount",
                        {"p_reservation_id": reservation_id},
                    ).execute()
                )

        except Exception:
            logger.exception(
                "Expiration ou libération à vérifier : %s",
                session.id,
            )

        raise HTTPException(
            status_code=503,
            detail="Impossible de préparer le paiement",
        )

    # Associer le coupon à la session Stripe
    # uniquement après l'enregistrement de la transaction.
    if reservation_id:
        try:
            await asyncio.to_thread(
                lambda: supabase.rpc(
                    "attach_discount_session",
                    {
                        "p_reservation_id": reservation_id,
                        "p_session_id": session.id,
                        "p_expires_at": datetime.fromtimestamp(
                            session.expires_at,
                            tz=timezone.utc,
                        ).isoformat(),
                    },
                ).execute()
            )

        except Exception:
            logger.exception(
                "Impossible de rattacher le coupon : %s",
                session.id,
            )

            try:
                await asyncio.to_thread(
                    stripe.checkout.Session.expire,
                    session.id,
                )

                await asyncio.to_thread(
                    lambda: supabase.rpc(
                        "release_unattached_discount",
                        {"p_reservation_id": reservation_id},
                    ).execute()
                )

            except Exception:
                logger.exception(
                    "Réservation à vérifier manuellement : %s",
                    reservation_id,
                )

            raise HTTPException(
                status_code=503,
                detail="Impossible de rattacher le coupon au paiement",
            )

    return {
        "url": session.url,
        "session_id": session.id,
        "total": total,
    }

    return {
        "url": session.url,
        "session_id": session.id,
        "total": total,
    }


async def _decrease_stock_for_order(order: dict):
    items = order.get("items", [])

    if not items:
        logger.info(
            f"No line items found for order {order.get('id')}, stock decrement skipped."
        )
        return

    for item in items:
        product_id = item.get("product_id")
        quantity = int(item.get("quantity", 0))

        if not product_id or quantity <= 0:
            continue

        product = await sb_select_one("products", "id", product_id)

        if not product:
            logger.warning(f"Product {product_id} not found during stock decrement.")
            continue

        # Shopify-like inventory tables are variant-based.
        # If no variant_id exists yet, we update products.stock only.
        variant_id = item.get("variant_id")

        if not variant_id:
            logger.info(
                f"No variant_id for product {product_id}; inventory_movements skipped."
            )
            continue

        inventory_item = await sb_select_one(
            "inventory_items", "variant_id", variant_id
        )

        if not inventory_item:
            logger.info(
                f"No inventory_item for variant {variant_id}; inventory_movements skipped."
            )
            continue

        movement_exists = await asyncio.to_thread(
            lambda: supabase.table("inventory_movements")
            .select("id")
            .eq("inventory_item_id", inventory_item["id"])
            .eq("reference_id", order["id"])
            .eq("reference_type", "order")
            .limit(1)
            .execute()
        )

        if movement_exists.data:
            continue

        await sb_insert(
            "inventory_movements",
            {
                "inventory_item_id": inventory_item["id"],
                "location_id": None,
                "change_quantity": -quantity,
                "reason": "order_created",
                "reference_type": "order",
                "reference_id": order["id"],
                "note": f"Stock décrémenté automatiquement pour commande {order['id']}",
                "created_at": now_iso(),
            },
        )


async def _ensure_order_from_tx(session_id: str):
    tx = await sb_select_one("payment_transactions", "session_id", session_id)

    if not tx:
        raise RuntimeError(f"Transaction introuvable : {session_id}")

    # Vérification indépendante auprès de Stripe.
    session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)

    if session.payment_status != "paid":
        return None

    expected_amount = int((Decimal(str(tx["amount"])) * 100).quantize(Decimal("1")))

    if session.amount_total != expected_amount:
        raise RuntimeError("Montant Stripe différent du montant enregistré")

    if session.currency.lower() != tx["currency"].lower():
        raise RuntimeError("Devise Stripe différente de la transaction")

    # Une ancienne commande créée par la Edge Function
    # ne doit pas être finalisée automatiquement.
    existing_order = await sb_select_one(
        "orders",
        "stripe_checkout_session_id",
        session_id,
    )

    if existing_order:
        payments_result = await asyncio.to_thread(
            lambda: supabase.table("payments")
            .select("id")
            .eq("order_id", existing_order["id"])
            .eq("status", "paid")
            .limit(1)
            .execute()
        )

        if not payments_result.data:
            logger.error(
                "Commande existante incomplète : %s",
                existing_order["id"],
            )
            raise RuntimeError(
                "Commande existante sans paiement enregistré : "
                "réparation manuelle nécessaire."
            )

    customer_id = None

    # Retrouver ou créer uniquement le client
    # correspondant au compte authentifié à l'achat.
    if tx.get("user_id"):
        profile = await sb_select_one("profiles", "id", tx["user_id"])

        if profile:
            customer = await get_or_create_customer(profile)
            customer_id = customer["id"]

    await sb_update(
        "payment_transactions",
        {"payment_status": "paid", "updated_at": now_iso()},
        "session_id",
        session_id,
    )

    # Une seule transaction PostgreSQL crée la commande,
    # ses articles, le paiement et déduit le stock.
    result = await asyncio.to_thread(
        lambda: supabase.rpc(
            "finalize_paid_order",
            {
                "p_session_id": session_id,
                "p_payment_intent_id": (session.payment_intent),
                "p_customer_id": customer_id,
            },
        ).execute()
    )

    order_id = result.data

    if not order_id:
        raise RuntimeError("La finalisation de la commande a échoué")

    return await sb_select_one("orders", "id", order_id)


@api_router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe non configuré")

    tx = await sb_select_one("payment_transactions", "session_id", session_id)

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable")

    # Vérification en lecture seule auprès de Stripe.
    try:
        session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
    except Exception:
        logger.exception("Impossible de lire la session Stripe %s", session_id)
        raise HTTPException(
            status_code=503, detail="Statut de paiement temporairement indisponible"
        )

    # Consulter la commande existante.
    # Ne jamais en créer depuis cette route.
    order = await sb_select_one(
        "orders", "stripe_checkout_session_id", session_id, select="id,status"
    )

    payment_paid = session.payment_status == "paid"
    order_ready = (
        payment_paid
        and order is not None
        and order.get("status")
        in ("paid", "processing", "shipped", "delivered", "refunded")
    )

    return {
        "status": session.status,
        "payment_status": session.payment_status,
        "amount_total": session.amount_total,
        "currency": session.currency,
        "order_ready": order_ready,
        "order_id": order["id"] if order_ready else None,
        "order_status": (order["status"] if order else None),
    }


# ============================================================
# BAUME — STRIPE
# SYNCHRONISATION DES REMBOURSEMENTS
#
# Un remboursement partiel ne signifie pas que
# la commande entière est remboursée.
#
# Le montant Stripe est exprimé en centimes.
# ============================================================


async def sync_stripe_refund(refund):
    refund_id = refund.get("id")
    payment_intent_id = refund.get("payment_intent")
    charge_id = refund.get("charge")

    if not refund_id:
        logger.warning("Remboursement Stripe reçu sans identifiant.")
        return

    # Certains objets Refund contiennent uniquement
    # le charge_id. On récupère alors le PaymentIntent.
    if not payment_intent_id and charge_id:
        charge = await asyncio.to_thread(
            stripe.Charge.retrieve,
            charge_id,
        )
        payment_intent_id = charge.get("payment_intent")

    if not payment_intent_id:
        logger.warning(f"PaymentIntent introuvable pour refund={refund_id}")
        return

    order_result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("id,total,currency,payments(id)")
        .eq(
            "stripe_payment_intent_id",
            payment_intent_id,
        )
        .limit(1)
        .execute()
    )

    if not order_result.data:
        logger.warning(f"Commande introuvable pour refund={refund_id}")
        return

    order = order_result.data[0]

    payments = order.get("payments") or []
    payment_id = payments[0]["id"] if payments else None

    refund_amount = Decimal(str(refund.get("amount") or 0)) / Decimal("100")

    refund_status = refund.get("status") or "pending"

    refund_data = {
        "order_id": order["id"],
        "payment_id": payment_id,
        "stripe_refund_id": refund_id,
        "amount": float(refund_amount),
        "currency": (refund.get("currency") or order.get("currency") or "CHF").upper(),
        "status": refund_status,
        "reason": (refund.get("reason") or "Remboursement Stripe"),
    }

    # --------------------------------------------------------
    # 1. CRÉER OU ACTUALISER LE REMBOURSEMENT
    # --------------------------------------------------------

    existing = await sb_select_one(
        "refunds",
        "stripe_refund_id",
        refund_id,
    )

    if existing:
        await sb_update(
            "refunds",
            refund_data,
            "stripe_refund_id",
            refund_id,
        )
    else:
        await sb_insert(
            "refunds",
            {
                "id": str(uuid.uuid4()),
                **refund_data,
                "created_at": now_iso(),
            },
        )

    # --------------------------------------------------------
    # 2. RECALCULER LE TOTAL DES REMBOURSEMENTS RÉUSSIS
    #
    # Les remboursements échoués ou en attente
    # ne doivent pas diminuer le CA réalisé.
    # --------------------------------------------------------

    refund_rows = await stats_fetch_all(
        lambda: supabase.table("refunds")
        .select("amount,status")
        .eq("order_id", order["id"])
        .order("id")
    )

    total_refunded = sum(
        (
            Decimal(str(row.get("amount") or 0))
            for row in refund_rows
            if row.get("status") == "succeeded"
        ),
        Decimal("0"),
    )

    order_total = Decimal(str(order.get("total") or 0))

    # --------------------------------------------------------
    # 3. MODIFIER LE STATUT UNIQUEMENT SI LE
    # REMBOURSEMENT EST INTÉGRAL
    # --------------------------------------------------------

    if order_total > 0 and total_refunded >= order_total:
        await sb_update(
            "orders",
            {
                "status": "refunded",
                "updated_at": now_iso(),
            },
            "id",
            order["id"],
        )

    logger.info(
        f"Remboursement synchronisé : {refund_id}, "
        f"statut={refund_status}, "
        f"total remboursé={total_refunded}"
    )


async def finish_stripe_event(event_id: str, claim_token: str):
    result = await asyncio.to_thread(
        lambda: supabase.table("stripe_webhook_events")
        .update(
            {
                "processing_status": "processed",
                "processed_at": now_iso(),
            }
        )
        .eq("event_id", event_id)
        .eq("claim_token", claim_token)
        .eq("processing_status", "processing")
        .execute()
    )

    if not result.data:
        raise RuntimeError(f"Impossible de finaliser le webhook {event_id}")


async def release_coupon_after_stripe_failure(
    session_id: str,
    event_type: str,
) -> bool:
    """
    Libère un coupon uniquement après vérification
    du statut réel de la session auprès de Stripe.
    """

    session = await asyncio.to_thread(
        stripe.checkout.Session.retrieve,
        session_id,
    )

    # Ne jamais libérer un coupon si Stripe indique
    # que le paiement est confirmé.
    if session.payment_status == "paid":
        logger.warning(
            "Libération refusée : paiement confirmé, session=%s",
            session_id,
        )
        return False

    # Vérifier que l'événement correspond bien à
    # l'état réel de la session.
    if event_type == "checkout.session.expired":
        if session.status != "expired":
            raise RuntimeError(f"Session {session_id} non expirée dans Stripe")

    elif event_type == "checkout.session.async_payment_failed":
        if session.payment_status != "unpaid":
            raise RuntimeError(f"Échec non confirmé pour {session_id}")

    else:
        raise ValueError(f"Événement de libération non autorisé : {event_type}")

    # Seules les transactions de notre boutique
    # peuvent être traitées.
    if (session.metadata or {}).get("source") != "baume_checkout":
        raise RuntimeError(f"Session étrangère à Baume Shop : {session_id}")

    tx = await sb_select_one(
        "payment_transactions",
        "session_id",
        session_id,
    )

    if not tx:
        raise RuntimeError(f"Transaction introuvable : {session_id}")

    if tx.get("payment_status") == "paid":
        logger.warning(
            "Libération refusée : transaction déjà payée, " "session=%s",
            session_id,
        )
        return False

    # Une commande sans coupon ne nécessite
    # aucune libération.
    if not tx.get("discount_code"):
        return False

    result = await asyncio.to_thread(
        lambda: supabase.rpc(
            "release_discount_session",
            {"p_session_id": session_id},
        ).execute()
    )

    released = result.data is True

    logger.info(
        "Libération coupon : session=%s, " "événement=%s, libéré=%s",
        session_id,
        event_type,
        released,
    )

    return released


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    if not STRIPE_API_KEY:
        logger.warning("Webhook called but STRIPE_API_KEY missing")
        raise HTTPException(status_code=503, detail="Stripe non configuré")

    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    if not webhook_secret:
        logger.error("STRIPE_WEBHOOK_SECRET is not set. Rejecting webhook.")
        raise HTTPException(status_code=503, detail="Webhook Stripe non configuré")

    try:
        # Vérifier d'abord la signature Stripe.
        stripe.Webhook.construct_event(
            payload=body,
            sig_header=sig,
            secret=webhook_secret,
        )

        # Utiliser ensuite un dictionnaire Python standard.
        event = json.loads(body)

    except Exception:
        logger.exception("Signature ou événement Stripe invalide")
        raise HTTPException(status_code=400, detail="Événement Stripe invalide")
    event_id = event.get("id")
    event_type = event.get("type", "")
    obj = event.get("data", {}).get("object", {})

    # Les réservations d'ateliers sont gérées
    # exclusivement par la Edge Function Supabase.
    checkout_event_types = {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
    }

    if event_type in checkout_event_types:
        if obj.get("object") != "checkout.session":
            return {
                "received": True,
                "processed": False,
            }

        if (obj.get("metadata") or {}).get("source") != "baume_checkout":
            logger.info(
                "Session non e-commerce ignorée : %s",
                obj.get("id"),
            )
            return {
                "received": True,
                "processed": False,
                "reason": "not_baume_checkout",
            }

    # Réserver l'événement Stripe de manière atomique.
    if not event_id:
        raise HTTPException(status_code=400, detail="Identifiant Stripe manquant.")

    claim_result = await asyncio.to_thread(
        lambda: supabase.rpc(
            "claim_stripe_event",
            {
                "p_event_id": event_id,
                "p_event_type": event_type,
                "p_session_id": (
                    obj.get("id") if obj.get("object") == "checkout.session" else None
                ),
                "p_payment_status": (obj.get("payment_status") or ""),
            },
        ).execute()
    )

    claim_token = claim_result.data

    if not claim_token:
        previous = await sb_select_one("stripe_webhook_events", "event_id", event_id)

        if previous and previous.get("processing_status") == "processed":
            return {
                "received": True,
                "duplicate": True,
            }

        raise HTTPException(
            status_code=503, detail="Événement déjà en cours de traitement."
        )

    # ── checkout.session.completed ────────────────────────────────────────
    if event_type in (
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
    ):
        if obj.get("object") != "checkout.session":
            await finish_stripe_event(event_id, claim_token)
            return {"received": True, "processed": False}

        session_id = obj.get("id")
        payment_status = obj.get("payment_status", "")

        if not session_id:
            await finish_stripe_event(event_id, claim_token)
            return {"received": True, "processed": False}

        tx = await sb_select_one("payment_transactions", "session_id", session_id)

        if not tx:
            raise RuntimeError(f"Transaction introuvable : {session_id}")

        updates = {
            "last_webhook_event": event_type,
            "last_webhook_event_id": event_id,
            "updated_at": now_iso(),
        }

        # Ne jamais rétrograder un paiement déjà confirmé.
        if tx.get("payment_status") != "paid":
            updates["payment_status"] = (
                "paid"
                if payment_status == "paid"
                else tx.get("payment_status") or "pending"
            )

        await sb_update(
            "payment_transactions",
            updates,
            "session_id",
            session_id,
        )

        if payment_status == "paid":
            order = await _ensure_order_from_tx(session_id)

            logger.info(
                "Order processed for session=%s order_id=%s",
                session_id,
                order.get("id") if order else None,
            )

            if order:
                # Attribuer les points une seule fois
                # grâce à la fonction SQL idempotente.
                loyalty_result = await asyncio.to_thread(
                    lambda: supabase.rpc(
                        "award_paid_order_loyalty",
                        {"p_order_id": order["id"]},
                    ).execute()
                )

                logger.info(
                    "Fidélité : commande=%s, points attribués=%s",
                    order["id"],
                    loyalty_result.data,
                )

                # Parrainage : valider automatiquement au 1er achat payé
                try:
                    ref_result = await _complete_referral_for_order(order)
                    if ref_result:
                        logger.info("Parrainage validé : %s", ref_result)
                except Exception:
                    logger.exception(
                        "Validation parrainage échouée pour order_id=%s",
                        order["id"],
                    )

                # Demander l'envoi de l'e-mail de confirmation.
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        email_response = await client.post(
                            f"{SUPABASE_URL}/functions/v1/send-order-email",
                            json={"order_id": order["id"]},
                            headers={
                                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                                "X-Baume-Internal-Token": os.environ[
                                    "BAUME_INTERNAL_TOKEN"
                                ],
                                "Content-Type": "application/json",
                            },
                        )
                        email_response.raise_for_status()

                    logger.info(
                        "Confirmation email requested for order_id=%s",
                        order["id"],
                    )

                except Exception:
                    logger.exception(
                        "Confirmation email failed for order_id=%s",
                        order["id"],
                    )

    elif event_type == "payment_intent.payment_failed":
        payment_intent_id = obj.get("id")

        if not payment_intent_id:
            raise HTTPException(status_code=400, detail="PaymentIntent manquant.")

        sessions = await asyncio.to_thread(
            stripe.checkout.Session.list, payment_intent=payment_intent_id, limit=1
        )

        if not sessions.data:
            logger.warning(
                "Aucune session Checkout pour " "PaymentIntent %s", payment_intent_id
            )
        else:
            stripe_session = sessions.data[0]
            session_id = stripe_session.id

            if (stripe_session.metadata or {}).get("source") != "baume_checkout":
                await finish_stripe_event(event_id, claim_token)
                return {
                    "received": True,
                    "processed": False,
                }

            tx = await sb_select_one("payment_transactions", "session_id", session_id)

            if not tx:
                # Ne jamais associer cet échec à
                # une autre transaction au hasard.
                raise RuntimeError(f"Transaction absente pour {session_id}")

            if stripe_session.payment_status != "paid":
                # Un échec de tentative de carte n'est
                # pas forcément l'échec définitif du
                # Checkout : la cliente peut réessayer.
                await sb_update(
                    "payment_transactions",
                    {
                        "last_webhook_event": event_type,
                        "last_webhook_event_id": event_id,
                        "updated_at": now_iso(),
                    },
                    "session_id",
                    session_id,
                )

                logger.warning(
                    "Tentative de paiement échouée " "pour la session %s", session_id
                )

    elif event_type == "checkout.session.expired":
        session_id = obj.get("id")

        if not session_id:
            raise HTTPException(
                status_code=400,
                detail="Session Stripe manquante.",
            )

        tx = await sb_select_one(
            "payment_transactions",
            "session_id",
            session_id,
        )

        if not tx:
            raise RuntimeError(f"Transaction absente pour {session_id}")

        stripe_session = await asyncio.to_thread(
            stripe.checkout.Session.retrieve,
            session_id,
        )

        if (
            stripe_session.status != "expired"
            or stripe_session.payment_status == "paid"
        ):
            raise RuntimeError(f"Expiration Stripe non confirmée : {session_id}")

        if tx.get("payment_status") != "paid":
            # Libérer d'abord le coupon. En cas d'échec
            # SQL, Stripe pourra retenter le webhook.
            await release_coupon_after_stripe_failure(
                session_id,
                event_type,
            )

            await sb_update(
                "payment_transactions",
                {
                    "status": "expired",
                    "last_webhook_event": event_type,
                    "last_webhook_event_id": event_id,
                    "updated_at": now_iso(),
                },
                "session_id",
                session_id,
            )

    elif event_type == "checkout.session.async_payment_failed":
        session_id = obj.get("id")

        if not session_id:
            raise HTTPException(status_code=400, detail="Session Stripe manquante.")

        tx = await sb_select_one("payment_transactions", "session_id", session_id)

        if not tx:
            raise RuntimeError(f"Transaction absente pour {session_id}")

        stripe_session = await asyncio.to_thread(
            stripe.checkout.Session.retrieve, session_id
        )

        # Ne jamais rétrograder un paiement déjà confirmé.
        if stripe_session.payment_status != "paid":
            # Libération avant la mise à jour.
            # Si elle échoue, l'événement reste
            # non traité et pourra être retenté.
            await release_coupon_after_stripe_failure(
                session_id,
                event_type,
            )

            await sb_update(
                "payment_transactions",
                {
                    "status": "failed",
                    "payment_status": "unpaid",
                    "last_webhook_event": event_type,
                    "last_webhook_event_id": event_id,
                    "updated_at": now_iso(),
                },
                "session_id",
                session_id,
            )
    # ========================================================
    # BAUME — WEBHOOK : REMBOURSEMENTS STRIPE
    #
    # Les événements refund.* constituent la source
    # principale de synchronisation.
    #
    # charge.refunded n'insère pas de remboursement
    # supplémentaire, afin d'éviter les doublons.
    # ========================================================

    elif event_type in (
        "refund.created",
        "refund.updated",
        "refund.failed",
    ):
        await sync_stripe_refund(obj)

    elif event_type == "charge.refunded":
        # Événement complémentaire.
        # Les remboursements individuels sont enregistrés
        # par les événements refund.*.
        logger.info(
            "charge.refunded reçu : synchronisation "
            "assurée par les événements refund.*"
        )

    # ── charge.dispute.created ────────────────────────────────────────────
    elif event_type == "charge.dispute.created":
        dispute_id = obj.get("id")
        payment_intent_id = obj.get("payment_intent")
        dispute_amount = (obj.get("amount") or 0) / 100
        dispute_reason = obj.get("reason", "unknown")

        logger.error(
            f"⚠️ LITIGE CRÉÉ — dispute_id={dispute_id} "
            f"payment_intent={payment_intent_id} "
            f"montant={dispute_amount} CHF "
            f"raison={dispute_reason}"
        )

        # Mettre la commande en statut spécial si trouvée
        if payment_intent_id:
            order_result = await asyncio.to_thread(
                lambda: supabase.table("orders")
                .select("id")
                .eq("stripe_payment_intent_id", payment_intent_id)
                .limit(1)
                .execute()
            )

            if order_result.data:
                order_id = order_result.data[0]["id"]
                await sb_update(
                    "orders",
                    {
                        "notes": f"⚠️ Litige Stripe ouvert — {dispute_reason} — {dispute_amount} CHF",
                        "updated_at": now_iso(),
                    },
                    "id",
                    order_id,
                )

                # Envoyer un email d'alerte admin
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"{SUPABASE_URL}/functions/v1/send-dispute-alert",
                            json={
                                "order_id": order_id,
                                "dispute_id": dispute_id,
                                "amount": dispute_amount,
                                "reason": dispute_reason,
                            },
                            headers={
                                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                                "Content-Type": "application/json",
                            },
                            timeout=10,
                        )
                except Exception as e:
                    logger.error(f"send-dispute-alert failed: {e}")

    # ── charge.dispute.closed ─────────────────────────────────────────────
    elif event_type == "charge.dispute.closed":
        dispute_id = obj.get("id")
        payment_intent_id = obj.get("payment_intent")
        dispute_status = obj.get("status", "unknown")

        logger.info(
            f"Litige fermé — dispute_id={dispute_id} "
            f"payment_intent={payment_intent_id} "
            f"statut={dispute_status}"
        )

        if payment_intent_id:
            order_result = await asyncio.to_thread(
                lambda: supabase.table("orders")
                .select("id")
                .eq("stripe_payment_intent_id", payment_intent_id)
                .limit(1)
                .execute()
            )

            if order_result.data:
                await sb_update(
                    "orders",
                    {
                        "notes": f"Litige Stripe fermé — statut : {dispute_status}",
                        "updated_at": now_iso(),
                    },
                    "id",
                    order_result.data[0]["id"],
                )

    else:
        logger.info(f"Webhook event non géré : {event_type}")

    await finish_stripe_event(event_id, claim_token)
    return {
        "received": True,
        "processed": True,
        "event_type": event_type,
    }


@api_router.get("/discounts/{code}")
@limiter.limit("20/minute")
async def get_discount(
    request: Request,
    code: str,
):
    code = code.strip().upper()

    if not code or len(code) > 80:
        raise HTTPException(
            status_code=404,
            detail="Code promo invalide",
        )

    # Récupérer uniquement les colonnes nécessaires.
    discount = await sb_select_one(
        "discounts",
        "code",
        code,
        select=(
            "id,code,type,value,active,"
            "starts_at,ends_at,usage_limit,"
            "used_count,min_order_amount,"
            "owner_profile_id"
        ),
    )

    if not discount or not discount.get("active"):
        raise HTTPException(
            status_code=404,
            detail="Code promo invalide",
        )

    owner_id = discount.get("owner_profile_id")

    # Empêcher la consultation des coupons personnels
    # par un autre compte ou un visiteur anonyme.
    if owner_id is not None:
        user = await get_optional_user(request)
        user_id = auth_user_id(user)

        if not user_id or str(user_id) != str(owner_id):
            raise HTTPException(
                status_code=404,
                detail="Code promo invalide",
            )

    # Un coupon fidélité (FIDELITE… ancien format, FID-… nouveau)
    # sans propriétaire ne doit pas être traité comme un code public.
    if code.startswith(("FIDELITE", "FID-")) and not owner_id:
        raise HTTPException(
            status_code=404,
            detail="Code promo invalide",
        )

    now = datetime.now(timezone.utc)

    if discount.get("starts_at"):
        starts_at = datetime.fromisoformat(discount["starts_at"].replace("Z", "+00:00"))

        if starts_at > now:
            raise HTTPException(
                status_code=404,
                detail="Code promo pas encore actif",
            )

    if discount.get("ends_at"):
        ends_at = datetime.fromisoformat(discount["ends_at"].replace("Z", "+00:00"))

        if ends_at <= now:
            raise HTTPException(
                status_code=404,
                detail="Code promo expiré",
            )

    usage_limit = discount.get("usage_limit")
    used_count = int(discount.get("used_count") or 0)

    if usage_limit is not None and used_count >= int(usage_limit):
        raise HTTPException(
            status_code=404,
            detail="Code promo épuisé",
        )

    # Tenir compte des coupons déjà réservés.
    reserved_result = await asyncio.to_thread(
        lambda: supabase.table("discount_reservations")
        .select("id", count="exact")
        .eq("discount_id", discount["id"])
        .eq("status", "reserved")
        .execute()
    )

    reserved_count = reserved_result.count or 0

    if usage_limit is not None and used_count + reserved_count >= int(usage_limit):
        raise HTTPException(
            status_code=409,
            detail="Ce code promo est actuellement réservé",
        )

    # Liste blanche : aucune information interne
    # ou liée au propriétaire n'est divulguée.
    return {
        "code": discount["code"],
        "type": discount["type"],
        "value": float(discount["value"]),
        "min_order_amount": float(discount.get("min_order_amount") or 0),
        "active": True,
    }


@api_router.post("/ecom/admin/discounts")
async def create_discount(payload: dict, profile=Depends(require_admin)):
    data = {
        "id": str(uuid.uuid4()),
        "code": payload["code"].upper(),
        "type": payload["type"],
        "value": payload["value"],
        "active": payload.get("active", True),
        "starts_at": payload.get("starts_at"),
        "ends_at": payload.get("ends_at"),
        "usage_limit": payload.get("usage_limit"),
        "min_order_amount": payload.get("min_order_amount"),
        "description": payload.get("description"),
        "used_count": 0,
        "created_at": now_iso(),
    }
    result = await sb_insert("discounts", data)
    return result.data[0]


@api_router.patch("/ecom/admin/discounts/{discount_id}")
async def update_discount(
    discount_id: str,
    payload: dict,
    profile=Depends(require_admin),
):
    payload.pop("id", None)
    payload.pop("used_count", None)
    payload.pop("created_at", None)
    if "code" in payload:
        payload["code"] = payload["code"].upper()
    await sb_update("discounts", payload, "id", discount_id)
    return await sb_select_one("discounts", "id", discount_id)


# ---------- Collections ----------


@api_router.get("/collections")
async def list_collections(limit: int = 50):
    result = await asyncio.to_thread(
        lambda: supabase.table("collections").select("*").limit(limit).execute()
    )
    return result.data or []


@api_router.get("/collections/{slug}")
async def get_collection(slug: str):
    collection = await sb_select_one("collections", "slug", slug)

    if not collection:
        raise HTTPException(status_code=404, detail="Collection introuvable")

    return collection


@api_router.get("/collections/{collection_id}/products")
async def list_collection_products(collection_id: str):
    result = await asyncio.to_thread(
        lambda: supabase.table("product_collections")
        .select("products(*)")
        .eq("collection_id", collection_id)
        .execute()
    )

    return [row["products"] for row in result.data or [] if row.get("products")]


# ---------- Inventory / Locations ----------


@api_router.get("/locations")
async def list_locations():
    result = await asyncio.to_thread(
        lambda: supabase.table("locations").select("*").eq("active", True).execute()
    )
    return result.data or []


@api_router.get("/inventory/variant/{variant_id}")
async def get_variant_inventory(variant_id: str, profile=Depends(require_admin)):
    result = await asyncio.to_thread(
        lambda: supabase.table("inventory_items")
        .select("*, inventory_levels(*, locations(*))")
        .eq("variant_id", variant_id)
        .limit(1)
        .execute()
    )

    return result.data[0] if result.data else {}


# ---------- Shipping / Discounts ----------


@api_router.get("/shipping-methods")
async def list_shipping_methods(country: Optional[str] = None):
    def run():
        q = supabase.table("shipping_methods").select("*").eq("active", True)
        if country:
            q = q.eq("country", country.upper())
        return q.execute()

    result = await asyncio.to_thread(run)
    return result.data or []


# ---------- Pages / Store Settings ----------


@api_router.get("/pages")
async def list_pages():
    result = await asyncio.to_thread(
        lambda: supabase.table("pages").select("*").eq("published", True).execute()
    )
    return result.data or []


@api_router.get("/pages/{slug}")
async def get_page(slug: str):
    page = await sb_select_one("pages", "slug", slug)

    if not page or not page.get("published", False):
        raise HTTPException(status_code=404, detail="Page introuvable")

    return page


@api_router.get("/store-settings")
async def get_store_settings():
    result = await asyncio.to_thread(
        lambda: supabase.table("store_settings").select("*").execute()
    )

    return {row["key"]: row["value"] for row in result.data or []}


# ---------- Full Ecommerce Table API ----------

PUBLIC_READ_TABLES = {
    "products",
    "collections",
    "product_collections",
    "product_images",
    "product_variants",
    "product_options",
    "product_option_values",
    "categories",
    "reviews",
    "guides",
    "experts",
    "pages",
    "shipping_methods",
    "store_settings",
}

CUSTOMER_TABLES = {
    "customers",
    "addresses",
    "carts",
    "cart_items",
    "orders",
    "order_items",
    "payments",
    "refunds",
}

ADMIN_TABLES = {
    "activity_logs",
    "barcode_scans",
    "discounts",
    "inventory_items",
    "inventory_levels",
    "inventory_movements",
    "locations",
    "payment_transactions",
    "profiles",
    "stripe_webhook_events",
    "workshops",
    "workshop_bookings",
    "conversations",
    "messages",
    "return_requests",
    "newsletter_subscribers",
    "loyalty_points",
    "loyalty_transactions",
}


@api_router.get("/ecom/public/{table}")
async def list_public_table(table: str, limit: int = 100):
    if table not in PUBLIC_READ_TABLES:
        raise HTTPException(status_code=400, detail="Table publique non autorisée")

    result = await asyncio.to_thread(
        lambda: supabase.table(table).select("*").limit(limit).execute()
    )
    return result.data or []


@api_router.get("/ecom/public/{table}/{item_id}")
async def get_public_item(table: str, item_id: str):
    if table not in PUBLIC_READ_TABLES:
        raise HTTPException(status_code=400, detail="Table publique non autorisée")

    item = await sb_select_one(table, "id", item_id)

    if not item:
        raise HTTPException(status_code=404, detail="Élément introuvable")

    return item


@api_router.post("/ecom/admin/products/create")
async def create_admin_product(
    payload: dict,
    profile=Depends(require_admin),
):
    product_data = payload.get("product", {})
    options = payload.get("options", [])
    variants = payload.get("variants", [])
    images = payload.get("images", [])
    collections = payload.get("collections", [])

    if not product_data.get("title"):
        raise HTTPException(status_code=400, detail="Le titre est obligatoire.")

    if not product_data.get("slug"):
        raise HTTPException(status_code=400, detail="Le slug est obligatoire.")

    product_data["name"] = product_data.get("name") or product_data.get("title")
    product_data["updated_at"] = now_iso()

    try:
        created = await sb_insert("products", product_data)
        product = created.data[0]
        product_id = product["id"]

        clean_options = [
            {
                "product_id": product_id,
                "name": option.get("name"),
                "position": option.get("position", 1),
            }
            for option in options
            if option.get("name")
        ]

        if clean_options:
            await sb_insert("product_options", clean_options)

        clean_variants = []
        for variant in variants:
            if not variant.get("title"):
                continue

            existing_stock = 0
            if variant.get("id"):
                existing = await sb_select_one("product_variants", "id", variant["id"])
                if existing:
                    existing_stock = existing.get("stock", 0)

            clean_variants.append(
                {
                    "product_id": product_id,
                    "title": variant.get("title"),
                    "sku": variant.get("sku") or None,
                    "barcode": variant.get("barcode") or None,
                    "price": variant.get("price", 0),
                    "compare_at_price": variant.get("compare_at_price"),
                    "cost_price": variant.get("cost_price"),
                    "weight_grams": variant.get("weight_grams", 0),
                    "option1": variant.get("option1") or None,
                    "option2": variant.get("option2") or None,
                    "option3": variant.get("option3") or None,
                    "active": variant.get("active", True),
                    "stock": variant.get("stock", existing_stock),
                    "available": variant.get("stock", existing_stock) > 0,
                }
            )

        if clean_variants:
            await sb_insert("product_variants", clean_variants)
            # Lignes d'inventaire nécessaires pour pouvoir vendre le produit.
            await sync_product_inventory(product_id)

        clean_images = [
            {
                "product_id": product_id,
                "storage_path": image.get("storage_path"),
                "public_url": image.get("public_url") or None,
                "alt_text": image.get("alt_text") or product_data.get("title"),
                "position": image.get("position", 1),
            }
            for image in images
            if image.get("storage_path")
        ]

        if clean_images:
            await sb_insert("product_images", clean_images)

        clean_collections = [
            {
                "product_id": product_id,
                "collection_id": collection_id,
            }
            for collection_id in collections
            if collection_id
        ]

        if clean_collections:
            await sb_insert("product_collections", clean_collections)

        return {
            "success": True,
            "product_id": product_id,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def update_product_variants_safely(
    product_id: str,
    variants: list,
):
    """
    Met à jour les variantes sans supprimer leurs UUID.

    Une variante absente du formulaire n'est pas supprimée.
    Pour l'archiver, transmettre son UUID et active=False.

    Le stock n'est volontairement pas modifiable ici :
    il sera géré par les opérations d'inventaire.
    """

    if not isinstance(variants, list):
        raise HTTPException(
            status_code=400, detail="Le champ variants doit être une liste."
        )

    # Charger les variantes actuelles du produit.
    result = await asyncio.to_thread(
        lambda: supabase.table("product_variants")
        .select("id,product_id,stock")
        .eq("product_id", product_id)
        .execute()
    )

    existing = {row["id"]: row for row in (result.data or [])}

    allowed_fields = {
        "title",
        "sku",
        "barcode",
        "price",
        "compare_at_price",
        "cost_price",
        "weight_grams",
        "option1",
        "option2",
        "option3",
        "option1_value_id",
        "option2_value_id",
        "option3_value_id",
        "active",
        "supplier_price",
        "supplier_currency",
        "acquisition_fees",
        "cost_price_source",
    }

    seen_ids = set()

    # Valider l'ensemble avant toute écriture.
    for variant in variants:
        if not isinstance(variant, dict):
            raise HTTPException(status_code=400, detail="Format de variante invalide.")

        variant_id = variant.get("id")

        if variant_id:
            if variant_id not in existing:
                raise HTTPException(
                    status_code=400,
                    detail=("Une variante transmise n'appartient " "pas à ce produit."),
                )

            if variant_id in seen_ids:
                raise HTTPException(
                    status_code=400, detail="Variante présente plusieurs fois."
                )

            seen_ids.add(variant_id)

        elif not variant.get("title"):
            raise HTTPException(
                status_code=400, detail="Une nouvelle variante doit avoir un titre."
            )

    # Appliquer les modifications.
    for variant in variants:
        variant_id = variant.get("id")

        values = {key: value for key, value in variant.items() if key in allowed_fields}

        values["updated_at"] = now_iso()

        if variant_id:
            await sb_update(
                "product_variants",
                values,
                "id",
                variant_id,
            )

        else:
            values["product_id"] = product_id
            values.setdefault("active", True)
            values.setdefault("price", 0)
            values.setdefault("stock", 0)
            values.setdefault("available", False)

            await sb_insert(
                "product_variants",
                values,
            )


@api_router.patch("/ecom/admin/products/{product_id}")
async def update_admin_product(
    product_id: str,
    payload: dict,
    profile=Depends(require_admin),
):
    product_data = payload.get("product", {})
    options = payload.get("options")  # ← None si absent (pas de [], None)
    variants = payload.get("variants")  # ← None si absent
    images = payload.get("images")  # ← None si absent
    collections = payload.get("collections")  # ← None si absent

    product_data["updated_at"] = now_iso()

    try:
        await sb_update("products", product_data, "id", product_id)

        # ← Ne supprimer/recréer QUE si explicitement fourni dans le payload
        if options is not None:
            await sb_delete("product_options", "product_id", product_id)
            clean_options = [
                {
                    "product_id": product_id,
                    "name": option.get("name"),
                    "position": option.get("position", 1),
                }
                for option in options
                if option.get("name")
            ]
            if clean_options:
                await sb_insert("product_options", clean_options)

        if variants is not None:
            await update_product_variants_safely(
                product_id,
                variants,
            )
            await sync_product_inventory(product_id)

        if images is not None:
            await sb_delete("product_images", "product_id", product_id)
            clean_images = [
                {
                    "product_id": product_id,
                    "storage_path": image.get("storage_path"),
                    "public_url": image.get("public_url") or None,
                    "alt_text": image.get("alt_text"),
                    "position": image.get("position", 1),
                }
                for image in images
                if image.get("storage_path")
            ]
            if clean_images:
                await sb_insert("product_images", clean_images)

        if collections is not None:
            await sb_delete("product_collections", "product_id", product_id)
            clean_collections = [
                {"product_id": product_id, "collection_id": collection_id}
                for collection_id in collections
                if collection_id
            ]
            if clean_collections:
                await sb_insert("product_collections", clean_collections)

        return {"success": True, "product_id": product_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.patch("/ecom/admin/products/{product_id}/archive")
async def archive_admin_product(
    product_id: str,
    profile=Depends(require_admin),
):
    await sb_update(
        "products",
        {
            "status": "archived",
            "available": False,
            "updated_at": now_iso(),
        },
        "id",
        product_id,
    )

    return {"success": True, "status": "archived"}


@api_router.get("/ecom/admin/storage/product-images")
async def list_product_bucket_images(profile=Depends(require_admin)):
    try:
        files = await asyncio.to_thread(
            lambda: supabase.storage.from_("product-images").list()
        )

        images = []

        for file in files:
            name = file.get("name")

            if not name:
                continue

            public_url = supabase.storage.from_("product-images").get_public_url(name)

            images.append(
                {
                    "name": name,
                    "storage_path": name,
                    "public_url": public_url,
                }
            )

        return images

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/workshops")
async def list_workshops():
    result = await asyncio.to_thread(
        lambda: supabase.table("workshops")
        .select("*")
        .eq("active", True)
        .order("starts_at")
        .execute()
    )

    return result.data or []


@api_router.get("/workshops/{slug}")
async def get_workshop(slug: str):
    workshop = await sb_select_one("workshops", "slug", slug)

    if not workshop or not workshop.get("active"):
        raise HTTPException(status_code=404, detail="Atelier introuvable")

    return workshop


@api_router.post("/workshops/book")
async def book_workshop(payload: WorkshopBookingRequest):
    workshop = await sb_select_one("workshops", "id", payload.workshop_id)

    if not workshop or not workshop.get("active"):
        raise HTTPException(status_code=404, detail="Atelier introuvable")

    available = int(workshop["capacity"]) - int(workshop.get("reserved_count", 0))

    if payload.quantity > available:
        raise HTTPException(status_code=400, detail="Plus assez de places disponibles")

    amount = round(float(workshop.get("price", 0)) * payload.quantity, 2)

    booking_data = {
        "id": str(uuid.uuid4()),
        "workshop_id": payload.workshop_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "email": payload.email,
        "phone": payload.phone,
        "quantity": payload.quantity,
        "amount": amount,
        "currency": workshop.get("currency", "CHF"),
        "status": "pending",
        "created_at": now_iso(),
    }

    inserted = await sb_insert("workshop_bookings", booking_data)
    booking = inserted.data[0]

    if amount <= 0:
        await sb_update(
            "workshop_bookings",
            {"status": "confirmed"},
            "id",
            booking["id"],
        )

        await sb_update(
            "workshops",
            {
                "reserved_count": int(workshop.get("reserved_count", 0))
                + payload.quantity,
                "updated_at": now_iso(),
            },
            "id",
            payload.workshop_id,
        )

        return {"status": "confirmed", "booking_id": booking["id"]}

    session = await asyncio.to_thread(
        stripe.checkout.Session.create,
        mode="payment",
        customer_email=payload.email,
        success_url=f"{payload.origin_url.rstrip('/')}/ateliers?booking_status=success&booking_id={booking['id']}",
        cancel_url=f"{payload.origin_url.rstrip('/')}/ateliers?booking_status=failed&booking_id={booking['id']}",
        metadata={
            "type": "workshop_booking",
            "booking_id": booking["id"],
            "workshop_id": payload.workshop_id,
        },
        line_items=[
            {
                "price_data": {
                    "currency": "chf",
                    "product_data": {
                        "name": workshop["title"],
                    },
                    "unit_amount": int(round(float(workshop["price"]) * 100)),
                },
                "quantity": payload.quantity,
            }
        ],
    )

    await sb_update(
        "workshop_bookings",
        {"stripe_checkout_session_id": session.id},
        "id",
        booking["id"],
    )

    return {"url": session.url, "booking_id": booking["id"]}


@api_router.post("/ecom/admin/workshops")
async def create_admin_workshop(
    payload: AdminWorkshopRequest,
    profile=Depends(require_admin),
):
    data = payload.model_dump()
    data["id"] = str(uuid.uuid4())
    data["created_at"] = now_iso()
    data["updated_at"] = now_iso()

    inserted = await sb_insert("workshops", data)

    return inserted.data[0]


@api_router.patch("/ecom/admin/workshops/{workshop_id}")
async def update_admin_workshop(
    workshop_id: str,
    payload: AdminWorkshopRequest,
    profile=Depends(require_admin),
):
    data = payload.model_dump()
    data["updated_at"] = now_iso()

    await sb_update("workshops", data, "id", workshop_id)

    return {"success": True, "id": workshop_id}


@api_router.delete("/ecom/admin/workshops/{workshop_id}")
async def delete_admin_workshop(
    workshop_id: str,
    profile=Depends(require_admin),
):
    await sb_delete("workshops", "id", workshop_id)

    return {"success": True}


@api_router.delete("/ecom/admin/products/{product_id}")
async def delete_admin_product(
    product_id: str,
    profile=Depends(require_admin),
):
    await sb_delete("products", "id", product_id)
    return {"success": True, "status": "deleted"}


@api_router.get("/ecom/admin/products-list")
async def list_admin_products(
    limit: int = 200,
    profile=Depends(require_admin),
):
    result = await asyncio.to_thread(
        lambda: supabase.table("products")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


# ============================================================
# BAUME — STATISTIQUES ADMINISTRATEUR
# SECTION 1 : PÉRIODES COMMERCIALES SUISSES
#
# Les journées et les mois suivent Europe/Zurich.
# Les bornes sont converties en UTC pour interroger Supabase.
# La borne de début est incluse ; celle de fin est exclue.
# ============================================================


def stats_period_bounds(period: str):
    swiss_tz = ZoneInfo("Europe/Zurich")

    now_local = datetime.now(swiss_tz)
    today = now_local.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    if period == "month":
        start = today.replace(day=1)

        if start.month == 12:
            end = start.replace(
                year=start.year + 1,
                month=1,
            )
        else:
            end = start.replace(month=start.month + 1)

        end = min(end, now_local)

    elif period == "previous_month":
        end = today.replace(day=1)

        if end.month == 1:
            start = end.replace(
                year=end.year - 1,
                month=12,
            )
        else:
            start = end.replace(month=end.month - 1)

    elif period == "last_30_days":
        # 30 journées calendaires suisses,
        # aujourd'hui compris.
        start = today - timedelta(days=29)
        end = now_local

    elif period == "year":
        start = today.replace(month=1, day=1)
        end = min(
            start.replace(year=start.year + 1),
            now_local,
        )

    else:
        raise HTTPException(
            status_code=400,
            detail="Période statistique non autorisée.",
        )

    return (
        start.astimezone(timezone.utc),
        end.astimezone(timezone.utc),
    )


async def stats_fetch_all(query_factory, page_size=500):
    """
    Lit toutes les pages d'une requête Supabase.

    Ne pas utiliser une limite de 300 lignes pour les
    statistiques : cela fausserait les totaux.
    """
    all_rows = []
    offset = 0

    while True:
        result = await asyncio.to_thread(
            lambda: query_factory().range(offset, offset + page_size - 1).execute()
        )

        batch = result.data or []
        all_rows.extend(batch)

        if len(batch) < page_size:
            break

        offset += page_size

    return all_rows


def stats_sell_through_by_variant(
    opening_by_variant,
    received_by_variant,
    net_sold_by_variant,
    eligible_variant_ids,
):
    results = []
    total_sold = 0
    total_available = 0

    all_variant_ids = (
        set(opening_by_variant) | set(received_by_variant) | set(net_sold_by_variant)
    )

    for variant_id in sorted(all_variant_ids):
        opening = opening_by_variant.get(variant_id)
        received = received_by_variant.get(variant_id)
        net_sold = net_sold_by_variant.get(variant_id)

        complete = (
            variant_id in eligible_variant_ids
            and opening is not None
            and received is not None
            and net_sold is not None
        )

        rate = stats_sell_through(net_sold, opening, received) if complete else None

        results.append(
            {
                "variant_id": variant_id,
                "opening_stock_units": opening,
                "received_units": received,
                "net_units_sold": net_sold,
                "rate_percent": rate,
                "status": "complete" if rate is not None else "incomplete",
            }
        )

        if rate is not None:
            total_sold += net_sold
            total_available += opening + received

    global_rate = (
        round(total_sold * 100 / total_available, 1) if total_available > 0 else None
    )

    return {
        "rate_percent": (
            global_rate
            if results and all(row["status"] == "complete" for row in results)
            else None
        ),
        "eligible_rate_percent": global_rate,
        "net_units_sold": (total_sold if total_available > 0 else None),
        "variants": results,
        "status": (
            "complete"
            if results and all(row["status"] == "complete" for row in results)
            else "partial" if total_available > 0 else "incomplete_inventory_history"
        ),
    }


# ============================================================
# BAUME — STATISTIQUES ADMINISTRATEUR
# SECTION 1 BIS : REMBOURSEMENTS ET RETOURS PHYSIQUES
#
# Un remboursement est un événement financier.
# Un retour est un mouvement physique de marchandise.
# Ils ne doivent jamais être confondus.
# ============================================================


async def stats_get_refunds_and_returns(order_ids):
    """
    Retourne :
    - les montants remboursés par commande ;
    - les quantités retournées par ligne de commande.

    Les retours physiques nécessitent la table
    order_item_returns décrite ci-dessous.
    """

    refunds_by_order = {}
    returns_by_item = {}

    if not order_ids:
        return refunds_by_order, returns_by_item

    # --------------------------------------------------------
    # 1. Remboursements financiers
    #
    # Formule :
    # Remboursement total d'une commande =
    # somme de ses remboursements enregistrés.
    # --------------------------------------------------------

    for offset in range(0, len(order_ids), 100):
        batch_ids = order_ids[offset : offset + 100]

        # Ne comptabiliser que les remboursements réussis.
        # Les remboursements en attente ou échoués
        # ne diminuent pas le chiffre d'affaires.

        refunds = await stats_fetch_all(
            lambda ids=batch_ids: supabase.table("refunds")
            .select("id,order_id,amount,created_at,status")
            .in_("order_id", ids)
            .eq("status", "succeeded")
            .order("id")
        )

        for refund in refunds:
            order_id = refund["order_id"]

            amount = Decimal(str(refund.get("amount") or 0))

            refunds_by_order[order_id] = (
                refunds_by_order.get(
                    order_id,
                    Decimal("0"),
                )
                + amount
            )

    # --------------------------------------------------------
    # 2. Retours physiques
    #
    # Formule :
    # Quantité retournée d'une ligne =
    # somme des unités effectivement retournées.
    #
    # La quantité retournée ne signifie pas que le produit
    # a été remis en stock : il peut être endommagé.
    # --------------------------------------------------------

    for offset in range(0, len(order_ids), 100):
        batch_ids = order_ids[offset : offset + 100]

        returns = await stats_fetch_all(
            lambda ids=batch_ids: supabase.table("order_item_returns")
            .select("id,order_id,order_item_id," "quantity,restocked,created_at")
            .in_("order_id", ids)
            .order("id")
        )

        for returned in returns:
            item_id = returned["order_item_id"]

            quantity = int(returned.get("quantity") or 0)

            returns_by_item[item_id] = returns_by_item.get(item_id, 0) + quantity

    return refunds_by_order, returns_by_item


# ============================================================
# BAUME — STATISTIQUES ADMINISTRATEUR
# SECTION 2 : VENTES ET PERFORMANCE DES PRODUITS
#
# Indicateurs calculés :
# - Quantités vendues brutes
# - Chiffre d'affaires brut des produits
# - Remises réparties proportionnellement entre les produits
# - Chiffre d'affaires produits après remises
# - Remboursements financiers, suivis séparément
# - Produits les plus vendus et les moins vendus
#
# IMPORTANT :
# Les remboursements ne sont pas automatiquement considérés
# comme des retours physiques.
# Le CA HT et les ventes nettes après retours nécessitent
# des données supplémentaires.
#
# Cette route ne modifie aucune donnée.
# ============================================================


def stats_stock_value(snapshot_rows):
    """Valorisation historique d'un relevé, en CHF."""
    if not snapshot_rows:
        return None

    if any(row.get("unit_cost_chf") is None for row in snapshot_rows):
        return None

    return sum(
        (
            Decimal(str(row["unit_cost_chf"])) * Decimal(str(row["stock_quantity"]))
            for row in snapshot_rows
        ),
        Decimal("0"),
    )


def stats_stock_rotation(cogs, opening_value, closing_value):
    """Rotation sur une période, sans fabriquer les données manquantes."""
    if cogs is None or opening_value is None or closing_value is None:
        return None

    average_value = (
        Decimal(str(opening_value)) + Decimal(str(closing_value))
    ) / Decimal("2")

    if average_value <= 0:
        return None

    return float(round(Decimal(str(cogs)) / average_value, 3))


def stats_stock_coverage(stock_units, sold_units, days=30):
    """Couverture en jours sur une fenêtre de ventes donnée."""
    if stock_units is None or sold_units is None:
        return None

    if days <= 0 or sold_units <= 0:
        return None

    return round(stock_units * days / sold_units, 1)


def stats_sell_through(net_sold, opening_stock, received):
    """Taux d'écoulement sur une période."""
    if any(value is None for value in (net_sold, opening_stock, received)):
        return None

    available = opening_stock + received

    if available <= 0:
        return None

    if net_sold < 0 or net_sold > available:
        return None

    return round(net_sold * 100 / available, 1)


@api_router.get("/ecom/admin/statistics/sales")
async def get_admin_statistics_sales(
    period: str = "month",
    _profile=Depends(require_admin),
):
    start, end = stats_period_bounds(period)

    # --------------------------------------------------------
    # STOCK INITIAL ET FINAL — RELEVÉS QUOTIDIENS
    # --------------------------------------------------------

    zurich = ZoneInfo("Europe/Zurich")

    # Les bornes de la période sont converties en dates suisses.
    period_start_date = start.astimezone(zurich).date()
    period_end_date = (end.astimezone(zurich) - timedelta(microseconds=1)).date()

    opening_snapshot_date = period_start_date - timedelta(days=1)
    closing_snapshot_date = period_end_date

    async def load_stock_snapshot(snapshot_date):
        date_iso = snapshot_date.isoformat()

        rows = await stats_fetch_all(
            lambda: supabase.table("inventory_daily_snapshots")
            .select("variant_id,stock_quantity,unit_cost_chf")
            .eq("snapshot_date", date_iso)
            .order("variant_id")
        )

        run = await sb_select_one(
            "inventory_snapshot_runs",
            "snapshot_date",
            date_iso,
        )

        expected_count = run.get("expected_variant_count") if run is not None else None

        complete = (
            (
                bool(run.get("is_complete"))
                and expected_count is not None
                and len(rows) == expected_count
                and len({row["variant_id"] for row in rows}) == len(rows)
            )
            if run is not None
            else False
        )

        if not rows:
            return None

        return {
            "date": date_iso,
            "units": sum(int(row["stock_quantity"]) for row in rows),
            "variant_count": len(rows),
            "expected_variant_count": expected_count,
            "complete": complete,
            "variant_ids": {row["variant_id"] for row in rows},
            "rows": rows,
            "stock_value_chf": (stats_stock_value(rows) if complete else None),
        }

    # IMPORTANT : on est sorti de load_stock_snapshot().
    # On est toujours dans get_admin_statistics_sales().

    opening_snapshot = await load_stock_snapshot(opening_snapshot_date)

    today_zurich = datetime.now(zurich).date()

    closing_snapshot = (
        await load_stock_snapshot(closing_snapshot_date)
        if closing_snapshot_date < today_zurich
        else None
    )

    # --------------------------------------------------------
    # VALEUR HISTORIQUE DU STOCK — ROTATION
    # --------------------------------------------------------
    opening_stock_value = (
        {
            "value": opening_snapshot["stock_value_chf"],
            "variant_ids": opening_snapshot["variant_ids"],
        }
        if opening_snapshot is not None
        and opening_snapshot["stock_value_chf"] is not None
        else None
    )

    closing_stock_value = (
        {
            "value": closing_snapshot["stock_value_chf"],
            "variant_ids": closing_snapshot["variant_ids"],
        }
        if closing_snapshot is not None
        and closing_snapshot["stock_value_chf"] is not None
        else None
    )

    ZERO = Decimal("0")
    CENT = Decimal("0.01")

    def money(value):
        """Convertit un montant en Decimal sans passer par float."""
        return Decimal(str(value if value is not None else 0))

    def amount(value):
        """Arrondit un montant à deux décimales pour la réponse JSON."""
        return float(value.quantize(CENT))

    # --------------------------------------------------------
    # 1. CHARGER LES COMMANDES
    #
    # On conserve les commandes remboursées pour connaître
    # les ventes historiques. Le remboursement est traité
    # séparément.
    #
    # Les commandes annulées ne sont pas comptabilisées.
    # --------------------------------------------------------

    orders = await stats_fetch_all(
        lambda: supabase.table("orders")
        .select("id,created_at,status,currency," "subtotal,discount_total,total")
        .gte("created_at", start.isoformat())
        .lt("created_at", end.isoformat())
        .in_(
            "status",
            [
                "paid",
                "processing",
                "shipped",
                "delivered",
                "refunded",
            ],
        )
        .order("created_at")
        .order("id")
    )

    order_map = {order["id"]: order for order in orders}
    order_ids = list(order_map.keys())

    # --------------------------------------------------------
    # 2. CHARGER UNIQUEMENT LES LIGNES CONCERNÉES
    #
    # On interroge Supabase par lots pour éviter de charger
    # toutes les commandes historiques du site.
    # --------------------------------------------------------

    items = []

    for offset in range(0, len(order_ids), 100):
        batch_ids = order_ids[offset : offset + 100]

        batch_items = await stats_fetch_all(
            lambda ids=batch_ids: supabase.table("order_items")
            .select(
                "id,order_id,product_id,variant_id,"
                "product_title,quantity,total_price"
            )
            .in_("order_id", ids)
            .order("id")
        )

        items.extend(batch_items)

    # --------------------------------------------------------
    # 3. CHARGER LE CATALOGUE
    #
    # Tous les produits sont chargés, même ceux qui n'ont
    # enregistré aucune vente.
    # --------------------------------------------------------

    products = await stats_fetch_all(
        lambda: supabase.table("products").select("id,name,vendor,status").order("id")
    )

    product_map = {product["id"]: product for product in products}

    # Coûts courants par variante. Ces coûts ne sont PAS des instantanés
    # historiques : les marges sur commandes passées restent indicatives.
    variants = await stats_fetch_all(
        lambda: supabase.table("product_variants")
        .select(
            "id,product_id,active,stock,cost_price,cost_price_source,"
            "supplier_price,supplier_currency,acquisition_fees"
        )
        .order("id")
    )
    variant_map = {variant["id"]: variant for variant in variants}

    # Valorisation du stock actuel, indépendante de la période des ventes.
    # Ne jamais convertir implicitement une devise fournisseur en CHF.
    inventory = {
        "currency": "CHF",
        "active_variants": 0,
        "stock_units": 0,
        "variants_with_complete_cost": 0,
        "variants_missing_cost": 0,
        "variants_with_estimated_cost": 0,
        "stock_units_missing_cost": 0,
        "supplier_stock_value": ZERO,
        "acquisition_fees_stock_value": ZERO,
        "stock_cost_value": ZERO,
    }
    for variant in variants:
        if not variant.get("active"):
            continue
        inventory["active_variants"] += 1
        stock = max(int(variant.get("stock") or 0), 0)
        inventory["stock_units"] += stock
        if variant.get("cost_price_source") == "estimated":
            inventory["variants_with_estimated_cost"] += 1
        complete = (
            variant.get("supplier_currency") == "CHF"
            and variant.get("supplier_price") is not None
            and variant.get("acquisition_fees") is not None
            and variant.get("cost_price") is not None
        )
        if not complete:
            inventory["variants_missing_cost"] += 1
            inventory["stock_units_missing_cost"] += stock
            continue
        inventory["variants_with_complete_cost"] += 1
        inventory["supplier_stock_value"] += money(variant["supplier_price"]) * stock
        inventory["acquisition_fees_stock_value"] += (
            money(variant["acquisition_fees"]) * stock
        )
        inventory["stock_cost_value"] += money(variant["cost_price"]) * stock

    # --------------------------------------------------------
    # COUVERTURE DU STOCK — 30 DERNIERS JOURS
    #
    # Indépendante de la période sélectionnée dans le dashboard.
    # Ventes brutes des commandes admissibles, hors commandes
    # entièrement remboursées. Les retours physiques ne sont
    # pas encore déduits : couverture indicative.
    # --------------------------------------------------------

    coverage_end = datetime.now(timezone.utc)
    coverage_start = coverage_end - timedelta(days=30)

    coverage_orders = await stats_fetch_all(
        lambda: supabase.table("orders")
        .select("id")
        .gte("created_at", coverage_start.isoformat())
        .lt("created_at", coverage_end.isoformat())
        .in_(
            "status",
            ["paid", "processing", "shipped", "delivered"],
        )
        .order("id")
    )

    coverage_order_ids = [row["id"] for row in coverage_orders]
    sold_by_variant = defaultdict(int)

    for offset in range(0, len(coverage_order_ids), 100):
        batch_ids = coverage_order_ids[offset : offset + 100]

        coverage_items = await stats_fetch_all(
            lambda ids=batch_ids: supabase.table("order_items")
            .select("id,variant_id,quantity")
            .in_("order_id", ids)
            .order("id")
        )

        for item in coverage_items:
            variant_id = item.get("variant_id")
            quantity = max(int(item.get("quantity") or 0), 0)

            if variant_id:
                sold_by_variant[variant_id] += quantity

    coverage_variants = []
    stock_with_recent_sales = 0
    units_sold_recently = 0

    for variant in variants:
        if not variant.get("active"):
            continue

        variant_id = variant["id"]
        product = product_map.get(variant.get("product_id"), {})

        stock = max(int(variant.get("stock") or 0), 0)
        sold_30d = sold_by_variant.get(variant_id, 0)

        daily_sales = sold_30d / 30

        coverage_days = stats_stock_coverage(
            stock_units=stock,
            sold_units=sold_30d,
            days=30,
        )

        if sold_30d > 0:
            stock_with_recent_sales += stock
            units_sold_recently += sold_30d

        if sold_30d == 0:
            coverage_status = "no_recent_sales"
        elif stock == 0:
            coverage_status = "out_of_stock"
        elif coverage_days is not None and coverage_days <= 30:
            coverage_status = "under_30_days"
        else:
            coverage_status = "over_30_days"

        coverage_variants.append(
            {
                "variant_id": variant_id,
                "product_id": variant.get("product_id"),
                "product_name": product.get("name") or "Produit inconnu",
                "stock_units": stock,
                "units_sold_30d": sold_30d,
                "daily_sales": round(daily_sales, 3),
                "coverage_days": coverage_days,
                "status": coverage_status,
            }
        )

    # Indicateur global limité aux variantes ayant des ventes récentes.
    # Les variantes sans ventes restent visibles dans le tableau.
    global_coverage_days = stats_stock_coverage(
        stock_units=stock_with_recent_sales,
        sold_units=units_sold_recently,
        days=30,
    )

    coverage_variants.sort(
        key=lambda row: (
            row["coverage_days"] is None,
            row["coverage_days"] if row["coverage_days"] is not None else float("inf"),
            row["product_name"].lower(),
        )
    )

    stock_coverage = {
        "window_days": 30,
        "start": coverage_start.isoformat(),
        "end": coverage_end.isoformat(),
        "global_coverage_days": global_coverage_days,
        "stock_units_with_recent_sales": stock_with_recent_sales,
        "units_sold_30d": units_sold_recently,
        "variants": coverage_variants,
    }

    # --------------------------------------------------------
    # 4. REGROUPER LES LIGNES PAR COMMANDE
    #
    # Cette étape permet de répartir correctement les
    # remises globales entre les différents produits.
    # --------------------------------------------------------

    items_by_order = {}

    for item in items:
        order_id = item["order_id"]
        items_by_order.setdefault(order_id, []).append(item)

    # --------------------------------------------------------
    # 5. INITIALISER LES DEVISES
    #
    # Le CHF doit exister même lorsqu'aucune commande
    # n'a été passée pendant la période.
    # Cela permet d'afficher les produits à zéro vente.
    # --------------------------------------------------------

    results_by_currency = {
        "CHF": {
            "orders_count": 0,
            "units_sold_gross": 0,
            "product_revenue_gross": Decimal("0"),
            "discounts_allocated": Decimal("0"),
            "product_revenue_after_discounts": Decimal("0"),
            "products": {},
            "supplier_cost_estimated": ZERO,
            "acquisition_fees_estimated": ZERO,
            "cogs_estimated": ZERO,
            "units_missing_cost": 0,
            "missing_cost_items": [],  # AJOUT
            "units_with_estimated_cost": 0,
        }
    }

    for order in orders:
        currency = (order.get("currency") or "CHF").upper()

        if currency not in results_by_currency:
            results_by_currency[currency] = {
                "orders_count": 0,
                "units_sold_gross": 0,
                "product_revenue_gross": ZERO,
                "discounts_allocated": ZERO,
                "product_revenue_after_discounts": ZERO,
                "products": {},
                "supplier_cost_estimated": ZERO,
                "acquisition_fees_estimated": ZERO,
                "cogs_estimated": ZERO,
                "units_missing_cost": 0,
                "missing_cost_items": [],  # AJOUT
                "units_with_estimated_cost": 0,
            }

        group = results_by_currency.get(currency)
        if group is None:
            continue
        group["orders_count"] += 1

        order_items = items_by_order.get(order["id"], [])

        # Sous-total des lignes de commande.
        lines_subtotal = sum(
            (money(item.get("total_price")) for item in order_items),
            ZERO,
        )

        # Remise globale enregistrée sur la commande.
        order_discount = money(order.get("discount_total"))

        # La remise ne peut pas dépasser le montant des
        # produits pour les besoins de cette répartition.
        allocated_discount = min(
            max(order_discount, ZERO),
            lines_subtotal,
        )

        # ----------------------------------------------------
        # 6. CALCULER LES VENTES DE CHAQUE LIGNE
        #
        # Remise de la ligne =
        # Remise globale × (montant ligne / sous-total)
        #
        # CA après remise =
        # Montant ligne − remise attribuée
        # ----------------------------------------------------

        for item in order_items:
            product_id = item.get("product_id")

            if not product_id:
                continue

            product = product_map.get(product_id) or {}

            quantity = int(item.get("quantity") or 0)
            gross = money(item.get("total_price"))

            if lines_subtotal > ZERO:
                line_discount = allocated_discount * gross / lines_subtotal
            else:
                line_discount = ZERO

            revenue_after_discount = gross - line_discount
            line_cogs_for_product = None

            # Coûts en CHF uniquement : aucune conversion FX implicite.
            # Les quantités vendues sont brutes (retours non déduits).
            variant = variant_map.get(item.get("variant_id"))
            has_cost = bool(
                currency == "CHF"
                and variant
                and variant.get("supplier_currency") == "CHF"
                and variant.get("supplier_price") is not None
                and variant.get("acquisition_fees") is not None
                and variant.get("cost_price") is not None
            )
            if has_cost:
                supplier_cost = money(variant["supplier_price"]) * quantity
                acquisition_cost = money(variant["acquisition_fees"]) * quantity
                line_cogs = money(variant["cost_price"]) * quantity
                group["supplier_cost_estimated"] += supplier_cost
                group["acquisition_fees_estimated"] += acquisition_cost
                group["cogs_estimated"] += line_cogs
                line_cogs_for_product = line_cogs
                if variant.get("cost_price_source") == "estimated":
                    group["units_with_estimated_cost"] += quantity

            else:
                group["units_missing_cost"] += quantity

                # Diagnostic des lignes vendues sans coût complet.
                missing_fields = []

                if not variant:
                    missing_fields.append("variant_not_found_or_variant_id_missing")
                else:
                    if variant.get("supplier_currency") != "CHF":
                        missing_fields.append("supplier_currency_not_chf")

                    for field in (
                        "supplier_price",
                        "acquisition_fees",
                        "cost_price",
                    ):
                        if variant.get(field) is None:
                            missing_fields.append(field)

                if currency != "CHF":
                    missing_fields.append("order_currency_not_chf")

                group["missing_cost_items"].append(
                    {
                        "order_item_id": item.get("id"),
                        "product_id": product_id,
                        "product_title": (
                            product.get("name") or item.get("product_title")
                        ),
                        "variant_id": item.get("variant_id"),
                        "quantity": quantity,
                        "missing_fields": missing_fields,
                    }
                )

            if product_id not in group["products"]:
                group["products"][product_id] = {
                    "product_id": product_id,
                    "name": (
                        product.get("name")
                        or item.get("product_title")
                        or "Produit inconnu"
                    ),
                    "vendor": (product.get("vendor") or "Sans marque"),
                    "status": product.get("status"),
                    "quantity_sold_gross": 0,
                    "gross_revenue": ZERO,
                    "allocated_discount": ZERO,
                    "revenue_after_discounts": ZERO,
                    "cogs_estimated": ZERO,
                    "units_missing_cost": 0,
                }

            stat = group["products"][product_id]

            stat["quantity_sold_gross"] += quantity
            stat["gross_revenue"] += gross
            stat["allocated_discount"] += line_discount
            stat["revenue_after_discounts"] += revenue_after_discount
            if line_cogs_for_product is not None:
                stat["cogs_estimated"] += line_cogs_for_product
            else:
                stat["units_missing_cost"] += quantity

            group["units_sold_gross"] += quantity
            group["product_revenue_gross"] += gross
            group["discounts_allocated"] += line_discount
            group["product_revenue_after_discounts"] += revenue_after_discount

    # --------------------------------------------------------
    # 7. AJOUTER LES PRODUITS SANS VENTES
    #
    # Seuls les produits actifs sans ventes sont ajoutés.
    # Les produits archivés ayant réellement été vendus
    # restent présents dans les résultats historiques.
    # --------------------------------------------------------

    for currency, group in results_by_currency.items():
        for product in products:
            if product.get("status") != "active":
                continue

            product_id = product["id"]

            if product_id in group["products"]:
                continue

            group["products"][product_id] = {
                "product_id": product_id,
                "name": product.get("name") or "Produit inconnu",
                "vendor": product.get("vendor") or "Sans marque",
                "status": "active",
                "quantity_sold_gross": 0,
                "gross_revenue": ZERO,
                "allocated_discount": ZERO,
                "revenue_after_discounts": ZERO,
                "cogs_estimated": ZERO,
                "units_missing_cost": 0,
            }

    # --------------------------------------------------------
    # 8. PRÉPARER LES CLASSEMENTS
    #
    # Classement principal : quantités vendues brutes.
    # Le taux d'écoulement sera ajouté lorsque les stocks
    # historiques auront été fiabilisés.
    # --------------------------------------------------------

    response_currencies = {}

    for currency, group in results_by_currency.items():
        product_results = []

        brands = {}

        for stat in group["products"].values():
            cost_complete = currency == "CHF" and stat["units_missing_cost"] == 0
            product_margin = (
                stat["revenue_after_discounts"] - stat["cogs_estimated"]
                if cost_complete
                else None
            )
            product_results.append(
                {
                    **stat,
                    "gross_revenue": amount(stat["gross_revenue"]),
                    "allocated_discount": amount(stat["allocated_discount"]),
                    "revenue_after_discounts": amount(stat["revenue_after_discounts"]),
                    "cogs_estimated": (
                        amount(stat["cogs_estimated"]) if cost_complete else None
                    ),
                    "gross_margin_estimated": (
                        amount(product_margin) if product_margin is not None else None
                    ),
                }
            )

            # Agrégat par marque (ventes, coût, marge brute)
            vendor = stat.get("vendor") or "Sans marque"
            b = brands.setdefault(
                vendor,
                {
                    "vendor": vendor,
                    "products_count": 0,
                    "units_sold": 0,
                    "revenue_after_discounts": ZERO,
                    "cogs_estimated": ZERO,
                    "units_missing_cost": 0,
                },
            )
            b["products_count"] += 1
            b["units_sold"] += stat["quantity_sold_gross"]
            b["revenue_after_discounts"] += stat["revenue_after_discounts"]
            b["cogs_estimated"] += stat["cogs_estimated"]
            b["units_missing_cost"] += stat["units_missing_cost"]

        brand_results = []
        for b in brands.values():
            complete = currency == "CHF" and b["units_missing_cost"] == 0
            margin = b["revenue_after_discounts"] - b["cogs_estimated"]
            brand_results.append(
                {
                    "vendor": b["vendor"],
                    "products_count": b["products_count"],
                    "units_sold": b["units_sold"],
                    "revenue_after_discounts": amount(b["revenue_after_discounts"]),
                    "cogs_estimated": amount(b["cogs_estimated"]) if complete else None,
                    "gross_margin_estimated": amount(margin) if complete else None,
                    "gross_margin_rate": (
                        float(
                            round(
                                margin / b["revenue_after_discounts"] * Decimal("100"),
                                1,
                            )
                        )
                        if complete and b["revenue_after_discounts"] > ZERO
                        else None
                    ),
                }
            )
        brand_results.sort(key=lambda r: -float(r["revenue_after_discounts"] or 0))

        best_sellers = sorted(
            product_results,
            key=lambda p: (
                -p["quantity_sold_gross"],
                p["name"].lower(),
            ),
        )[:10]

        least_sellers = sorted(
            (p for p in product_results if p["status"] == "active"),
            key=lambda p: (
                p["quantity_sold_gross"],
                p["name"].lower(),
            ),
        )[:10]

        response_currencies[currency] = {
            "metrics": {
                "orders_count": group["orders_count"],
                "units_sold_gross": group["units_sold_gross"],
                "product_revenue_gross": amount(group["product_revenue_gross"]),
                "discounts_allocated": amount(group["discounts_allocated"]),
                "product_revenue_after_discounts": amount(
                    group["product_revenue_after_discounts"]
                ),
                "supplier_cost_estimated": (
                    amount(group["supplier_cost_estimated"])
                    if currency == "CHF" and not group["units_missing_cost"]
                    else None
                ),
                "acquisition_fees_estimated": (
                    amount(group["acquisition_fees_estimated"])
                    if currency == "CHF" and not group["units_missing_cost"]
                    else None
                ),
                "cogs_estimated": (
                    amount(group["cogs_estimated"])
                    if currency == "CHF" and not group["units_missing_cost"]
                    else None
                ),
                "gross_margin_estimated": (
                    amount(
                        group["product_revenue_after_discounts"]
                        - group["cogs_estimated"]
                    )
                    if currency == "CHF" and not group["units_missing_cost"]
                    else None
                ),
                "gross_margin_rate": (
                    float(
                        round(
                            (
                                group["product_revenue_after_discounts"]
                                - group["cogs_estimated"]
                            )
                            / group["product_revenue_after_discounts"]
                            * Decimal("100"),
                            1,
                        )
                    )
                    if currency == "CHF"
                    and not group["units_missing_cost"]
                    and group["product_revenue_after_discounts"] > ZERO
                    else None
                ),
                "units_missing_cost": group["units_missing_cost"],
                "missing_cost_items": group["missing_cost_items"],  # AJOUT
                "units_with_estimated_cost": group["units_with_estimated_cost"],
            },
            "products": product_results,
            "brands": brand_results,
            "best_sellers": best_sellers,
            "least_sellers": least_sellers,
        }

    # --------------------------------------------------------
    # ROTATION ESTIMÉE DU STOCK
    # --------------------------------------------------------

    chf_metrics = response_currencies.get("CHF", {}).get("metrics", {})

    estimated_cogs = chf_metrics.get("cogs_estimated")

    rotation = {
        "estimated": None,
        "average_stock_value_chf": None,
        "opening_stock_value_chf": None,
        "closing_stock_value_chf": None,
        "status": "insufficient_history",
    }

    if opening_stock_value and closing_stock_value:
        # Vérifier que les deux relevés portent sur
        # le même ensemble de variantes.
        same_variants = (
            opening_stock_value["variant_ids"] == closing_stock_value["variant_ids"]
        )

        if same_variants:
            opening_value = opening_stock_value["value"]
            closing_value = closing_stock_value["value"]

            average_value = (opening_value + closing_value) / Decimal("2")

            rotation["opening_stock_value_chf"] = amount(opening_value)
            rotation["closing_stock_value_chf"] = amount(closing_value)
            rotation["average_stock_value_chf"] = amount(average_value)

            rotation["estimated"] = stats_stock_rotation(
                cogs=estimated_cogs,
                opening_value=opening_value,
                closing_value=closing_value,
            )

            rotation["status"] = (
                "estimated"
                if rotation["estimated"] is not None
                else "missing_cost_or_zero_stock"
            )
        else:
            rotation["status"] = "different_variant_sets"

    # --------------------------------------------------------
    # TAUX D'ÉCOULEMENT — PÉRIODE SÉLECTIONNÉE
    #
    # Ne pas supposer qu'une absence de mouvements enregistrés
    # signifie qu'aucun réapprovisionnement n'a eu lieu.
    # --------------------------------------------------------

    sold_units_by_variant = {}

    for item in items:
        variant_id = item.get("variant_id")

        if not variant_id:
            continue

        quantity = max(int(item.get("quantity") or 0), 0)

        sold_units_by_variant[variant_id] = (
            sold_units_by_variant.get(variant_id, 0) + quantity
        )

    # Les commandes remboursées figurent encore dans "items".
    # Ces quantités sont donc BRUTES et non des ventes nettes.
    gross_units_sold = sum(sold_units_by_variant.values())

    sell_through = {
        "rate_percent": None,
        "gross_units_sold": gross_units_sold,
        "net_units_sold": None,
        "opening_stock_units": (
            opening_snapshot["units"] if opening_snapshot is not None else None
        ),
        "received_units": None,
        "status": "incomplete_inventory_history",
        "variants": [],
    }

    # --------------------------------------------------------
    # 9. RÉPONSE
    #
    # Les remboursements et les retours physiques ne sont
    # pas encore attribués aux produits.
    # Aucun CA net HT fictif n'est retourné.
    # --------------------------------------------------------

    return {
        "period": period,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "stock_history": {
            "initial": opening_snapshot["units"] if opening_snapshot else None,
            "initial_date": (opening_snapshot["date"] if opening_snapshot else None),
            "initial_variant_count": (
                opening_snapshot["variant_count"] if opening_snapshot else None
            ),
            "final": closing_snapshot["units"] if closing_snapshot else None,
            "final_date": (closing_snapshot["date"] if closing_snapshot else None),
            "final_variant_count": (
                closing_snapshot["variant_count"] if closing_snapshot else None
            ),
        },
        "currencies": response_currencies,
        "stock_rotation": rotation,
        "sell_through": sell_through,
        "stock_coverage": stock_coverage,
        "calculation_status": "sales_after_discounts_with_estimated_current_costs",
        "inventory": {
            **{k: v for k, v in inventory.items() if not isinstance(v, Decimal)},
            "supplier_stock_value": (
                amount(inventory["supplier_stock_value"])
                if inventory["stock_units_missing_cost"] == 0
                else None
            ),
            "acquisition_fees_stock_value": (
                amount(inventory["acquisition_fees_stock_value"])
                if inventory["stock_units_missing_cost"] == 0
                else None
            ),
            "stock_cost_value": (
                amount(inventory["stock_cost_value"])
                if inventory["stock_units_missing_cost"] == 0
                else None
            ),
        },
        "limitations": [
            "Les coûts fournisseurs, frais et coûts d'achat sont simulés tant que la source est estimated.",
            "Les coûts courants sont appliqués aux ventes historiques : marges indicatives uniquement.",
            "Le stock est valorisé à partir de product_variants.stock actuel, non d'un historique de mouvements.",
            "Les coûts et la valorisation sont calculés uniquement en CHF, sans conversion implicite.",
            "Les remboursements ne sont pas encore déduits.",
            "Les retours physiques ne sont pas encore déduits.",
            "Les montants ne sont pas encore convertis en HT.",
            "Les marques correspondent au catalogue actuel.",
            "Les produits sans ventes sont issus du catalogue actif actuel.",
        ],
    }


# ════════════════════════════════════════════════════════════════════════════
# NOUVELLES ROUTES ADMIN / INTERNES
# (déclarées AVANT /ecom/admin/{table} pour ne pas être capturées par la
#  route générique)
# ════════════════════════════════════════════════════════════════════════════


def require_internal_token(request: Request):
    """Protège les routes appelées par les fonctions Supabase (cron)."""
    expected = os.environ.get("BAUME_INTERNAL_TOKEN", "")
    received = request.headers.get("X-Baume-Internal-Token", "")
    if not expected or received != expected:
        raise HTTPException(status_code=401, detail="Non autorisé")
    return True


async def _supabase_function(name: str, payload: dict, timeout: float = 60.0) -> dict:
    """Appelle une fonction Supabase (Edge Function) avec le jeton interne."""
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(
            f"{SUPABASE_URL}/functions/v1/{name}",
            json=payload,
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "X-Baume-Internal-Token": os.environ.get("BAUME_INTERNAL_TOKEN", ""),
                "Content-Type": "application/json",
            },
        )
    try:
        data = res.json()
    except Exception:
        data = {"raw": res.text}
    if res.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Fonction {name} en erreur ({res.status_code}) : {data}",
        )
    return data


# ── Rapport mensuel ─────────────────────────────────────────────────────────


async def _purchases_for_period(start: datetime, end: datetime) -> dict:
    """
    Achats / réceptions de stock sur la période : mouvements d'inventaire
    positifs (hors annulations de commande), valorisés au coût actuel.
    """
    movements = await asyncio.to_thread(
        lambda: supabase.table("inventory_movements")
        .select("inventory_item_id,change_quantity,reason,reference_type,created_at")
        .gt("change_quantity", 0)
        .gte("created_at", start.astimezone(timezone.utc).isoformat())
        .lt("created_at", end.astimezone(timezone.utc).isoformat())
        .limit(5000)
        .execute()
    )
    rows = [
        m
        for m in (movements.data or [])
        if (m.get("reference_type") or "") != "order"
        and not str(m.get("reason") or "").startswith("order_")
    ]
    if not rows:
        return {"units": 0, "value_chf": None, "lines": []}

    item_ids = list({m["inventory_item_id"] for m in rows if m.get("inventory_item_id")})
    items = await asyncio.to_thread(
        lambda: supabase.table("inventory_items")
        .select("id,variant_id")
        .in_("id", item_ids)
        .execute()
    )
    variant_by_item = {i["id"]: i.get("variant_id") for i in (items.data or [])}
    variant_ids = [v for v in variant_by_item.values() if v]
    variants = (
        await asyncio.to_thread(
            lambda: supabase.table("product_variants")
            .select("id,product_id,title,sku,cost_price")
            .in_("id", variant_ids)
            .execute()
        )
        if variant_ids
        else None
    )
    variant_map = {v["id"]: v for v in ((variants.data if variants else None) or [])}
    product_ids = list({v["product_id"] for v in variant_map.values() if v.get("product_id")})
    products = (
        await asyncio.to_thread(
            lambda: supabase.table("products")
            .select("id,name,vendor")
            .in_("id", product_ids)
            .execute()
        )
        if product_ids
        else None
    )
    product_map = {p["id"]: p for p in ((products.data if products else None) or [])}

    agg: Dict[str, dict] = {}
    total_units = 0
    total_value = Decimal("0")
    value_complete = True
    for m in rows:
        variant = variant_map.get(variant_by_item.get(m.get("inventory_item_id")))
        qty = int(m.get("change_quantity") or 0)
        total_units += qty
        product = product_map.get((variant or {}).get("product_id")) or {}
        key = (variant or {}).get("id") or m.get("inventory_item_id")
        line = agg.setdefault(
            key,
            {
                "product": product.get("name") or "Produit inconnu",
                "vendor": product.get("vendor") or "Sans marque",
                "variant": (variant or {}).get("title"),
                "sku": (variant or {}).get("sku"),
                "units": 0,
                "value_chf": Decimal("0"),
            },
        )
        line["units"] += qty
        if variant and variant.get("cost_price") is not None:
            v = Decimal(str(variant["cost_price"])) * qty
            line["value_chf"] += v
            total_value += v
        else:
            value_complete = False

    lines = sorted(agg.values(), key=lambda r: -r["units"])
    for l in lines:
        l["value_chf"] = float(round(l["value_chf"], 2))
    return {
        "units": total_units,
        "value_chf": float(round(total_value, 2)) if value_complete else None,
        "lines": lines[:100],
    }


async def _build_monthly_report(period: str = "previous_month") -> dict:
    stats = await get_admin_statistics_sales(period=period, _profile=None)
    start, end = stats_period_bounds(period)
    purchases = await _purchases_for_period(start, end)
    chf = (stats.get("currencies") or {}).get("CHF") or {}
    month_label = start.astimezone(ZoneInfo("Europe/Zurich")).strftime("%m/%Y")
    products = [p for p in chf.get("products", []) if p.get("quantity_sold_gross")]
    products.sort(key=lambda p: -float(p.get("revenue_after_discounts") or 0))
    return {
        "period": period,
        "month_label": month_label,
        "start": stats.get("start"),
        "end": stats.get("end"),
        "metrics": chf.get("metrics") or {},
        "brands": chf.get("brands") or [],
        "products_sold": products,
        "best_sellers": chf.get("best_sellers") or [],
        "least_sellers": chf.get("least_sellers") or [],
        "stock_history": stats.get("stock_history"),
        "inventory": stats.get("inventory"),
        "purchases": purchases,
        "limitations": stats.get("limitations") or [],
        "generated_at": now_iso(),
    }


@api_router.get("/internal/reports/monthly")
async def internal_monthly_report(
    request: Request,
    period: str = "previous_month",
):
    """Données du rapport mensuel — appelée par la fonction send-monthly-report."""
    require_internal_token(request)
    return await _build_monthly_report(period)


@api_router.get("/ecom/admin/reports/monthly")
async def admin_monthly_report(
    period: str = "previous_month",
    profile=Depends(require_admin),
):
    return await _build_monthly_report(period)


@api_router.post("/ecom/admin/reports/monthly/send")
async def admin_send_monthly_report(profile=Depends(require_admin)):
    """Déclenche manuellement l'envoi du rapport du mois précédent."""
    return await _supabase_function("send-monthly-report", {"trigger": "manual"})


# ── CTR des bannières promotionnelles ──────────────────────────────────────

BANNER_ID_ALLOWED = set("abcdefghijklmnopqrstuvwxyz0123456789-_")


@api_router.post("/banners/track")
@limiter.limit("120/minute")
async def track_banner_event(request: Request):
    """
    Enregistre un affichage ou un clic de bannière. Le corps est envoyé en
    text/plain par navigator.sendBeacon : on le décode nous-mêmes.
    """
    try:
        raw = await request.body()
        payload = json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        raise HTTPException(status_code=400, detail="Corps invalide")

    banner_id = str(payload.get("banner_id") or "").strip().lower()[:80]
    event_type = payload.get("event_type")

    if (
        not banner_id
        or any(c not in BANNER_ID_ALLOWED for c in banner_id)
        or event_type not in ("view", "click")
    ):
        raise HTTPException(status_code=400, detail="Événement invalide")

    user = await get_optional_user(request)

    try:
        await sb_insert(
            "banner_events",
            {
                "banner_id": banner_id,
                "banner_label": str(payload.get("banner_label") or banner_id)[:160],
                "event_type": event_type,
                "page": str(payload.get("page") or "")[:200] or None,
                "target": str(payload.get("target") or "")[:200] or None,
                "session_id": str(payload.get("session_id") or "")[:80] or None,
                "profile_id": auth_user_id(user),
                "created_at": now_iso(),
            },
        )
    except Exception:
        # Le suivi ne doit jamais casser la navigation
        logger.exception("banner_events insert failed")

    return {"ok": True}


@api_router.get("/ecom/admin/banners/ctr")
async def admin_banner_ctr(
    period: str = "30d",
    profile=Depends(require_admin),
):
    days = {"today": 1, "7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = await asyncio.to_thread(
        lambda: supabase.rpc(
            "banner_ctr_stats", {"p_since": since.isoformat()}
        ).execute()
    )
    rows = result.data or []

    banners = []
    total_views = total_clicks = 0
    for r in rows:
        views = int(r.get("unique_viewers") or 0)
        clicks = int(r.get("clicks") or 0)
        total_views += views
        total_clicks += clicks
        banners.append(
            {
                "banner_id": r["banner_id"],
                "label": r.get("banner_label") or r["banner_id"],
                "views": views,
                "clicks": clicks,
                "unique_clickers": int(r.get("unique_clickers") or 0),
                "ctr": round(clicks / views * 100, 2) if views else None,
                "last_event_at": r.get("last_event_at"),
            }
        )

    banners.sort(key=lambda b: (-(b["ctr"] or 0), -b["views"]))
    return {
        "period": period,
        "since": since.isoformat(),
        "total_views": total_views,
        "total_clicks": total_clicks,
        "global_ctr": (
            round(total_clicks / total_views * 100, 2) if total_views else None
        ),
        "banners": banners,
    }


# ── Fiche client (admin) ───────────────────────────────────────────────────

PAID_ORDER_STATUSES = ("paid", "processing", "shipped", "delivered", "refunded")


async def _safe_rows(fn) -> list:
    """Exécute une requête Supabase et renvoie [] en cas d'erreur
    (ex. table pas encore migrée) pour ne pas casser la fiche client."""
    try:
        result = await asyncio.to_thread(fn)
        return result.data or []
    except Exception as e:
        logger.warning("Fiche client : requête ignorée (%s)", e)
        return []


def _loyalty_status(paid_orders: int, net_spent: float) -> dict:
    """Statut fidélité calculé (indépendant des points)."""
    if net_spent >= 600 or paid_orders >= 6:
        return {"key": "vip", "label": "VIP"}
    if net_spent >= 300 or paid_orders >= 4:
        return {"key": "fidele", "label": "Fidèle"}
    if paid_orders >= 2:
        return {"key": "reguliere", "label": "Régulière"}
    if paid_orders == 1:
        return {"key": "nouvelle", "label": "Nouvelle cliente"}
    return {"key": "prospect", "label": "Prospect (sans achat)"}


@api_router.get("/ecom/admin/customers")
async def admin_list_customers(
    search: Optional[str] = None,
    limit: int = Query(300, gt=0, le=1000),
    profile=Depends(require_admin),
):
    """Liste des clientes avec indicateurs clés (dépense, commandes, statut)."""

    def run_profiles():
        q = supabase.table("profiles").select(
            "id,email,first_name,last_name,phone,role,created_at"
        )
        if search:
            term = search.replace(",", " ").strip()
            q = q.or_(
                f"email.ilike.%{term}%,first_name.ilike.%{term}%,last_name.ilike.%{term}%"
            )
        return q.order("created_at", desc=True).limit(limit).execute()

    profiles = await _safe_rows(run_profiles)
    if not profiles:
        return []

    profile_ids = [p["id"] for p in profiles]
    customers = await _safe_rows(
        lambda: supabase.table("customers")
        .select("id,profile_id,tags,marketing_opt_out")
        .in_("profile_id", profile_ids)
        .execute()
    )
    customer_by_profile = {c["profile_id"]: c for c in customers}
    customer_ids = [c["id"] for c in customers]

    orders = (
        await _safe_rows(
            lambda: supabase.table("orders")
            .select("customer_id,total,status,created_at")
            .in_("customer_id", customer_ids)
            .limit(10000)
            .execute()
        )
        if customer_ids
        else []
    )
    loyalty = await _safe_rows(
        lambda: supabase.table("loyalty_points")
        .select("profile_id,points")
        .in_("profile_id", profile_ids)
        .execute()
    )
    points_by_profile = {l["profile_id"]: l.get("points") or 0 for l in loyalty}

    stats: Dict[str, dict] = {}
    for o in orders:
        st = stats.setdefault(
            o["customer_id"], {"orders": 0, "spent": 0.0, "refunded": 0.0, "last": None}
        )
        if o.get("status") not in PAID_ORDER_STATUSES:
            continue
        total = float(o.get("total") or 0)
        st["orders"] += 1
        st["spent"] += total
        if o.get("status") == "refunded":
            st["refunded"] += total
        if not st["last"] or o["created_at"] > st["last"]:
            st["last"] = o["created_at"]

    rows = []
    for p in profiles:
        c = customer_by_profile.get(p["id"]) or {}
        st = stats.get(c.get("id"), {"orders": 0, "spent": 0.0, "refunded": 0.0, "last": None})
        net = round(st["spent"] - st["refunded"], 2)
        rows.append(
            {
                **p,
                "customer_id": c.get("id"),
                "tags": c.get("tags") or [],
                "marketing_opt_out": bool(c.get("marketing_opt_out")),
                "orders_count": st["orders"],
                "net_spent": net,
                "last_order_at": st["last"],
                "loyalty_points": points_by_profile.get(p["id"], 0),
                "loyalty_status": _loyalty_status(st["orders"], net),
            }
        )
    return rows


@api_router.get("/ecom/admin/customers/{profile_id}")
async def admin_customer_file(profile_id: str, profile=Depends(require_admin)):
    """Fiche client complète : identité, historique, habitudes, fidélité, offres."""
    person = await sb_select_one("profiles", "id", profile_id)
    if not person:
        raise HTTPException(status_code=404, detail="Cliente introuvable")

    email = (person.get("email") or "").strip().lower()
    customers = await _safe_rows(
        lambda: supabase.table("customers").select("*").eq("profile_id", profile_id).execute()
    )
    customer_ids = [c["id"] for c in customers]
    customer = customers[0] if customers else {}

    # Commandes rattachées au compte + commandes invitées avec le même email
    def run_orders():
        q = supabase.table("orders").select(
            "*, order_items(*), payments(*), refunds(*)"
        )
        filters = []
        if customer_ids:
            filters.append(f"customer_id.in.({','.join(customer_ids)})")
        if email:
            filters.append(f"email.ilike.{email}")
        if not filters:
            return type("R", (), {"data": []})()
        return q.or_(",".join(filters)).order("created_at", desc=True).limit(500).execute()

    orders = await _safe_rows(run_orders)
    for o in orders:
        o.pop("stripe_checkout_session_id", None)
        o.pop("stripe_payment_intent_id", None)

    addresses = (
        await _safe_rows(
            lambda: supabase.table("addresses").select("*").in_("customer_id", customer_ids).execute()
        )
        if customer_ids
        else []
    )
    loyalty = await sb_select_one("loyalty_points", "profile_id", profile_id) or {}
    loyalty_tx = await _safe_rows(
        lambda: supabase.table("loyalty_transactions")
        .select("*")
        .eq("profile_id", profile_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    returns = (
        await _safe_rows(
            lambda: supabase.table("return_requests")
            .select("*")
            .ilike("email", email)
            .order("created_at", desc=True)
            .execute()
        )
        if email
        else []
    )
    reviews = (
        await _safe_rows(
            lambda: supabase.table("reviews")
            .select("id,product_id,rating,title,status,created_at")
            .in_("customer_id", customer_ids)
            .order("created_at", desc=True)
            .execute()
        )
        if customer_ids
        else []
    )
    referrals = await _safe_rows(
        lambda: supabase.table("referrals")
        .select("id,referee_email,status,reward_points,created_at,completed_at")
        .eq("referrer_id", profile_id)
        .order("created_at", desc=True)
        .execute()
    )
    discounts = await _safe_rows(
        lambda: supabase.table("discounts")
        .select("id,code,type,value,active,used_count,usage_limit,ends_at,description,campaign,created_at")
        .eq("owner_profile_id", profile_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    followups = (
        await _safe_rows(
            lambda: supabase.table("customer_followups")
            .select("*")
            .eq("customer_email", email)
            .order("created_at", desc=True)
            .limit(30)
            .execute()
        )
        if email
        else []
    )
    offers = await _safe_rows(
        lambda: supabase.table("customer_offers")
        .select("*")
        .eq("profile_id", profile_id)
        .order("created_at", desc=True)
        .limit(30)
        .execute()
    )
    newsletter = (
        await sb_select_one("newsletter_subscribers", "email", email) if email else None
    )
    workshops = (
        await _safe_rows(
            lambda: supabase.table("workshop_bookings")
            .select("id,workshop_id,quantity,amount,status,created_at")
            .ilike("email", email)
            .order("created_at", desc=True)
            .execute()
        )
        if email
        else []
    )
    quiz = await _safe_rows(
        lambda: supabase.table("quiz_results")
        .select("id,recommended_categories,created_at")
        .eq("profile_id", profile_id)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    # ── Indicateurs & habitudes d'achat ─────────────────────────────────────
    paid = [o for o in orders if o.get("status") in PAID_ORDER_STATUSES]
    gross_spent = sum(float(o.get("total") or 0) for o in paid)
    refunded_total = 0.0
    for o in paid:
        refunds = o.get("refunds") or []
        if refunds:
            refunded_total += sum(float(r.get("amount") or 0) for r in refunds)
        elif o.get("status") == "refunded":
            refunded_total += float(o.get("total") or 0)
    net_spent = round(gross_spent - refunded_total, 2)
    paid_dates = sorted(o["created_at"] for o in paid if o.get("created_at"))

    frequency_days = None
    if len(paid_dates) >= 2:
        first = datetime.fromisoformat(paid_dates[0].replace("Z", "+00:00"))
        last = datetime.fromisoformat(paid_dates[-1].replace("Z", "+00:00"))
        frequency_days = round((last - first).days / (len(paid_dates) - 1))

    product_ids = list(
        {
            i.get("product_id")
            for o in paid
            for i in (o.get("order_items") or [])
            if i.get("product_id")
        }
    )
    products = (
        await _safe_rows(
            lambda: supabase.table("products")
            .select("id,name,slug,image,vendor,product_category,price,status")
            .in_("id", product_ids)
            .execute()
        )
        if product_ids
        else []
    )
    product_map = {p["id"]: p for p in products}

    by_product: Dict[str, dict] = {}
    by_category: Dict[str, int] = defaultdict(int)
    by_vendor: Dict[str, int] = defaultdict(int)
    sizes: Dict[str, int] = defaultdict(int)
    for o in paid:
        for i in o.get("order_items") or []:
            qty = int(i.get("quantity") or 0)
            pid = i.get("product_id")
            prod = product_map.get(pid) or {}
            entry = by_product.setdefault(
                pid or i.get("product_title") or "?",
                {
                    "product_id": pid,
                    "name": prod.get("name") or i.get("product_title") or "Produit",
                    "slug": prod.get("slug"),
                    "image": prod.get("image"),
                    "category": prod.get("product_category"),
                    "quantity": 0,
                    "orders": 0,
                    "spent": 0.0,
                    "last_bought_at": None,
                },
            )
            entry["quantity"] += qty
            entry["orders"] += 1
            entry["spent"] += float(i.get("total_price") or 0)
            if not entry["last_bought_at"] or o["created_at"] > entry["last_bought_at"]:
                entry["last_bought_at"] = o["created_at"]
            if prod.get("product_category"):
                by_category[prod["product_category"]] += qty
            if prod.get("vendor"):
                by_vendor[prod["vendor"]] += qty
            if i.get("size"):
                sizes[str(i["size"])] += qty

    top_products = sorted(by_product.values(), key=lambda e: (-e["quantity"], -e["spent"]))
    for e in top_products:
        e["spent"] = round(e["spent"], 2)

    def ranked(d):
        return [{"key": k, "quantity": v} for k, v in sorted(d.items(), key=lambda kv: -kv[1])]

    stats = {
        "orders_count": len(orders),
        "paid_orders_count": len(paid),
        "gross_spent": round(gross_spent, 2),
        "refunded_total": round(refunded_total, 2),
        "net_spent": net_spent,
        "average_basket": round(gross_spent / len(paid), 2) if paid else 0,
        "first_order_at": paid_dates[0] if paid_dates else None,
        "last_order_at": paid_dates[-1] if paid_dates else None,
        "purchase_frequency_days": frequency_days,
        "returns_count": len(returns),
        "reviews_count": len(reviews),
    }

    return {
        "profile": person,
        "customer": customer,
        "addresses": addresses,
        "stats": stats,
        "loyalty": {
            "points": loyalty.get("points") or 0,
            "total_earned": loyalty.get("total_earned") or 0,
            "total_spent": loyalty.get("total_spent") or 0,
            "status": _loyalty_status(len(paid), net_spent),
            "transactions": loyalty_tx,
        },
        "habits": {
            "top_products": top_products[:12],
            "categories": ranked(by_category),
            "brands": ranked(by_vendor),
            "sizes": ranked(sizes),
        },
        "orders": orders,
        "returns": returns,
        "reviews": reviews,
        "referrals": referrals,
        "discounts": discounts,
        "followups": followups,
        "offers": offers,
        "newsletter": newsletter,
        "workshops": workshops,
        "quiz": quiz,
    }


class CustomerAdminUpdate(BaseModel):
    admin_notes: Optional[str] = Field(None, max_length=5000)
    tags: Optional[List[str]] = None
    marketing_opt_out: Optional[bool] = None


@api_router.patch("/ecom/admin/customers/{profile_id}")
async def admin_update_customer(
    profile_id: str,
    payload: CustomerAdminUpdate,
    profile=Depends(require_admin),
):
    person = await sb_select_one("profiles", "id", profile_id)
    if not person:
        raise HTTPException(status_code=404, detail="Cliente introuvable")
    customer = await get_or_create_customer(person)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "tags" in updates:
        updates["tags"] = [t.strip()[:40] for t in updates["tags"] if t.strip()][:20]
    if not updates:
        return customer
    updates["updated_at"] = now_iso()
    await sb_update("customers", updates, "id", customer["id"])
    return await sb_select_one("customers", "id", customer["id"])


class CustomerOfferRequest(BaseModel):
    percent: int = Field(10, ge=5, le=30)
    validity_days: int = Field(21, ge=3, le=90)
    message: Optional[str] = Field(None, max_length=600)


@api_router.post("/ecom/admin/customers/{profile_id}/offer")
async def admin_send_customer_offer(
    profile_id: str,
    payload: CustomerOfferRequest,
    profile=Depends(require_admin),
):
    """Envoie immédiatement une offre personnalisée basée sur les achats."""
    person = await sb_select_one("profiles", "id", profile_id, select="id,email")
    if not person or not person.get("email"):
        raise HTTPException(status_code=404, detail="Cliente introuvable ou sans email")
    return await _supabase_function(
        "send-personalized-offers",
        {
            "mode": "manual",
            "profile_id": profile_id,
            "percent": payload.percent,
            "validity_days": payload.validity_days,
            "message": payload.message,
        },
    )


@api_router.get("/ecom/admin/{table}")
async def list_admin_table(
    table: str,
    limit: int = 200,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    profile=Depends(require_admin),
):
    allowed = PUBLIC_READ_TABLES | CUSTOMER_TABLES | ADMIN_TABLES

    if table not in allowed:
        raise HTTPException(status_code=400, detail="Table non autorisée")

    if table == "orders":

        def run_orders():
            q = supabase.table("orders").select("*, order_items(*)")
            q = q.order("created_at", desc=True)
            if date_from:
                q = q.gte("created_at", date_from)
            if date_to:
                q = q.lte("created_at", date_to + "T23:59:59")
            return q.limit(limit).execute()

        result = await asyncio.to_thread(run_orders)
        return result.data or []

    def run():
        q = supabase.table(table).select("*")
        if date_from and table in ("profiles",):
            q = q.gte("created_at", date_from)
        if date_to and table in ("profiles",):
            q = q.lte("created_at", date_to + "T23:59:59")
        return q.limit(limit).execute()

    result = await asyncio.to_thread(run)
    return result.data or []


@api_router.get("/ecom/admin/orders/{order_id}")
async def get_admin_order(
    order_id: str,
    profile=Depends(require_admin),
):
    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*, order_items(*)")
        .eq("id", order_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    order = result.data[0]
    order["items"] = order.get("order_items", [])

    return order


@api_router.get("/ecom/admin/{table}/{item_id}")
async def get_admin_item(
    table: str,
    item_id: str,
    profile=Depends(require_admin),
):
    allowed = PUBLIC_READ_TABLES | CUSTOMER_TABLES | ADMIN_TABLES

    if table not in allowed:
        raise HTTPException(status_code=400, detail="Table non autorisée")

    item = await sb_select_one(table, "id", item_id)

    if not item:
        raise HTTPException(status_code=404, detail="Élément introuvable")

    return item


@api_router.delete("/ecom/admin/{table}/{item_id}")
async def delete_admin_item(
    table: str,
    item_id: str,
    profile=Depends(require_admin),
):
    allowed = PUBLIC_READ_TABLES | CUSTOMER_TABLES | ADMIN_TABLES

    if table not in allowed:
        raise HTTPException(status_code=400, detail="Table non autorisée")

    await sb_delete(table, "id", item_id)
    return {"status": "deleted"}


@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()

        file_path = f"products/{uuid.uuid4()}-{file.filename}"

        # ✅ IMPORTANT : nom du bucket
        res = await asyncio.to_thread(
            lambda: supabase.storage.from_("product-images").upload(
                file_path, file_bytes, {"content-type": file.content_type}
            )
        )

        public_url = supabase.storage.from_("product-images").get_public_url(file_path)

        return {
            "path": file_path,
            "url": public_url,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/admin/analytics")
async def get_analytics(period: str = "7d", profile=Depends(require_admin)):
    days_map = {"today": 1, "7d": 7, "30d": 30, "90d": 90}
    days = days_map.get(period, 7)

    from datetime import timedelta

    end = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    posthog_key = os.environ.get("POSTHOG_PERSONAL_KEY", "")
    posthog_host = os.environ.get("POSTHOG_HOST", "https://us.posthog.com")

    if not posthog_key:
        return {"pageviews": 0, "active_users": 0, "unique_visitors": 0}

    try:
        async with httpx.AsyncClient() as client:
            # Nouvelle API HogQL
            res = await client.post(
                f"{posthog_host}/api/projects/@current/query/",
                headers={
                    "Authorization": f"Bearer {posthog_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "query": {
                        "kind": "HogQLQuery",
                        "query": f"""
                            SELECT
                                count() as pageviews,
                                count(distinct person_id) as unique_visitors
                            FROM events
                            WHERE event = '$pageview'
                            AND timestamp >= '{start}'
                            AND timestamp <= '{end}'
                        """,
                    }
                },
                timeout=15,
            )

            # Utilisateurs actifs (5 dernières minutes)
            active_res = await client.post(
                f"{posthog_host}/api/projects/@current/query/",
                headers={
                    "Authorization": f"Bearer {posthog_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "query": {
                        "kind": "HogQLQuery",
                        "query": """
                            SELECT count(distinct person_id) as active_users
                            FROM events
                            WHERE event = '$pageview'
                            AND timestamp >= now() - interval 5 minute
                        """,
                    }
                },
                timeout=15,
            )

        data = res.json() if res.status_code == 200 else {}
        active_data = active_res.json() if active_res.status_code == 200 else {}

        results = data.get("results", [[0, 0]])
        row = results[0] if results else [0, 0]

        active_results = active_data.get("results", [[0]])
        active_row = active_results[0] if active_results else [0]

        return {
            "pageviews": row[0] if len(row) > 0 else 0,
            "unique_visitors": row[1] if len(row) > 1 else 0,
            "active_users": active_row[0] if active_row else 0,
        }

    except Exception as e:
        logger.error(f"PostHog analytics error: {e}")
        return {"pageviews": 0, "active_users": 0, "unique_visitors": 0}


# ── Route ────────────────────────────────────────────────────────────────────

ALLOWED_TRANSITIONS = {
    "pending": ["paid", "cancelled"],
    "paid": ["processing", "cancelled"],
    "processing": ["shipped", "cancelled"],
    "shipped": ["delivered"],
    "delivered": [],
    "cancelled": [],
    "refunded": [],
}


@api_router.patch("/ecom/admin/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    payload: OrderStatusUpdate,
    profile=Depends(require_admin),
):
    order = await sb_select_one("orders", "id", order_id)

    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    current_status = order.get("status")
    new_status = payload.status

    allowed = ALLOWED_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transition invalide : {current_status} → {new_status}",
        )

    await sb_update(
        "orders",
        {"status": new_status, "updated_at": now_iso()},
        "id",
        order_id,
    )

    # ── Déclencher l'email de statut ─────────────────────────────────────
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{SUPABASE_URL}/functions/v1/send-order-status-email",
                json={
                    "order_id": order_id,
                    "new_status": new_status,
                },
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
    except Exception as e:
        logger.error(f"send-order-status-email failed: {e}")

    return {"success": True, "order_id": order_id, "status": new_status}


# ── Quiz bien-être ─────────────────────────────────────────────────────────


class QuizSubmitRequest(BaseModel):
    email: str
    answers: Dict[str, Any]
    recommended_categories: List[str]
    profile_id: Optional[str] = None


@api_router.post("/quiz/submit")
async def submit_quiz(payload: QuizSubmitRequest, http_request: Request):
    # Sauvegarder en DB
    quiz_data = {
        "id": str(uuid.uuid4()),
        "email": payload.email,
        "answers": payload.answers,
        "recommended_categories": payload.recommended_categories,
        "profile_id": payload.profile_id,
        "created_at": now_iso(),
    }

    try:
        await sb_insert("quiz_results", quiz_data)
    except Exception as e:
        logger.error(f"Quiz insert error: {e}")

    # Envoyer l'email si email fourni
    if payload.email:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{SUPABASE_URL}/functions/v1/send-quiz-results",
                    json={
                        "email": payload.email,
                        "recommended_categories": payload.recommended_categories,
                        "answers": payload.answers,
                    },
                    headers={
                        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                        "Content-Type": "application/json",
                    },
                    timeout=10,
                )
        except Exception as e:
            logger.error(f"send-quiz-results failed: {e}")

    return {"success": True}


@api_router.get("/quiz/my-results")
async def get_my_quiz_results(profile=Depends(get_current_profile)):
    result = await asyncio.to_thread(
        lambda: supabase.table("quiz_results")
        .select("*")
        .eq("profile_id", profile["id"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


# ── Programme de fidélité ──────────────────────────────────────────────────

LOYALTY_THRESHOLDS = [
    {"points": 200, "reward": 5, "label": "5 CHF"},  # ~150-200 CHF d'achat
    {"points": 400, "reward": 12, "label": "12 CHF"},  # ~350-400 CHF d'achat
    {"points": 800, "reward": 25, "label": "25 CHF"},  # ~750-800 CHF d'achat
]


async def get_or_create_loyalty(profile_id: str) -> dict:
    existing = await sb_select_one("loyalty_points", "profile_id", profile_id)
    if existing:
        return existing

    inserted = await sb_insert(
        "loyalty_points",
        {
            "profile_id": profile_id,
            "points": 0,
            "total_earned": 0,
            "total_spent": 0,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
    )
    return inserted.data[0]


async def add_loyalty_points(
    profile_id: str, points: int, reason: str, order_id: Optional[str] = None
):
    loyalty = await get_or_create_loyalty(profile_id)

    new_points = (loyalty["points"] or 0) + points
    new_total_earned = (loyalty["total_earned"] or 0) + points

    await sb_update(
        "loyalty_points",
        {
            "points": new_points,
            "total_earned": new_total_earned,
            "updated_at": now_iso(),
        },
        "profile_id",
        profile_id,
    )

    tx_data = {
        "id": str(uuid.uuid4()),
        "profile_id": profile_id,
        "order_id": order_id,
        "type": "earn",
        "points": points,
        "reason": reason,
        "created_at": now_iso(),
    }
    await sb_insert("loyalty_transactions", tx_data)


@api_router.get("/loyalty/me")
async def get_my_loyalty(profile=Depends(get_current_profile)):
    loyalty = await get_or_create_loyalty(profile["id"])

    transactions = await asyncio.to_thread(
        lambda: supabase.table("loyalty_transactions")
        .select("*")
        .eq("profile_id", profile["id"])
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    next_threshold = None
    for t in sorted(LOYALTY_THRESHOLDS, key=lambda x: x["points"]):
        if loyalty["points"] < t["points"]:
            next_threshold = t
            break

    return {
        "points": loyalty["points"],
        "total_earned": loyalty["total_earned"],
        "total_spent": loyalty["total_spent"],
        "generated_codes": loyalty.get("generated_codes") or [],  # ← ajouter
        "transactions": transactions.data or [],
        "next_threshold": next_threshold,
        "thresholds": LOYALTY_THRESHOLDS,
    }


@api_router.post("/loyalty/convert")
async def convert_loyalty_points(
    payload: dict,
    profile=Depends(get_current_profile),
):
    try:
        points_to_spend = int(payload.get("points") or 0)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Nombre de points invalide",
        )

    if points_to_spend not in (200, 400, 800):
        raise HTTPException(
            status_code=400,
            detail="Seuil de points invalide",
        )

    try:
        result = await asyncio.to_thread(
            lambda: supabase.rpc(
                "convert_loyalty_to_coupon",
                {
                    "p_profile_id": profile["id"],
                    "p_points": points_to_spend,
                },
            ).execute()
        )
    except Exception as exc:
        if "Points insuffisants" in str(exc):
            raise HTTPException(
                status_code=400,
                detail="Points insuffisants",
            )

        logger.exception("Échec de la conversion fidélité")
        raise HTTPException(
            status_code=503,
            detail="Conversion temporairement indisponible",
        )

    coupon = result.data

    if not isinstance(coupon, dict) or not coupon.get("code"):
        raise HTTPException(
            status_code=503,
            detail="Réponse de conversion invalide",
        )

    # L'e-mail est une notification : son échec
    # ne doit pas annuler le coupon déjà créé.
    email = profile.get("email")

    if email:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{SUPABASE_URL}/functions/v1/send-loyalty-code",
                    json={
                        "email": email,
                        "first_name": profile.get("first_name") or "",
                        "code": coupon["code"],
                        "reward": coupon["reward"],
                        "points_spent": points_to_spend,
                    },
                    headers={
                        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                        "apikey": SUPABASE_SERVICE_ROLE_KEY,
                        "X-Baume-Internal-Token": os.environ["BAUME_INTERNAL_TOKEN"],
                        "Content-Type": "application/json",
                    },
                )
                if response.status_code != 200:
                    logger.error(
                        "send-loyalty-code : HTTP %s — %s",
                        response.status_code,
                        response.text[:300],
                    )
                response.raise_for_status()

        except Exception:
            logger.exception("Échec de l'envoi du coupon de fidélité")

    return coupon


@api_router.get("/orders/{order_id}/tracking")
async def get_order_tracking(order_id: str):
    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*, order_items(*)")
        .eq("id", order_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    order = result.data[0]
    order["items"] = order.get("order_items", [])

    # Ne pas exposer les infos sensibles
    order.pop("stripe_checkout_session_id", None)
    order.pop("stripe_payment_intent_id", None)

    return order


# ── Parrainage ─────────────────────────────────────────────────────────────
#
# Règles anti-abus :
#   • 5 parrainages maximum par marraine et par année civile (fuseau Zurich).
#     Les parrainages en attente comptent dans la limite pour éviter le spam.
#   • Pas d'auto-parrainage (emails normalisés : majuscules, points Gmail,
#     alias « +quelquechose » ignorés).
#   • La filleule doit avoir un vrai compte Baume et aucune commande passée.
#   • Emails jetables refusés.
#   • Une seule inscription parrainée par adresse IP sur 30 jours.
#   • Le code −10 % de la filleule est personnel (lié à son compte),
#     à usage unique et expire après 60 jours.
#   • Les points de la marraine ne sont versés qu'au premier achat payé
#     de la filleule, et retirés si cette commande est remboursée.

REFERRAL_YEARLY_LIMIT = 5
REFERRAL_REWARD_POINTS = 50
REFERRAL_IP_WINDOW_DAYS = 30
REFERRAL_PROMO_VALIDITY_DAYS = 60
REFERRAL_COUNTED_STATUSES = ("pending", "completed")

DISPOSABLE_EMAIL_DOMAINS = {
    "yopmail.com", "yopmail.fr", "mailinator.com", "guerrillamail.com",
    "10minutemail.com", "tempmail.com", "temp-mail.org", "trashmail.com",
    "getnada.com", "dispostable.com", "sharklasers.com", "maildrop.cc",
    "throwawaymail.com", "fakeinbox.com", "mohmal.com", "emailondeck.com",
    "jetable.org", "mailnesia.com", "tempail.com", "minuteinbox.com",
}


def normalize_email(email: str) -> str:
    """Normalise un email pour repérer les doublons déguisés."""
    email = (email or "").strip().lower()
    if "@" not in email:
        return email
    local, domain = email.rsplit("@", 1)
    local = local.split("+", 1)[0]
    if domain in ("gmail.com", "googlemail.com"):
        local = local.replace(".", "")
        domain = "gmail.com"
    return f"{local}@{domain}"


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def _year_start_utc_iso() -> str:
    zurich = ZoneInfo("Europe/Zurich")
    now_local = datetime.now(zurich)
    start_local = datetime(now_local.year, 1, 1, tzinfo=zurich)
    return start_local.astimezone(timezone.utc).isoformat()


async def _referrals_used_this_year(referrer_id: str, statuses=REFERRAL_COUNTED_STATUSES) -> int:
    result = await asyncio.to_thread(
        lambda: supabase.table("referrals")
        .select("id", count="exact")
        .eq("referrer_id", referrer_id)
        .in_("status", list(statuses))
        .gte("created_at", _year_start_utc_iso())
        .execute()
    )
    return result.count or 0


def generate_referral_code(first_name: str, profile_id: str) -> str:
    """Génère un code parrainage unique basé sur le prénom + ID"""
    clean_name = "".join(c for c in (first_name or "BAUME").upper() if c.isalpha())[:6]
    short_id = profile_id[:4].upper()
    return f"BAUME-{clean_name}-{short_id}"


@api_router.get("/referral/me")
async def get_my_referral(profile=Depends(get_current_profile)):
    # Générer le code si pas encore créé
    if not profile.get("referral_code"):
        code = generate_referral_code(profile.get("first_name", ""), profile["id"])
        await sb_update("profiles", {"referral_code": code}, "id", profile["id"])
        profile["referral_code"] = code

    # Récupérer les parrainages effectués
    referrals = await asyncio.to_thread(
        lambda: supabase.table("referrals")
        .select("id,referee_email,status,reward_points,created_at,completed_at")
        .eq("referrer_id", profile["id"])
        .order("created_at", desc=True)
        .execute()
    )

    rows = referrals.data or []
    completed = [r for r in rows if r["status"] == "completed"]
    pending = [r for r in rows if r["status"] == "pending"]
    used_this_year = await _referrals_used_this_year(profile["id"])

    # Masquer partiellement les emails des filleules
    def mask(email: str) -> str:
        if not email or "@" not in email:
            return email
        local, domain = email.split("@", 1)
        return f"{local[:2]}***@{domain}"

    for r in rows:
        r["referee_email"] = mask(r.get("referee_email", ""))

    return {
        "referral_code": profile["referral_code"],
        "referral_link": f"{FRONTEND_URL}/inscription?ref={profile['referral_code']}",
        "total_referrals": len(completed),
        "pending_referrals": len(pending),
        "total_points_earned": sum(int(r.get("reward_points") or 0) for r in completed),
        "yearly_limit": REFERRAL_YEARLY_LIMIT,
        "used_this_year": used_this_year,
        "remaining_this_year": max(0, REFERRAL_YEARLY_LIMIT - used_this_year),
        "referrals": rows,
    }


@api_router.get("/referral/check/{code}")
@limiter.limit("30/minute")
async def check_referral_code(request: Request, code: str):
    """Vérifie si un code parrainage est valide (et pas au maximum annuel)"""
    profile = await asyncio.to_thread(
        lambda: supabase.table("profiles")
        .select("id, first_name, referral_code")
        .eq("referral_code", code.strip().upper())
        .limit(1)
        .execute()
    )

    if not profile.data:
        raise HTTPException(status_code=404, detail="Code parrainage invalide")

    referrer = profile.data[0]

    if await _referrals_used_this_year(referrer["id"]) >= REFERRAL_YEARLY_LIMIT:
        raise HTTPException(
            status_code=409,
            detail="Ce code parrainage a atteint sa limite pour cette année.",
        )

    return {
        "valid": True,
        "referrer_name": referrer.get("first_name", "une amie"),
    }


@api_router.post("/referral/register")
@limiter.limit("5/hour")
async def register_referral(request: Request, payload: dict):
    """Enregistre un parrainage juste après l'inscription de la filleule"""
    referral_code = (payload.get("referral_code") or "").strip().upper()
    referee_email = (payload.get("email") or "").strip().lower()

    if not referral_code or not referee_email or "@" not in referee_email:
        raise HTTPException(status_code=400, detail="Code et email requis")

    referee_norm = normalize_email(referee_email)
    domain = referee_norm.rsplit("@", 1)[-1]

    if domain in DISPOSABLE_EMAIL_DOMAINS:
        raise HTTPException(
            status_code=400,
            detail="Les adresses email temporaires ne sont pas acceptées pour le parrainage.",
        )

    # Marraine
    referrer_result = await asyncio.to_thread(
        lambda: supabase.table("profiles")
        .select("id, first_name, email")
        .eq("referral_code", referral_code)
        .limit(1)
        .execute()
    )
    if not referrer_result.data:
        raise HTTPException(status_code=404, detail="Code parrainage invalide")
    referrer = referrer_result.data[0]

    # Pas d'auto-parrainage
    if normalize_email(referrer.get("email", "")) == referee_norm:
        raise HTTPException(
            status_code=400, detail="Vous ne pouvez pas utiliser votre propre code."
        )

    # La filleule doit avoir un vrai compte Baume
    referee_profile = await sb_select_one(
        "profiles", "email", referee_email, select="id,email"
    )
    if not referee_profile:
        raise HTTPException(
            status_code=400,
            detail="Créez d'abord votre compte pour utiliser un code parrainage.",
        )
    if referee_profile["id"] == referrer["id"]:
        raise HTTPException(
            status_code=400, detail="Vous ne pouvez pas utiliser votre propre code."
        )

    # La filleule ne doit jamais avoir commandé
    previous_orders = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("id", count="exact")
        .ilike("email", referee_email)
        .in_("status", ["paid", "processing", "shipped", "delivered", "refunded"])
        .execute()
    )
    if (previous_orders.count or 0) > 0:
        raise HTTPException(
            status_code=409,
            detail="Le parrainage est réservé aux nouvelles clientes.",
        )

    # Email déjà parrainé (y compris variantes Gmail / alias +)
    existing = await asyncio.to_thread(
        lambda: supabase.table("referrals")
        .select("id")
        .or_(
            f"referee_email_normalized.eq.{referee_norm},"
            f"referee_email.eq.{referee_email}"
        )
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="Email déjà parrainé")

    # Une seule inscription parrainée par IP sur 30 jours
    ip = client_ip(request)
    if ip:
        since = (
            datetime.now(timezone.utc) - timedelta(days=REFERRAL_IP_WINDOW_DAYS)
        ).isoformat()
        same_ip = await asyncio.to_thread(
            lambda: supabase.table("referrals")
            .select("id", count="exact")
            .eq("referee_ip", ip)
            .gte("created_at", since)
            .execute()
        )
        if (same_ip.count or 0) > 0:
            logger.warning("Parrainage refusé : IP déjà utilisée (%s)", ip)
            raise HTTPException(
                status_code=429,
                detail="Un parrainage a déjà été enregistré récemment depuis cet appareil.",
            )

    # Limite annuelle de la marraine
    if await _referrals_used_this_year(referrer["id"]) >= REFERRAL_YEARLY_LIMIT:
        raise HTTPException(
            status_code=409,
            detail="Ce code parrainage a atteint sa limite de 5 parrainages pour cette année.",
        )

    referral_id = str(uuid.uuid4())
    await sb_insert(
        "referrals",
        {
            "id": referral_id,
            "referrer_id": referrer["id"],
            "referee_email": referee_email,
            "referee_email_normalized": referee_norm,
            "referee_profile_id": referee_profile["id"],
            "referee_ip": ip or None,
            "referral_code": referral_code,
            "status": "pending",
            "reward_points": REFERRAL_REWARD_POINTS,
            "created_at": now_iso(),
        },
    )

    # Code −10 % personnel, usage unique, valable 60 jours
    promo_code = f"PARRAIN{str(uuid.uuid4())[:6].upper()}"
    await sb_insert(
        "discounts",
        {
            "id": str(uuid.uuid4()),
            "code": promo_code,
            "type": "percentage",
            "value": 10,
            "active": True,
            "usage_limit": 1,
            "used_count": 0,
            "owner_profile_id": referee_profile["id"],
            "ends_at": (
                datetime.now(timezone.utc)
                + timedelta(days=REFERRAL_PROMO_VALIDITY_DAYS)
            ).isoformat(),
            "description": f"Code parrainage — {referral_code}",
            "created_at": now_iso(),
        },
    )

    return {
        "success": True,
        "promo_code": promo_code,
        "referrer_name": referrer.get("first_name", "votre amie"),
    }


async def _complete_referral_for_order(order: dict) -> Optional[dict]:
    """
    Appelée automatiquement après une commande payée (webhook Stripe).
    Valide le parrainage en attente de la filleule et crédite la marraine,
    dans la limite de 5 parrainages validés par année civile.
    """
    email = (order.get("email") or "").strip().lower()
    if not email:
        return None

    norm = normalize_email(email)
    referral = await asyncio.to_thread(
        lambda: supabase.table("referrals")
        .select("*")
        .eq("status", "pending")
        .or_(f"referee_email_normalized.eq.{norm},referee_email.eq.{email}")
        .limit(1)
        .execute()
    )
    if not referral.data:
        return None
    ref = referral.data[0]

    # Uniquement la toute première commande payée de la filleule
    paid_orders = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("id", count="exact")
        .ilike("email", email)
        .in_("status", ["paid", "processing", "shipped", "delivered", "refunded"])
        .execute()
    )
    if (paid_orders.count or 0) > 1:
        await sb_update(
            "referrals",
            {"status": "rejected", "rejection_reason": "not_first_order"},
            "id",
            ref["id"],
        )
        return None

    completed_this_year = await _referrals_used_this_year(
        ref["referrer_id"], statuses=("completed",)
    )
    if completed_this_year >= REFERRAL_YEARLY_LIMIT:
        await sb_update(
            "referrals",
            {"status": "capped", "order_id": order["id"], "completed_at": now_iso()},
            "id",
            ref["id"],
        )
        return None

    # Verrou optimiste : on ne passe en "completed" que si encore "pending"
    updated = await asyncio.to_thread(
        lambda: supabase.table("referrals")
        .update(
            {"status": "completed", "order_id": order["id"], "completed_at": now_iso()}
        )
        .eq("id", ref["id"])
        .eq("status", "pending")
        .execute()
    )
    if not updated.data:
        return None

    points = int(ref.get("reward_points") or REFERRAL_REWARD_POINTS)
    await add_loyalty_points(
        profile_id=ref["referrer_id"],
        points=points,
        reason=f"Parrainage validé — {email}",
        order_id=order["id"],
    )
    return {"referral_id": ref["id"], "points_awarded": points}


async def _reverse_referral_for_order(order_id: str):
    """Retire les points de parrainage si la commande de la filleule est remboursée."""
    if not order_id:
        return
    ref = await asyncio.to_thread(
        lambda: supabase.table("referrals")
        .select("*")
        .eq("order_id", order_id)
        .eq("status", "completed")
        .limit(1)
        .execute()
    )
    if not ref.data:
        return
    ref = ref.data[0]
    points = int(ref.get("reward_points") or 0)

    loyalty = await get_or_create_loyalty(ref["referrer_id"])
    await sb_update(
        "loyalty_points",
        {
            "points": max(0, int(loyalty.get("points") or 0) - points),
            "total_earned": max(0, int(loyalty.get("total_earned") or 0) - points),
            "updated_at": now_iso(),
        },
        "profile_id",
        ref["referrer_id"],
    )
    await sb_insert(
        "loyalty_transactions",
        {
            "id": str(uuid.uuid4()),
            "profile_id": ref["referrer_id"],
            "order_id": order_id,
            "type": "adjust",
            "points": -points,
            "reason": "Parrainage annulé — commande remboursée",
            "created_at": now_iso(),
        },
    )
    await sb_update("referrals", {"status": "reversed"}, "id", ref["id"])


@api_router.post("/referral/complete")
async def complete_referral(payload: dict, profile=Depends(require_admin)):
    """Validation manuelle (admin) — mêmes règles que la validation automatique"""
    order_id = payload.get("order_id", "")
    order = await sb_select_one("orders", "id", order_id, select="id,email,status")
    if not order:
        return {"success": False, "message": "Commande introuvable"}

    result = await _complete_referral_for_order(order)
    if not result:
        return {
            "success": False,
            "message": "Aucun parrainage validable (absent, déjà traité ou limite annuelle atteinte)",
        }
    return {"success": True, "points_awarded": result["points_awarded"]}


@api_router.post("/ecom/admin/scan")
async def process_scan(payload: dict, profile=Depends(require_admin)):
    barcode = payload.get("barcode", "").strip()
    action = payload.get("action", "lookup")
    quantity = int(payload.get("quantity", 1))

    if not barcode:
        raise HTTPException(status_code=400, detail="Code barre manquant")

    variant_result = await asyncio.to_thread(
        lambda: supabase.table("product_variants")
        .select("*, products(*)")
        .or_(f"barcode.eq.{barcode},sku.eq.{barcode}")
        .limit(1)
        .execute()
    )

    if not variant_result.data:
        raise HTTPException(
            status_code=404, detail="Produit introuvable pour ce code barre"
        )

    v = variant_result.data[0]
    product = v.get("products", {})
    previous_stock = int(v.get("stock", 0))

    if action == "stock_in":
        new_stock = previous_stock + quantity
    elif action == "stock_out":
        new_stock = max(previous_stock - quantity, 0)
    else:
        new_stock = previous_stock

    if action != "lookup":
        await sb_update(
            "product_variants",
            {
                "stock": new_stock,
                "available": new_stock > 0,
                "updated_at": now_iso(),
            },
            "id",
            v["id"],
        )
        await sync_variant_inventory(v["id"])

    await sb_insert(
        "barcode_scans",
        {
            "id": str(uuid.uuid4()),
            "barcode": barcode,
            "variant_id": v["id"],
            "action": action,
            "quantity": quantity,
            "scanned_by": profile["id"],
            "created_at": now_iso(),
        },
    )

    return {
        "product_name": product.get("name") or product.get("title"),
        "sku": v.get("sku"),
        "variant_title": v.get("title"),
        "previous_stock": previous_stock,
        "current_stock": new_stock,
    }


# ── Pré-commandes ──────────────────────────────────────────────────────────


@api_router.post("/ecom/admin/products/{product_id}/preorder")
async def set_product_preorder(
    product_id: str,
    payload: dict,
    profile=Depends(require_admin),
):
    """Active ou désactive le mode pré-commande sur un produit."""
    await sb_update(
        "products",
        {
            "preorder": payload.get("preorder", False),
            "preorder_shipping_date": payload.get("preorder_shipping_date"),
            "preorder_message": payload.get("preorder_message"),
            "updated_at": now_iso(),
        },
        "id",
        product_id,
    )
    return await sb_select_one("products", "id", product_id)


@api_router.post("/ecom/admin/products/{product_id}/preorder/notify")
async def notify_preorder_customers(
    product_id: str,
    profile=Depends(require_admin),
):
    """Envoie un email à tous les clients ayant précommandé ce produit."""
    product = await sb_select_one("products", "id", product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    # Récupérer toutes les notifications non encore envoyées
    result = await asyncio.to_thread(
        lambda: supabase.table("preorder_notifications")
        .select("*")
        .eq("product_id", product_id)
        .is_("notified_at", "null")
        .execute()
    )

    notifications = result.data or []

    if not notifications:
        return {"success": True, "notified": 0, "message": "Aucun client à notifier"}

    notified = 0
    for notif in notifications:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{SUPABASE_URL}/functions/v1/send-preorder-available",
                    json={
                        "email": notif["email"],
                        "product_id": product_id,
                        "product_name": product.get("name"),
                        "product_slug": product.get("slug"),
                        "notification_id": notif["id"],
                    },
                    headers={
                        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                        "Content-Type": "application/json",
                    },
                    timeout=10,
                )

            # Marquer comme notifié
            await sb_update(
                "preorder_notifications",
                {"notified_at": now_iso()},
                "id",
                notif["id"],
            )
            notified += 1

        except Exception as e:
            logger.error(f"Preorder notification failed for {notif['email']}: {e}")
            continue

    # Désactiver le mode pré-commande sur le produit
    await sb_update(
        "products",
        {"preorder": False, "updated_at": now_iso()},
        "id",
        product_id,
    )

    return {"success": True, "notified": notified}


@api_router.get("/ecom/admin/products/{product_id}/preorder/subscribers")
async def get_preorder_subscribers(
    product_id: str,
    profile=Depends(require_admin),
):
    """Liste les clients ayant précommandé ce produit."""
    result = await asyncio.to_thread(
        lambda: supabase.table("preorder_notifications")
        .select("*")
        .eq("product_id", product_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


# ── Chat / Conversations ───────────────────────────────────────────────────


class MessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class ConversationCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


async def _auto_lock_expired_conversations():
    """Verrouille automatiquement les conversations inactives depuis 48h."""
    from datetime import timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()

    await asyncio.to_thread(
        lambda: supabase.table("conversations")
        .update(
            {
                "status": "locked",
                "locked_at": now_iso(),
            }
        )
        .eq("status", "open")
        .lt("last_message_at", cutoff)
        .execute()
    )


@api_router.post("/conversations")
@limiter.limit("20/minute")
async def create_conversation(
    request: Request,  # ← ajouter
    payload: ConversationCreateRequest,
    profile=Depends(get_current_profile),
):
    """Crée une nouvelle conversation et envoie le premier message."""
    await _auto_lock_expired_conversations()

    customer = await get_or_create_customer(profile)

    # Vérifier si une conversation ouverte existe déjà
    existing = await asyncio.to_thread(
        lambda: supabase.table("conversations")
        .select("*")
        .eq("profile_id", profile["id"])
        .eq("status", "open")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if existing.data:
        conversation = existing.data[0]
    else:
        inserted = await sb_insert(
            "conversations",
            {
                "profile_id": profile["id"],
                "customer_id": customer["id"],
                "email": profile.get("email"),
                "status": "open",
                "last_message_at": now_iso(),
                "created_at": now_iso(),
            },
        )
        conversation = inserted.data[0]

    # Insérer le premier message
    await sb_insert(
        "messages",
        {
            "conversation_id": conversation["id"],
            "sender_id": profile["id"],
            "sender_role": profile.get("role", "customer"),
            "content": payload.content,
            "created_at": now_iso(),
        },
    )

    # Mettre à jour last_message_at
    await sb_update(
        "conversations",
        {"last_message_at": now_iso()},
        "id",
        conversation["id"],
    )

    return conversation


@api_router.get("/conversations/mine")
async def get_my_conversations(profile=Depends(get_current_profile)):
    """Récupère toutes les conversations du client connecté."""
    await _auto_lock_expired_conversations()

    result = await asyncio.to_thread(
        lambda: supabase.table("conversations")
        .select("*")
        .eq("profile_id", profile["id"])
        .order("last_message_at", desc=True)
        .execute()
    )
    return result.data or []


# Retirer le décorateur @limiter.limit("30/minute") complètement
@api_router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    request: Request,
    conversation_id: str,
    profile=Depends(get_current_profile),
):
    """Récupère les messages d'une conversation."""
    conversation = await sb_select_one("conversations", "id", conversation_id)

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation introuvable")

    is_admin = profile.get("role") == "admin"
    if not is_admin and conversation.get("profile_id") != profile["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # Marquer les messages comme lus
    await asyncio.to_thread(
        lambda: supabase.table("messages")
        .update({"read_at": now_iso()})
        .eq("conversation_id", conversation_id)
        .neq("sender_id", profile["id"])
        .is_("read_at", "null")
        .execute()
    )

    result = await asyncio.to_thread(
        lambda: supabase.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )

    return result.data or []


@api_router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    payload: MessageRequest,
    profile=Depends(get_current_profile),
):
    """Envoie un message dans une conversation."""
    conversation = await sb_select_one("conversations", "id", conversation_id)

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation introuvable")

    is_admin = profile.get("role") == "admin"

    if not is_admin and conversation.get("profile_id") != profile["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    if conversation.get("status") == "locked":
        raise HTTPException(
            status_code=403, detail="Cette conversation est verrouillée."
        )

    inserted = await sb_insert(
        "messages",
        {
            "conversation_id": conversation_id,
            "sender_id": profile["id"],
            "sender_role": "admin" if is_admin else "customer",
            "content": payload.content,
            "created_at": now_iso(),
        },
    )

    await sb_update(
        "conversations",
        {"last_message_at": now_iso()},
        "id",
        conversation_id,
    )

    return inserted.data[0]


@api_router.get("/ecom/admin/conversations")
async def list_all_conversations(
    status: Optional[str] = None,
    profile=Depends(require_admin),
):
    """Liste toutes les conversations — admin uniquement."""
    await _auto_lock_expired_conversations()

    def run():
        q = (
            supabase.table("conversations")
            .select("*")
            .order("last_message_at", desc=True)
        )
        if status:
            q = q.eq("status", status)
        return q.limit(100).execute()

    result = await asyncio.to_thread(run)
    return result.data or []


@api_router.patch("/ecom/admin/conversations/{conversation_id}/lock")
async def lock_conversation(
    conversation_id: str,
    profile=Depends(require_admin),
):
    """Verrouille une conversation — admin uniquement."""
    await sb_update(
        "conversations",
        {
            "status": "locked",
            "locked_at": now_iso(),
            "locked_by": profile["id"],
        },
        "id",
        conversation_id,
    )
    return {"success": True, "status": "locked"}


@api_router.patch("/ecom/admin/conversations/{conversation_id}/unlock")
async def unlock_conversation(
    conversation_id: str,
    profile=Depends(require_admin),
):
    """Déverrouille une conversation — admin uniquement."""
    await sb_update(
        "conversations",
        {
            "status": "open",
            "locked_at": None,
            "locked_by": None,
        },
        "id",
        conversation_id,
    )
    return {"success": True, "status": "open"}


@api_router.delete("/ecom/admin/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    profile=Depends(require_admin),
):
    """Supprime une conversation — admin uniquement."""
    await sb_delete("conversations", "id", conversation_id)
    return {"success": True}


@api_router.patch("/conversations/{conversation_id}/typing")
async def update_typing(
    conversation_id: str,
    payload: dict,
    profile=Depends(get_current_profile),
):
    role = payload.get("role")
    is_admin = profile.get("role") == "admin"

    if is_admin:
        await sb_update(
            "conversations",
            {"admin_typing_at": now_iso() if role else None},
            "id",
            conversation_id,
        )
    else:
        await sb_update(
            "conversations",
            {"customer_typing_at": now_iso() if role else None},
            "id",
            conversation_id,
        )

    return {"success": True}


# ── Retours & Remboursements ───────────────────────────────────────────────────


class ReturnRequestCreate(BaseModel):
    order_id: str
    reason: str = Field(
        ..., pattern="^(defective|wrong_item|not_as_described|changed_mind|other)$"
    )
    message: str = Field(..., min_length=10, max_length=2000)
    images: List[str] = []


class ReturnRequestReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    admin_note: Optional[str] = None


@api_router.post("/returns")
async def create_return_request(
    payload: ReturnRequestCreate,
    profile=Depends(get_current_profile),
):
    """Client soumet une demande de retour."""
    customer = await get_or_create_customer(profile)

    # Vérifier que la commande appartient au client
    order = await sb_select_one("orders", "id", payload.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    owns = order.get("customer_id") == customer["id"] or order.get(
        "email"
    ) == profile.get("email")
    if not owns:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # Vérifier qu'une demande n'existe pas déjà pour cette commande
    existing = await asyncio.to_thread(
        lambda: supabase.table("return_requests")
        .select("id, status")
        .eq("order_id", payload.order_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail=f"Une demande de retour existe déjà pour cette commande (statut : {existing.data[0]['status']}).",
        )

    # Vérifier que la commande est dans un état retournable
    if order.get("status") not in ("paid", "processing", "shipped", "delivered"):
        raise HTTPException(
            status_code=400,
            detail="Cette commande ne peut pas faire l'objet d'un retour.",
        )

    inserted = await sb_insert(
        "return_requests",
        {
            "order_id": payload.order_id,
            "customer_id": customer["id"],
            "email": profile.get("email", order.get("email", "")),
            "reason": payload.reason,
            "message": payload.message,
            "images": payload.images,
            "status": "pending",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        },
    )

    return_request = inserted.data[0]

    # Notifier l'admin par email
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{SUPABASE_URL}/functions/v1/send-return-status-email",
                json={
                    "return_request_id": return_request["id"],
                    "type": "new_request",
                    "email": return_request["email"],
                    "order_id": payload.order_id,
                    "reason": payload.reason,
                },
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
    except Exception as e:
        logger.error(f"send-return-status-email failed: {e}")

    return return_request


@api_router.get("/returns/mine")
async def get_my_return_requests(profile=Depends(get_current_profile)):
    """Récupère toutes les demandes de retour du client."""
    customer = await get_or_create_customer(profile)

    result = await asyncio.to_thread(
        lambda: supabase.table("return_requests")
        .select("*, orders(id, total, currency, created_at, status)")
        .eq("customer_id", customer["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@api_router.get("/returns/{return_id}")
async def get_return_request(
    return_id: str,
    profile=Depends(get_current_profile),
):
    """Récupère une demande de retour."""
    result = await asyncio.to_thread(
        lambda: supabase.table("return_requests")
        .select("*, orders(id, total, currency, created_at, status, order_items(*))")
        .eq("id", return_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Demande introuvable")

    req = result.data[0]
    is_admin = profile.get("role") == "admin"

    if not is_admin:
        customer = await get_or_create_customer(profile)
        if req.get("customer_id") != customer["id"]:
            raise HTTPException(status_code=403, detail="Accès refusé")

    return req


@api_router.get("/ecom/admin/returns")
async def list_all_return_requests(
    status: Optional[str] = None,
    profile=Depends(require_admin),
):
    """Liste toutes les demandes de retour — admin uniquement."""

    def run():
        q = (
            supabase.table("return_requests")
            .select(
                "*, orders(id, total, currency, created_at, status, order_items(*))"
            )
            .order("created_at", desc=True)
        )
        if status:
            q = q.eq("status", status)
        return q.limit(200).execute()

    result = await asyncio.to_thread(run)
    return result.data or []


@api_router.patch("/ecom/admin/returns/{return_id}/review")
async def review_return_request(
    return_id: str,
    payload: ReturnRequestReview,
    profile=Depends(require_admin),
):
    """Admin approuve ou refuse une demande de retour."""
    req = await sb_select_one("return_requests", "id", return_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable")

    if req.get("status") != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Cette demande a déjà été traitée (statut : {req['status']}).",
        )

    await sb_update(
        "return_requests",
        {
            "status": payload.status,
            "admin_note": payload.admin_note,
            "reviewed_at": now_iso(),
            "reviewed_by": profile["id"],
            "updated_at": now_iso(),
        },
        "id",
        return_id,
    )

    # Envoyer email au client
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{SUPABASE_URL}/functions/v1/send-return-status-email",
                json={
                    "return_request_id": return_id,
                    "type": payload.status,  # "approved" ou "rejected"
                    "email": req["email"],
                    "order_id": req["order_id"],
                    "admin_note": payload.admin_note,
                },
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
    except Exception as e:
        logger.error(f"send-return-status-email failed: {e}")

    return await sb_select_one("return_requests", "id", return_id)


@api_router.patch("/ecom/admin/returns/{return_id}/refund")
async def process_return_refund(
    return_id: str,
    profile=Depends(require_admin),
):
    """Admin déclenche le remboursement manuellement."""
    req = await sb_select_one("return_requests", "id", return_id)
    if not req:
        raise HTTPException(status_code=404, detail="Demande introuvable")

    if req.get("status") != "approved":
        raise HTTPException(
            status_code=400,
            detail="La demande doit être approuvée avant de déclencher le remboursement.",
        )

    # Déclencher le remboursement via l'Edge Function existante
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{SUPABASE_URL}/functions/v1/refund-order",
                json={"orderId": req["order_id"]},
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=30,
            )
            # ← Lire le body une seule fois
            response_text = res.text
            try:
                refund_data = res.json()
            except Exception:
                refund_data = {"raw": response_text}

            if res.status_code != 200:
                raise HTTPException(
                    status_code=500, detail=f"Erreur remboursement : {response_text}"
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"refund-order failed: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du remboursement")

    # Parrainage : retirer les points si c'était la 1re commande d'une filleule
    try:
        await _reverse_referral_for_order(req["order_id"])
    except Exception:
        logger.exception("Annulation parrainage échouée pour %s", req["order_id"])

    # Mettre à jour la demande
    await sb_update(
        "return_requests",
        {
            "status": "refunded",
            "refunded_at": now_iso(),
            "updated_at": now_iso(),
        },
        "id",
        return_id,
    )

    # Envoyer email de confirmation au client
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{SUPABASE_URL}/functions/v1/send-return-status-email",
                json={
                    "return_request_id": return_id,
                    "type": "refunded",
                    "email": req["email"],
                    "order_id": req["order_id"],
                },
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
    except Exception as e:
        logger.error(f"send-return-status-email failed: {e}")

    return {
        "success": True,
        "refund": refund_data,
        "return_request_id": return_id,
    }


@api_router.post("/returns/upload-image")
async def upload_return_image(
    file: UploadFile = File(...),
    profile=Depends(get_current_profile),
):
    """Upload une image pour une demande de retour."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, detail="Fichier non valide — image uniquement."
        )

    file_bytes = await file.read()

    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image trop lourde — 5 Mo maximum.")

    file_path = f"returns/{profile['id']}/{uuid.uuid4()}-{file.filename}"

    await asyncio.to_thread(
        lambda: supabase.storage.from_("return-images").upload(
            file_path, file_bytes, {"content-type": file.content_type}
        )
    )

    public_url = supabase.storage.from_("return-images").get_public_url(file_path)

    return {"path": file_path, "url": public_url}


# ── Newsletter ─────────────────────────────────────────────────────────────────


class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr
    source: Optional[str] = "footer"


@api_router.post("/newsletter/subscribe")
@limiter.limit("5/minute")
async def newsletter_subscribe(
    request: Request,
    payload: NewsletterSubscribeRequest,
):
    """Inscription à la newsletter."""

    # Vérifier si déjà inscrit
    existing = await sb_select_one("newsletter_subscribers", "email", payload.email)

    if existing:
        if existing.get("status") == "active":
            # Déjà inscrit et actif — silencieux pour éviter l'énumération
            return {"success": True, "already_subscribed": True}
        else:
            # Était désabonné — réactiver
            await sb_update(
                "newsletter_subscribers",
                {
                    "status": "active",
                    "unsubscribed_at": None,
                    "updated_at": now_iso(),
                },
                "email",
                payload.email,
            )
            subscriber = await sb_select_one(
                "newsletter_subscribers", "email", payload.email
            )
    else:
        # Nouvel abonné
        inserted = await sb_insert(
            "newsletter_subscribers",
            {
                "email": payload.email,
                "status": "active",
                "source": payload.source or "footer",
                "created_at": now_iso(),
            },
        )
        subscriber = inserted.data[0]

    # Envoyer l'email de bienvenue newsletter
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{SUPABASE_URL}/functions/v1/send-newsletter-welcome",
                json={
                    "email": payload.email,
                    "unsubscribe_token": subscriber["unsubscribe_token"],
                },
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=10,
            )
    except Exception as e:
        logger.error(f"send-newsletter-welcome failed: {e}")

    return {"success": True, "already_subscribed": False}


@api_router.get("/newsletter/unsubscribe")
async def newsletter_unsubscribe(token: str):
    """Désabonnement via le lien dans l'email."""

    # Chercher l'abonné par token
    result = await asyncio.to_thread(
        lambda: supabase.table("newsletter_subscribers")
        .select("*")
        .eq("unsubscribe_token", token)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Lien invalide ou expiré")

    subscriber = result.data[0]

    if subscriber.get("status") == "unsubscribed":
        return {
            "success": True,
            "already_unsubscribed": True,
            "email": subscriber["email"],
        }

    await sb_update(
        "newsletter_subscribers",
        {
            "status": "unsubscribed",
            "unsubscribed_at": now_iso(),
        },
        "unsubscribe_token",
        token,
    )

    return {
        "success": True,
        "already_unsubscribed": False,
        "email": subscriber["email"],
    }


@api_router.get("/ecom/admin/newsletter/subscribers")
async def list_newsletter_subscribers(
    status: Optional[str] = None,
    profile=Depends(require_admin),
):
    """Liste tous les abonnés newsletter — admin uniquement."""

    def run():
        q = (
            supabase.table("newsletter_subscribers")
            .select("*")
            .order("created_at", desc=True)
        )
        if status:
            q = q.eq("status", status)
        return q.limit(1000).execute()

    result = await asyncio.to_thread(run)
    return result.data or []


@api_router.get("/ecom/admin/newsletter/stats")
async def newsletter_stats(profile=Depends(require_admin)):
    """Statistiques newsletter — admin uniquement."""
    total = await sb_count("newsletter_subscribers")
    active = await sb_count("newsletter_subscribers", {"status": "active"})
    unsubscribed = await sb_count("newsletter_subscribers", {"status": "unsubscribed"})

    return {
        "total": total,
        "active": active,
        "unsubscribed": unsubscribed,
    }


@api_router.post("/ecom/admin/loyalty/credit")
async def admin_credit_points(
    payload: dict,
    profile=Depends(require_admin),
):
    profile_id = payload.get("profile_id")
    points = int(payload.get("points", 0))
    reason = payload.get("reason", "Achat en boutique")

    if not profile_id or points <= 0:
        raise HTTPException(status_code=400, detail="Données invalides")

    await add_loyalty_points(
        profile_id=profile_id,
        points=points,
        reason=reason,
    )

    loyalty = await get_or_create_loyalty(profile_id)
    return {
        "success": True,
        "points_added": points,
        "new_total": loyalty["points"],
    }


@api_router.post("/ecom/admin/loyalty/use-voucher")
async def admin_use_voucher(
    payload: dict,
    profile=Depends(require_admin),
):
    code = payload.get("code", "").upper()
    profile_id = payload.get("profile_id")

    if not code or not profile_id:
        raise HTTPException(status_code=400, detail="Code et profile_id requis")

    # ← Vérifier le code promo
    discount = await sb_select_one("discounts", "code", code)
    if not discount or not discount.get("active"):
        raise HTTPException(status_code=404, detail="Bon invalide ou déjà utilisé")

    # ← Désactiver le code promo
    await sb_update("discounts", {"active": False, "used_count": 1}, "code", code)

    # ← Marquer le bon comme utilisé dans loyalty_points
    loyalty = await get_or_create_loyalty(profile_id)
    existing_codes = loyalty.get("generated_codes") or []
    updated_codes = [
        {**c, "used": True} if c.get("code") == code else c for c in existing_codes
    ]
    await sb_update(
        "loyalty_points",
        {"generated_codes": updated_codes, "updated_at": now_iso()},
        "profile_id",
        profile_id,
    )

    return {
        "success": True,
        "code": code,
        "message": f"Bon {code} validé en boutique",
    }


import httpx

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


# ← Stocker les tokens dans store_settings
@api_router.post("/ecom/admin/push-token")
async def save_push_token(
    payload: dict,
    profile=Depends(require_admin),
):
    token = payload.get("token")
    if not token:
        raise HTTPException(status_code=400, detail="Token manquant")

    # ← Récupérer les tokens existants
    existing = await asyncio.to_thread(
        lambda: supabase.table("store_settings")
        .select("*")
        .eq("key", "admin_push_tokens")
        .limit(1)
        .execute()
    )

    tokens = []
    if existing.data:
        tokens = existing.data[0].get("value", []) or []

    # ← Ajouter le token si pas déjà présent
    if token not in tokens:
        tokens.append(token)
        if existing.data:
            await sb_update(
                "store_settings",
                {"value": tokens, "updated_at": now_iso()},
                "key",
                "admin_push_tokens",
            )
        else:
            await sb_insert(
                "store_settings", {"key": "admin_push_tokens", "value": tokens}
            )

    return {"success": True}


async def send_push_notification(title: str, body: str, data: dict = {}):
    """Envoie une notification push à tous les admins."""
    try:
        tokens_res = await asyncio.to_thread(
            lambda: supabase.table("store_settings")
            .select("value")
            .eq("key", "admin_push_tokens")
            .limit(1)
            .execute()
        )

        if not tokens_res.data:
            return

        tokens = tokens_res.data[0].get("value", []) or []
        if not tokens:
            return

        messages = [
            {
                "to": token,
                "title": title,
                "body": body,
                "data": data,
                "sound": "default",
                "priority": "high",
            }
            for token in tokens
        ]

        async with httpx.AsyncClient() as client:
            await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Content-Type": "application/json"},
                timeout=10,
            )

        logger.info(f"Push notification envoyée: {title}")

    except Exception as e:
        logger.error(f"Push notification failed: {e}")


# APRÈS
@api_router.patch("/ecom/admin/orders/{order_id}/tracking")
async def update_order_tracking(
    order_id: str,
    payload: dict,
    profile=Depends(require_admin),
):
    carrier = payload.get("carrier")
    tracking_number = payload.get("tracking_number")
    tracking_url = payload.get("tracking_url")

    update_data = {
        "carrier": carrier,
        "tracking_number": tracking_number,
        "tracking_url": tracking_url,
        "updated_at": now_iso(),
    }

    if tracking_number:
        update_data["status"] = "shipped"

    await sb_update("orders", update_data, "id", order_id)

    if tracking_number:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{SUPABASE_URL}/functions/v1/send-order-status-email",
                    json={
                        "order_id": order_id,
                        "new_status": "shipped",
                        "tracking_number": tracking_number,
                        "carrier": carrier,
                        "tracking_url": tracking_url,
                    },
                    headers={
                        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                        "Content-Type": "application/json",
                    },
                    timeout=10,
                )
        except Exception as e:
            logger.error(f"send-order-status-email (shipped) failed: {e}")

    return {
        "success": True,
        "carrier": carrier,
        "tracking_number": tracking_number,
        "tracking_url": tracking_url,
    }


@api_router.patch("/ecom/admin/product-variants/{variant_id}")
async def update_variant(
    variant_id: str,
    payload: dict,
    profile=Depends(require_admin),
):
    payload.pop("id", None)
    payload["updated_at"] = now_iso()
    await sb_update("product_variants", payload, "id", variant_id)
    if "stock" in payload:
        await sync_variant_inventory(variant_id)
    return await sb_select_one("product_variants", "id", variant_id)


# ============================================================
# BAUME — CAISSE (APPLICATION MOBILE ADMIN)
#
# Ventes en boutique encaissées par QR code Stripe.
# Le paiement suit exactement le même circuit que le site :
#   payment_transactions → webhook Stripe → finalize_paid_order
#   (commande + paiement + déduction du stock) → points fidélité.
#
# La session porte metadata.source = "baume_checkout" pour être
# traitée par le webhook existant, et metadata.channel = "pos"
# pour être reconnue comme une vente en boutique.
#
# Aucune route existante n'est modifiée par ce bloc.
# ============================================================

POS_CHANNEL = "pos"
POS_PAYMENT_METHODS = ["card", "twint"]
POS_SESSION_TTL_SECONDS = 30 * 60  # minimum imposé par Stripe
POS_ORDER_READY_STATUSES = ("paid", "processing", "shipped", "delivered", "refunded")


class PosCheckoutItem(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    quantity: int = Field(..., gt=0, le=100, strict=True)


class PosCheckoutRequest(BaseModel):
    items: List[PosCheckoutItem] = Field(..., min_length=1, max_length=100)
    customer_profile_id: Optional[str] = None
    email: Optional[EmailStr] = None
    session_id: Optional[str] = None


def _pos_clean_search(value: str) -> str:
    # Les virgules et parenthèses cassent les filtres or() de PostgREST.
    cleaned = "".join(ch for ch in value if ch not in ",()%_*\\")
    return cleaned.strip()[:80]


def _pos_product_image(product: dict) -> Optional[str]:
    if product.get("image"):
        return product["image"]
    gallery = product.get("gallery") or []
    return gallery[0] if gallery else None


def _pos_public_profile(p: dict) -> dict:
    return {
        "id": p.get("id"),
        "email": p.get("email"),
        "first_name": p.get("first_name"),
        "last_name": p.get("last_name"),
        "phone": p.get("phone"),
        "address": p.get("address"),
        "postal_code": p.get("postal_code"),
        "city": p.get("city"),
        "country": p.get("country"),
        "role": p.get("role"),
        "created_at": p.get("created_at"),
    }


async def _pos_require_tx(session_id: str) -> dict:
    tx = await sb_select_one("payment_transactions", "session_id", session_id)
    if not tx or (tx.get("metadata") or {}).get("channel") != POS_CHANNEL:
        raise HTTPException(status_code=404, detail="Vente en boutique introuvable")
    return tx


async def _pos_channels_for_sessions(session_ids: list) -> dict:
    channels = {}
    ids = [s for s in session_ids if s]
    for start in range(0, len(ids), 80):
        chunk = ids[start : start + 80]
        result = await asyncio.to_thread(
            lambda: supabase.table("payment_transactions")
            .select("session_id,metadata")
            .in_("session_id", chunk)
            .execute()
        )
        for row in result.data or []:
            channel = (row.get("metadata") or {}).get("channel")
            channels[row["session_id"]] = channel or "online"
    return channels


async def _pos_hand_over(order: dict) -> dict:
    """
    Une vente en boutique est remise immédiatement au client :
    la commande passe directement de « paid » à « delivered ».
    Aucun e-mail d'expédition n'est envoyé.
    """
    if order and order.get("status") == "paid":
        await sb_update(
            "orders",
            {"status": "delivered", "updated_at": now_iso()},
            "id",
            order["id"],
        )
        order = {**order, "status": "delivered"}
    return order


# ── Catalogue avec stock (source de vérité : product_variants.stock) ──


@api_router.get("/pos/catalog")
async def pos_catalog(profile=Depends(require_admin)):
    products = await stats_fetch_all(
        lambda: supabase.table("products").select("*").order("name")
    )
    variants = await stats_fetch_all(
        lambda: supabase.table("product_variants").select("*").order("created_at")
    )

    by_product = defaultdict(list)
    for v in variants:
        by_product[v.get("product_id")].append(
            {
                "id": v.get("id"),
                "title": v.get("title"),
                "sku": v.get("sku"),
                "barcode": v.get("barcode"),
                "price": v.get("price"),
                "stock": int(v.get("stock") or 0),
                "available": bool(v.get("available")),
                "active": v.get("active") is not False,
            }
        )

    catalog = []
    for p in products:
        if p.get("status") == "archived":
            continue
        product_variants = by_product.get(p.get("id"), [])
        active_variants = [v for v in product_variants if v["active"]]
        catalog.append(
            {
                "id": p.get("id"),
                "slug": p.get("slug"),
                "name": p.get("name") or p.get("title") or "Produit",
                "price": p.get("price"),
                "image": _pos_product_image(p),
                "category": p.get("product_category"),
                "status": p.get("status"),
                "available": bool(p.get("available")),
                "featured": bool(p.get("featured")),
                "bestseller": bool(p.get("bestseller")),
                "stock": sum(v["stock"] for v in active_variants),
                "variants": product_variants,
            }
        )

    return {"generated_at": now_iso(), "products": catalog}


# ── Clients ──


@api_router.get("/pos/customers")
async def pos_customers(
    search: Optional[str] = None,
    limit: int = Query(100, gt=0, le=500),
    profile=Depends(require_admin),
):
    term = _pos_clean_search(search or "")

    def run():
        q = supabase.table("profiles").select("*")
        if term:
            like = f"%{term}%"
            q = q.or_(
                f"email.ilike.{like},first_name.ilike.{like},last_name.ilike.{like}"
            )
        return q.order("created_at", desc=True).limit(limit).execute()

    result = await asyncio.to_thread(run)
    return [_pos_public_profile(p) for p in result.data or []]


async def _pos_customer_detail(p: dict) -> dict:
    loyalty = await sb_select_one("loyalty_points", "profile_id", p["id"]) or {}

    transactions = await asyncio.to_thread(
        lambda: supabase.table("loyalty_transactions")
        .select("*")
        .eq("profile_id", p["id"])
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    orders = []
    if p.get("email"):
        orders_result = await asyncio.to_thread(
            lambda: supabase.table("orders")
            .select("*")
            .ilike("email", p["email"].replace("%", "").replace("_", "\\_"))
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        orders = orders_result.data or []

    return {
        **_pos_public_profile(p),
        "loyalty": {
            "points": loyalty.get("points") or 0,
            "total_earned": loyalty.get("total_earned") or 0,
            "total_spent": loyalty.get("total_spent") or 0,
            "generated_codes": loyalty.get("generated_codes") or [],
        },
        "loyalty_transactions": transactions.data or [],
        "orders": orders,
    }


@api_router.get("/pos/customers/lookup")
async def pos_customer_lookup(email: str, profile=Depends(require_admin)):
    """Recherche exacte par e-mail (QR de la carte fidélité « BAUME:email »)."""
    value = (email or "").strip()
    if not value or "%" in value or "," in value:
        raise HTTPException(status_code=400, detail="E-mail invalide")

    result = await asyncio.to_thread(
        lambda: supabase.table("profiles")
        .select("*")
        .ilike("email", value.replace("_", "\\_"))
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Aucun compte Baume pour cet e-mail")

    return await _pos_customer_detail(result.data[0])


@api_router.get("/pos/customers/{profile_id}")
async def pos_customer(profile_id: str, profile=Depends(require_admin)):
    p = await sb_select_one("profiles", "id", profile_id)
    if not p:
        raise HTTPException(status_code=404, detail="Client introuvable")
    return await _pos_customer_detail(p)


# ── Commandes (site + boutique) ──


@api_router.get("/pos/orders")
async def pos_orders(
    limit: int = Query(200, gt=0, le=500),
    profile=Depends(require_admin),
):
    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*, order_items(*)")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    orders = result.data or []

    channels = await _pos_channels_for_sessions(
        [o.get("stripe_checkout_session_id") for o in orders]
    )

    for o in orders:
        o["channel"] = channels.get(o.get("stripe_checkout_session_id"), "online")
        o["items"] = o.get("order_items", [])

    return orders


@api_router.post("/pos/orders/{order_id}/hand-over")
async def pos_hand_over_order(order_id: str, profile=Depends(require_admin)):
    order = await sb_select_one("orders", "id", order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    await _pos_require_tx(order.get("stripe_checkout_session_id") or "")
    order = await _pos_hand_over(order)
    return {"success": True, "order_id": order_id, "status": order.get("status")}


# ── Ajustement de stock d'une variante ──


class PosStockAdjust(BaseModel):
    delta: Optional[int] = Field(None, ge=-10000, le=10000)
    set: Optional[int] = Field(None, ge=0, le=100000)


@api_router.post("/pos/variants/{variant_id}/stock")
async def pos_adjust_stock(
    variant_id: str,
    payload: PosStockAdjust,
    profile=Depends(require_admin),
):
    """
    Ajuste le stock en relatif (delta) ou en absolu (set).
    La lecture et l'écriture se font côté serveur, juste avant
    l'écriture, pour limiter les conflits avec une vente en cours.
    """
    if (payload.delta is None) == (payload.set is None):
        raise HTTPException(status_code=400, detail="Indiquez delta ou set.")

    variant = await sb_select_one("product_variants", "id", variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variante introuvable")

    previous = int(variant.get("stock") or 0)
    new_stock = payload.set if payload.set is not None else max(previous + payload.delta, 0)

    await sb_update(
        "product_variants",
        {"stock": new_stock, "available": new_stock > 0, "updated_at": now_iso()},
        "id",
        variant_id,
    )

    await sync_variant_inventory(variant_id)

    logger.info(
        "Stock ajusté depuis l'app : variante=%s %s → %s par %s",
        variant_id,
        previous,
        new_stock,
        profile.get("id"),
    )

    return {"variant_id": variant_id, "previous_stock": previous, "stock": new_stock}


# ── Encaissement par QR code ──


@api_router.post("/pos/checkout")
async def pos_create_checkout(
    payload: PosCheckoutRequest,
    profile=Depends(require_admin),
):
    # Mêmes garde-fous que le paiement du site.
    if os.environ.get("CHECKOUT_ENABLED", "false").lower() != "true":
        raise HTTPException(
            status_code=503, detail="Paiement temporairement indisponible."
        )
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")
    if not STRIPE_API_KEY.startswith("sk_test_"):
        raise HTTPException(
            status_code=503, detail="Seul Stripe en mode test est autorisé."
        )

    # Aucune vente sans session de caisse ouverte.
    pos_session = await _pos_require_open_session(payload.session_id)

    customer = None
    if payload.customer_profile_id:
        customer = await sb_select_one("profiles", "id", payload.customer_profile_id)
        if not customer:
            raise HTTPException(status_code=404, detail="Client introuvable")

    email = (
        payload.email
        or (customer or {}).get("email")
        or os.environ.get("POS_DEFAULT_EMAIL")
    )
    if not email:
        raise HTTPException(
            status_code=400,
            detail="Indiquez l'e-mail du client pour le reçu.",
        )

    # Stock d'inventaire aligné avant la vente (exigé par finalize_paid_order).
    for item in payload.items:
        await sync_variant_inventory(item.variant_id)

    # Prix, disponibilité et stock vérifiés côté serveur,
    # exactement comme pour le site.
    priced = await _price_cart([item.model_dump() for item in payload.items])
    total = float(Decimal(str(priced["subtotal"])).quantize(Decimal("0.01")))

    if total <= 0:
        raise HTTPException(status_code=400, detail="Montant à payer invalide")

    customer_id = (customer or {}).get("id") or ""
    customer_name = " ".join(
        x for x in [(customer or {}).get("first_name"), (customer or {}).get("last_name")] if x
    )

    metadata = {
        "source": "baume_checkout",
        "channel": POS_CHANNEL,
        "country": "CH",
        "email": email,
        "user_id": customer_id,
        "items_count": str(sum(i.quantity for i in payload.items)),
        "discount_code": "",
        "discount_amount": "0.0",
        "cashier_id": profile.get("id") or "",
        "pos_session_id": pos_session["id"],
    }

    stripe_line_items = [
        {
            "price_data": {
                "currency": "chf",
                "product_data": {
                    "name": item["name"],
                    **({"description": item["size"]} if item.get("size") else {}),
                },
                "unit_amount": int(round(item["unit_price"] * 100)),
            },
            "quantity": item["quantity"],
        }
        for item in priced["items"]
    ]

    try:
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            mode="payment",
            payment_method_types=POS_PAYMENT_METHODS,
            customer_email=email,
            success_url=(
                f"{FRONTEND_URL}/commande/confirmation" "?session_id={CHECKOUT_SESSION_ID}"
            ),
            cancel_url=f"{FRONTEND_URL}/commande/confirmation?cancelled=true",
            metadata=metadata,
            line_items=stripe_line_items,
            expires_at=int(time.time()) + POS_SESSION_TTL_SECONDS,
            idempotency_key=f"baume-pos-{uuid.uuid4()}",
        )
    except Exception:
        logger.exception("Caisse : impossible de créer la session Stripe")
        raise HTTPException(status_code=503, detail="Création du paiement indisponible")

    tx = {
        "id": str(uuid.uuid4()),
        "session_id": session.id,
        "amount": total,
        "subtotal": priced["subtotal"],
        "shipping": 0.0,
        "discount_code": None,
        "discount_amount": 0.0,
        "currency": "chf",
        "email": email,
        "user_id": customer_id or None,
        "country": "CH",
        "items": priced["items"],
        "shipping_address": {
            "type": "in_store",
            "name": customer_name or "Client boutique",
            "first_name": (customer or {}).get("first_name"),
            "last_name": (customer or {}).get("last_name"),
            "line1": "Vente en boutique",
            "address": "Vente en boutique",
            "country": "CH",
        },
        "status": "initiated",
        "payment_status": "pending",
        "metadata": metadata,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    try:
        await sb_insert("payment_transactions", tx)
    except Exception:
        logger.exception("Caisse : transaction non enregistrée %s", session.id)
        try:
            await asyncio.to_thread(stripe.checkout.Session.expire, session.id)
        except Exception:
            logger.exception("Caisse : expiration à vérifier %s", session.id)
        raise HTTPException(status_code=503, detail="Impossible de préparer le paiement")

    return {
        "session_id": session.id,
        "url": session.url,
        "total": total,
        "email": email,
        "expires_at": session.expires_at,
        "items": priced["items"],
    }


@api_router.get("/pos/checkout/{session_id}")
async def pos_checkout_status(session_id: str, profile=Depends(require_admin)):
    await _pos_require_tx(session_id)

    try:
        session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
    except Exception:
        logger.exception("Caisse : lecture de la session %s impossible", session_id)
        raise HTTPException(status_code=503, detail="Statut du paiement indisponible")

    order = await sb_select_one("orders", "stripe_checkout_session_id", session_id)
    paid = session.payment_status == "paid"
    order_ready = bool(paid and order and order.get("status") in POS_ORDER_READY_STATUSES)

    if order_ready:
        order = await _pos_hand_over(order)

    return {
        "status": session.status,  # open | complete | expired
        "payment_status": session.payment_status,  # unpaid | paid
        "amount_total": session.amount_total,
        "order_ready": order_ready,
        "order": (
            {
                "id": order.get("id"),
                "order_number": order.get("order_number"),
                "status": order.get("status"),
                "total": order.get("total"),
            }
            if order_ready
            else None
        ),
    }


@api_router.post("/pos/checkout/{session_id}/cancel")
async def pos_cancel_checkout(session_id: str, profile=Depends(require_admin)):
    await _pos_require_tx(session_id)

    session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)

    if session.payment_status == "paid" or session.status == "complete":
        raise HTTPException(status_code=409, detail="Ce paiement a déjà été effectué.")

    if session.status == "open":
        await asyncio.to_thread(stripe.checkout.Session.expire, session_id)

    return {"success": True, "status": "expired"}




# ── Encaissement en espèces (caisse web /caisse) ──
#
# Même circuit que le paiement Stripe, sans Stripe :
#   payment_transactions (payment_status = paid) → finalize_paid_order
#   (commande + paiement + déduction du stock) → points fidélité.
#
# L'identifiant de session est « pos_cash_<client_sale_id> » : la caisse
# génère cet identifiant une fois par vente, ce qui rend l'appel
# idempotent (double clic, réseau coupé puis relance).

POS_CASH_PREFIX = "pos_cash_"


class PosCashCheckoutRequest(BaseModel):
    items: List[PosCheckoutItem] = Field(..., min_length=1, max_length=100)
    customer_profile_id: Optional[str] = None
    email: Optional[EmailStr] = None
    cash_received: Decimal = Field(..., ge=0, le=100000)
    client_sale_id: uuid.UUID
    session_id: Optional[str] = None


async def _pos_after_paid(order: dict, send_email: bool) -> None:
    """Étapes post-paiement identiques au webhook Stripe."""
    try:
        await asyncio.to_thread(
            lambda: supabase.rpc(
                "award_paid_order_loyalty", {"p_order_id": order["id"]}
            ).execute()
        )
    except Exception:
        logger.exception("Caisse espèces : fidélité non attribuée %s", order["id"])

    try:
        await _complete_referral_for_order(order)
    except Exception:
        logger.exception("Caisse espèces : parrainage non validé %s", order["id"])

    if not send_email:
        return

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{SUPABASE_URL}/functions/v1/send-order-email",
                json={"order_id": order["id"]},
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "X-Baume-Internal-Token": os.environ["BAUME_INTERNAL_TOKEN"],
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
    except Exception:
        logger.exception("Caisse espèces : e-mail de reçu non envoyé %s", order["id"])


def _pos_receipt_payload(order: dict, tx: dict) -> dict:
    metadata = (tx or {}).get("metadata") or {}
    method = metadata.get("payment_method") or "card"
    return {
        "order": {
            "id": order.get("id"),
            "order_number": order.get("order_number"),
            "status": order.get("status"),
            "total": order.get("total"),
            "created_at": order.get("created_at"),
            "email": order.get("email"),
        },
        "items": (tx or {}).get("items") or order.get("order_items") or [],
        "payment": {
            "method": method,
            "amount": (tx or {}).get("amount"),
            "cash_received": metadata.get("cash_received"),
            "change_due": metadata.get("change_due"),
        },
        "customer_name": ((tx or {}).get("shipping_address") or {}).get("name"),
    }


async def _pos_finalize_cash(session_id: str, tx: dict, sale_id: str) -> dict:
    existing = await sb_select_one("orders", "stripe_checkout_session_id", session_id)
    if existing:
        return existing

    customer_id = None
    if tx.get("user_id"):
        p = await sb_select_one("profiles", "id", tx["user_id"])
        if p:
            customer_id = (await get_or_create_customer(p))["id"]

    result = await asyncio.to_thread(
        lambda: supabase.rpc(
            "finalize_paid_order",
            {
                "p_session_id": session_id,
                "p_payment_intent_id": f"cash_{sale_id}",
                "p_customer_id": customer_id,
            },
        ).execute()
    )
    if not result.data:
        raise RuntimeError("finalize_paid_order n'a renvoyé aucune commande")

    # Le paiement est créé avec le fournisseur par défaut (stripe) :
    # on l'identifie comme un encaissement en espèces.
    try:
        await asyncio.to_thread(
            lambda: supabase.table("payments")
            .update({"provider": "cash", "transaction_id": f"cash_{sale_id}"})
            .eq("order_id", result.data)
            .execute()
        )
    except Exception:
        logger.exception("Caisse espèces : paiement non marqué « cash » %s", result.data)

    return await sb_select_one("orders", "id", result.data)


@api_router.post("/pos/checkout/cash")
async def pos_cash_checkout(
    payload: PosCashCheckoutRequest,
    profile=Depends(require_admin),
):
    sale_id = str(payload.client_sale_id)
    session_id = f"{POS_CASH_PREFIX}{sale_id}"

    tx = await sb_select_one("payment_transactions", "session_id", session_id)

    if not tx:
        # Aucune vente sans session de caisse ouverte.
        pos_session = await _pos_require_open_session(payload.session_id)

        customer = None
        if payload.customer_profile_id:
            customer = await sb_select_one("profiles", "id", payload.customer_profile_id)
            if not customer:
                raise HTTPException(status_code=404, detail="Client introuvable")

        explicit_email = payload.email or (customer or {}).get("email")
        email = explicit_email or os.environ.get("POS_DEFAULT_EMAIL")
        if not email:
            raise HTTPException(
                status_code=400,
                detail="Indiquez l'e-mail du client (ou configurez POS_DEFAULT_EMAIL).",
            )

        for item in payload.items:
            await sync_variant_inventory(item.variant_id)

        priced = await _price_cart([item.model_dump() for item in payload.items])
        total = Decimal(str(priced["subtotal"])).quantize(Decimal("0.01"))
        received = payload.cash_received.quantize(Decimal("0.01"))

        if total <= 0:
            raise HTTPException(status_code=400, detail="Montant à payer invalide")
        if received < total:
            raise HTTPException(
                status_code=400,
                detail=f"Montant reçu insuffisant : {received} CHF pour {total} CHF.",
            )

        customer_name = " ".join(
            x
            for x in [(customer or {}).get("first_name"), (customer or {}).get("last_name")]
            if x
        )

        metadata = {
            "source": "baume_checkout",
            "channel": POS_CHANNEL,
            "payment_method": "cash",
            "country": "CH",
            "email": email,
            "user_id": (customer or {}).get("id") or "",
            "items_count": str(sum(i.quantity for i in payload.items)),
            "discount_code": "",
            "discount_amount": "0.0",
            "cashier_id": profile.get("id") or "",
            "cash_received": str(received),
            "change_due": str(received - total),
            "send_receipt_email": "true" if explicit_email else "false",
            "pos_session_id": pos_session["id"],
        }

        tx = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "amount": float(total),
            "subtotal": priced["subtotal"],
            "shipping": 0.0,
            "discount_code": None,
            "discount_amount": 0.0,
            "currency": "chf",
            "email": email,
            "user_id": (customer or {}).get("id"),
            "country": "CH",
            "items": priced["items"],
            "shipping_address": {
                "type": "in_store",
                "name": customer_name or "Client boutique",
                "first_name": (customer or {}).get("first_name"),
                "last_name": (customer or {}).get("last_name"),
                "line1": "Vente en boutique",
                "address": "Vente en boutique",
                "country": "CH",
            },
            # Même état que celui laissé par le webhook Stripe
            # juste avant l'appel à finalize_paid_order.
            "status": "initiated",
            "payment_status": "paid",
            "metadata": metadata,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }

        try:
            await sb_insert("payment_transactions", tx)
        except Exception:
            # Deux envois simultanés de la même vente : on relit.
            tx = await sb_select_one("payment_transactions", "session_id", session_id)
            if not tx:
                logger.exception("Caisse espèces : transaction non enregistrée")
                raise HTTPException(
                    status_code=503, detail="Impossible d'enregistrer la vente"
                )

    elif (tx.get("metadata") or {}).get("payment_method") != "cash":
        raise HTTPException(status_code=409, detail="Identifiant de vente déjà utilisé")

    already_done = bool(
        await sb_select_one("orders", "stripe_checkout_session_id", session_id, select="id")
    )

    try:
        order = await _pos_finalize_cash(session_id, tx, sale_id)
    except Exception:
        logger.exception("Caisse espèces : finalisation échouée %s", session_id)
        raise HTTPException(
            status_code=503,
            detail=(
                "La vente est enregistrée mais la commande n'a pas pu être créée. "
                "Réessayez : la vente ne sera pas comptée deux fois."
            ),
        )

    order = await _pos_hand_over(order)

    if not already_done:
        send_email = (tx.get("metadata") or {}).get("send_receipt_email") == "true"
        await _pos_after_paid(order, send_email)

    return _pos_receipt_payload(order, tx)


@api_router.get("/pos/orders/{order_id}/receipt")
async def pos_order_receipt(order_id: str, profile=Depends(require_admin)):
    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*, order_items(*)")
        .eq("id", order_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    order = result.data[0]
    tx = await sb_select_one(
        "payment_transactions", "session_id", order.get("stripe_checkout_session_id") or ""
    )
    return _pos_receipt_payload(order, tx)



# ============================================================
# BAUME — CAISSE : SESSIONS, MOUVEMENTS, REMBOURSEMENTS
#
# • Une caisse (pos_registers) a un code fixe : CAISSE-GENEVE-01.
# • Une session s'ouvre avec un fond de caisse et se clôture avec
#   le comptage des espèces ; le rapport Z est alors figé.
# • Chaque vente en boutique porte metadata.pos_session_id.
# • Les remboursements passent par la fonction SQL atomique
#   pos_record_refund (stock, retours, refunds, statut commande).
# ============================================================

POS_DEFAULT_REGISTER = os.environ.get("POS_DEFAULT_REGISTER", "CAISSE-GENEVE-01")
POS_REVENUE_STATUSES = ("paid", "processing", "shipped", "delivered", "refunded")


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


async def _pos_register(code: Optional[str] = None) -> dict:
    register = await sb_select_one("pos_registers", "code", (code or POS_DEFAULT_REGISTER).strip())
    if not register or register.get("active") is False:
        raise HTTPException(status_code=404, detail="Caisse introuvable ou désactivée")
    return register


async def _pos_open_session_for(register_id: str) -> Optional[dict]:
    result = await asyncio.to_thread(
        lambda: supabase.table("pos_sessions")
        .select("*")
        .eq("register_id", register_id)
        .eq("status", "open")
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def _pos_require_open_session(session_id: Optional[str] = None) -> dict:
    """Session ouverte à rattacher à une vente ou à un remboursement."""
    if session_id:
        session = await sb_select_one("pos_sessions", "id", session_id)
        if not session or session.get("status") != "open":
            raise HTTPException(
                status_code=409,
                detail="Cette session de caisse est fermée. Ouvrez la caisse pour continuer.",
            )
        return session

    register = await _pos_register()
    session = await _pos_open_session_for(register["id"])
    if not session:
        raise HTTPException(
            status_code=409,
            detail="La caisse est fermée. Ouvrez une session de caisse avant d'encaisser.",
        )
    return session


async def _pos_session_report(session: dict) -> dict:
    """Rapport X (session ouverte, calculé en direct) ou Z (figé à la clôture)."""
    if session.get("status") == "closed" and session.get("report"):
        return session["report"]

    sid = session["id"]

    txs = await stats_fetch_all(
        lambda: supabase.table("payment_transactions")
        .select("session_id,amount,items,payment_status,created_at")
        .eq("metadata->>pos_session_id", sid)
        .eq("payment_status", "paid")
        .order("created_at")
    )
    tx_by_session = {t["session_id"]: t for t in txs if t.get("session_id")}

    orders = []
    ids = list(tx_by_session.keys())
    for start in range(0, len(ids), 80):
        chunk = ids[start : start + 80]
        result = await asyncio.to_thread(
            lambda: supabase.table("orders")
            .select("id,order_number,total,status,stripe_checkout_session_id,created_at")
            .in_("stripe_checkout_session_id", chunk)
            .execute()
        )
        orders.extend(result.data or [])

    sales_cash = sales_card = Decimal("0")
    items_count = 0
    sales_count = 0
    for o in orders:
        if o.get("status") not in POS_REVENUE_STATUSES:
            continue
        sales_count += 1
        total = _money(o.get("total"))
        if str(o.get("stripe_checkout_session_id") or "").startswith(POS_CASH_PREFIX):
            sales_cash += total
        else:
            sales_card += total
        tx = tx_by_session.get(o.get("stripe_checkout_session_id")) or {}
        items_count += sum(int(i.get("quantity") or 0) for i in (tx.get("items") or []))

    refunds = await stats_fetch_all(
        lambda: supabase.table("pos_refunds")
        .select("id,order_id,method,amount,reason,items,created_at")
        .eq("session_id", sid)
        .order("created_at")
    )
    refunds_cash = sum((_money(r["amount"]) for r in refunds if r["method"] == "cash"), Decimal("0"))
    refunds_card = sum((_money(r["amount"]) for r in refunds if r["method"] == "card"), Decimal("0"))
    returned_items = sum(
        int(i.get("quantity") or 0) for r in refunds for i in (r.get("items") or [])
    )

    movements = await stats_fetch_all(
        lambda: supabase.table("pos_cash_movements")
        .select("id,type,amount,reason,created_at,created_by")
        .eq("session_id", sid)
        .order("created_at")
    )
    cash_in = sum((_money(m["amount"]) for m in movements if m["type"] == "in"), Decimal("0"))
    cash_out = sum((_money(m["amount"]) for m in movements if m["type"] == "out"), Decimal("0"))

    opening = _money(session.get("opening_float"))
    sales_total = sales_cash + sales_card
    refunds_total = refunds_cash + refunds_card
    expected_cash = opening + sales_cash - refunds_cash + cash_in - cash_out

    def f(d: Decimal) -> float:
        return float(d.quantize(Decimal("0.01")))

    return {
        "generated_at": now_iso(),
        "opening_float": f(opening),
        "sales": {
            "count": sales_count,
            "items": items_count,
            "total": f(sales_total),
            "cash": f(sales_cash),
            "card": f(sales_card),
            "average_basket": f(sales_total / sales_count) if sales_count else 0.0,
        },
        "refunds": {
            "count": len(refunds),
            "items_returned": returned_items,
            "total": f(refunds_total),
            "cash": f(refunds_cash),
            "card": f(refunds_card),
            "list": refunds,
        },
        "movements": {
            "in": f(cash_in),
            "out": f(cash_out),
            "list": movements,
        },
        "net_total": f(sales_total - refunds_total),
        "expected_cash": f(expected_cash),
    }


def _pos_public_session(session: dict, register: Optional[dict] = None) -> dict:
    keys = (
        "id", "session_number", "register_id", "status", "opened_at", "opened_by",
        "opening_float", "opening_note", "closed_at", "closed_by", "counted_cash",
        "counted_detail", "expected_cash", "cash_difference", "closing_note",
    )
    data = {k: session.get(k) for k in keys}
    if register:
        data["register"] = {"id": register["id"], "code": register["code"], "name": register["name"]}
    return data


async def _pos_profile_names(ids) -> dict:
    ids = [i for i in set(ids) if i]
    if not ids:
        return {}
    result = await asyncio.to_thread(
        lambda: supabase.table("profiles").select("id,first_name,last_name,email").in_("id", ids).execute()
    )
    names = {}
    for p in result.data or []:
        name = " ".join(x for x in [p.get("first_name"), p.get("last_name")] if x)
        names[p["id"]] = name or p.get("email") or "—"
    return names


# ── Caisses & session courante ──


@api_router.get("/pos/registers")
async def pos_registers(profile=Depends(require_admin)):
    result = await asyncio.to_thread(
        lambda: supabase.table("pos_registers").select("*").eq("active", True).order("code").execute()
    )
    return result.data or []


@api_router.get("/pos/session/current")
async def pos_current_session(
    register_code: Optional[str] = None,
    profile=Depends(require_admin),
):
    register = await _pos_register(register_code)
    session = await _pos_open_session_for(register["id"])
    if not session:
        return {"register": register, "session": None, "report": None}

    names = await _pos_profile_names([session.get("opened_by")])
    data = _pos_public_session(session, register)
    data["opened_by_name"] = names.get(session.get("opened_by"))
    return {"register": register, "session": data, "report": await _pos_session_report(session)}


class PosSessionOpen(BaseModel):
    register_code: Optional[str] = None
    opening_float: Decimal = Field(..., ge=0, le=100000)
    opening_detail: Optional[Dict[str, int]] = None
    note: Optional[str] = Field(None, max_length=500)


@api_router.post("/pos/session/open")
async def pos_open_session(payload: PosSessionOpen, profile=Depends(require_admin)):
    register = await _pos_register(payload.register_code)

    if await _pos_open_session_for(register["id"]):
        raise HTTPException(status_code=409, detail="Une session est déjà ouverte sur cette caisse.")

    row = {
        "id": str(uuid.uuid4()),
        "register_id": register["id"],
        "status": "open",
        "opened_at": now_iso(),
        "opened_by": profile.get("id"),
        "opening_float": float(_money(payload.opening_float)),
        "opening_detail": payload.opening_detail,
        "opening_note": (payload.note or "").strip() or None,
    }
    try:
        await sb_insert("pos_sessions", row)
    except Exception:
        # Deux ouvertures simultanées : l'index unique n'en laisse passer qu'une.
        if await _pos_open_session_for(register["id"]):
            raise HTTPException(status_code=409, detail="Une session est déjà ouverte sur cette caisse.")
        logger.exception("Caisse : ouverture de session impossible")
        raise HTTPException(status_code=503, detail="Ouverture de la caisse impossible")

    session = await sb_select_one("pos_sessions", "id", row["id"])
    logger.info("Caisse %s ouverte (fond %s) par %s", register["code"], row["opening_float"], profile.get("id"))
    return {"session": _pos_public_session(session, register), "report": await _pos_session_report(session)}


@api_router.get("/pos/session/{session_id}/report")
async def pos_session_report(session_id: str, profile=Depends(require_admin)):
    session = await sb_select_one("pos_sessions", "id", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session introuvable")
    register = await sb_select_one("pos_registers", "id", session["register_id"])
    names = await _pos_profile_names([session.get("opened_by"), session.get("closed_by")])
    data = _pos_public_session(session, register)
    data["opened_by_name"] = names.get(session.get("opened_by"))
    data["closed_by_name"] = names.get(session.get("closed_by"))
    return {"session": data, "report": await _pos_session_report(session)}


@api_router.get("/pos/sessions")
async def pos_sessions_history(
    register_code: Optional[str] = None,
    limit: int = Query(30, gt=0, le=200),
    profile=Depends(require_admin),
):
    register = await _pos_register(register_code)
    result = await asyncio.to_thread(
        lambda: supabase.table("pos_sessions")
        .select("*")
        .eq("register_id", register["id"])
        .order("opened_at", desc=True)
        .limit(limit)
        .execute()
    )
    sessions = result.data or []
    names = await _pos_profile_names(
        [s.get("opened_by") for s in sessions] + [s.get("closed_by") for s in sessions]
    )
    out = []
    for s in sessions:
        data = _pos_public_session(s, register)
        data["opened_by_name"] = names.get(s.get("opened_by"))
        data["closed_by_name"] = names.get(s.get("closed_by"))
        rep = s.get("report") or {}
        data["sales_total"] = (rep.get("sales") or {}).get("total")
        data["net_total"] = rep.get("net_total")
        out.append(data)
    return out


# ── Mouvements d'espèces ──


class PosCashMovementIn(BaseModel):
    type: str = Field(..., pattern="^(in|out)$")
    amount: Decimal = Field(..., gt=0, le=100000)
    reason: str = Field(..., min_length=2, max_length=300)


@api_router.post("/pos/session/{session_id}/movements")
async def pos_add_cash_movement(
    session_id: str,
    payload: PosCashMovementIn,
    profile=Depends(require_admin),
):
    session = await _pos_require_open_session(session_id)
    row = {
        "id": str(uuid.uuid4()),
        "session_id": session["id"],
        "type": payload.type,
        "amount": float(_money(payload.amount)),
        "reason": payload.reason.strip(),
        "created_by": profile.get("id"),
        "created_at": now_iso(),
    }
    try:
        await sb_insert("pos_cash_movements", row)
    except Exception:
        logger.exception("Caisse : mouvement non enregistré")
        raise HTTPException(status_code=409, detail="Mouvement refusé : la session est peut-être fermée.")
    return {"movement": row, "report": await _pos_session_report(session)}


# ── Clôture ──


class PosSessionClose(BaseModel):
    counted_cash: Decimal = Field(..., ge=0, le=1000000)
    counted_detail: Optional[Dict[str, int]] = None
    note: Optional[str] = Field(None, max_length=1000)


@api_router.post("/pos/session/{session_id}/close")
async def pos_close_session(
    session_id: str,
    payload: PosSessionClose,
    profile=Depends(require_admin),
):
    session = await _pos_require_open_session(session_id)
    report = await _pos_session_report(session)

    counted = _money(payload.counted_cash)
    expected = _money(report["expected_cash"])
    difference = counted - expected

    report = {
        **report,
        "counted_cash": float(counted),
        "cash_difference": float(difference),
        "closed_at": now_iso(),
    }

    result = await asyncio.to_thread(
        lambda: supabase.table("pos_sessions")
        .update(
            {
                "status": "closed",
                "closed_at": report["closed_at"],
                "closed_by": profile.get("id"),
                "counted_cash": float(counted),
                "counted_detail": payload.counted_detail,
                "expected_cash": float(expected),
                "cash_difference": float(difference),
                "report": report,
                "closing_note": (payload.note or "").strip() or None,
            }
        )
        .eq("id", session["id"])
        .eq("status", "open")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=409, detail="Cette session a déjà été clôturée.")

    closed = result.data[0]
    register = await sb_select_one("pos_registers", "id", closed["register_id"])
    logger.info(
        "Caisse %s clôturée : attendu %s, compté %s, écart %s",
        (register or {}).get("code"), expected, counted, difference,
    )
    names = await _pos_profile_names([closed.get("opened_by"), closed.get("closed_by")])
    data = _pos_public_session(closed, register)
    data["opened_by_name"] = names.get(closed.get("opened_by"))
    data["closed_by_name"] = names.get(closed.get("closed_by"))
    return {"session": data, "report": report}


# ── Remboursements & retours en boutique ──


async def _pos_refundable(order_id: str) -> dict:
    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*, order_items(*), refunds(*)")
        .eq("id", order_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    order = result.data[0]

    item_ids = [i["id"] for i in order.get("order_items") or []]
    returned = defaultdict(int)
    if item_ids:
        rows = await asyncio.to_thread(
            lambda: supabase.table("order_item_returns")
            .select("order_item_id,quantity")
            .in_("order_item_id", item_ids)
            .execute()
        )
        for r in rows.data or []:
            returned[r["order_item_id"]] += int(r.get("quantity") or 0)

    refunded = sum(
        (
            _money(r.get("amount"))
            for r in order.get("refunds") or []
            if (r.get("status") or "succeeded") in ("succeeded", "pending")
        ),
        Decimal("0"),
    )
    total = _money(order.get("total"))
    pi = order.get("stripe_payment_intent_id") or ""
    session_ref = order.get("stripe_checkout_session_id") or ""
    is_cash_sale = session_ref.startswith(POS_CASH_PREFIX) or pi.startswith("cash_")

    items = []
    for i in order.get("order_items") or []:
        qty = int(i.get("quantity") or 0)
        items.append(
            {
                "id": i["id"],
                "product_title": i.get("product_title"),
                "variant_title": i.get("variant_title"),
                "variant_id": i.get("variant_id"),
                "quantity": qty,
                "returned": returned[i["id"]],
                "returnable": max(qty - returned[i["id"]], 0),
                "unit_price": float(_money(i.get("unit_price"))),
            }
        )

    refundable_status = order.get("status") in ("paid", "processing", "shipped", "delivered")
    return {
        "order": {
            "id": order["id"],
            "order_number": order.get("order_number"),
            "status": order.get("status"),
            "total": float(total),
            "email": order.get("email"),
            "created_at": order.get("created_at"),
            "customer_id": order.get("customer_id"),
        },
        "items": items,
        "refunded_total": float(refunded),
        "remaining": float(max(total - refunded, Decimal("0"))) if refundable_status else 0.0,
        "refundable": refundable_status and total - refunded > 0,
        "methods": {
            "cash": True,
            "card": bool(pi) and not is_cash_sale,
        },
        "is_cash_sale": is_cash_sale,
        "_payment_intent": pi,
    }


@api_router.get("/pos/orders/{order_id}/refundable")
async def pos_order_refundable(order_id: str, profile=Depends(require_admin)):
    data = await _pos_refundable(order_id)
    data.pop("_payment_intent", None)
    return data


class PosRefundItem(BaseModel):
    order_item_id: str
    quantity: int = Field(..., gt=0, le=1000, strict=True)
    restock: bool = True


class PosRefundRequest(BaseModel):
    client_refund_id: uuid.UUID
    method: str = Field(..., pattern="^(cash|card)$")
    items: List[PosRefundItem] = Field(default_factory=list, max_length=100)
    amount: Optional[Decimal] = Field(None, gt=0, le=100000)
    reason: Optional[str] = Field(None, max_length=300)


async def _pos_reverse_loyalty(order: dict, amount: Decimal) -> int:
    """Retire les points gagnés sur la part remboursée (sans passer sous zéro)."""
    customer_id = order.get("customer_id")
    if not customer_id:
        return 0
    customer = await sb_select_one("customers", "id", customer_id)
    profile_id = (customer or {}).get("profile_id")
    if not profile_id:
        return 0

    loyalty = await sb_select_one("loyalty_points", "profile_id", profile_id)
    if not loyalty:
        return 0
    balance = int(loyalty.get("points") or 0)
    points = min(int(amount), balance)
    if points <= 0:
        return 0

    await sb_update(
        "loyalty_points",
        {
            "points": balance - points,
            "total_earned": max(int(loyalty.get("total_earned") or 0) - points, 0),
            "updated_at": now_iso(),
        },
        "profile_id",
        profile_id,
    )
    await sb_insert(
        "loyalty_transactions",
        {
            "id": str(uuid.uuid4()),
            "profile_id": profile_id,
            "order_id": order["id"],
            "type": "spend",
            "points": -points,
            "reason": f"Points retirés — remboursement commande #{order.get('order_number') or ''}".strip(),
            "created_at": now_iso(),
        },
    )
    return points


@api_router.post("/pos/orders/{order_id}/refund")
async def pos_refund_order(
    order_id: str,
    payload: PosRefundRequest,
    profile=Depends(require_admin),
):
    client_refund_id = str(payload.client_refund_id)

    # Rejeu (double appui, réseau coupé) : on renvoie le résultat existant.
    existing = await sb_select_one("pos_refunds", "client_refund_id", client_refund_id)
    if existing:
        data = await _pos_refundable(order_id)
        data.pop("_payment_intent", None)
        return {"duplicate": True, "pos_refund": existing, "refundable": data}

    data = await _pos_refundable(order_id)
    if not data["refundable"]:
        raise HTTPException(status_code=400, detail="Cette commande n'est plus remboursable.")

    # Contrôle des quantités et calcul du montant des articles.
    items_by_id = {i["id"]: i for i in data["items"]}
    wanted = defaultdict(int)
    items_amount = Decimal("0")
    for it in payload.items:
        line = items_by_id.get(it.order_item_id)
        if not line:
            raise HTTPException(status_code=400, detail="Article introuvable dans cette commande.")
        wanted[it.order_item_id] += it.quantity
        if wanted[it.order_item_id] > line["returnable"]:
            raise HTTPException(
                status_code=400,
                detail=f"Quantité trop élevée pour « {line['product_title']} » (max {line['returnable']}).",
            )
        items_amount += _money(line["unit_price"]) * it.quantity

    amount = _money(payload.amount) if payload.amount is not None else _money(items_amount)
    remaining = _money(data["remaining"])
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Indiquez les articles ou le montant à rembourser.")
    if amount > remaining:
        raise HTTPException(status_code=400, detail=f"Montant supérieur au solde remboursable ({remaining} CHF).")

    if payload.method == "card" and not data["methods"]["card"]:
        raise HTTPException(status_code=400, detail="Cette vente n'a pas été payée par carte : remboursez en espèces.")

    # Espèces : session ouverte obligatoire. Carte : rattachée si une session est ouverte.
    if payload.method == "cash":
        session = await _pos_require_open_session()
    else:
        register = await _pos_register()
        session = await _pos_open_session_for(register["id"])

    stripe_refund_id = None
    stripe_status = None
    if payload.method == "card":
        try:
            refund = await asyncio.to_thread(
                stripe.Refund.create,
                payment_intent=data["_payment_intent"],
                amount=int((amount * 100).quantize(Decimal("1"))),
                reason="requested_by_customer",
                metadata={
                    "source": "baume_pos",
                    "order_id": order_id,
                    "client_refund_id": client_refund_id,
                },
                idempotency_key=f"baume-pos-refund-{client_refund_id}",
            )
        except Exception as exc:
            logger.exception("Caisse : remboursement Stripe refusé pour %s", order_id)
            raise HTTPException(status_code=502, detail=f"Remboursement par carte refusé : {getattr(exc, 'user_message', None) or 'erreur Stripe'}")
        stripe_refund_id = refund.id
        stripe_status = refund.status if refund.status in ("succeeded", "pending") else "pending"

    items_json = [
        {"order_item_id": it.order_item_id, "quantity": it.quantity, "restock": it.restock}
        for it in payload.items
    ]

    try:
        result = await asyncio.to_thread(
            lambda: supabase.rpc(
                "pos_record_refund",
                {
                    "p_client_refund_id": client_refund_id,
                    "p_order_id": order_id,
                    "p_session_id": (session or {}).get("id"),
                    "p_method": payload.method,
                    "p_amount": float(amount),
                    "p_items": items_json,
                    "p_reason": (payload.reason or "").strip() or None,
                    "p_created_by": profile.get("id"),
                    "p_stripe_refund_id": stripe_refund_id,
                    "p_stripe_status": stripe_status,
                },
            ).execute()
        )
    except Exception as exc:
        if stripe_refund_id:
            # L'argent est rendu au client : le webhook Stripe enregistrera le
            # remboursement ; seuls les retours / la remise en stock manquent.
            logger.critical(
                "Caisse : remboursement Stripe %s effectué mais non enregistré (commande %s)",
                stripe_refund_id, order_id,
            )
        message = str(getattr(exc, "message", "") or exc)
        raise HTTPException(status_code=400, detail=f"Remboursement non enregistré : {message[:200]}")

    outcome = result.data or {}

    points_removed = 0
    if not outcome.get("duplicate"):
        try:
            order_row = await sb_select_one("orders", "id", order_id)
            points_removed = await _pos_reverse_loyalty(order_row or {"id": order_id}, amount)
        except Exception:
            logger.exception("Caisse : points fidélité non ajustés pour %s", order_id)
        if outcome.get("full"):
            try:
                await _reverse_referral_for_order(order_id)
            except Exception:
                logger.exception("Caisse : parrainage non annulé pour %s", order_id)

    refreshed = await _pos_refundable(order_id)
    refreshed.pop("_payment_intent", None)
    return {
        "duplicate": bool(outcome.get("duplicate")),
        "result": outcome,
        "amount": float(amount),
        "method": payload.method,
        "stripe_refund_id": stripe_refund_id,
        "points_removed": points_removed,
        "refundable": refreshed,
    }


api_router.include_router(auth_router)


# ---------- Health check (UptimeRobot / Render) ----------
# Accepts GET and HEAD: UptimeRobot pings with HEAD by default.
@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/health", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/api/health", methods=["GET", "HEAD"], include_in_schema=False)
async def health():
    return {"service": "baume-api", "status": "ok"}

# ---------- CORS & Mount ----------
app.include_router(api_router)
