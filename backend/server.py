"""Baume e-commerce API — FastAPI + Supabase + Stripe + Resend + Supabase Auth."""

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import asyncio
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

import stripe

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from supabase import create_client, Client

from auth import (
    get_current_user,
    get_optional_user,
    get_current_profile,
    require_admin,
)

from emails import (
    send_contact_notification,
    send_contact_acknowledgement,
    send_order_confirmation,
)

from seed_data import PRODUCTS, NEEDS, PRODUCT_CATEGORIES, REVIEWS, GUIDES, EXPERTS


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

app = FastAPI(title="Baume API")
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
    size: Optional[str] = None
    color: Optional[str] = None


class CheckoutRequest(BaseModel):
    items: List[CheckoutItem]
    origin_url: str
    email: Optional[EmailStr] = None
    shipping_country: Optional[str] = "CH"
    shipping_address: Optional[Dict[str, Any]] = None


# ---------- Startup / Seed ----------


@app.on_event("startup")
async def startup():
    if await sb_count("products") == 0:
        products = []
        for p in PRODUCTS:
            doc = dict(p)
            doc.pop("id", None)
            doc.setdefault("created_at", now_iso())
            doc.setdefault("updated_at", now_iso())
            products.append(doc)

        await sb_insert("products", products)
        logger.info(f"Seeded {len(products)} products")

    if await sb_count("categories", {"kind": "besoin"}) == 0:
        await sb_insert(
            "categories",
            [
                {
                    **n,
                    "id": n.get("id", str(uuid.uuid4())),
                    "kind": "besoin",
                    "created_at": now_iso(),
                }
                for n in NEEDS
            ],
        )

    if await sb_count("categories", {"kind": "produit"}) == 0:
        await sb_insert(
            "categories",
            [
                {
                    **c,
                    "id": c.get("id", str(uuid.uuid4())),
                    "kind": "produit",
                    "created_at": now_iso(),
                }
                for c in PRODUCT_CATEGORIES
            ],
        )

    if await sb_count("reviews") == 0:
        await sb_insert(
            "reviews",
            [
                {
                    **r,
                    "id": r.get("id", str(uuid.uuid4())),
                    "created_at": r.get("created_at", now_iso()),
                }
                for r in REVIEWS
            ],
        )

    if await sb_count("guides") == 0:
        await sb_insert(
            "guides",
            [
                {
                    **g,
                    "id": g.get("id", str(uuid.uuid4())),
                    "created_at": g.get("created_at", now_iso()),
                }
                for g in GUIDES
            ],
        )

    if await sb_count("experts") == 0:
        await sb_insert(
            "experts",
            [
                {
                    **e,
                    "id": e.get("id", str(uuid.uuid4())),
                    "created_at": e.get("created_at", now_iso()),
                }
                for e in EXPERTS
            ],
        )


# ---------- Health ----------


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
    limit: int = 48,
):
    def run():
        q = supabase.table("products").select("*")

        if category:
            q = q.eq("product_category", category)
        if need:
            q = q.contains("needs", [need])
        if flux:
            q = q.eq("flux", flux)
        if usage:
            q = q.eq("usage", usage)
        if size:
            q = q.contains("sizes", [size])
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

    return doc


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
async def submit_contact(payload: ContactRequest):
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


# ---------- Orders ----------


@api_router.get("/orders/mine")
async def my_orders(profile=Depends(get_current_profile)):
    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*")
        .eq("user_id", profile["id"])
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )

    return result.data or []


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, profile=Depends(get_current_profile)):
    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*")
        .eq("id", order_id)
        .eq("user_id", profile["id"])
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    return result.data[0]


# ---------- Stripe Checkout ----------

SHIPPING_RULES = {
    "CH": {"fee": 6.90, "threshold": 60.0},
    "default": {"fee": 12.90, "threshold": 90.0},
}

EU_COUNTRIES = {"FR", "BE", "DE", "IT", "ES", "AT", "NL", "LU"}


async def _price_cart(items: List[CheckoutItem], country: str) -> Dict[str, Any]:
    total = 0.0
    line_items = []

    for it in items:
        if it.quantity <= 0:
            continue

        prod = await sb_select_one("products", "id", it.product_id)

        if not prod:
            raise HTTPException(
                status_code=400, detail=f"Produit introuvable: {it.product_id}"
            )

        if not prod.get("available", True):
            raise HTTPException(
                status_code=400, detail=f"Produit indisponible: {prod['name']}"
            )

        stock = int(prod.get("stock", 0))

        if stock < it.quantity:
            raise HTTPException(
                status_code=400, detail=f"Stock insuffisant pour: {prod['name']}"
            )

        unit_price = float(prod["price"])
        subtotal = round(unit_price * it.quantity, 2)
        total += subtotal

        line_items.append(
            {
                "product_id": prod["id"],
                "slug": prod["slug"],
                "name": prod["name"],
                "image": prod.get("image", ""),
                "unit_price": unit_price,
                "quantity": it.quantity,
                "size": it.size,
                "color": it.color,
                "subtotal": subtotal,
            }
        )

    if total <= 0:
        raise HTTPException(status_code=400, detail="Panier vide")

    rule = SHIPPING_RULES.get(country, SHIPPING_RULES["default"])
    shipping = 0.0 if total >= rule["threshold"] else rule["fee"]
    grand_total = round(total + shipping, 2)

    return {
        "line_items": line_items,
        "subtotal": round(total, 2),
        "shipping": shipping,
        "total": grand_total,
    }


