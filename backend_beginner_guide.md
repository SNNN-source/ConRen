# ConRen Backend Beginner Guide

This document explains how the backend works for a complete beginner.

The goal is to answer these questions:

- What is each backend file for?
- How do the files connect to each other?
- What happens when a user signs up, logs in, books a machine, pays, or cancels?
- What does each important line of code mean?

This guide covers the handwritten backend files in the `backend/` folder:

- `auth.py`
- `database.py`
- `main.py`
- `models.py`
- `db_check.py`
- `requirements.txt`
- `.env.example`

It does not explain generated folders like `.venv`, `venv`, or `__pycache__` line by line, because those are tool-generated support files rather than application logic.

## 1. Big Picture First

Before going line by line, here is the full backend in plain English:

1. The frontend sends HTTP requests to the FastAPI backend.
2. `main.py` creates the FastAPI app and defines most API routes.
3. `auth.py` handles signup, login, password hashing, token creation, and checking who the current user is.
4. `database.py` connects to MongoDB and makes sure required collections exist.
5. `models.py` defines the expected shape of request data using Pydantic models.
6. MongoDB stores the actual data in collections such as `users`, `machines`, `bookings`, `notifications`, and `reviews`.
7. The backend returns JSON responses to the frontend.

## 2. How The Files Depend On Each Other

This is the backend dependency flow:

- `main.py` imports `auth`, `database`, and `models`.
- `auth.py` imports `database` and `models`.
- `database.py` is mostly independent and only handles MongoDB setup.
- `models.py` is shared by `main.py` and `auth.py`.
- `db_check.py` is a standalone helper script used for debugging the database.

## 3. How The Frontend Communicates With The Backend

If you are completely new to backend development, this is the most important mental model:

1. The frontend sends an HTTP request.
2. FastAPI receives that request.
3. FastAPI finds the matching Python route function.
4. The route may validate incoming data using a Pydantic model.
5. The route may check the logged-in user using a bearer token.
6. The route reads or writes MongoDB.
7. The route returns JSON.
8. The frontend reads that JSON and updates the screen.

Here is what that looks like in this project:

- The frontend might send `POST /api/auth/login` with JSON like `{ "email": "...", "password": "..." }`.
- FastAPI sends that request to `login()` in `backend/auth.py`.
- `login()` checks MongoDB for the user and verifies the password.
- If login succeeds, the backend returns JSON containing a `token` and `user`.
- The frontend stores that token and sends it later in the `Authorization` header.
- For a protected route, the header usually looks like `Authorization: Bearer <token>`.
- FastAPI's dependency system reads that token before the route runs.
- The backend then decides whether this user is a renter, owner, or admin.

So the frontend does not "talk directly to MongoDB".

It always talks to the FastAPI backend first, and the backend talks to MongoDB on the frontend's behalf.

That separation is important because:

- the frontend should not know database secrets
- the backend can validate data before saving it
- the backend can enforce permissions
- the backend can calculate trusted values like booking cost

## 4. What Happens In Common Real-Life Flows

### User signup flow

1. Frontend sends `POST /api/auth/signup`.
2. FastAPI matches that route to `signup()` in `auth.py`.
3. FastAPI validates the incoming JSON using `UserCreate` from `models.py`.
4. `auth.py` checks whether the email already exists.
5. It blocks `ADMIN` self-signup.
6. It hashes the password.
7. It stores the new user in MongoDB.
8. It creates a token.
9. It returns the token and safe user data to the frontend.

### User login flow

1. Frontend sends `POST /api/auth/login`.
2. `login()` in `auth.py` receives the request.
3. It checks whether the user is the configured admin.
4. If not, it looks up the email in MongoDB.
5. It verifies the password hash.
6. If valid, it creates a token and returns the logged-in user.

### Machine listing flow

1. Owner sends `POST /api/machines`.
2. `main.py` checks whether the requester is an owner.
3. It checks whether the owner has been approved.
4. It validates the machine data.
5. It inserts the machine into MongoDB.

### Booking flow

1. Renter sends `POST /api/bookings`.
2. Backend checks whether the renter is booking for themselves.
3. It loads the machine from MongoDB.
4. It calculates the total cost based on hours and hourly price.
5. It stores a booking with default status and payment flags.

