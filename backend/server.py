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
from datetime import datetime, timezone
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
    name: str
    tagline: str
    price: float
    compare_price: Optional[float] = None
    currency: str = "CHF"
    image: str
    gallery: List[str] = []
    product_category: str
    product_type: Optional[str] = None
    needs: List[str] = []
    flux: Optional[str] = None
    usage: Optional[str] = None
    sizes: List[str] = []
    colors: List[str] = []
    benefits: List[str] = []
    description: str
    composition: str
    how_to_use: str
    fabrication: str
    rating: float = 4.8
    reviews_count: int = 0
    stock: int = 50
    available: bool = True
    bestseller: bool = False
    featured: bool = False
    # ← Ajouter ces 3 lignes
    preorder: bool = False
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
    name: str
    quantity: int
    variant_id: Optional[str] = None  # ← ajouter
    size: Optional[str] = None
    color: Optional[str] = None
    price: Optional[float] = None  # ← ajouter pour prix variante
    sku: Optional[str] = None


class CheckoutRequest(BaseModel):
    items: List[CheckoutItem]
    origin_url: str
    email: Optional[EmailStr] = None
    shipping_country: Optional[str] = "CH"
    shipping_address: Optional[Dict[str, Any]] = None
    discount_code: Optional[str] = None  # ← ajouter


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
        q = supabase.table("reviews").select("*")
        if product_id:
            q = q.eq("product_id", product_id)
        return q.limit(limit).execute()

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
    customer = await get_or_create_customer(profile)
    order_item = await _customer_bought_product(customer["id"], product_id)

    if not order_item:
        return {"has_ordered": False, "order": None, "review": None}

    order_summary = {
        "id": order_item["orders"]["id"],
        "status": order_item["orders"]["status"],
    }

    review_result = await asyncio.to_thread(
        lambda: supabase.table("reviews")
        .select("*")
        .eq("product_id", product_id)
        .eq("customer_id", customer["id"])
        .limit(1)
        .execute()
    )

    return {
        "has_ordered": True,
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

    order_item = await _customer_bought_product(customer_id, payload.product_id)
    if not order_item:
        raise HTTPException(
            status_code=403,
            detail="Vous devez avoir commandé ce produit pour laisser un avis.",
        )

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
        "order_id": order_item["orders"]["id"],
        "author": author,
        "rating": payload.rating,
        "title": payload.title,
        "body": payload.body,
        "images": [],
        "verified_purchase": True,
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
    subtotal = Decimal("0")
    priced_items = []

    for item in items:
        product_id = item.get("product_id") or item.get("id")
        variant_id = item.get("variant_id")
        qty = int(item.get("quantity", 1))

        # Récupérer le produit
        product = await sb_select_one("products", "id", product_id)
        if not product:
            raise HTTPException(
                status_code=404, detail=f"Produit {product_id} introuvable"
            )
        if product.get("status") != "active":
            raise HTTPException(
                status_code=400, detail=f"{product.get('name')} n'est plus disponible"
            )

        # Vérifier le stock par variante si variant_id fourni
        if variant_id:
            variant = await sb_select_one("product_variants", "id", variant_id)
            if not variant:
                raise HTTPException(status_code=404, detail=f"Variante introuvable")
            if not variant.get("available", True):
                raise HTTPException(
                    status_code=400,
                    detail=f"{product.get('name')} — variante en rupture de stock",
                )
            if (variant.get("stock") or 0) < qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"{product.get('name')} — stock insuffisant ({variant.get('stock', 0)} disponible(s))",
                )
            unit_price = Decimal(str(variant.get("price") or product.get("price") or 0))
        else:
            # Fallback sur variante par défaut
            variant_result = await asyncio.to_thread(
                lambda: supabase.table("product_variants")
                .select("*")
                .eq("product_id", product_id)
                .eq("active", True)
                .order("created_at")
                .limit(1)
                .execute()
            )
            if variant_result.data:
                variant = variant_result.data[0]
                variant_id = variant["id"]
                if (variant.get("stock") or 0) < qty:
                    raise HTTPException(
                        status_code=400,
                        detail=f"{product.get('name')} — stock insuffisant",
                    )
                unit_price = Decimal(
                    str(variant.get("price") or product.get("price") or 0)
                )
            else:
                # Aucune variante — vérifier stock produit directement
                if not product.get("available"):
                    raise HTTPException(
                        status_code=400,
                        detail=f"{product.get('name')} est en rupture de stock",
                    )
                unit_price = Decimal(str(product.get("price") or 0))

        total_price = unit_price * qty
        subtotal += total_price

        priced_items.append(
            {
                **item,
                "variant_id": variant_id,
                "product_title": product.get("name") or product.get("title"),
                "unit_price": float(unit_price),
                "total_price": float(total_price),
            }
        )

    return {"items": priced_items, "subtotal": float(subtotal)}


