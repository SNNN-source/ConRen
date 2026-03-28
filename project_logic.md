# Project Logic Explained (For Beginners)

Welcome! If you are completely new to web development, this guide will explain exactly how the **ConRen** (Construction Rental) platform works from a high-level perspective. 

Imagine a restaurant. A web application works exactly like one:
- **The Frontend (React)** is the menu and the dining area. It's what the customer sees and interacts with.
- **The Backend (FastAPI)** is the kitchen. It receives orders, prepares the food (data), makes sure rules are followed, and sends the meal out.
- **The Database (MongoDB)** is the pantry. It permanently stores all the ingredients (data like user accounts, machines, and bookings).

---

## 1. The Core Idea
ConRen is a platform that connects two types of people:
1. **Owners**: People who own construction equipment (like excavators or cranes) and want to rent them out to make money.
2. **Renters**: People or companies who need to rent this equipment for a specific period of time.
3. **Admin**: The boss of the platform who makes sure everything runs smoothly and approves new owners.

---

## 2. How the Three Pieces Talk to Each Other

When a user clicks a button on the website, here is the journey that happens in milliseconds:

1. **Frontend (The Face):** The user clicks "Rent Machine". The React frontend packages this request into a message called an **API Request**.
2. **Backend (The Brain):** The Python (FastAPI) backend receives the message. It checks a few things:
   - *Is this person actually logged in?* (Authentication)
   - *Are they allowed to rent this?* 
   - *How many hours are they renting it for, and what is the total cost?*
3. **Database (The Memory):** If everything is correct, the backend talks to MongoDB and says, *"Save this new booking into the database,"* or *"Give me the details of this machine."*
4. **Sending it Back:** The backend sends a success message back to the frontend. The frontend updates the screen to show the user a "Booking Confirmed" popup.

---

## 3. The Main User Stories (How everything works in practice)

Here is the exact step-by-step logic of how a transaction happens on the platform.

### Step A: Joining the Platform
- **Signup**: A user signs up. If they sign up as a **Renter**, they can log in immediately. If they sign up as an **Owner**, their account is placed in a "pending" state.
- **Admin Approval**: The Admin logs in, sees the pending Owner, and clicks "Approve." Now the Owner can log in.
- *Logic Behind It:* The backend safely encrypts (hashes) your password so even the database doesn't know what it is. It gives the user a digital "ticket" (a JWT Token) that they show to the backend every time they do something, proving who they are.

### Step B: Adding a Machine
- The **Owner** goes to their dashboard and fills out a form for a new Tractor. They set the `price_per_hour`.
- The frontend sends this to the backend. The backend securely saves this new tractor into the [machines](file:///d:/vs%20code%20workspace/Mini%20Project/mini%20projecttt/mini%20projecttt/backend/main.py#95-105) collection in the MongoDB database.

### Step C: Making a Booking
- The **Renter** browses the site and finds the Tractor. They choose a start date and an end date.
- *The Math:* The backend ([main.py](file:///d:/vs%20code%20workspace/Mini%20Project/mini%20projecttt/mini%20projecttt/backend/main.py)) looks at the exact hours between the start and end date. If you book it for 2 hours, and it costs Rs 500/hour, the backend calculates the `total_cost` as Rs 1000. It marks the booking as **PENDING**.

### Step D: The Payment Rules (Crucial Logic)
ConRen has a specific rule for payments: **You pay 50% upfront, and 50% after.**

1. **Initial Payment:** The Renter pays the first 50% (Rs 500). The backend moves the booking to **CONFIRMED** and sends a notification to the Owner.
2. **The Rental Period:** The Renter takes the machine and uses it.
3. **Returning the Machine:** Once finished, the Owner goes to their screen and clicks "Complete Booking".
   - *The Catch:* What if the Renter brought it back 3 hours late? The backend looks at the `actual_end_date`. If it's late, it automatically calculates an `extra_cost`.
4. **Final Payment:** The Renter pays the remaining 50% (Rs 500) **plus** any extra cost calculated for being late.

### Step E: Reviews
- After the booking is fully complete, the Renter can leave a 5-star rating. This gets saved in the database's `reviews` collection so future renters know the owner is trustworthy.

---

## Summary of the Code's Job

- **[models.py](file:///d:/vs%20code%20workspace/Mini%20Project/mini%20projecttt/mini%20projecttt/backend/models.py) (The Bouncer)**: It stands at the door and checks the format. "Did they provide an email? Is the price a real number?" If not, it rejects the request before it even gets processing.
- **[database.py](file:///d:/vs%20code%20workspace/Mini%20Project/mini%20projecttt/mini%20projecttt/backend/database.py) (The Librarian)**: Knows exactly where all the files (Mongo collections) are stored and how to fetch them safely.
- **[auth.py](file:///d:/vs%20code%20workspace/Mini%20Project/mini%20projecttt/mini%20projecttt/backend/auth.py) (Security)**: Gives out VIP wristbands (Tokens) to users who typed the right password.
- **[main.py](file:///d:/vs%20code%20workspace/Mini%20Project/mini%20projecttt/mini%20projecttt/backend/main.py) (The Manager)**: Does all the heavy lifting. Calculates prices, handles time-zone math, updates booking statuses, and directs traffic.