### Payment flow

1. Renter sends `POST /api/bookings/{booking_id}/pay`.
2. Backend checks booking ownership.
3. It checks whether payment type is `INITIAL` or `FINAL`.
4. It calculates the expected amount.
5. It updates payment status.
6. It inserts an owner notification.

## 5. File-By-File Detailed Explanation

---

## `backend/auth.py`

This file handles:

- signup
- login
- password hashing
- token creation and checking
- identifying the currently logged-in user
- role-based access control

### Line-by-line explanation

- Lines 1-8: A module docstring. This is a descriptive comment at the top of the file. It explains that the file manages authentication and lists the major features added in this version.
- Line 10: Imports Python's `base64` module. This is used to convert binary data into a URL-safe string format for tokens.
- Line 11: Imports `hashlib`. This module provides hashing algorithms such as SHA-256 and PBKDF2.
- Line 12: Imports `hmac`. This is used to sign tokens securely and compare signatures safely.
- Line 13: Imports `json`. This is used to turn Python dictionaries into JSON strings and back.
- Line 14: Imports `os`. This lets the code read environment variables like `APP_SECRET`.
- Line 15: Imports `secrets`. This is used to generate secure random values, such as password salts.
- Line 16: Imports `time`. This is used for token expiration timestamps.
- Line 18: Imports `ObjectId` from `bson`. MongoDB uses ObjectIds as document IDs.
- Line 19: Imports FastAPI tools:
  - `APIRouter` lets this file define routes that can later be attached to the main app.
  - `Depends` lets FastAPI inject dependencies automatically.
  - `HTTPException` is used to return proper API errors.
