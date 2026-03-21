# ConRen - Construction Equipment Rental Marketplace

🚀 **Live Demo:** [https://mini-projecttt.vercel.app](https://mini-projecttt.vercel.app)

ConRen is a production-ready marketplace designed to bridge the gap between Construction Equipment Owners and Site Engineers. 

## Key Features

* **Role-Based Access Control:** Dedicated dashboards for Renters, Machine Owners, and Administrators.
* **Streamlined Rentals:** Renters (Site Engineers) can easily browse, search, and rent construction equipment.
* **Fleet Management:** Machine Owners can list their equipment, manage availability, and track rentals.
* **Admin Approval Workflow:** New Machine Owners require Administrator approval before machines can be publicly listed to ensure quality and trust on the platform.
* **Authentication:** Secure user registration and login built in.

## Tech Stack

* **Frontend:** React, TypeScript, Tailwind CSS, Vite
* **Backend:** Python, FastAPI
* **Database:** MongoDB
* **Deployment:** Vercel

## Running Locally

To run the project locally, you will need to start both the backend and frontend servers.

### 1. Backend Setup
Make sure you have Python installed.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
pip install -r requirements.txt
```

Set up your `.env` file in the `backend` directory with your MongoDB connection string (see `.env.example`).

Run the backend server:
```bash
fastapi dev main.py
```

### 2. Frontend Setup
Make sure you have Node.js installed.

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173` (or the port specified by Vite), and the backend API runs at `http://localhost:8000`.

## Contributing
Feel free to open issues and pull requests to improve the project.