@api_router.post("/checkout/session")
@limiter.limit("10/minute")
async def create_checkout(
    request: Request, payload: CheckoutRequest
):  # ← http_request → request
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
    discount_amount = 0.0
    discount_code = None
    if payload.discount_code:
        discount = await sb_select_one(
            "discounts", "code", payload.discount_code.upper()
        )
        if discount and discount.get("active"):
            if discount["type"] == "percentage":
                discount_amount = round(
                    priced["subtotal"] * float(discount["value"]) / 100, 2
                )
            else:
                discount_amount = float(discount["value"])
            discount_code = payload.discount_code.upper()

    total = round(priced["subtotal"] - discount_amount + shipping, 2)

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/commande/confirmation?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/commande/confirmation?cancelled=true"

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
                name=f"Réduction ({discount_code})",
                max_redemptions=1,
            )
            stripe_coupon_id = coupon.id
        except Exception as e:
            logger.warning(f"Coupon Stripe création échouée: {e}")

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

    session = await asyncio.to_thread(
        stripe.checkout.Session.create,
        **session_params,
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

    await sb_insert("payment_transactions", tx)

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
    if not tx or tx.get("payment_status") != "paid":
        return None

    existing = await sb_select_one("orders", "stripe_checkout_session_id", session_id)
    if existing:
        return existing

    customer_id = None
    user_id = tx.get("user_id")
    if user_id:
        profile = await sb_select_one("profiles", "id", user_id)
        if profile:
            customer = await get_or_create_customer(profile)
            customer_id = customer["id"]

    order_data = {
        "customer_id": customer_id,
        "email": tx.get("email", ""),
        "subtotal": tx.get("subtotal", tx["amount"]),
        "shipping_total": tx.get("shipping", 0.0),
        "tax_total": 0,
        "discount_total": tx.get("discount_amount", 0.0),  # ← corriger
        "discount_code": tx.get("discount_code"),  # ← ajouter
        "total": tx["amount"],
        "currency": tx.get("currency", "chf").upper(),
        "stripe_checkout_session_id": session_id,
        "shipping_address": tx.get("shipping_address", {}),
        "billing_address": tx.get("shipping_address", {}),
        "status": "paid",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    try:
        inserted_order = await sb_insert("orders", order_data)
    except Exception as e:
        logger.warning(f"Order insert failed for session {session_id}: {e}.")
        return await sb_select_one("orders", "stripe_checkout_session_id", session_id)

    order = inserted_order.data[0]
    line_items = tx.get("items", [])

    # ← ajouter ce bloc pour insérer les order_items
    if line_items:
        order_items = [
            {
                "order_id": order["id"],
                "product_id": item.get("product_id"),
                "variant_id": item.get("variant_id"),  # ← ajouter
                "product_title": item.get("product_title") or item.get("name"),
                "variant_title": " · ".join(
                    filter(None, [item.get("size"), item.get("color")])
                )
                or None,
                "sku": item.get("sku"),
                "quantity": item.get("quantity", 1),
                "unit_price": item.get("unit_price", 0),
                "total_price": item.get(
                    "total_price", item.get("unit_price", 0) * item.get("quantity", 1)
                ),
            }
            for item in line_items
        ]
        try:
            await sb_insert("order_items", order_items)
        except Exception as e:
            logger.error(f"Order items insert failed: {e}")

    order["items"] = line_items

    # ── Enregistrer les pré-commandes ─────────────────────────────────────
    for item in line_items:
        product_id = item.get("product_id")
        if not product_id:
            continue
        try:
            product = await sb_select_one("products", "id", product_id)
            if product and product.get("preorder"):
                await sb_insert(
                    "preorder_notifications",
                    {
                        "product_id": product_id,
                        "order_id": order["id"],
                        "email": order.get("email", ""),
                        "notified_at": None,
                    },
                )
        except Exception as e:
            logger.error(f"Preorder notification insert failed: {e}")

    try:
        await _decrease_stock_for_order(order)
    except Exception as e:
        logger.error(f"Stock decrement failed: {e}")

    email = order.get("email")
    if email:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{SUPABASE_URL}/functions/v1/send-order-email",
                    json={"order_id": order["id"]},
                    headers={
                        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                        "Content-Type": "application/json",
                    },
                    timeout=10,
                )
        except Exception as e:
            logger.error(f"send-order-email failed: {e}")

    return order


@api_router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")

    tx = await sb_select_one("payment_transactions", "session_id", session_id)

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable")

    try:
        session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)

        new_status = session.status or "unknown"
        new_payment = session.payment_status or "unknown"
        amount_total = session.amount_total or int(
            round(float(tx.get("amount", 0)) * 100)
        )
        currency = session.currency or tx.get("currency", "chf")
        metadata = dict(session.metadata or {})

    except Exception as e:
        logger.warning(
            f"Stripe status retrieval failed for {session_id}: {e}. Falling back to DB."
        )

        new_status = tx.get("status", "initiated")
        new_payment = tx.get("payment_status", "pending")
        amount_total = int(round(float(tx.get("amount", 0)) * 100))
        currency = tx.get("currency", "chf")
        metadata = tx.get("metadata", {}) or {}

    if tx.get("payment_status") != new_payment or tx.get("status") != new_status:
        await sb_update(
            "payment_transactions",
            {
                "status": new_status,
                "payment_status": new_payment,
                "updated_at": now_iso(),
            },
            "session_id",
            session_id,
        )

    if new_payment == "paid":
        await _ensure_order_from_tx(session_id)

    return {
        "status": new_status,
        "payment_status": new_payment,
        "amount_total": amount_total,
        "currency": currency,
        "metadata": metadata,
    }


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
        event = stripe.Webhook.construct_event(
            payload=body,
            sig_header=sig,
            secret=webhook_secret,
        )
    except Exception as e:
        logger.error(f"Stripe webhook signature/parse error: {e}")
        raise HTTPException(status_code=400, detail="Signature Stripe invalide")

    event_id = event.get("id")
    event_type = event.get("type", "")
    obj = event.get("data", {}).get("object", {})

    # ── Déduplication ─────────────────────────────────────────────────────
    if event_id:
        existing_event = await sb_select_one(
            "stripe_webhook_events", "event_id", event_id
        )
        if existing_event:
            return {"received": True, "processed": False, "duplicate": True}

        await sb_insert(
            "stripe_webhook_events",
            {
                "id": str(uuid.uuid4()),
                "event_id": event_id,
                "event_type": event_type,
                "session_id": obj.get("id"),
                "payment_status": obj.get("payment_status", ""),
                "received_at": now_iso(),
            },
        )

    # ── checkout.session.completed ────────────────────────────────────────
    if event_type in (
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
    ):
        if obj.get("object") != "checkout.session":
            return {"received": True, "processed": False}

        session_id = obj.get("id")
        payment_status = obj.get("payment_status", "")

        if not session_id:
            return {"received": True, "processed": False}

        await sb_update(
            "payment_transactions",
            {
                "payment_status": payment_status or "unknown",
                "last_webhook_event": event_type,
                "last_webhook_event_id": event_id,
                "updated_at": now_iso(),
            },
            "session_id",
            session_id,
        )

        if payment_status == "paid":
            order = await _ensure_order_from_tx(session_id)
            logger.info(
                f"Order processed for session={session_id} "
                f"order_id={order.get('id') if order else None}"
            )

    # ── payment_intent.payment_failed ─────────────────────────────────────
    elif event_type == "payment_intent.payment_failed":
        payment_intent_id = obj.get("id")
        error_message = obj.get("last_payment_error", {}).get(
            "message", "Paiement échoué"
        )

        logger.warning(f"Payment failed: {payment_intent_id} — {error_message}")

        # Chercher la transaction par payment_intent si possible
        result = await asyncio.to_thread(
            lambda: supabase.table("payment_transactions")
            .select("session_id")
            .eq("status", "initiated")
            .limit(1)
            .execute()
        )

        if result.data:
            await sb_update(
                "payment_transactions",
                {
                    "payment_status": "failed",
                    "last_webhook_event": event_type,
                    "last_webhook_event_id": event_id,
                    "updated_at": now_iso(),
                },
                "session_id",
                result.data[0]["session_id"],
            )

    # ── charge.refunded ───────────────────────────────────────────────────
    elif event_type == "charge.refunded":
        payment_intent_id = obj.get("payment_intent")
        amount_refunded = (obj.get("amount_refunded") or 0) / 100

        if payment_intent_id:
            order_result = await asyncio.to_thread(
                lambda: supabase.table("orders")
                .select("id, payments(*)")
                .eq("stripe_payment_intent_id", payment_intent_id)
                .limit(1)
                .execute()
            )

            if order_result.data:
                o = order_result.data[0]
                payments = o.get("payments") or []
                payment_id = payments[0]["id"] if payments else None

                # Vérifier que le remboursement n'existe pas déjà
                existing_refund = await asyncio.to_thread(
                    lambda: supabase.table("refunds")
                    .select("id")
                    .eq("order_id", o["id"])
                    .limit(1)
                    .execute()
                )

                if not existing_refund.data:
                    await sb_insert(
                        "refunds",
                        {
                            "id": str(uuid.uuid4()),
                            "order_id": o["id"],
                            "payment_id": payment_id,
                            "amount": amount_refunded,
                            "reason": "Remboursement Stripe",
                            "created_at": now_iso(),
                        },
                    )
                    logger.info(
                        f"Refund enregistré pour order={o['id']} "
                        f"montant={amount_refunded} CHF"
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

    return {
        "received": True,
        "processed": True,
        "event_type": event_type,
    }


@api_router.get("/discounts/{code}")
async def get_discount(code: str):
    discount = await sb_select_one("discounts", "code", code.upper())

    if not discount or not discount.get("active"):
        raise HTTPException(status_code=404, detail="Code promo invalide")

    # Vérifier les dates
    now = datetime.now(timezone.utc)
    if (
        discount.get("starts_at")
        and datetime.fromisoformat(discount["starts_at"]) > now
    ):
        raise HTTPException(status_code=404, detail="Code promo pas encore actif")
    if discount.get("ends_at") and datetime.fromisoformat(discount["ends_at"]) < now:
        raise HTTPException(status_code=404, detail="Code promo expiré")

    # Vérifier la limite d'usage
    if (
        discount.get("usage_limit")
        and discount.get("used_count", 0) >= discount["usage_limit"]
    ):
        raise HTTPException(status_code=404, detail="Code promo épuisé")

    return discount


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

        clean_variants = [
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
                "stock": int(variant.get("stock", 0)),
                "available": int(variant.get("stock", 0)) > 0,
            }
            for variant in variants
            if variant.get("title")
        ]

        if clean_variants:
            await sb_insert("product_variants", clean_variants)

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