- Line 20: Imports bearer-token security classes from FastAPI. This is how the app reads the `Authorization: Bearer ...` header.
- Line 22: Imports `get_db` from `database.py`, so this file can talk to MongoDB.
- Line 23: Imports `UserAuth`, `UserCreate`, and `serialize_doc` from `models.py`.
- Line 25: Creates a router for auth endpoints. Every route in this file will start with `/api/auth`.
- Line 26: Creates a bearer-token security object. FastAPI will use this to extract the access token from requests.
- Line 28: Sets token lifetime to 7 days. The math is seconds per hour times hours per day times 7 days.
- Line 29: Reads `APP_SECRET` from environment variables. If missing, it falls back to `"change-this-in-production"`, which is okay for local testing but not safe for production.
- Line 30: Reads the admin email from environment variables.
- Line 31: Reads the admin password from environment variables.
- Line 34: Defines `_b64url_encode`, a helper that converts bytes into a URL-safe base64 string.
- Line 35: Performs the actual encoding and strips trailing `=` padding to make the token shorter and URL-safe.
- Line 38: Defines `_b64url_decode`, the reverse helper for turning the string back into bytes.
- Line 39: Reconstructs missing base64 padding. Base64 decoding often requires the string length to be divisible by 4.
- Line 40: Decodes the URL-safe base64 string back into bytes.
- Line 43: Defines `_sign`, a helper that creates a signature for a given string.
- Line 44: Uses HMAC-SHA256 with `TOKEN_SECRET` to create a hexadecimal signature. This prevents token tampering.
- Line 47: Defines `hash_password`, which turns a plain password into a safer stored value.
- Line 48: Creates a random salt. A salt is extra random data added before hashing so identical passwords do not produce identical results.
- Line 49: Uses `hashlib.pbkdf2_hmac` to derive a secure digest from the password and salt. `100_000` rounds intentionally make brute-force attacks slower.
- Line 50: Returns the stored format as `salt$digest`.
- Line 53: Defines `verify_password`, which checks whether a user-entered password matches the stored password hash.
- Lines 54-57: Try to split the stored hash into salt and digest. If the format is wrong, return `False`.
- Lines 59-64: Recompute the digest from the incoming password using the same salt and algorithm.
- Line 65: Uses `hmac.compare_digest` for a safe equality check that avoids timing attack issues.
- Line 68: Defines `create_token`, which builds the app's custom bearer token.
- Lines 69-73: Creates a payload dictionary containing user id, role, and expiration time.
- Line 74: Converts the payload to compact JSON, then encodes it using the helper above.
- Line 75: Returns the final token in the format `encoded_payload.signature`.
- Line 78: Defines `decode_token`, which checks a token and returns its payload.
- Lines 79-82: Split the token into payload and signature, raising `401` if the format is invalid.
- Lines 84-85: Recalculate the signature and reject the token if it does not match.
- Lines 87-90: Decode the payload, check expiry time, and return the payload.
- Line 93: Defines `serialize_user`, a safer version of `serialize_doc`.
- Lines 94-97: Copy the user document, remove password fields, and convert MongoDB `_id` into string `id`.
- Line 100: Defines `_admin_user`, which returns a synthetic admin user object.
- Lines 101-107: Return a dictionary representing the admin account. This account can come from environment variables instead of MongoDB.
- Line 110: Defines `get_current_user`, an async dependency used in protected routes.
- Lines 111-113: Decode the token and pull out role and user id.
- Lines 115-118: Handle the special admin token case.
- Lines 120-121: Validate that normal user ids are valid MongoDB ObjectIds.
- Lines 123-126: Load the user from MongoDB and reject tokens for missing users.
- Lines 128-130: Serialize the user and ensure the role in the token still matches the role in the database.
- Line 131: Return the current user.
- Line 134: Defines `require_roles`, which returns a dependency function for role checking.
- Line 135: Convert allowed roles into a set.
- Lines 137-140: Define the dependency that checks the current user's role and raises `403` when not allowed.
- Line 142: Return that dependency function.
- Line 145: Declares an HTTP `POST /api/auth/signup` route.
- Line 146: Defines the async `signup` handler. `user: UserCreate` means FastAPI validates the request body against the `UserCreate` model.
- Lines 147-151: Get the database, check for an existing email, and reject duplicates.
- Lines 153-154: Block self-signup as `ADMIN`.
- Lines 156-159: Convert the Pydantic model to a dict, remove the raw password, hash it, and set approval status.
- Lines 161-164: Insert the new user, load it back, sanitize it, and return token plus user data.
- Lines 165-169: Print unexpected errors and convert them to a `503` unless they were already valid `HTTPException`s.
- Line 172: Declares an HTTP `POST /api/auth/login` route.
- Line 173: Defines the login handler using `UserAuth`.
- Lines 174-176: Handle the special admin login path.
- Lines 178-182: Load the user by email and reject missing users.
- Lines 184-185: Read the stored password hash and verify the incoming password.
- Lines 187-195: Support legacy users that still have plain-text passwords by migrating them to hashed passwords on successful login.
- Lines 197-201: Reject wrong passwords or return token plus safe user data.
- Lines 202-206: Handle and normalize unexpected errors.

### `auth.py` in one sentence

This file is the security gatekeeper of the backend: it creates accounts, verifies passwords, issues tokens, and makes sure protected routes know who the user is.

---

## `backend/database.py`

This file handles MongoDB setup.

It is responsible for:

- loading environment variables
- creating the MongoDB client
- selecting the database
- returning the database object to the rest of the app
- creating collections and indexes on startup

### Line-by-line explanation

- Lines 1-11: Module docstring describing the file's job.
- Line 14: Imports the asynchronous MongoDB driver `motor.motor_asyncio`. This is how the app talks to MongoDB without blocking the server.
- Line 17: Imports `os` for environment variables.
- Line 18: Imports `Path` from `pathlib` for safer path handling.
- Line 21: Imports `certifi`. In this file it exists to support trusted TLS certificate handling, although the current code does not actively pass `certifi.where()` into the client.
- Line 24: Imports Python's `ssl` module for TLS-related behavior.
- Line 27: Imports `load_dotenv` from `python-dotenv`.
- Lines 29-33: Warn that the SSL override is relaxed and is useful mainly for local testing.
- Line 34: Replaces Python's default HTTPS context with an unverified one. This weakens certificate checking and should be treated carefully in production.
- Line 37: Computes the absolute path of the backend directory.
- Line 38: Computes the project root directory by moving one level above the backend folder.
- Line 39: Loads environment variables from the root `.env.local` file if present.
- Line 40: Loads environment variables from `backend/.env` if present.
- Line 44: Reads `MONGO_URL` from the environment. If missing, it falls back to a default MongoDB URI.
- Line 45: Reads optional `MONGO_DB_NAME`, which can force the backend to use a specific database name.
- Lines 47-55: Create the asynchronous MongoDB client with relaxed TLS checking and 10 second timeouts.
- Lines 57-62: Select which database to use:
  - use `MONGO_DB_NAME` if set
  - otherwise use the database name inside the Mongo URI
  - otherwise fall back to `machinery_db`
