# Import tools from FastAPI for building the web server.
from fastapi import FastAPI, HTTPException, Request, Query
# Import CORS middleware allow frontend and backend to talk to each other without security blockages.
from fastapi.middleware.cors import CORSMiddleware
# Import tools to serve static files (like images, CSS, JS) and specific files (like index.html).
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
# Import ObjectId to handle MongoDB's unique ID format.
from bson import ObjectId

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import our own modules (auth logic, database logic, models containing rules).
import auth
import os
from database import get_db, init_db
from models import (
    MachineCreate, BookingCreate, BookingUpdate, PaymentSchema, ReviewCreate, serialize_doc
)
# Import datetime and math for calculating times and costs.
from datetime import datetime
import math

# Initialize the main FastAPI application. This is the heart of the backend.
app = FastAPI()

# Add a "Middleware" to allow Cross-Origin Resource Sharing (CORS).
# This basically says: "Allow any frontend (allow_origins=['*']) to talk to our API."
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect the auth.py routes (like signup and login) to the main app.
app.include_router(auth.router)

# This function runs automatically exactly once when the server starts up.
@app.on_event("startup")
async def startup_event():
    try:
        # Try to initialize the database (create collections like users, machines).
        await init_db()
        print("INFO:     Connected to MongoDB and initialized collections.")
    except Exception as e:
        # If the database isn't ready, we print a warning but don't crash yet.
        print(f"WARNING:  MongoDB init failed (will retry on first request): {e}")

# --- Admin Routes ---

# Example: GET request to '/api/admin/pending-owners'
# This route grabs all users who registered as "OWNER" but aren't approved yet.
@app.get("/api/admin/pending-owners")
async def get_pending_owners():
    db = get_db()
    # Find up to 100 owners where 'is_approved' equals 0.
    owners = await db.users.find({"role": "OWNER", "is_approved": 0}).to_list(length=100)
    # Return the clean, formatted list of owners.
    return [serialize_doc(o) for o in owners]

# Example: PATCH request to approve a specific owner.
@app.patch("/api/admin/approve-owner/{owner_id}")
async def approve_owner(owner_id: str):
    db = get_db()
    # Find the owner by their ID and update their 'is_approved' status from 0 to 1.
    result = await db.users.update_one({"_id": ObjectId(owner_id)}, {"$set": {"is_approved": 1}})
    # Return success true if the update worked.
    return {"success": result.modified_count > 0}

# --- Machines ---

# Gets a list of all available machines, with optional filters for category and location.
@app.get("/api/machines")
async def get_machines(category: str = None, location: str = None):
    db = get_db()
    query = {}
    # If the user asks for a specific category, add it to our search filter.
    if category:
        query["category"] = category
    # If they ask for a location, use a "regex" (pattern match) ignoring uppercase/lowercase ("i").
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    # Ask the database for up to 100 machines matching those filters.
    machines = await db.machines.find(query).to_list(length=100)
    return [serialize_doc(m) for m in machines]

# Adds a new machine to the database.
@app.post("/api/machines")
async def create_machine(machine: MachineCreate):
    db = get_db()
    # Convert validated incoming data to a normal dictionary.
    machine_dict = machine.model_dump()
    # Save the new machine into the 'machines' collection.
    result = await db.machines.insert_one(machine_dict)
    # Return the newly created database ID.
    return {"id": str(result.inserted_id)}

# Gets all machines owned by a specific owner ID.
@app.get("/api/machines/owner/{owner_id}")
async def get_owner_machines(owner_id: str):
    db = get_db()
    # Find machines where the owner_id matches.
    machines = await db.machines.find({"owner_id": owner_id}).to_list(length=100)
    return [serialize_doc(m) for m in machines]

# --- Bookings ---

# Creates a new rental booking.
@app.post("/api/bookings")
async def create_booking(booking: BookingCreate):
    db = get_db()
    booking_dict = booking.model_dump()
    # Set default values for a brand new booking.
    booking_dict["status"] = "PENDING"
    booking_dict["initial_paid"] = 0
    booking_dict["final_paid"] = 0
    booking_dict["extra_cost"] = 0
    # Save to the 'bookings' collection.
    result = await db.bookings.insert_one(booking_dict)
    return {"id": str(result.inserted_id)}