@api_router.patch("/ecom/admin/products/{product_id}")
async def update_admin_product(
    product_id: str,
    payload: dict,
    profile=Depends(require_admin),
):
    product_data = payload.get("product", {})
    options = payload.get("options", [])
    variants = payload.get("variants", [])
    images = payload.get("images", [])
    collections = payload.get("collections", [])

    product_data["updated_at"] = now_iso()

    try:
        await sb_update("products", product_data, "id", product_id)

        await sb_delete("product_options", "product_id", product_id)
        await sb_delete("product_variants", "product_id", product_id)
        await sb_delete("product_images", "product_id", product_id)
        await sb_delete("product_collections", "product_id", product_id)

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

        clean_variants = [
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
            }
            for variant in variants
            if variant.get("title")
        ]

        if clean_variants:
            await sb_insert("product_variants", clean_variants)

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

    def run():
        q = supabase.table(table).select("*")
        if date_from and table in ("orders", "profiles"):
            q = q.gte("created_at", date_from)
        if date_to and table in ("orders", "profiles"):
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


@api_router.patch("/ecom/admin/orders/{order_id}/tracking")
async def update_order_tracking(
    order_id: str,
    payload: dict,
    profile=Depends(require_admin),
):
    carrier = payload.get("carrier")
    tracking_number = payload.get("tracking_number")

    await sb_update(
        "orders",
        {
            "carrier": carrier,
            "tracking_number": tracking_number,
            "updated_at": now_iso(),
        },
        "id",
        order_id,
    )

    return {"success": True, "carrier": carrier, "tracking_number": tracking_number}


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
async def convert_loyalty_points(payload: dict, profile=Depends(get_current_profile)):
    points_to_spend = int(payload.get("points") or 0)

    threshold = next(
        (t for t in LOYALTY_THRESHOLDS if t["points"] == points_to_spend), None
    )
    if not threshold:
        raise HTTPException(status_code=400, detail="Seuil de points invalide")

    loyalty = await get_or_create_loyalty(profile["id"])
    if (loyalty["points"] or 0) < (points_to_spend or 0):
        raise HTTPException(status_code=400, detail="Points insuffisants")

    # Créer un code promo unique
    code = f"FIDELITE{str(uuid.uuid4())[:6].upper()}"

    discount_data = {
        "id": str(uuid.uuid4()),
        "code": code,
        "type": "fixed",
        "value": threshold["reward"],
        "active": True,
        "usage_limit": 1,
        "used_count": 0,
        "description": f"Code fidélité — {points_to_spend} points convertis",
        "created_at": now_iso(),
    }
    await sb_insert("discounts", discount_data)

    # Récupérer les codes existants
    existing_codes = loyalty.get("generated_codes") or []

    # Ajouter le nouveau code
    new_code_entry = {
        "code": code,
        "reward": threshold["reward"],
        "points_spent": points_to_spend,
        "created_at": now_iso(),
        "used": False,
    }
    updated_codes = existing_codes + [new_code_entry]

    # Déduire les points + sauvegarder le code
    new_points = (loyalty["points"] or 0) - points_to_spend
    new_total_spent = (loyalty["total_spent"] or 0) + points_to_spend

    await sb_update(
        "loyalty_points",
        {
            "points": new_points,
            "total_spent": new_total_spent,
            "generated_codes": updated_codes,
            "updated_at": now_iso(),
        },
        "profile_id",
        profile["id"],
    )

    await sb_insert(
        "loyalty_transactions",
        {
            "id": str(uuid.uuid4()),
            "profile_id": profile["id"],
            "order_id": None,
            "type": "spend",
            "points": -points_to_spend,
            "reason": f"Conversion en code promo {code}",
            "created_at": now_iso(),
        },
    )

    # Envoyer l'email
    email = profile.get("email")
    if email:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{SUPABASE_URL}/functions/v1/send-loyalty-code",
                    json={
                        "email": email,
                        "first_name": profile.get("first_name", ""),
                        "code": code,
                        "reward": threshold["reward"],
                        "points_spent": points_to_spend,
                    },
                    headers={
                        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                        "Content-Type": "application/json",
                    },
                    timeout=10,
                )
        except Exception as e:
            logger.error(f"send-loyalty-code failed: {e}")

    return {
        "success": True,
        "code": code,
        "reward": threshold["reward"],
        "points_remaining": new_points,
    }


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
        .select("*")
        .eq("referrer_id", profile["id"])
        .order("created_at", desc=True)
        .execute()
    )

    completed = [r for r in (referrals.data or []) if r["status"] == "completed"]
    pending = [r for r in (referrals.data or []) if r["status"] == "pending"]

    return {
        "referral_code": profile["referral_code"],
        "referral_link": f"{FRONTEND_URL}/inscription?ref={profile['referral_code']}",
        "total_referrals": len(completed),
        "pending_referrals": len(pending),
        "total_points_earned": len(completed) * 50,
        "referrals": referrals.data or [],
    }