- Lines 64-66: Define `get_db()` and return the shared database object.
- Lines 68-82: Define `init_db()` which creates required collections if missing and creates a unique index on `users.email`.

### `database.py` in one sentence

This file is the backend's bridge to MongoDB: it opens the connection, picks the database, and prepares the collections the app needs.

---

## `backend/main.py`

This is the main application file.

It is responsible for:

- creating the FastAPI app
- attaching middleware
- importing auth routes
- defining the main business routes
- calculating booking and payment values
- serving the frontend build when present

### Line-by-line explanation

- Lines 1-3: Module docstring describing the file.
- Line 5: Imports `math`, used for rounding booking hours and payment amounts upward.
- Line 6: Imports `os`, mainly for file-path operations near the end of the file.
- Line 7: Imports `sys`, used to modify Python's import path.
- Line 8: Imports `datetime`, used for booking times, cancellations, notifications, and completion timestamps.
- Line 10: Imports MongoDB's `ObjectId`.
- Line 11: Imports core FastAPI tools:
  - `Depends` for dependency injection
  - `FastAPI` for the app itself
  - `HTTPException` for API errors
- Line 12: Imports `CORSMiddleware`, which controls cross-origin browser access.
- Line 13: Imports `FileResponse`, used to send static files back to the browser.
- Line 14: Imports `StaticFiles`, used to mount the frontend asset directory.
- Line 16: Adds the backend directory to `sys.path` so local imports like `import auth` work reliably.
- Lines 18-20: Import the auth module, database helpers, request models, and document serializer.
- Line 22: Creates the FastAPI application object.
- Lines 24-30: Add CORS middleware and allow any origin, any method, and any header.
- Line 32: Attach all routes from `auth.router` to the app.
- Lines 35-41: Define the startup event that calls `init_db()` and logs success or warning messages.
- Lines 44-47: Define `to_object_id()` which validates a string id and converts it into a MongoDB `ObjectId`.
- Lines 50-54: Define `parse_datetime_value()` which parses ISO date strings and returns a `400` error for invalid dates.
- Lines 57-63: Define `compute_booking_hours()` which validates the start/end order, computes the hour difference, rounds up, and enforces a minimum of 1 hour.
- Lines 66-67: Define `initial_payment_amount()` as half the total rounded up.
- Lines 70-71: Define `final_payment_amount()` as the remaining balance plus any extra cost.
- Lines 74-78: Define `ensure_same_user()` so normal users can only access their own data while admins can bypass that check.

#### Admin routes

- Lines 81-85: `GET /api/admin/pending-owners` loads up to 100 owner users whose `is_approved` field is `0`.
- Lines 88-92: `PATCH /api/admin/approve-owner/{owner_id}` sets `is_approved` to `1` and returns whether a record changed.

#### Machine routes

- Lines 95-104: `GET /api/machines` reads optional `category` and `location` query filters, builds a MongoDB query, and returns serialized machines.
- Lines 107-118: `POST /api/machines` allows only approved owners to add a machine, validates ownership and price, inserts the machine, and returns its id.
- Lines 121-126: `GET /api/machines/owner/{owner_id}` returns one owner's machines after checking permissions.

#### Booking routes

- Lines 129-149: `POST /api/bookings` allows renters to create a booking, loads the machine, calculates hours and total cost, initializes payment/status fields, stores the booking, and returns the booking id plus total cost.
- Lines 152-166: `GET /api/bookings/owner/{owner_id}` loads the owner's machines, finds all bookings for those machines, enriches each booking with machine and renter names, and returns the list.
- Lines 169-182: `GET /api/bookings/renter/{renter_id}` loads the renter's bookings and enriches each booking with machine details.

