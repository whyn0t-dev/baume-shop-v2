from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
import resend
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
    CheckoutSessionRequest,
)

from seed_data import PRODUCTS, NEEDS, PRODUCT_CATEGORIES, REVIEWS, GUIDES, EXPERTS

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "bonjour@baume-shop.com")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

app = FastAPI(title="Baume API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ---------- Pydantic models ----------

class Variant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    value: str
    stock: int = 0
    price_delta: float = 0.0


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
    product_category: str  # e.g., "culottes-menstruelles"
    needs: List[str] = []   # e.g., ["regles-cycle", "ados"]
    flux: Optional[str] = None  # "leger" | "moyen" | "abondant"
    usage: Optional[str] = None  # "jour" | "nuit" | "sport"
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


class Category(BaseModel):
    slug: str
    name: str
    tagline: str
    description: str
    image: str
    kind: str  # "besoin" | "produit"


class ContactMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    subject: str
    message: str
    topic: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str
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


# ---------- Startup: seed DB ----------

@app.on_event("startup")
async def startup_seed():
    try:
        existing = await db.products.count_documents({})
        if existing == 0:
            await db.products.insert_many([dict(p) for p in PRODUCTS])
            logger.info(f"Seeded {len(PRODUCTS)} products")
        await db.products.create_index("slug", unique=True)
        await db.products.create_index("product_category")
        await db.products.create_index("needs")

        cats_needs_count = await db.categories.count_documents({"kind": "besoin"})
        if cats_needs_count == 0:
            await db.categories.insert_many(
                [{**n, "kind": "besoin"} for n in NEEDS] +
                [{**c, "kind": "produit"} for c in PRODUCT_CATEGORIES]
            )
            logger.info("Seeded categories")

        reviews_count = await db.reviews.count_documents({})
        if reviews_count == 0:
            await db.reviews.insert_many(REVIEWS)
            logger.info("Seeded reviews")

        guides_count = await db.guides.count_documents({})
        if guides_count == 0:
            await db.guides.insert_many(GUIDES)
            logger.info("Seeded guides")

        experts_count = await db.experts.count_documents({})
        if experts_count == 0:
            await db.experts.insert_many(EXPERTS)
            logger.info("Seeded experts")
    except Exception as e:
        logger.error(f"Seed error: {e}")


# ---------- Health ----------

@api_router.get("/")
async def root():
    return {"service": "baume-api", "status": "ok"}


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
    query: Dict[str, Any] = {}
    if category:
        query["product_category"] = category
    if need:
        query["needs"] = need
    if flux:
        query["flux"] = flux
    if usage:
        query["usage"] = usage
    if size:
        query["sizes"] = size
    if available is not None:
        query["available"] = available
    if bestseller is not None:
        query["bestseller"] = bestseller
    if featured is not None:
        query["featured"] = featured
    if min_price is not None or max_price is not None:
        price_q: Dict[str, Any] = {}
        if min_price is not None:
            price_q["$gte"] = min_price
        if max_price is not None:
            price_q["$lte"] = max_price
        query["price"] = price_q
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"tagline": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    cursor = db.products.find(query, {"_id": 0}).limit(limit)
    items = await cursor.to_list(length=limit)
    return items


@api_router.get("/products/{slug}", response_model=Product)
async def get_product(slug: str):
    doc = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return doc


# ---------- Categories ----------

@api_router.get("/categories")
async def list_categories(kind: Optional[str] = None):
    q: Dict[str, Any] = {}
    if kind:
        q["kind"] = kind
    docs = await db.categories.find(q, {"_id": 0}).to_list(length=100)
    return docs


@api_router.get("/categories/{kind}/{slug}")
async def get_category(kind: str, slug: str):
    doc = await db.categories.find_one({"slug": slug, "kind": kind}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Category not found")
    return doc


# ---------- Reviews ----------

@api_router.get("/reviews")
async def list_reviews(product_id: Optional[str] = None, limit: int = 20):
    q: Dict[str, Any] = {}
    if product_id:
        q["product_id"] = product_id
    docs = await db.reviews.find(q, {"_id": 0}).limit(limit).to_list(length=limit)
    return docs


# ---------- Guides ----------

@api_router.get("/guides")
async def list_guides(limit: int = 20):
    docs = await db.guides.find({}, {"_id": 0}).limit(limit).to_list(length=limit)
    return docs


@api_router.get("/guides/{slug}")
async def get_guide(slug: str):
    doc = await db.guides.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Guide not found")
    return doc


# ---------- Experts ----------

@api_router.get("/experts")
async def list_experts():
    docs = await db.experts.find({}, {"_id": 0}).to_list(length=50)
    return docs


# ---------- Contact ----------

@api_router.post("/contact")
async def submit_contact(payload: ContactRequest):
    msg = ContactMessage(**payload.model_dump())
    await db.contact_messages.insert_one(msg.model_dump())

    if RESEND_API_KEY:
        params = {
            "from": SENDER_EMAIL,
            "to": [CONTACT_EMAIL],
            "subject": f"[Baume Contact] {payload.subject}",
            "html": f"""
                <div style='font-family:Inter,Arial,sans-serif;color:#111111;background:#F7F3EE;padding:24px'>
                  <h2 style='font-family:Georgia,serif;color:#4D1E19'>Nouveau message Baume</h2>
                  <p><strong>De :</strong> {payload.name} &lt;{payload.email}&gt;</p>
                  <p><strong>Sujet :</strong> {payload.subject}</p>
                  <p><strong>Motif :</strong> {payload.topic or 'Non précisé'}</p>
                  <hr style='border-color:#E7DDD3' />
                  <p style='white-space:pre-wrap'>{payload.message}</p>
                </div>
            """,
        }
        try:
            await asyncio.to_thread(resend.Emails.send, params)
        except Exception as e:
            logger.error(f"Resend send error: {e}")

    return {"status": "ok", "id": msg.id, "message": "Message enregistré. Nos expertes vous répondent sous peu."}


# ---------- Stripe checkout ----------

# Fixed shipping rules (server-side only)
FREE_SHIPPING_THRESHOLD = 60.0  # CHF
SHIPPING_FEE_CH = 6.90
SHIPPING_FEE_EU = 12.90


async def _compute_cart_total(items: List[CheckoutItem], country: str) -> Dict[str, Any]:
    """Server-side price computation to prevent manipulation."""
    total = 0.0
    line_items = []
    for it in items:
        if it.quantity <= 0:
            continue
        prod = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not prod:
            raise HTTPException(status_code=400, detail=f"Produit introuvable: {it.product_id}")
        if not prod.get("available", True):
            raise HTTPException(status_code=400, detail=f"Produit indisponible: {prod['name']}")
        unit_price = float(prod["price"])
        subtotal = round(unit_price * it.quantity, 2)
        total += subtotal
        line_items.append({
            "product_id": prod["id"],
            "name": prod["name"],
            "unit_price": unit_price,
            "quantity": it.quantity,
            "size": it.size,
            "color": it.color,
            "subtotal": subtotal,
        })
    if total <= 0:
        raise HTTPException(status_code=400, detail="Panier vide")
    shipping = 0.0 if total >= FREE_SHIPPING_THRESHOLD else (SHIPPING_FEE_CH if country == "CH" else SHIPPING_FEE_EU)
    grand_total = round(total + shipping, 2)
    return {"line_items": line_items, "subtotal": round(total, 2), "shipping": shipping, "total": grand_total}


@api_router.post("/checkout/session")
async def create_checkout(payload: CheckoutRequest, http_request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")

    priced = await _compute_cart_total(payload.items, payload.shipping_country or "CH")

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/commande/confirmation?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/panier"

    metadata = {
        "source": "baume_checkout",
        "country": payload.shipping_country or "CH",
        "email": payload.email or "",
        "items_count": str(sum(i.quantity for i in payload.items)),
    }

    req = CheckoutSessionRequest(
        amount=float(priced["total"]),
        currency="chf",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(req)

    tx = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "amount": priced["total"],
        "subtotal": priced["subtotal"],
        "shipping": priced["shipping"],
        "currency": "chf",
        "email": payload.email or "",
        "country": payload.shipping_country or "CH",
        "items": priced["line_items"],
        "status": "initiated",
        "payment_status": "pending",
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(tx)

    return {"url": session.url, "session_id": session.session_id, "total": priced["total"]}


@api_router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, http_request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)

    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if tx and tx.get("payment_status") != status.payment_status:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": status.status,
                "payment_status": status.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        # Create order if paid
        if status.payment_status == "paid":
            existing_order = await db.orders.find_one({"session_id": session_id})
            if not existing_order:
                order = {
                    "id": str(uuid.uuid4()),
                    "session_id": session_id,
                    "amount": tx["amount"],
                    "currency": tx["currency"],
                    "items": tx["items"],
                    "email": tx.get("email", ""),
                    "country": tx.get("country", "CH"),
                    "status": "paid",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.orders.insert_one(order)

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "metadata": status.metadata,
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    if not STRIPE_API_KEY:
        return {"received": False}
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        event = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": False}

    if event and event.session_id:
        await db.payment_transactions.update_one(
            {"session_id": event.session_id},
            {"$set": {
                "payment_status": event.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
    return {"received": True}


# ---------- Mount router & CORS ----------

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