@api_router.get("/referral/check/{code}")
async def check_referral_code(code: str):
    """Vérifie si un code parrainage est valide"""
    profile = await asyncio.to_thread(
        lambda: supabase.table("profiles")
        .select("id, first_name, referral_code")
        .eq("referral_code", code.upper())
        .limit(1)
        .execute()
    )

    if not profile.data:
        raise HTTPException(status_code=404, detail="Code parrainage invalide")

    referrer = profile.data[0]
    return {
        "valid": True,
        "referrer_name": referrer.get("first_name", "une amie"),
    }


@api_router.post("/referral/register")
async def register_referral(payload: dict):
    """Enregistre un parrainage lors de l'inscription"""
    referral_code = payload.get("referral_code", "").upper()
    referee_email = payload.get("email", "")

    if not referral_code or not referee_email:
        raise HTTPException(status_code=400, detail="Code et email requis")

    # Vérifier que le code existe
    referrer_result = await asyncio.to_thread(
        lambda: supabase.table("profiles")
        .select("id, first_name")
        .eq("referral_code", referral_code)
        .limit(1)
        .execute()
    )

    if not referrer_result.data:
        raise HTTPException(status_code=404, detail="Code parrainage invalide")

    referrer = referrer_result.data[0]

    # Vérifier que l'email n'a pas déjà été parrainé
    existing = await asyncio.to_thread(
        lambda: supabase.table("referrals")
        .select("id")
        .eq("referee_email", referee_email)
        .limit(1)
        .execute()
    )

    if existing.data:
        raise HTTPException(status_code=409, detail="Email déjà parrainé")

    # Créer le parrainage
    await sb_insert(
        "referrals",
        {
            "id": str(uuid.uuid4()),
            "referrer_id": referrer["id"],
            "referee_email": referee_email,
            "referral_code": referral_code,
            "status": "pending",
            "reward_points": 50,
            "created_at": now_iso(),
        },
    )

    # Créer un code promo -10% pour la filleule
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
            "description": f"Code parrainage — {referral_code}",
            "created_at": now_iso(),
        },
    )

    return {
        "success": True,
        "promo_code": promo_code,
        "referrer_name": referrer.get("first_name", "votre amie"),
    }