#### Payment route

- Lines 185-234: `POST /api/bookings/{booking_id}/pay` loads the booking, machine, and renter, validates ownership, checks whether the payment is `INITIAL` or `FINAL`, validates the exact amount, updates the payment field, inserts an owner notification, and returns success.

#### Booking cancellation and completion

- Lines 237-267: `POST /api/bookings/{booking_id}/cancel` allows renters to cancel `PENDING` or `CONFIRMED` bookings if the start time is at least 8 hours away, updates the booking status, and notifies the owner.
- Lines 270-300: `PATCH /api/bookings/{booking_id}` allows owners to change booking status, and when a booking is marked `COMPLETED`, it calculates extra late-return cost based on actual end time.

#### Notifications and reviews

- Lines 303-315: `GET /api/notifications/{user_id}` returns up to 20 notifications for the user, newest first, converting `_id` and `created_at` into JSON-friendly values.
- Lines 318-326: `POST /api/notifications/read/{notif_id}` marks a notification as read after checking ownership.
- Lines 329-337: `POST /api/reviews` lets renters submit a review for their own booking.

#### Frontend static serving

- Line 340: Build the path to the frontend `dist` folder.
- Lines 342-343: If the build folder exists, mount `/assets` so static frontend files can be served.
- Lines 345-353: Add a catch-all route that serves frontend files directly or falls back to `index.html` for client-side routing.

### `main.py` in one sentence

This file is the control center of the backend: it starts the FastAPI app and defines the main business behavior for admins, owners, renters, bookings, payments, notifications, reviews, and frontend serving.

---

## `backend/models.py`

This file defines request and data models using Pydantic.

Pydantic models are important because they:

- validate incoming JSON
- convert data into Python objects
- reject wrong or missing fields automatically

### Line-by-line explanation

- Lines 1-3: Module docstring describing the file.
- Line 5: Imports `Optional` from Python typing. This is used for fields that may be missing or `None`.
- Line 7: Imports `BaseModel` and `EmailStr` from Pydantic.
- Lines 10-12: Define `UserAuth` with required `email` and `password`.
- Lines 15-19: Define `UserCreate`, which inherits from `UserAuth` and adds `name`, `role`, `id_proof`, and `shop_credentials`.
- Lines 22-29: Define `MachineCreate` with all fields needed to create a machine listing.
- Lines 32-37: Define `BookingCreate` with booking ids and dates. `total_cost` is optional because the server recalculates it anyway.
- Lines 40-42: Define `PaymentSchema` with `type` and `amount`.
- Lines 45-47: Define `BookingUpdate` with `status` and optional `actual_end_date`.
- Lines 50-53: Define `ReviewCreate` with booking id, rating, and optional comment.
- Lines 56-60: Define `serialize_doc()` which converts MongoDB `_id` to string `id` and returns the document.

### `models.py` in one sentence

This file tells FastAPI what valid incoming data should look like and provides a helper to make MongoDB documents easier for the frontend to use.

---

## `backend/db_check.py`

This is a small utility script, not part of the main API.

Its purpose is to inspect the connected MongoDB cluster and print:

- database names
- collection names
- document counts

### Line-by-line explanation

- Line 1: Imports `asyncio`, which is Python's standard async runtime helper.
- Line 2: Imports `AsyncIOMotorClient`, the async MongoDB client.
- Line 4: Defines the async `main()` function.
- Line 5: Creates a MongoDB client using a hardcoded Atlas URI and relaxed TLS checking.
- Line 6: Asks MongoDB for all database names in the cluster.
- Line 7: Prints the list of database names.
- Lines 8-15: Loop through each database, skip special system databases, print the collections in each one, and print the document count for each collection.
- Line 17: Runs the async `main()` function.

### `db_check.py` in one sentence

This file is a debugging flashlight that lets you see what databases and collections actually exist in your MongoDB cluster.

---

## `backend/requirements.txt`

This file lists Python packages the backend depends on.

### Line-by-line explanation

