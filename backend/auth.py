from fastapi import Request, HTTPException, Depends, APIRouter
from security import limiter, login_guard, is_honeypot_filled, is_password_pwned, PWNED_MESSAGE
from pydantic import BaseModel, EmailStr
from supabase import create_client
import os

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# Client anon pour l'auth Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Client service role pour les opérations DB (bypass RLS)
supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

auth_router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str | None = None
    last_name: str | None = None
    # Champ invisible du formulaire (pot de miel anti-robots).
    website: str | None = None

class UpdateProfileRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None

@auth_router.post("/login")
@limiter.limit("10/minute;60/hour")
async def login(request: Request, payload: LoginRequest):
    # Trop d'échecs récents pour cet e-mail : blocage temporaire (même depuis d'autres IP).
    login_guard.check(payload.email)
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
            login_guard.failure(payload.email)
            raise HTTPException(status_code=401, detail="Invalid login credentials")
        if "Email not confirmed" in msg:
            raise HTTPException(status_code=401, detail="Email not confirmed")
        if "rate limit" in msg.lower():
            raise HTTPException(status_code=429, detail="Email rate limit exceeded")
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    if not result.user or not result.session:
        login_guard.failure(payload.email)
        raise HTTPException(status_code=401, detail="Invalid login credentials")
    login_guard.success(payload.email)
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


class RefreshRequest(BaseModel):
    refresh_token: str


@auth_router.post("/refresh")
@limiter.limit("30/minute")
async def refresh_session(request: Request, payload: RefreshRequest):
    """
    Renouvelle la session Supabase à partir du refresh token.
    Appel REST direct à GoTrue : le client Supabase partagé
    n'est pas modifié (aucun état global).
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/token",
                params={"grant_type": "refresh_token"},
                json={"refresh_token": payload.refresh_token},
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Content-Type": "application/json",
                },
            )
    except Exception:
        raise HTTPException(status_code=503, detail="Service d'authentification indisponible")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Session expirée")

    data = response.json()

    return {
        "access_token": data.get("access_token"),
        "refresh_token": data.get("refresh_token"),
        "expires_in": data.get("expires_in"),
    }


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@auth_router.post("/forgot-password")
@limiter.limit("5/hour")
async def forgot_password(request: Request, payload: ForgotPasswordRequest):
    """
    Envoie l'e-mail Supabase de réinitialisation du mot de passe.
    Réponse identique que le compte existe ou non (pas d'énumération des e-mails).
    """
    import httpx

    frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
    params = {"redirect_to": f"{frontend}/reinitialiser-mot-de-passe"} if frontend else {}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{SUPABASE_URL}/auth/v1/recover",
                params=params,
                json={"email": payload.email},
                headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            )
    except Exception:
        raise HTTPException(status_code=503, detail="Service d'authentification indisponible")
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="Email rate limit exceeded")
    return {"success": True}


@auth_router.post("/reset-password")
@limiter.limit("10/hour")
async def reset_password(request: Request, payload: ResetPasswordRequest):
    """Définit le nouveau mot de passe avec le jeton reçu dans le lien de l'e-mail."""
    import httpx

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 8 caractères.")
    if not payload.token:
        raise HTTPException(status_code=400, detail="Token has expired or is invalid")
    if await is_password_pwned(payload.password):
        raise HTTPException(status_code=400, detail=PWNED_MESSAGE)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.put(
                f"{SUPABASE_URL}/auth/v1/user",
                json={"password": payload.password},
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {payload.token}",
                    "Content-Type": "application/json",
                },
            )
    except Exception:
        raise HTTPException(status_code=503, detail="Service d'authentification indisponible")
    if response.status_code == 422:
        raise HTTPException(status_code=400, detail="New password should be different from the old password")
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Token has expired or is invalid")
    return {"success": True}


