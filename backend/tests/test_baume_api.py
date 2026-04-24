"""Backend API tests for Baume e-commerce (French feminine wellness)."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "https://baume-refonte.preview.emergentagent.com"
BASE = BASE.rstrip("/")
API = f"{BASE}/api"


# -------- Health --------
def test_health():
    r = requests.get(f"{API}/", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"


# -------- Products listing & filters --------
def test_list_products_all():
    r = requests.get(f"{API}/products", timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) == 20
    # ensure no _id leaked
    for it in items:
        assert "_id" not in it
        assert "id" in it and "slug" in it


def test_filter_category():
    r = requests.get(f"{API}/products", params={"category": "culottes-menstruelles"}, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 3
    assert all(p["product_category"] == "culottes-menstruelles" for p in items)


def test_filter_need():
    r = requests.get(f"{API}/products", params={"need": "regles-cycle"}, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 0
    assert all("regles-cycle" in p["needs"] for p in items)


def test_filter_bestseller():
    r = requests.get(f"{API}/products", params={"bestseller": "true"}, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 5
    assert all(p["bestseller"] is True for p in items)


def test_filter_flux_abondant():
    r = requests.get(f"{API}/products", params={"flux": "abondant"}, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    assert all(p.get("flux") == "abondant" for p in items)


def test_filter_usage_nuit():
    r = requests.get(f"{API}/products", params={"usage": "nuit"}, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert all(p.get("usage") == "nuit" for p in items)


def test_filter_max_price():
    r = requests.get(f"{API}/products", params={"max_price": 30}, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert all(p["price"] <= 30 for p in items)


def test_filter_search_cup():
    r = requests.get(f"{API}/products", params={"search": "cup"}, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1


# -------- Single product --------
def test_get_product_by_slug():
    r = requests.get(f"{API}/products/culotte-confort-nuit", timeout=30)
    assert r.status_code == 200
    p = r.json()
    assert p["slug"] == "culotte-confort-nuit"
    assert p["price"] == 42.0
    assert "_id" not in p


def test_get_product_404():
    r = requests.get(f"{API}/products/inexistant", timeout=30)
    assert r.status_code == 404


# -------- Categories --------
def test_categories_besoin():
    r = requests.get(f"{API}/categories", params={"kind": "besoin"}, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 6
    for it in items:
        assert "_id" not in it
        assert it["kind"] == "besoin"


def test_categories_produit():
    r = requests.get(f"{API}/categories", params={"kind": "produit"}, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 8


def test_category_detail_besoin():
    r = requests.get(f"{API}/categories/besoin/regles-cycle", timeout=30)
    assert r.status_code == 200
    assert r.json()["slug"] == "regles-cycle"


def test_category_detail_produit():
    r = requests.get(f"{API}/categories/produit/culottes-menstruelles", timeout=30)
    assert r.status_code == 200
    assert r.json()["slug"] == "culottes-menstruelles"


# -------- Reviews --------
def test_reviews_list():
    r = requests.get(f"{API}/reviews", timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 6
    for it in items:
        assert "_id" not in it


def test_reviews_by_product():
    r = requests.get(f"{API}/reviews", params={"product_id": "p1"}, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert all(x.get("product_id") == "p1" for x in items)


# -------- Guides --------
def test_guides_list():
    r = requests.get(f"{API}/guides", timeout=30)
    assert r.status_code == 200
    assert len(r.json()) == 6


def test_guide_detail():
    r = requests.get(f"{API}/guides/choisir-sa-culotte-menstruelle", timeout=30)
    assert r.status_code == 200
    g = r.json()
    assert g["slug"] == "choisir-sa-culotte-menstruelle"
    assert "content" in g


# -------- Experts --------
def test_experts_list():
    r = requests.get(f"{API}/experts", timeout=30)
    assert r.status_code == 200
    assert len(r.json()) == 3


# -------- Contact --------
def test_contact_valid():
    payload = {
        "name": "TEST_Marie",
        "email": "test_marie@example.com",
        "subject": "TEST Question produit",
        "message": "Bonjour, j'ai une question sur la culotte nuit.",
        "topic": "produit"
    }
    r = requests.post(f"{API}/contact", json=payload, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "id" in data
    assert "message" in data


def test_contact_invalid_email():
    payload = {
        "name": "TEST",
        "email": "not-an-email",
        "subject": "x",
        "message": "y",
    }
    r = requests.post(f"{API}/contact", json=payload, timeout=30)
    assert r.status_code == 422


# -------- Checkout --------
def test_checkout_session_valid():
    payload = {
        "items": [{"product_id": "p1", "name": "Culotte", "quantity": 1, "size": "M"}],
        "origin_url": "https://baume-refonte.preview.emergentagent.com",
        "email": "test_checkout@example.com",
        "shipping_country": "CH"
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "url" in data and data["url"].startswith("http")
    assert "session_id" in data
    # 42 + 6.90 shipping CH (below 60 threshold) = 48.90
    assert data["total"] == 48.9
    # checkout status
    sid = data["session_id"]
    r2 = requests.get(f"{API}/checkout/status/{sid}", timeout=30)
    assert r2.status_code == 200
    status = r2.json()
    assert "status" in status
    assert "payment_status" in status


def test_checkout_empty_items():
    payload = {
        "items": [],
        "origin_url": "https://baume-refonte.preview.emergentagent.com",
        "shipping_country": "CH"
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 400


def test_checkout_unknown_product():
    payload = {
        "items": [{"product_id": "xxxx", "name": "Unknown", "quantity": 1}],
        "origin_url": "https://baume-refonte.preview.emergentagent.com",
        "shipping_country": "CH"
    }
    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 400
