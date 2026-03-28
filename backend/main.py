"""
Main FastAPI application for the ConRen backend.
"""

import math
import os
import sys
from datetime import datetime

from bson import ObjectId
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import auth
from database import get_db, init_db
from models import BookingCreate, BookingUpdate, MachineCreate, PaymentSchema, ReviewCreate, serialize_doc

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)


@app.on_event("startup")
async def startup_event():
    try:
        await init_db()
        print("INFO: Connected to MongoDB and initialized collections.")
    except Exception as e:
        print(f"WARNING: MongoDB init failed (will retry on first request): {e}")


def to_object_id(value: str, field_name: str = "id") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")
    return ObjectId(value)


def parse_datetime_value(value: str, field_name: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}") from exc


def compute_booking_hours(start_date: str, end_date: str) -> int:
    start_dt = parse_datetime_value(start_date, "start_date")
    end_dt = parse_datetime_value(end_date, "end_date")
    if end_dt <= start_dt:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    hours = (end_dt - start_dt).total_seconds() / 3600.0
    return max(1, math.ceil(hours))


def initial_payment_amount(total_cost: int) -> int:
    return math.ceil(total_cost / 2)


def final_payment_amount(total_cost: int, extra_cost: int) -> int:
    return (total_cost - initial_payment_amount(total_cost)) + extra_cost


def ensure_same_user(current_user: dict, user_id: str, field_name: str = "user") -> None:
    if current_user["role"] == "ADMIN":
        return
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail=f"You cannot access another {field_name}")


@app.get("/api/admin/pending-owners")
async def get_pending_owners(current_user: dict = Depends(auth.require_roles("ADMIN"))):
    db = get_db()
    owners = await db.users.find({"role": "OWNER", "is_approved": 0}).to_list(length=100)
    return [auth.serialize_user(owner) for owner in owners]


@app.patch("/api/admin/approve-owner/{owner_id}")
async def approve_owner(owner_id: str, current_user: dict = Depends(auth.require_roles("ADMIN"))):
    db = get_db()
    result = await db.users.update_one({"_id": to_object_id(owner_id, "owner_id")}, {"$set": {"is_approved": 1}})
    return {"success": result.modified_count > 0}


@app.get("/api/machines")
async def get_machines(category: str = None, location: str = None):
    db = get_db()
    query = {}
    if category:
        query["category"] = category
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    machines = await db.machines.find(query).to_list(length=100)
    return [serialize_doc(machine) for machine in machines]


@app.post("/api/machines")
async def create_machine(machine: MachineCreate, current_user: dict = Depends(auth.require_roles("OWNER"))):
    if current_user["is_approved"] != 1:
        raise HTTPException(status_code=403, detail="Owner account is not approved yet")
    if machine.owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only create machines for your own account")
    if machine.price_per_hour <= 0:
        raise HTTPException(status_code=400, detail="Price per hour must be greater than zero")

    db = get_db()
    result = await db.machines.insert_one(machine.model_dump())
    return {"id": str(result.inserted_id)}


@app.get("/api/machines/owner/{owner_id}")
async def get_owner_machines(owner_id: str, current_user: dict = Depends(auth.require_roles("OWNER", "ADMIN"))):
    ensure_same_user(current_user, owner_id, "owner")
    db = get_db()
    machines = await db.machines.find({"owner_id": owner_id}).to_list(length=100)
    return [serialize_doc(machine) for machine in machines]


@app.post("/api/bookings")
async def create_booking(booking: BookingCreate, current_user: dict = Depends(auth.require_roles("RENTER"))):
    ensure_same_user(current_user, booking.renter_id, "renter")
    db = get_db()

    machine = await db.machines.find_one({"_id": to_object_id(booking.machine_id, "machine_id")})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")

    hours = compute_booking_hours(booking.start_date, booking.end_date)
    total_cost = hours * machine.get("price_per_hour", 0)

    booking_dict = booking.model_dump()
    booking_dict["total_cost"] = total_cost
    booking_dict["status"] = "PENDING"
    booking_dict["initial_paid"] = 0
    booking_dict["final_paid"] = 0
    booking_dict["extra_cost"] = 0

    result = await db.bookings.insert_one(booking_dict)
    return {"id": str(result.inserted_id), "total_cost": total_cost}