# Gets all bookings for machines owned by a specific owner.
@app.get("/api/bookings/owner/{owner_id}")
async def get_owner_bookings(owner_id: str):
    db = get_db()
    # 1. Find all machines this owner has.
    machines = await db.machines.find({"owner_id": owner_id}).to_list(length=100)
    # Extract just the IDs of those machines.
    machine_ids = [str(m["_id"]) for m in machines]
    # Create a quick reference map so we can attach the machine's name to the booking later.
    machine_map = {str(m["_id"]): m for m in machines}
    
    # 2. Find any bookings linked to those specific machine IDs.
    bookings = await db.bookings.find({"machine_id": {"$in": machine_ids}}).to_list(length=100)
    
    # 3. For each booking, retrieve the name of the machine and the name of the renter to display on the frontend.
    for b in bookings:
        m = machine_map.get(b["machine_id"])
        b["machine_name"] = m["name"] if m else "Unknown"
        user = await db.users.find_one({"_id": ObjectId(b["renter_id"])})
        b["renter_name"] = user["name"] if user else "Unknown"
        
    return [serialize_doc(b) for b in bookings]

# Gets all bookings made by a specific renter.
@app.get("/api/bookings/renter/{renter_id}")
async def get_renter_bookings(renter_id: str):
    db = get_db()
    # Find bookings belonging to this renter's ID.
    bookings = await db.bookings.find({"renter_id": renter_id}).to_list(length=100)
    
    # Grab extra details about the machine so the renter can see what they rented on their dashboard.
    for b in bookings:
        try:
            m = await db.machines.find_one({"_id": ObjectId(b["machine_id"])})
            if m:
                b["machine_name"] = m.get("name")
                b["location"] = m.get("location")
                b["price_per_hour"] = m.get("price_per_hour")
                b["owner_id"] = m.get("owner_id")
        except:
            pass
            
    return [serialize_doc(b) for b in bookings]

# Handles payments made towards a specific booking.
@app.post("/api/bookings/{booking_id}/pay")
async def pay_booking(booking_id: str, payment: PaymentSchema):
    db = get_db()
    # Verify the booking actually exists.
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Get details for the notification message.
    machine = await db.machines.find_one({"_id": ObjectId(booking["machine_id"])})
    renter = await db.users.find_one({"_id": ObjectId(booking["renter_id"])})
    
    machine_name = machine["name"] if machine else "Machine"
    owner_id = machine["owner_id"] if machine else None
    renter_name = renter["name"] if renter else "Renter"

    update_field = ""
    message = ""
    # Decide which type of payment is being made (deposit vs final balance).
    if payment.type == 'INITIAL':
        update_field = "initial_paid"
        message = f"Payment Received: Initial 50% (₹{payment.amount}) for {machine_name} from {renter_name}"
    elif payment.type == 'FINAL':
        update_field = "final_paid"
        message = f"Payment Received: Final Balance (₹{payment.amount}) for {machine_name} from {renter_name}"

    # Update the booking in the database to mark it as paid.
    if update_field:
        await db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": {update_field: 1}})
        # If the machine has an owner, create a notification for them about the new payment.
        if owner_id:
            await db.notifications.insert_one({
                "user_id": owner_id,
                "message": message,
                "is_read": 0,
                "created_at": datetime.now()
            })

    return {"success": True}