@api_router.post("/checkout/session")
async def create_checkout(payload: CheckoutRequest, http_request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")

    user = await get_optional_user(http_request)
    user_id = auth_user_id(user)
    user_email = auth_user_email(user)

    country = (payload.shipping_country or "CH").upper()

    if country not in {"CH"} | EU_COUNTRIES:
        raise HTTPException(status_code=400, detail="Pays non desservi")

    priced = await _price_cart(payload.items, country)

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/commande/confirmation?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/panier"

    email = payload.email or user_email

    metadata = {
        "source": "baume_checkout",
        "country": country,
        "email": email,
        "user_id": user_id or "",
        "items_count": str(sum(i.quantity for i in payload.items)),
    }

    session = await asyncio.to_thread(
        stripe.checkout.Session.create,
        mode="payment",
        payment_method_types=["card"],
        customer_email=email or None,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        line_items=[
            {
                "price_data": {
                    "currency": "chf",
                    "product_data": {
                        "name": "Commande Baume",
                    },
                    "unit_amount": int(round(priced["total"] * 100)),
                },
                "quantity": 1,
            }
        ],
    )

    tx = {
        "id": str(uuid.uuid4()),
        "session_id": session.id,
        "amount": priced["total"],
        "subtotal": priced["subtotal"],
        "shipping": priced["shipping"],
        "currency": "chf",
        "email": email,
        "user_id": user_id,
        "country": country,
        "items": priced["line_items"],
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
        "total": priced["total"],
    }


async def _decrease_stock_for_order(order: dict):
    for item in order.get("items", []):
        product_id = item.get("product_id")
        quantity = int(item.get("quantity", 0))

        if not product_id or quantity <= 0:
            continue

        product = await sb_select_one("products", "id", product_id)

        if not product:
            continue

        current_stock = int(product.get("stock", 0))
        new_stock = max(current_stock - quantity, 0)

        await sb_update(
            "products",
            {
                "stock": new_stock,
                "available": new_stock > 0,
                "updated_at": now_iso(),
            },
            "id",
            product_id,
        )

        await sb_insert(
            "inventory_movements",
            {
                "id": str(uuid.uuid4()),
                "product_id": product_id,
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

    existing = await sb_select_one("orders", "session_id", session_id)

    if existing:
        return existing

    order = {
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "user_id": tx.get("user_id"),
        "email": tx.get("email", ""),
        "amount": tx["amount"],
        "subtotal": tx.get("subtotal", tx["amount"]),
        "shipping": tx.get("shipping", 0.0),
        "currency": tx["currency"],
        "items": tx["items"],
        "country": tx.get("country", "CH"),
        "shipping_address": tx.get("shipping_address", {}),
        "status": "paid",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    await sb_insert("orders", order)
    await _decrease_stock_for_order(order)

    email = order.get("email")

    if email:
        first_name = "cliente"

        if order.get("user_id"):
            profile = await sb_select_one("profiles", "id", order["user_id"])
            if profile:
                first_name = profile.get("first_name", "cliente")

        await send_order_confirmation(email, first_name, order)

    return order


@api_router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, http_request: Request):
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

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(
                payload=body,
                sig_header=sig,
                secret=webhook_secret,
            )
        else:
            event = stripe.Event.construct_from(
                await request.json(),
                stripe.api_key,
            )
    except Exception as e:
        logger.error(f"Stripe webhook signature/parse error: {e}")
        raise HTTPException(status_code=400, detail="Signature Stripe invalide")

    event_id = event.get("id")
    event_type = event.get("type", "")
    obj = event.get("data", {}).get("object", {})

    if obj.get("object") != "checkout.session":
        return {"received": True, "processed": False}

    session_id = obj.get("id")
    payment_status = obj.get("payment_status", "")

    if not session_id:
        return {"received": True, "processed": False}

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
                "session_id": session_id,
                "payment_status": payment_status,
                "received_at": now_iso(),
            },
        )

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

    return {
        "received": True,
        "processed": True,
        "session_id": session_id,
    }


# ---------- Mount & CORS ----------

app.include_router(api_router)

_cors_origins = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", FRONTEND_URL).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