@auth_router.post("/register")
@limiter.limit("10/hour")
async def register(request: Request, payload: RegisterRequest):
    # Robot : réponse identique à une inscription réussie, sans rien créer.
    if is_honeypot_filled(payload.website):
        return {
            "user": {
                "id": None,
                "email": payload.email,
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "role": "customer",
            }
        }

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 8 caractères.")
    if await is_password_pwned(payload.password):
        raise HTTPException(status_code=400, detail=PWNED_MESSAGE)

    result = supabase.auth.sign_up(
        {
            "email": payload.email,
            "password": payload.password,
        }
    )

    if not result.user:
        raise HTTPException(status_code=400, detail="Inscription impossible")

    user_id = result.user.id

    # Adresse déjà inscrite et confirmée : Supabase renvoie un compte factice sans identité.
    # On répond comme pour une inscription normale (on ne révèle pas quels e-mails existent)
    # mais on ne crée ni ne modifie aucune donnée.
    if getattr(result.user, "identities", None) == []:
        return {
            "user": {
                "id": None,
                "email": payload.email,
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "role": "customer",
            }
        }

    # Compte déjà existant (inscription non confirmée relancée) : on ne touche ni à son rôle
    # ni à ses données, et on ne le supprime jamais en cas d'erreur.
    existing_profile = (
        supabase_admin.table("profiles").select("id, role").eq("id", user_id).limit(1).execute()
    ).data
    already_existed = bool(existing_profile)

    try:
        # ── Profil ────────────────────────────────────────────────────────
        if already_existed:
            supabase_admin.table("profiles").update(
                {
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                }
            ).eq("id", user_id).execute()
        else:
            supabase_admin.table("profiles").upsert(
                {
                    "id": user_id,
                    "email": result.user.email,
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                    "role": "customer",
                }
            ).execute()

        # ── Customer ──────────────────────────────────────────────────────
        existing_customer = (
            supabase_admin.table("customers")
            .select("id")
            .eq("profile_id", user_id)
            .limit(1)
            .execute()
        )

        if not existing_customer.data:
            customer_result = (
                supabase_admin.table("customers")
                .insert(
                    {
                        "profile_id": user_id,
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

        # ── Loyalty points ────────────────────────────────────────────────
        existing_points = (
            supabase_admin.table("loyalty_points").select("profile_id").eq("profile_id", user_id).limit(1).execute()
        ).data
        if not existing_points:
            supabase_admin.table("loyalty_points").insert(
                {
                    "profile_id": user_id,
                    "points": 0,
                    "total_earned": 0,
                    "total_spent": 0,
                    "generated_codes": [],
                }
            ).execute()

    except Exception as e:
        print(f"Register setup failed: {e} — rollback")
        if already_existed:
            # Jamais de suppression d'un compte qui existait avant cette demande.
            raise HTTPException(
                status_code=500,
                detail="Erreur lors de la création du compte. Veuillez réessayer.",
            )
        # Supprimer le profil et le user Supabase Auth pour éviter les données orphelines
        try:
            supabase_admin.table("profiles").delete().eq("id", user_id).execute()
        except:
            pass
        try:
            supabase_admin.auth.admin.delete_user(user_id)
        except:
            pass
        raise HTTPException(
            status_code=500,
            detail="Erreur lors de la création du compte. Veuillez réessayer.",
        )

    # ── Associer les commandes guest ──────────────────────────────────────
    if customer_id:
        try:
            guest_orders = (
                supabase_admin.table("orders")
                .select("id")
                .eq("email", result.user.email)
                .is_("customer_id", "null")
                .execute()
            )
            for order in guest_orders.data or []:
                try:
                    supabase_admin.table("orders").update(
                        {"customer_id": customer_id}
                    ).eq("id", order["id"]).execute()
                except Exception as e:
                    print(f"Order association failed for {order['id']}: {e}")
                    continue
        except Exception as e:
            print(f"Guest orders lookup failed: {e}")

    return {
        "user": {
            "id": user_id,
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

@auth_router.get("/me")
async def get_me(user=Depends(get_current_user)):
    result = (
        supabase_admin.table("profiles")
        .select("*")
        .eq("id", user.id)
        .maybe_single()
        .execute()
    )
    profile = result.data or {}
    return {
        "id": user.id,
        "email": user.email,
        **profile,
    }


@auth_router.patch("/me")
async def update_me(
    payload: UpdateProfileRequest,
    user=Depends(get_current_user),
):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}

    if not updates:
        raise HTTPException(status_code=400, detail="Aucune donnée à mettre à jour")

    result = (
        supabase_admin.table("profiles")
        .update(updates)
        .eq("id", user.id)
        .execute()
    )

    profile = result.data[0] if result.data else {}

    return {
        "id": user.id,
        "email": user.email,
        **profile,
    }