@api_router.post("/referral/complete")
async def complete_referral(payload: dict, profile=Depends(require_admin)):
    """Complète un parrainage après la première commande de la filleule"""
    referee_email = payload.get("referee_email", "")
    order_id = payload.get("order_id", "")

    referral = await asyncio.to_thread(
        lambda: supabase.table("referrals")
        .select("*")
        .eq("referee_email", referee_email)
        .eq("status", "pending")
        .limit(1)
        .execute()
    )

    if not referral.data:
        return {"success": False, "message": "Aucun parrainage en attente"}

    ref = referral.data[0]

    # Mettre à jour le parrainage
    await sb_update(
        "referrals",
        {
            "status": "completed",
            "order_id": order_id,
            "completed_at": now_iso(),
        },
        "id",
        ref["id"],
    )

    # Attribuer les points à la marraine
    await add_loyalty_points(
        profile_id=ref["referrer_id"],
        points=ref["reward_points"],
        reason=f"Parrainage complété — {referee_email}",
        order_id=order_id,
    )

    return {"success": True, "points_awarded": ref["reward_points"]}


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
            refund_data = res.json()
    except Exception as e:
        logger.error(f"refund-order failed: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du remboursement")

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


api_router.include_router(auth_router)
# ---------- CORS & Mount ----------
app.include_router(api_router)