# Handles cancelling a booking.
@app.post("/api/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str):
    db = get_db()
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # We only cancel things that haven't been completed or cancelled already.
    if booking["status"] not in ["PENDING", "CONFIRMED"]:
        raise HTTPException(status_code=400, detail="Only PENDING or CONFIRMED bookings can be cancelled.")

    # Check 8-hour window policy: Renters cannot cancel if the rental starts in less than 8 hours.
    try:
        # Calculate time remaining.
        start_dt = datetime.fromisoformat(booking["start_date"].replace('Z', '+00:00'))
        now = datetime.now(tz=start_dt.tzinfo)
        hours_until_start = (start_dt - now).total_seconds() / 3600.0
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse booking start date.")

    # If too late to cancel, throw an error.
    if hours_until_start < 8:
        raise HTTPException(
            status_code=400,
            detail=f"Cancellation not allowed. Booking starts in less than 8 hours ({max(0, hours_until_start):.1f} hrs remaining)."
        )

    # Cancel the booking by changing its status.
    await db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": {"status": "CANCELLED"}})

    # Notify owner that their machine rental was cancelled.
    machine = await db.machines.find_one({"_id": ObjectId(booking["machine_id"])})
    renter = await db.users.find_one({"_id": ObjectId(booking["renter_id"])})
    machine_name = machine["name"] if machine else "a machine"
    renter_name = renter["name"] if renter else "A renter"
    owner_id = machine["owner_id"] if machine else None

    if owner_id:
        await db.notifications.insert_one({
            "user_id": owner_id,
            "message": f"Booking Cancelled: {renter_name} cancelled the booking for {machine_name} (start: {booking['start_date']}).",
            "is_read": 0,
            "created_at": datetime.now()
        })

    return {"success": True, "message": "Booking cancelled successfully."}

# Updates a booking (e.g., when an owner marks it as 'COMPLETED').
@app.patch("/api/bookings/{booking_id}")
async def update_booking(booking_id: str, update: BookingUpdate):
    db = get_db()
    booking = await db.bookings.find_one({"_id": ObjectId(booking_id)})
    if not booking:
        return {"success": False}

    update_doc = {"status": update.status}
    
    # If the booking is marked COMPLETED, check if they returned it late and calculate extra costs.
    if update.status == 'COMPLETED' and update.actual_end_date:
        update_doc["actual_end_date"] = update.actual_end_date
        
        machine = await db.machines.find_one({"_id": ObjectId(booking["machine_id"])})
        price_per_hour = machine.get("price_per_hour", 0) if machine else 0
        
        try:
            # Compare scheduled end date to actual return date.
            scheduled_end = datetime.fromisoformat(booking["end_date"].replace('Z', '+00:00'))
            actual_end = datetime.fromisoformat(update.actual_end_date.replace('Z', '+00:00'))
            
            extra_cost = 0
            if actual_end > scheduled_end:
                # If late, compute extra hours and multiply by the hourly rate.
                extra_hours = (actual_end - scheduled_end).total_seconds() / 3600.0
                extra_cost = math.ceil(extra_hours) * price_per_hour
                
            update_doc["extra_cost"] = extra_cost
        except:
            pass
            
    # Apply the updates to the database.
    await db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": update_doc})
    return {"success": True}

# --- Notifications ---

# Fetches up to 20 recent notifications for a specific user ID.
@app.get("/api/notifications/{user_id}")
async def get_notifications(user_id: str):
    db = get_db()
    # Sort them backwards by created_at date so the newest ones show up first.
    notifications = await db.notifications.find({"user_id": user_id}).sort("created_at", -1).limit(20).to_list(length=20)
    
    res = []
    # Clean up the output to work nicely with JavaScript on the frontend.
    for n in notifications:
        n["id"] = str(n.pop("_id"))
        if "created_at" in n and isinstance(n["created_at"], datetime):
            n["created_at"] = n["created_at"].isoformat()
        res.append(n)
    return res

# Marks a given notification as "read" by updating the database.
@app.post("/api/notifications/read/{notif_id}")
async def read_notification(notif_id: str):
    db = get_db()
    await db.notifications.update_one({"_id": ObjectId(notif_id)}, {"$set": {"is_read": 1}})
    return {"success": True}

# --- Reviews ---

# Creates a new review snippet in the database.
@app.post("/api/reviews")
async def create_review(review: ReviewCreate):
    db = get_db()
    await db.reviews.insert_one(review.model_dump())
    return {"success": True}

# --- Serve Frontend (React) ---
# NOTE: Instead of letting the frontend run separately, we can build the frontend 
# and serve its finished files right out of the backend folder using this setup.

# Define the folder path where the frontend build lives (the 'dist' folder generated by Vite/React).
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

# If the compiled frontend exists...
if os.path.exists(frontend_dist):
    # Serve assets like images, js, and css files so the browser can load them.
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    # Catch-all route for any other URL the user types in (like '/login', '/dashboard').
    # It always returns the main 'index.html' file so React Router can take over in the browser.
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # We don't want to accidentally serve html for backend API URLs, so return a 404 error if it's an API route.
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        
        # Check if they asked for a specific physical file in frontend storage.
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
             return FileResponse(file_path)
             
        # Otherwise, fall back to index.html to load the React app framework.
        return FileResponse(os.path.join(frontend_dist, "index.html"))

