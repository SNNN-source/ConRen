# Import BaseModel from pydantic. Pydantic is used to create "shapes" (schemas) for our data to validate it.
from pydantic import BaseModel, EmailStr, Field
# Import Optional and Any to define fields that might be empty or missing.
from typing import Optional, Any
# Import datetime to handle dates and times.
from datetime import datetime

# --- Models for Incoming Requests ---
# Think of these classes as "forms" that the frontend must fill out correctly before the backend accepts them.

# 1. UserAuth Model: Used when a user is logging in.
class UserAuth(BaseModel):
    # The email must be a valid email format (e.g., test@test.com).
    email: EmailStr
    # The user's password.
    password: str

# 2. UserCreate Model: Used when a new user is signing up. It inherits email/password from UserAuth.
class UserCreate(UserAuth):
    # The full name of the user.
    name: str
    # The user's role: e.g., "RENTER", "OWNER", or "ADMIN".
    role: str
    # Optional field for their ID proof (like an image URL). 'Optional' means they can leave it blank.
    id_proof: Optional[str] = None
    # Optional field for shop credentials (for shop owners).
    shop_credentials: Optional[str] = None

# 3. MachineCreate Model: Used when an owner wants to add a new machine to rent out.
class MachineCreate(BaseModel):
    # The ID of the owner who owns this machine.
    owner_id: str
    # The name of the equipment (e.g., "Tractor X200").
    name: str
    # Category of the machine (e.g., "Excavator", "Crane").
    category: str
    # Location where the machine is available.
    location: str
    # How much it costs to rent per hour.
    price_per_hour: int
    # Optional URL to a picture of the machine.
    image_url: Optional[str] = None
    # Optional text description detailing the machine's features.
    description: Optional[str] = None

# 4. BookingCreate Model: Used when a renter wants to book a machine.
class BookingCreate(BaseModel):
    # The ID of the machine being rented.
    machine_id: str
    # The ID of the user doing the renting.
    renter_id: str
    # When the rental starts.
    start_date: str
    # When the rental ends.
    end_date: str
    # Total calculated cost for the rental duration.
    total_cost: int

# 5. PaymentSchema Model: Used when a renter is making a payment.
class PaymentSchema(BaseModel):
    # The type of payment: usually 'INITIAL' (deposit) or 'FINAL' (remaining balance).
    type: str 
    # The amount of money being paid.
    amount: int

# 6. BookingUpdate Model: Used by the backend to change the status of an existing booking.
class BookingUpdate(BaseModel):
    # The new status (e.g., "COMPLETED", "CANCELLED").
    status: str
    # Optional field for the actual time the rental ended (used to calculate extra costs if late).
    actual_end_date: Optional[str] = None

# 7. ReviewCreate Model: Used when a renter leaves a review after a booking.
class ReviewCreate(BaseModel):
    # The ID of the booking this review belongs to.
    booking_id: str
    # A rating between 1 and 5.
    rating: int  
    # An optional written comment.
    comment: Optional[str] = None

# --- Helper Function ---
# MongoDB uses a special ID format called `_id` which looks like `ObjectId('...')`.
# Web browsers (React) prefer simple strings like "id".
# This function converts the database `_id` into a normal string `id` so the frontend can understand it.
def serialize_doc(doc) -> dict:
    if doc is None:
        return None
    # Remove '_id' from the document and save it as a string under the new key 'id'.
    doc['id'] = str(doc.pop('_id'))
    return doc
