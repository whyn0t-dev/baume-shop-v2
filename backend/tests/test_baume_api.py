"""Global backend API tests for Baume."""

import os
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8000"
BASE = BASE.rstrip("/")
API = f"{BASE}/api"


def test_health():
    r = requests.get(f"{API}/", timeout=30)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_products_global():
    r = requests.get(f"{API}/products", timeout=30)
    assert r.status_code == 200

    products = r.json()
    assert isinstance(products, list)

    if products:
        product = products[0]
        assert "id" in product
        assert "slug" in product
        assert "name" in product
        assert "price" in product


def test_product_detail_if_products_exist():
    products = requests.get(f"{API}/products", timeout=30).json()

    if not products:
        return

    slug = products[0]["slug"]
    r = requests.get(f"{API}/products/{slug}", timeout=30)

    assert r.status_code == 200
    assert r.json()["slug"] == slug


def test_product_404():
    r = requests.get(f"{API}/products/product-that-does-not-exist", timeout=30)
    assert r.status_code == 404


def test_categories_global():
    r = requests.get(f"{API}/categories", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_reviews_global():
    r = requests.get(f"{API}/reviews", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_guides_global():
    r = requests.get(f"{API}/guides", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_experts_global():
    r = requests.get(f"{API}/experts", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_contact_valid():
    payload = {
        "name": "Test Global",
        "email": "test-global@example.com",
        "subject": "Test contact",
        "message": "Message de test global.",
        "topic": "test",
    }

    r = requests.post(f"{API}/contact", json=payload, timeout=30)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_contact_invalid_email():
    payload = {
        "name": "Test",
        "email": "invalid-email",
        "subject": "Test",
        "message": "Message",
    }

    r = requests.post(f"{API}/contact", json=payload, timeout=30)
    assert r.status_code == 422


def test_checkout_empty_cart():
    payload = {
        "items": [],
        "origin_url": BASE,
        "shipping_country": "CH",
    }

    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 400


def test_checkout_unknown_product():
    payload = {
        "items": [
            {
                "product_id": "unknown-product-id",
                "name": "Unknown",
                "quantity": 1,
            }
        ],
        "origin_url": BASE,
        "shipping_country": "CH",
    }

    r = requests.post(f"{API}/checkout/session", json=payload, timeout=30)
    assert r.status_code == 400


def test_checkout_valid_if_products_exist():
    products = requests.get(f"{API}/products", timeout=30).json()

    available_products = [p for p in products if p.get("available", True)]

    if not available_products:
        return

    product = available_products[0]

    payload = {
        "items": [
            {
                "product_id": product["id"],
                "name": product["name"],
                "quantity": 1,
            }
        ],
        "origin_url": BASE,
        "email": "checkout-test@example.com",
        "shipping_country": "CH",
    }

    r = requests.post(f"{API}/checkout/session", json=payload, timeout=60)

    assert r.status_code == 200, r.text

    data = r.json()
    assert "url" in data
    assert "session_id" in data
    assert "total" in data
    assert data["total"] > 0


def test_orders_mine_requires_auth():
    r = requests.get(f"{API}/orders/mine", timeout=30)
    assert r.status_code == 401


def test_admin_requires_auth():
    r = requests.get(f"{API}/admin/test", timeout=30)
    assert r.status_code == 401


def test_me_requires_auth():
    r = requests.get(f"{API}/me", timeout=30)
    assert r.status_code == 401