from fastapi import Request, HTTPException, Depends
from supabase import create_client
import os

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def extract_token(request: Request):
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        return auth.split(" ")[1]
    return None


async def get_current_user(request: Request):
    token = extract_token(request)

    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")

    user = supabase.auth.get_user(token)

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
    except:
        return None


async def get_current_profile(user=Depends(get_current_user)):
    result = supabase.table("profiles").select("*").eq("id", user.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Profil introuvable")

    return result.data


async def require_admin(profile=Depends(get_current_profile)):
    if profile.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé")

    return profile