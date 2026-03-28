"""
Pydantic models used by the backend API.
"""

from typing import Optional

from pydantic import BaseModel, EmailStr


class UserAuth(BaseModel):
    email: EmailStr
    password: str


class UserCreate(UserAuth):
    name: str
    role: str
    id_proof: Optional[str] = None
    shop_credentials: Optional[str] = None


class MachineCreate(BaseModel):
    owner_id: str
    name: str
    category: str
    location: str
    price_per_hour: int
    image_url: Optional[str] = None
    description: Optional[str] = None


class BookingCreate(BaseModel):
    machine_id: str
    renter_id: str
    start_date: str
    end_date: str
    total_cost: Optional[int] = None


class PaymentSchema(BaseModel):
    type: str
    amount: int


class BookingUpdate(BaseModel):
    status: str
    actual_end_date: Optional[str] = None


class ReviewCreate(BaseModel):
    booking_id: str
    rating: int
    comment: Optional[str] = None


def serialize_doc(doc) -> dict:
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc
