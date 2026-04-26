"""Baume e-commerce API — FastAPI + Supabase + Stripe + Resend + Supabase Auth."""

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

import stripe

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Query
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

# FIX: assign the API key to the stripe client so all Stripe calls work
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY


# ---------- Lifespan (replaces deprecated @app.on_event) ----------


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _seed_db()
    yield


app = FastAPI(title="Baume API", lifespan=lifespan)
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

    inserted = await sb_insert("customers", {
        "profile_id": profile["id"],
        "email": profile.get("email"),
        "first_name": profile.get("first_name"),
        "last_name": profile.get("last_name"),
        "phone": profile.get("phone"),
        "created_at": now_iso(),
    })

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


# ---------- Startup / Seed ----------


async def _seed_db():
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
    limit: int = Query(default=48, ge=1, le=200),
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

    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*, order_items(*), payments(*)")
        .eq("customer_id", customer["id"])
        .order("created_at", desc=True)
        .execute()
    )

    return result.data or []


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, profile=Depends(get_current_profile)):
    customer = await get_or_create_customer(profile)

    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*, order_items(*)")
        .eq("id", order_id)
        .eq("customer_id", customer["id"])
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    return result.data[0]


@api_router.get("/orders/{order_id}/full")
async def get_order_full(order_id: str, profile=Depends(get_current_profile)):
    customer = await get_or_create_customer(profile)

    result = await asyncio.to_thread(
        lambda: supabase.table("orders")
        .select("*, order_items(*), payments(*), refunds(*)")
        .eq("id", order_id)
        .eq("customer_id", customer["id"])
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

    order_data = {
        "customer_id": None,
        "email": tx.get("email", ""),
        "subtotal": tx.get("subtotal", tx["amount"]),
        "shipping_total": tx.get("shipping", 0.0),
        "tax_total": 0,
        "discount_total": 0,
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
        # FIX: handle race condition — another process may have inserted concurrently
        logger.warning(
            f"Order insert failed for session {session_id}: {e}. Fetching existing."
        )
        return await sb_select_one("orders", "stripe_checkout_session_id", session_id)

    order = inserted_order.data[0]
    order["items"] = tx.get("items", [])

    try:
        await _decrease_stock_for_order(order)
    except Exception as e:
        logger.error(f"Stock decrement failed for order {order.get('id')}: {e}")

    email = order.get("email")

    if email:
        first_name = "cliente"

        if order.get("user_id"):
            profile = await sb_select_one("profiles", "id", order["user_id"])
            if profile:
                first_name = profile.get("first_name", "cliente")

        try:
            await send_order_confirmation(email, first_name, order)
        except Exception as e:
            logger.error(
                f"Order confirmation email failed for order {order.get('id')}: {e}"
            )

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

    # FIX: reject webhook if secret is not configured — never accept unsigned events
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
        lambda: supabase.table("locations")
        .select("*")
        .eq("active", True)
        .execute()
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


@api_router.get("/discounts/{code}")
async def get_discount(code: str):
    discount = await sb_select_one("discounts", "code", code.upper())

    if not discount or not discount.get("active"):
        raise HTTPException(status_code=404, detail="Code promo invalide")

    return discount


# ---------- Pages / Store Settings ----------


@api_router.get("/pages")
async def list_pages():
    result = await asyncio.to_thread(
        lambda: supabase.table("pages")
        .select("*")
        .eq("published", True)
        .execute()
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


@api_router.get("/ecom/admin/{table}")
async def list_admin_table(
    table: str,
    limit: int = 200,
    profile=Depends(require_admin),
):
    allowed = PUBLIC_READ_TABLES | CUSTOMER_TABLES | ADMIN_TABLES

    if table not in allowed:
        raise HTTPException(status_code=400, detail="Table non autorisée")

    result = await asyncio.to_thread(
        lambda: supabase.table(table).select("*").limit(limit).execute()
    )
    return result.data or []


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


# ---------- CORS & Mount ----------
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