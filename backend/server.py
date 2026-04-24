"""Baume e-commerce API — FastAPI + MongoDB + Stripe + Resend + JWT auth."""

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
    CheckoutSessionRequest,
)

from auth import (
    RegisterRequest, LoginRequest, UpdateProfileRequest, ForgotPasswordRequest, ResetPasswordRequest,
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    set_auth_cookies, clear_auth_cookies, get_current_user, get_optional_user,
    new_user_doc, public_user, new_reset_token,
    check_and_record_login, is_locked_out,
)
from emails import (
    send_contact_notification, send_contact_acknowledgement,
    send_welcome_email, send_order_confirmation, send_password_reset,
)
from seed_data import PRODUCTS, NEEDS, PRODUCT_CATEGORIES, REVIEWS, GUIDES, EXPERTS


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")

app = FastAPI(title="Baume API")
api_router = APIRouter(prefix="/api")


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


# ---------- Startup ----------

@app.on_event("startup")
async def startup():
    # Products
    existing = await db.products.count_documents({})
    if existing == 0:
        await db.products.insert_many([dict(p) for p in PRODUCTS])
        logger.info(f"Seeded {len(PRODUCTS)} products")
    await db.products.create_index("slug", unique=True)
    await db.products.create_index("product_category")
    await db.products.create_index("needs")

    # Categories
    if await db.categories.count_documents({"kind": "besoin"}) == 0:
        await db.categories.insert_many([{**n, "kind": "besoin"} for n in NEEDS])
    if await db.categories.count_documents({"kind": "produit"}) == 0:
        await db.categories.insert_many([{**c, "kind": "produit"} for c in PRODUCT_CATEGORIES])

    # Reviews, guides, experts
    if await db.reviews.count_documents({}) == 0:
        await db.reviews.insert_many(REVIEWS)
    if await db.guides.count_documents({}) == 0:
        await db.guides.insert_many(GUIDES)
    if await db.experts.count_documents({}) == 0:
        await db.experts.insert_many(EXPERTS)

    # Auth indexes
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.orders.create_index("session_id")
    await db.orders.create_index("user_id")
    await db.orders.create_index("email")

    # Admin seed
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@baume-shop.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    if admin_password:
        existing_admin = await db.users.find_one({"email": admin_email})
        if not existing_admin:
            doc = new_user_doc(admin_email, admin_password, "Admin", "Baume", role="admin")
            await db.users.insert_one(doc)
            logger.info(f"Seeded admin {admin_email}")
        elif not verify_password(admin_password, existing_admin.get("password_hash", "")):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hash_password(admin_password)}},
            )
            logger.info(f"Updated admin password for {admin_email}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


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
    if category: query["product_category"] = category
    if need: query["needs"] = need
    if flux: query["flux"] = flux
    if usage: query["usage"] = usage
    if size: query["sizes"] = size
    if available is not None: query["available"] = available
    if bestseller is not None: query["bestseller"] = bestseller
    if featured is not None: query["featured"] = featured
    if min_price is not None or max_price is not None:
        price_q: Dict[str, Any] = {}
        if min_price is not None: price_q["$gte"] = min_price
        if max_price is not None: price_q["$lte"] = max_price
        query["price"] = price_q
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"tagline": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]
    items = await db.products.find(query, {"_id": 0}).limit(limit).to_list(length=limit)
    return items


@api_router.get("/products/{slug}", response_model=Product)
async def get_product(slug: str):
    doc = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return doc


# ---------- Categories / Reviews / Guides / Experts ----------

@api_router.get("/categories")
async def list_categories(kind: Optional[str] = None):
    q = {"kind": kind} if kind else {}
    return await db.categories.find(q, {"_id": 0}).to_list(length=100)


