# Import the asynchronous MongoDB driver 'motor' to talk to the database without blocking the app.
import motor.motor_asyncio
# Import 'os' to read environment variables (like hidden passwords/URLs).
import os
# Import 'certifi' to provide a bundle of trusted security certificates (for safe internet connections).
import certifi
# Import 'ssl' to handle secure HTTPS connections.
import ssl
# Import 'load_dotenv' to load secret variables from the hidden '.env' file into Python.
from dotenv import load_dotenv

# GLOBAL SSL OVERRIDE
# This line bypasses strict SSL certificate checks. It's often used when testing locally or if there are certificate issues.
ssl._create_default_https_context = ssl._create_unverified_context

# Call load_dotenv() to actually read the '.env' file and load its contents into the app.
load_dotenv()

# Get the MongoDB connection URL from the environment. If it doesn't exist, it defaults to a local MongoDB instance.
MONGO_DETAILS = os.getenv("MONGO_URL", "mongodb://localhost:27017")

# Use only tlsInsecure to avoid conflicts with 'tls' or 'ssl' params
# Create the actual database client (the connection). 
# We enable tlsInsecure=True to avoid SSL errors, and set a timeout of 10 seconds (10000 ms) so it doesn't wait forever if it can't connect.
client = motor.motor_asyncio.AsyncIOMotorClient(
    MONGO_DETAILS, 
    tlsInsecure=True, 
    serverSelectionTimeoutMS=10000,
    connectTimeoutMS=10000
)

# Select the specific database we want to use inside MongoDB. Let's call it "machinery_db".
db = client.machinery_db

# This is a helper function. Whenever our app needs to talk to the database, it calls this to get the 'db' object.
def get_db():
    return db

# This async function runs when the app starts. It makes sure our database has the right tables (called "collections" in MongoDB).
async def init_db():
    try:
        # Get a list of all existing collections in our database.
        existing_collections = await db.list_collection_names()
        # Loop through the collections we absolutely need for our app to work.
        for col in ["users", "machines", "bookings", "notifications", "reviews"]:
            # If the collection doesn't exist yet, create it.
            if col not in existing_collections:
                await db.create_collection(col)
        # Create a unique index on the 'email' field in the 'users' collection.
        # This prevents two users from signing up with the exact same email address.
        await db.users.create_index("email", unique=True)
    except Exception as e:
        # If anything goes wrong (like a connection error), print an error message.
        print(f"CRITICAL: Failed to initialize database: {e}")