- Line 1: `fastapi` is the web framework used to define API routes and handle requests/responses.
- Line 2: `uvicorn` is the ASGI server that actually runs the FastAPI app.
- Line 3: `pydantic` is used for data validation and request models.
- Line 4: `motor[srv]` is the async MongoDB driver with SRV/DNS support for MongoDB Atlas connection strings.
- Line 5: `python-dotenv` loads environment variables from `.env` files.
- Line 6: `certifi` provides trusted CA certificates for TLS.
- Line 7: `dnspython` helps resolve DNS records that Atlas SRV connection strings use.
- Line 8: `email-validator` supports email validation used by `EmailStr`.

### `requirements.txt` in one sentence

This file tells Python which libraries must be installed for the backend to run.

---

## `backend/.env.example`

This is a template file, not a real secret file.

It shows which environment variables the backend expects.

### Line-by-line explanation

- Line 1: Comment introducing the file.
- Line 2: Blank comment separator line.
- Line 3: Comment saying this is for beginners.
- Line 4: Comment telling you to create a real `.env` file in the `backend/` folder.
- Line 5: Comment explaining that the backend reads those values at startup.
- Line 7: Example `MONGO_URL` value. This should be replaced with the real MongoDB connection string.
- Line 8: Example `APP_SECRET`. This should be replaced with a long, random secret used for signing tokens.
- Line 9: Example `ADMIN_EMAIL`.
- Line 10: Example `ADMIN_PASSWORD`.

### `.env.example` in one sentence

This file is a sample configuration template showing which secret values the backend needs.

---

## 6. How All The Backend Files Work Together

Here is the full chain when the system runs:

1. `uvicorn` starts the FastAPI app from `main.py`.
2. `main.py` imports `auth.py`, `database.py`, and `models.py`.
3. `database.py` loads environment variables and creates the MongoDB connection.
4. `main.py` runs `init_db()` during startup.
5. When a request arrives, FastAPI matches it to the correct route.
6. If the route has a request body, FastAPI validates it using a Pydantic model from `models.py`.
7. If the route is protected, FastAPI runs dependencies from `auth.py` to identify the user and enforce roles.
8. The route logic in `main.py` or `auth.py` reads or writes MongoDB through `get_db()`.
9. The route returns JSON back to the frontend.

## 7. Collections Used In MongoDB

The backend expects these collections:

- `users`: stores renter and owner accounts
- `machines`: stores machine listings
- `bookings`: stores rental bookings
- `notifications`: stores owner notifications such as payments and cancellations
- `reviews`: stores renter reviews

## 8. Important Beginner Concepts In This Backend

### What is FastAPI?

FastAPI is a Python web framework that makes it easy to create APIs. A route like:

```python
@app.get("/api/machines")
```

means:

- when the browser or frontend sends a `GET` request to `/api/machines`
- run the Python function below it

### What is a route?

A route is a URL path plus an HTTP method.

Examples:

- `GET /api/machines`
- `POST /api/auth/signup`
- `PATCH /api/bookings/{booking_id}`

### What is MongoDB?

MongoDB is a NoSQL document database.

Instead of tables and rows like SQL, it stores:

- databases
- collections
- documents

### What is a Pydantic model?

A Pydantic model is a Python class used to validate incoming data.

If the frontend sends bad JSON, Pydantic catches it before your route logic runs.

### What is a bearer token?

A bearer token is a string sent in the `Authorization` header to prove who the user is.

In this backend:

- user logs in
- backend returns token
- frontend stores token
- frontend sends token on later API calls
- backend decodes token and identifies the user

### What is password hashing?

Hashing means you do not store the real password directly.

Instead:

- user enters password
- backend transforms it into a secure hash
- database stores the hash
- later backend hashes the entered password again and compares

## 9. Final Summary

If you only remember one thing about each file, remember this:

- `auth.py`: who the user is and whether they are allowed in
- `database.py`: how the app connects to MongoDB
- `main.py`: what the app actually does
- `models.py`: what valid request data should look like
- `db_check.py`: debugging tool for checking MongoDB contents
- `requirements.txt`: dependency list
- `.env.example`: config template

If you want to go even deeper after reading this document, the best next step is:

1. Open `models.py` first because it is the smallest.
2. Then read `database.py`.
3. Then read `auth.py`.
4. Read `main.py` last because it uses ideas from all the others.