@app.get("/api/bookings/owner/{owner_id}")
async def get_owner_bookings(owner_id: str, current_user: dict = Depends(auth.require_roles("OWNER", "ADMIN"))):
    ensure_same_user(current_user, owner_id, "owner")
    db = get_db()
    machines = await db.machines.find({"owner_id": owner_id}).to_list(length=100)
    machine_ids = [str(machine["_id"]) for machine in machines]
    machine_map = {str(machine["_id"]): machine for machine in machines}

    bookings = await db.bookings.find({"machine_id": {"$in": machine_ids}}).to_list(length=100)
    for booking in bookings:
        machine = machine_map.get(booking["machine_id"])
        booking["machine_name"] = machine["name"] if machine else "Unknown"
        renter = await db.users.find_one({"_id": to_object_id(booking["renter_id"], "renter_id")})
        booking["renter_name"] = renter["name"] if renter else "Unknown"
    return [serialize_doc(booking) for booking in bookings]


@app.get("/api/bookings/renter/{renter_id}")
async def get_renter_bookings(renter_id: str, current_user: dict = Depends(auth.require_roles("RENTER", "ADMIN"))):
    ensure_same_user(current_user, renter_id, "renter")
    db = get_db()
    bookings = await db.bookings.find({"renter_id": renter_id}).to_list(length=100)

    for booking in bookings:
        machine = await db.machines.find_one({"_id": to_object_id(booking["machine_id"], "machine_id")})
        if machine:
            booking["machine_name"] = machine.get("name")
            booking["location"] = machine.get("location")
            booking["price_per_hour"] = machine.get("price_per_hour")
            booking["owner_id"] = machine.get("owner_id")
    return [serialize_doc(booking) for booking in bookings]


@app.post("/api/bookings/{booking_id}/pay")
async def pay_booking(booking_id: str, payment: PaymentSchema, current_user: dict = Depends(auth.require_roles("RENTER"))):
    db = get_db()
    booking = await db.bookings.find_one({"_id": to_object_id(booking_id, "booking_id")})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_same_user(current_user, booking["renter_id"], "renter")

    machine = await db.machines.find_one({"_id": to_object_id(booking["machine_id"], "machine_id")})
    renter = await db.users.find_one({"_id": to_object_id(booking["renter_id"], "renter_id")})
    if not machine or not renter:
        raise HTTPException(status_code=404, detail="Related booking data not found")

    machine_name = machine["name"]
    owner_id = machine["owner_id"]
    renter_name = renter["name"]

    if payment.type == "INITIAL":
        if booking["initial_paid"]:
            raise HTTPException(status_code=400, detail="Initial payment already completed")
        if booking["status"] not in ["PENDING", "CONFIRMED"]:
            raise HTTPException(status_code=400, detail="Initial payment is not allowed in the current booking status")
        expected_amount = initial_payment_amount(booking["total_cost"])
        update_field = "initial_paid"
        message = f"Payment Received: Initial 50% (Rs {payment.amount}) for {machine_name} from {renter_name}"
    elif payment.type == "FINAL":
        if not booking["initial_paid"]:
            raise HTTPException(status_code=400, detail="Initial payment must be completed first")
        if booking["final_paid"]:
            raise HTTPException(status_code=400, detail="Final payment already completed")
        if booking["status"] != "COMPLETED":
            raise HTTPException(status_code=400, detail="Final payment is only allowed after booking completion")
        expected_amount = final_payment_amount(booking["total_cost"], booking.get("extra_cost", 0))
        update_field = "final_paid"
        message = f"Payment Received: Final Balance (Rs {payment.amount}) for {machine_name} from {renter_name}"
    else:
        raise HTTPException(status_code=400, detail="Unsupported payment type")

    if payment.amount != expected_amount:
        raise HTTPException(status_code=400, detail=f"Expected payment amount is {expected_amount}")

    await db.bookings.update_one({"_id": to_object_id(booking_id, "booking_id")}, {"$set": {update_field: 1}})
    await db.notifications.insert_one({
        "user_id": owner_id,
        "message": message,
        "is_read": 0,
        "created_at": datetime.now(),
    })
    return {"success": True}


