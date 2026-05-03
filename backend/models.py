# models.py

from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class WorkshopBookingRequest(BaseModel):
    workshop_id: str
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    quantity: int = Field(1, gt=0)
    origin_url: str


class AdminWorkshopRequest(BaseModel):
    title: str
    slug: str
    description: Optional[str] = None
    expert_name: Optional[str] = None
    location: str = "Boutique Genève"
    starts_at: str
    price: float = 0
    currency: str = "CHF"
    capacity: int = Field(10, gt=0)
    active: bool = True