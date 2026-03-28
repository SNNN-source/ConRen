# ConRen

ConRen is a beginner-friendly full-stack project for renting construction equipment.

The app connects three types of users:

- `RENTER`: a site engineer or customer who wants to rent a machine
- `OWNER`: a machine owner who wants to list equipment
- `ADMIN`: a reviewer who approves new owners before they can publicly operate on the platform

## What This Project Does

ConRen works like a small marketplace:

1. A renter signs up and browses available machines.
2. An owner signs up and waits for admin approval.
3. Once approved, the owner can list machines.
4. A renter creates a booking for a machine.
5. Payments and booking status updates are tracked.
6. Notifications inform owners about important events.

This is a good learning project because it includes:

- frontend and backend separation
- user authentication
- role-based logic
- database integration
- REST API design
- deployment configuration

## Project Structure

```text
mini projecttt/
├── backend/
│   ├── auth.py
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── index.css
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── .env.example
├── metadata.json
├── start.bat
├── vercel.json
└── README.md
```

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Motion
- Lucide React

### Backend

- FastAPI
- Python
- MongoDB
- Motor
- Pydantic

### Deployment

- Vercel

## How The Frontend Works

The frontend is mainly inside `frontend/src/App.tsx`.

That file currently contains:

- shared TypeScript interfaces
- the navigation bar
- login and signup screen
- renter dashboard
- owner dashboard
- admin dashboard
- booking and payment UI
- top-level screen switching

This keeps the project easy to read for beginners, although in a larger app it should eventually be split into smaller files.

## How The Backend Works

The backend is mainly inside `backend/main.py`.

That file contains routes for:

- admin approval
- machine creation and listing
- bookings
- payments
- notifications
- reviews

The backend also uses:

- `backend/auth.py` for login and signup
- `backend/database.py` for MongoDB setup
- `backend/models.py` for request validation models

## Beginner Walkthrough Of The Main Flow

### 1. User Signs Up

The frontend sends signup data to:

```text
/api/auth/signup
```

The backend validates the data and stores the user in MongoDB.

Approval rules:

- renters are approved immediately
- owners start with pending approval

### 2. User Logs In

The frontend sends login data to:

```text
/api/auth/login
```

If the email and password match a user record, the backend returns that user.

### 3. Owner Adds A Machine

An approved owner can submit machine details using:

```text
POST /api/machines
```

The backend stores the machine in the `machines` collection.

### 4. Renter Books A Machine

The renter chooses booking dates and submits:

```text
POST /api/bookings
```

The backend stores the booking with default values such as:

- `status = PENDING`
- `initial_paid = 0`
- `final_paid = 0`
- `extra_cost = 0`

### 5. Owner Reviews The Booking

The owner can approve, decline, or complete the booking.

### 6. Payments And Notifications

When the renter pays, the backend updates the booking and creates a notification for the owner.

## Database Collections

MongoDB stores data in collections. This project uses:

- `users`
- `machines`
- `bookings`
- `notifications`
- `reviews`

## Environment Variables

This project includes two example environment files.

### Root `.env.example`

This file came from the original frontend starter template.

It mentions `GEMINI_API_KEY` and `APP_URL`. The current ConRen flow does not actively depend on Gemini, so most beginners can ignore this file unless they plan to add AI features later.

### `backend/.env.example`

This is the important environment example for local backend setup.

Create:

```text
backend/.env
```

and place your real MongoDB connection string there.

## How To Run Locally

You need:

- Node.js
- Python
- a MongoDB connection string

### 1. Start The Backend

```bash
cd backend
python -m venv venv
```

Activate the virtual environment.

On Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

On Windows Command Prompt:

```cmd
venv\Scripts\activate
```

Install Python packages:

```bash
pip install -r requirements.txt
```

Create `backend/.env` and add your `MONGO_URL`.

Run the backend:

```bash
fastapi dev main.py
```

or:

```bash
uvicorn main:app --reload
```

The backend usually runs at:

```text
http://localhost:8000
```

### 2. Start The Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend usually runs at:

```text
http://localhost:5173
```

The Vite development server forwards `/api` requests to the backend automatically.

## One-Command Windows Start

This project also includes `start.bat`.

That script:

1. installs frontend packages
2. builds the frontend
3. activates the backend virtual environment
4. starts the backend server

## Files Explained For Beginners

- `backend/auth.py`: handles signup and login routes
- `backend/database.py`: creates the MongoDB connection and collections
- `backend/main.py`: contains the main API routes and frontend serving logic
- `backend/models.py`: defines request validation models
- `frontend/src/main.tsx`: mounts React into the browser page
- `frontend/src/App.tsx`: contains most of the frontend UI and state
- `frontend/src/index.css`: loads Tailwind and global styles
- `frontend/vite.config.ts`: configures Vite and the local API proxy
- `frontend/package.json`: lists frontend dependencies and scripts
- `frontend/tsconfig.json`: configures TypeScript behavior
- `vercel.json`: configures deployment on Vercel
- `metadata.json`: stores basic app metadata

## Important Learning Notes

This project is good for learning, but beginners should notice a few things:

1. Passwords are currently handled too simply for a production app.
2. Admin access is hardcoded for demo purposes.
3. Many backend routes trust frontend-supplied IDs.
4. `App.tsx` is very large and should eventually be split up.

## Suggested Next Improvements

1. Hash passwords before storing them.
2. Add JWT-based authentication.
3. Split `App.tsx` into smaller components.
4. Add better validation and error handling.
5. Add tests for important backend routes.
6. Move more business rules fully to the backend.

## Reading Order For A Complete Beginner

If you want to understand this project step by step, read the files in this order:

1. `README.md`
2. `frontend/src/main.tsx`
3. `frontend/src/App.tsx`
4. `backend/models.py`
5. `backend/auth.py`
6. `backend/database.py`
7. `backend/main.py`