@api_router.get("/categories/{kind}/{slug}")
async def get_category(kind: str, slug: str):
    doc = await db.categories.find_one({"slug": slug, "kind": kind}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")
    return doc


@api_router.get("/reviews")
async def list_reviews(product_id: Optional[str] = None, limit: int = 20):
    q = {"product_id": product_id} if product_id else {}
    return await db.reviews.find(q, {"_id": 0}).limit(limit).to_list(length=limit)


@api_router.get("/guides")
async def list_guides(limit: int = 20):
    return await db.guides.find({}, {"_id": 0}).limit(limit).to_list(length=limit)


@api_router.get("/guides/{slug}")
async def get_guide(slug: str):
    doc = await db.guides.find_one({"slug": slug}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Guide introuvable")
    return doc


@api_router.get("/experts")
async def list_experts():
    return await db.experts.find({}, {"_id": 0}).to_list(length=50)


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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.contact_messages.insert_one(msg)

    # Send notification to team + acknowledgement to user (non-blocking if Resend key missing)
    await send_contact_notification(
        name=payload.name,
        email=payload.email,
        subject=payload.subject,
        topic=payload.topic or "",
        message=payload.message,
    )
    await send_contact_acknowledgement(to_email=payload.email, name=payload.name)

    return {"status": "ok", "id": msg["id"], "message": "Message enregistré. Nos expertes vous répondent sous peu."}


# ---------- Auth ----------

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


@auth_router.post("/register")
async def register(payload: RegisterRequest, request: Request, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Un compte existe déjà avec cet email")
    doc = new_user_doc(email, payload.password, payload.first_name, payload.last_name)
    await db.users.insert_one(doc)
    access = create_access_token(doc["id"], email, doc["role"])
    refresh = create_refresh_token(doc["id"])
    set_auth_cookies(response, access, refresh)
    # Welcome email (non-blocking)
    await send_welcome_email(email, doc["first_name"])
    return public_user(doc)


@auth_router.post("/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    email = payload.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    if await is_locked_out(db, identifier):
        raise HTTPException(status_code=429, detail="Trop de tentatives. Réessayez dans 15 minutes.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        await check_and_record_login(db, identifier, success=False)
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    await check_and_record_login(db, identifier, success=True)
    access = create_access_token(user["id"], email, user.get("role", "customer"))
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return public_user(user)


@auth_router.post("/logout")
async def logout(response: Response):
    clear_auth_cookies(response)
    return {"status": "ok"}


@auth_router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=401, detail="Pas de refresh token")
    try:
        payload = decode_token(rt)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token invalide")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
        access = create_access_token(user["id"], user["email"], user.get("role", "customer"))
        new_refresh = create_refresh_token(user["id"])
        set_auth_cookies(response, access, new_refresh)
        return {"status": "ok"}
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalide")


async def _current_user(request: Request):
    return await get_current_user(request, db)


@auth_router.get("/me")
async def me(user: dict = Depends(_current_user)):
    return public_user(user)


@auth_router.patch("/me")
async def update_me(payload: UpdateProfileRequest, user: dict = Depends(_current_user)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return public_user(updated)


@auth_router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    # Always return 200 to avoid user enumeration
    if user:
        token = new_reset_token()
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": user["id"],
            "email": email,
            "expires_at": expires,
            "used": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        reset_url = f"{FRONTEND_URL}/reinitialiser-mot-de-passe?token={token}"
        await send_password_reset(email, reset_url)
    return {"status": "ok", "message": "Si un compte existe, un email vous a été envoyé."}


@auth_router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    rec = await db.password_reset_tokens.find_one({"token": payload.token}, {"_id": 0})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré")
    expires = rec.get("expires_at")
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="Lien expiré")
    await db.users.update_one(
        {"id": rec["user_id"]},
        {"$set": {"password_hash": hash_password(payload.password)}},
    )
    await db.password_reset_tokens.update_one(
        {"token": payload.token},
        {"$set": {"used": True}},
    )
    return {"status": "ok", "message": "Mot de passe réinitialisé avec succès."}


# ---------- Orders ----------

@api_router.get("/orders/mine")
async def my_orders(user: dict = Depends(_current_user)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return orders


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return order


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
            "slug": prod["slug"],
            "name": prod["name"],
            "image": prod.get("image", ""),
            "unit_price": unit_price,
            "quantity": it.quantity,
            "size": it.size,
            "color": it.color,
            "subtotal": subtotal,
        })
    if total <= 0:
        raise HTTPException(status_code=400, detail="Panier vide")
    rule = SHIPPING_RULES.get(country, SHIPPING_RULES["default"])
    shipping = 0.0 if total >= rule["threshold"] else rule["fee"]
    grand_total = round(total + shipping, 2)
    return {"line_items": line_items, "subtotal": round(total, 2), "shipping": shipping, "total": grand_total}


@api_router.post("/checkout/session")
async def create_checkout(payload: CheckoutRequest, http_request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")

    user = await get_optional_user(http_request, db)
    country = (payload.shipping_country or "CH").upper()
    if country not in {"CH"} | EU_COUNTRIES:
        raise HTTPException(status_code=400, detail="Pays non desservi")

    priced = await _price_cart(payload.items, country)

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/commande/confirmation?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/panier"

    email = payload.email or (user.get("email") if user else "")
    metadata = {
        "source": "baume_checkout",
        "country": country,
        "email": email,
        "user_id": user["id"] if user else "",
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
        "email": email,
        "user_id": user["id"] if user else None,
        "country": country,
        "items": priced["line_items"],
        "shipping_address": payload.shipping_address or {},
        "status": "initiated",
        "payment_status": "pending",
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(tx)

    return {"url": session.url, "session_id": session.session_id, "total": priced["total"]}


async def _ensure_order_from_tx(session_id: str):
    """Idempotent: create an order + send email if tx is paid and no order exists yet."""
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx or tx.get("payment_status") != "paid":
        return None
    existing = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.orders.insert_one(order)
    # Send confirmation email
    email = order.get("email")
    if email:
        first_name = "cliente"
        if order.get("user_id"):
            u = await db.users.find_one({"id": order["user_id"]}, {"_id": 0})
            if u:
                first_name = u.get("first_name", "cliente")
        await send_order_confirmation(email, first_name, order)
    return order


@api_router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, http_request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Stripe non configuré")

    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable")

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        new_status = status.status
        new_payment = status.payment_status
        amount_total = status.amount_total
        currency = status.currency
        metadata = status.metadata or {}
    except Exception as e:
        logger.warning(f"Stripe status retrieval failed for {session_id}: {e}. Falling back to DB.")
        new_status = tx.get("status", "initiated")
        new_payment = tx.get("payment_status", "pending")
        amount_total = int(round(float(tx.get("amount", 0)) * 100))
        currency = tx.get("currency", "chf")
        metadata = tx.get("metadata", {}) or {}

    if tx.get("payment_status") != new_payment or tx.get("status") != new_status:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": new_status,
                "payment_status": new_payment,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )

    # Idempotent order creation + email
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
        if event.payment_status == "paid":
            await _ensure_order_from_tx(event.session_id)
    return {"received": True}


# ---------- Mount & CORS ----------

app.include_router(api_router)
app.include_router(auth_router)

_cors_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", FRONTEND_URL).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
