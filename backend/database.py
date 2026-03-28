"""
Database connection setup for the ConRen backend.

Beginner note:
This file does two jobs:
1. it connects the backend to MongoDB
2. it makes sure the required collections exist when the app starts

Other backend files import `get_db()` from here whenever they need to read or
write data.
"""

# Import the asynchronous MongoDB driver `motor` to talk to the database.
import motor.motor_asyncio

# Import `os` to read environment variables like MONGO_URL.
import os
from pathlib import Path

# Import `certifi` to provide trusted security certificates.
import certifi

# Import `ssl` to handle secure connections.
import ssl

# Import `load_dotenv` to load values from a local `.env` file.
from dotenv import load_dotenv

# GLOBAL SSL OVERRIDE
# Beginner warning:
# This disables strict SSL verification for outgoing connections. It can be
# useful during local testing, but a real production app should use a stricter
# and properly verified TLS setup.
ssl._create_default_https_context = ssl._create_unverified_context

# Load environment variables from the project root and backend folder when present.
BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
load_dotenv(PROJECT_DIR / ".env.local")
load_dotenv(BASE_DIR / ".env")

# Read the MongoDB connection string from the environment.
# If none is provided, fall back to the remote MongoDB server so Vercel can connect.
MONGO_DETAILS = os.getenv("MONGO_URL", "mongodb+srv://aaryanb23243csa_db_user:6VjGw3ekbmOlE9xL@conren.xtpfixf.mongodb.net/?appName=ConRen")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

# Create the MongoDB client.
# `tlsInsecure=True` relaxes certificate checks to avoid some local SSL issues.
# The timeout values stop the app from hanging forever if the database is unreachable.
client = motor.motor_asyncio.AsyncIOMotorClient(
    MONGO_DETAILS,
    tlsInsecure=True,
    serverSelectionTimeoutMS=10000,
    connectTimeoutMS=10000
)

# Select the database used by this project.
# Priority:
# 1. explicit MONGO_DB_NAME
# 2. database name embedded in MONGO_URL
# 3. fallback local database name
db = client.get_database(MONGO_DB_NAME) if MONGO_DB_NAME else client.get_default_database(default="machinery_db")

# Helper function used by the rest of the backend to access the database.
def get_db():
    return db

# Create required collections and indexes if they do not exist yet.
async def init_db():
    try:
        # Ask MongoDB which collections already exist.
        existing_collections = await db.list_collection_names()

        # Ensure each required collection exists.
        for col in ["users", "machines", "bookings", "notifications", "reviews"]:
            if col not in existing_collections:
                await db.create_collection(col)

        # Make email unique so two users cannot sign up with the same email.
        await db.users.create_index("email", unique=True)
    except Exception as e:
        print(f"CRITICAL: Failed to initialize database: {e}")
