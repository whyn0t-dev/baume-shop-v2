from fastapi import Request, HTTPException, Depends, APIRouter
from pydantic import BaseModel, EmailStr
from supabase import create_client
import os

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

auth_router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str | None = None
    last_name: str | None = None


@auth_router.post("/login")
async def login(payload: LoginRequest):
    try:
        result = supabase.auth.sign_in_with_password(
            {
                "email": payload.email,
                "password": payload.password,
            }
        )
    except Exception as e:
        msg = str(e)
        if "Invalid login credentials" in msg:
            raise HTTPException(status_code=401, detail="Invalid login credentials")
        if "Email not confirmed" in msg:
            raise HTTPException(status_code=401, detail="Email not confirmed")
        if "rate limit" in msg.lower():
            raise HTTPException(status_code=429, detail="Email rate limit exceeded")
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    if not result.user or not result.session:
        raise HTTPException(status_code=401, detail="Invalid login credentials")
    profile_result = (
        supabase.table("profiles")
        .select("*")
        .eq("id", result.user.id)
        .maybe_single()
        .execute()
    )

    profile = profile_result.data or {}

    return {
        "user": {
            "id": result.user.id,
            "email": result.user.email,
            "first_name": profile.get("first_name"),
            "last_name": profile.get("last_name"),
            "phone": profile.get("phone"),
            "address": profile.get("address"),
            "postal_code": profile.get("postal_code"),
            "city": profile.get("city"),
            "country": profile.get("country"),
            "role": profile.get("role", "customer"),
        },
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
    }


@auth_router.post("/register")
async def register(payload: RegisterRequest):
    result = supabase.auth.sign_up(
        {
            "email": payload.email,
            "password": payload.password,
        }
    )

    if not result.user:
        raise HTTPException(status_code=400, detail="Inscription impossible")

    supabase.table("profiles").upsert(
        {
            "id": result.user.id,
            "email": result.user.email,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "role": "customer",
        }
    ).execute()

    # ── Créer le customer ─────────────────────────────────────────────────
    try:
        existing_customer = (
            supabase.table("customers")
            .select("id")
            .eq("profile_id", result.user.id)
            .limit(1)
            .execute()
        )

        if not existing_customer.data:
            customer_result = (
                supabase.table("customers")
                .insert(
                    {
                        "profile_id": result.user.id,
                        "email": result.user.email,
                        "first_name": payload.first_name,
                        "last_name": payload.last_name,
                    }
                )
                .execute()
            )
            customer_id = customer_result.data[0]["id"]
        else:
            customer_id = existing_customer.data[0]["id"]
    except Exception as e:
        print(f"Customer creation failed: {e}")
        customer_id = None

    # ── Associer les commandes guest — séparé pour ne pas bloquer ────────
    if customer_id:
        try:
            # Récupérer les commandes guest sans customer_id
            guest_orders = (
                supabase.table("orders")
                .select("id")
                .eq("email", result.user.email)
                .is_("customer_id", "null")
                .execute()
            )

            # Mettre à jour une par une pour éviter la récursion de stack
            for order in guest_orders.data or []:
                try:
                    supabase.table("orders").update({"customer_id": customer_id}).eq(
                        "id", order["id"]
                    ).execute()
                except Exception as e:
                    print(f"Order association failed for {order['id']}: {e}")
                    continue

        except Exception as e:
            print(f"Guest orders lookup failed: {e}")

    return {
        "user": {
            "id": result.user.id,
            "email": result.user.email,
            "first_name": payload.first_name,
            "last_name": payload.last_name,
            "role": "customer",
        }
    }

def extract_token(request: Request):
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth.split(" ")[1]
    return None


async def get_current_user(request: Request):
    token = extract_token(request)

    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")

    try:
        user = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Session expirée ou invalide")

    if not user or not user.user:
        raise HTTPException(status_code=401, detail="Token invalide")

    return user.user


async def get_optional_user(request: Request):
    token = extract_token(request)

    if not token:
        return None

    try:
        user = supabase.auth.get_user(token)
        return user.user if user and user.user else None
    except Exception:
        return None


async def get_current_profile(user=Depends(get_current_user)):
    try:
        result = (
            supabase.table("profiles")
            .select("*")
            .eq("id", user.id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Profil inaccessible")

    if not result.data:
        raise HTTPException(status_code=404, detail="Profil introuvable")

    return result.data


async def require_admin(profile=Depends(get_current_profile)):
    if profile.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")

    return profile
