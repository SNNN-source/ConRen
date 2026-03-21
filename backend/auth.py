# Import tools from FastAPI for creating routes and handling errors.
from fastapi import APIRouter, HTTPException, Depends
# Import our data validator models and a helper function from models.py
from models import UserCreate, UserAuth, serialize_doc
# Import our database connection function from database.py
from database import get_db

# Create a "router" which groups all authentication-related URLs under '/api/auth'
router = APIRouter(prefix="/api/auth", tags=["auth"])

# --- SIGN UP ROUTE ---
# This listens for a POST request at '/api/auth/signup'
@router.post("/signup")
async def signup(user: UserCreate): # The 'user' variable must match the UserCreate rules.
    # Connect to the database
    db = get_db()
    try:
        # Check if a user with this email already exists in the 'users' collection.
        existing_user = await db.users.find_one({"email": user.email})
        # If they exist, stop here and return an error.
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already exists")
        
        # Convert the Pydantic 'user' model into a standard Python dictionary.
        user_dict = user.model_dump()
        # Automatically approve Renters and Admins. If they are an Owner, set approval to 0 (Pending).
        user_dict["is_approved"] = 1 if user.role in ["RENTER", "ADMIN"] else 0
        
        # Insert the new user's dictionary into the 'users' database collection.
        result = await db.users.insert_one(user_dict)
        # Fetch the newly created user back from the database using their new ID.
        new_user = await db.users.find_one({"_id": result.inserted_id})
        # Return the new user to the frontend, converting the raw database ID into a normal string 'id'.
        return serialize_doc(new_user)
    except Exception as e:
        # If an error happens, print it to the server console.
        print(f"Signup error: {e}")
        # If it's a known HTTP error, raise it normally.
        if isinstance(e, HTTPException): raise e
        # Otherwise, throw a general connection error.
        raise HTTPException(status_code=503, detail=f"Database connection failed. Please check your internet or firewall settings. Error: {str(e)[:100]}")

# --- LOGIN ROUTE ---
# This listens for a POST request at '/api/auth/login'
@router.post("/login")
async def login(user: UserAuth): # The 'user' must match the UserAuth rules (email, password).
    # Connect to the database
    db = get_db()
    try:
        # Look for a user in the database with exactly this email AND password.
        db_user = await db.users.find_one({"email": user.email, "password": user.password})
        # If we found a match, the login is successful.
        if db_user:
            # Return the user's data (like their role and ID) back to the frontend.
            return serialize_doc(db_user)
        else:
            # If no match is found, throw an "Invalid credentials" error.
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        # Print the error for developers to see.
        print(f"Login error: {e}")
        # Pass up expected HTTP errors.
        if isinstance(e, HTTPException): raise e
        # Pass up general database errors.
        raise HTTPException(status_code=503, detail=f"Database connection failed. Please check your internet or firewall settings. Error: {str(e)[:100]}")
