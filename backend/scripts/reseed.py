#!/usr/bin/env python3
"""Reseed script — clears products/categories/guides/experts/reviews collections and re-inserts fresh data.

Usage: python /app/backend/scripts/reseed.py
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Ensure backend is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402
from seed_data import PRODUCTS, NEEDS, PRODUCT_CATEGORIES, REVIEWS, GUIDES, EXPERTS  # noqa: E402


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    print("Clearing catalogue collections...")
    await db.products.delete_many({})
    await db.categories.delete_many({})
    await db.reviews.delete_many({})
    await db.guides.delete_many({})
    await db.experts.delete_many({})

    print(f"Inserting {len(PRODUCTS)} products...")
    await db.products.insert_many([dict(p) for p in PRODUCTS])
    print(f"Inserting {len(NEEDS)} needs + {len(PRODUCT_CATEGORIES)} product categories...")
    await db.categories.insert_many(
        [{**n, "kind": "besoin"} for n in NEEDS] +
        [{**c, "kind": "produit"} for c in PRODUCT_CATEGORIES]
    )
    print(f"Inserting {len(REVIEWS)} reviews, {len(GUIDES)} guides, {len(EXPERTS)} experts...")
    await db.reviews.insert_many(REVIEWS)
    await db.guides.insert_many(GUIDES)
    await db.experts.insert_many(EXPERTS)

    print("✓ Reseed complete.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