@app.post("/api/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, current_user: dict = Depends(auth.require_roles("RENTER"))):
    db = get_db()
    booking = await db.bookings.find_one({"_id": to_object_id(booking_id, "booking_id")})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    ensure_same_user(current_user, booking["renter_id"], "renter")

    if booking["status"] not in ["PENDING", "CONFIRMED"]:
        raise HTTPException(status_code=400, detail="Only PENDING or CONFIRMED bookings can be cancelled")

    start_dt = parse_datetime_value(booking["start_date"], "start_date")
    now = datetime.now(tz=start_dt.tzinfo) if start_dt.tzinfo else datetime.now()
    hours_until_start = (start_dt - now).total_seconds() / 3600.0
    if hours_until_start < 8:
        raise HTTPException(status_code=400, detail="Cancellation not allowed within 8 hours of the start time")

    await db.bookings.update_one({"_id": to_object_id(booking_id, "booking_id")}, {"$set": {"status": "CANCELLED"}})

    machine = await db.machines.find_one({"_id": to_object_id(booking["machine_id"], "machine_id")})
    renter = await db.users.find_one({"_id": to_object_id(booking["renter_id"], "renter_id")})
    if machine and renter:
        await db.notifications.insert_one({
            "user_id": machine["owner_id"],
            "message": f"Booking Cancelled: {renter['name']} cancelled the booking for {machine['name']} (start: {booking['start_date']}).",
            "is_read": 0,
            "created_at": datetime.now(),
        })

    return {"success": True, "message": "Booking cancelled successfully"}


@app.patch("/api/bookings/{booking_id}")
async def update_booking(booking_id: str, update: BookingUpdate, current_user: dict = Depends(auth.require_roles("OWNER"))):
    db = get_db()
    booking = await db.bookings.find_one({"_id": to_object_id(booking_id, "booking_id")})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    machine = await db.machines.find_one({"_id": to_object_id(booking["machine_id"], "machine_id")})
    if not machine or machine["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You do not own this booking")

    allowed_statuses = {"CONFIRMED", "CANCELLED", "COMPLETED"}
    if update.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Unsupported booking status")

    update_doc = {"status": update.status}
    if update.status == "COMPLETED":
        actual_end_value = update.actual_end_date or datetime.now().isoformat(timespec="minutes")
        update_doc["actual_end_date"] = actual_end_value

        scheduled_end = parse_datetime_value(booking["end_date"], "end_date")
        actual_end = parse_datetime_value(actual_end_value, "actual_end_date")

        extra_cost = 0
        if actual_end > scheduled_end:
            extra_hours = (actual_end - scheduled_end).total_seconds() / 3600.0
            extra_cost = math.ceil(extra_hours) * machine.get("price_per_hour", 0)
        update_doc["extra_cost"] = extra_cost

    await db.bookings.update_one({"_id": to_object_id(booking_id, "booking_id")}, {"$set": update_doc})
    return {"success": True}


@app.get("/api/notifications/{user_id}")
async def get_notifications(user_id: str, current_user: dict = Depends(auth.get_current_user)):
    ensure_same_user(current_user, user_id)
    db = get_db()
    notifications = await db.notifications.find({"user_id": user_id}).sort("created_at", -1).limit(20).to_list(length=20)

    cleaned = []
    for notification in notifications:
        notification["id"] = str(notification.pop("_id"))
        if "created_at" in notification and isinstance(notification["created_at"], datetime):
            notification["created_at"] = notification["created_at"].isoformat()
        cleaned.append(notification)
    return cleaned


@app.post("/api/notifications/read/{notif_id}")
async def read_notification(notif_id: str, current_user: dict = Depends(auth.get_current_user)):
    db = get_db()
    notification = await db.notifications.find_one({"_id": to_object_id(notif_id, "notif_id")})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    ensure_same_user(current_user, notification["user_id"])
    await db.notifications.update_one({"_id": to_object_id(notif_id, "notif_id")}, {"$set": {"is_read": 1}})
    return {"success": True}


@app.post("/api/reviews")
async def create_review(review: ReviewCreate, current_user: dict = Depends(auth.require_roles("RENTER"))):
    db = get_db()
    booking = await db.bookings.find_one({"_id": to_object_id(review.booking_id, "booking_id")})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    ensure_same_user(current_user, booking["renter_id"], "renter")
    await db.reviews.insert_one(review.model_dump())
    return {"success": True}


frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")

        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
