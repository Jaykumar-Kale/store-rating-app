# Store Rating Platform

A full stack web application where users can discover stores and submit ratings from 1 to 5. The platform has separate capabilities for system administrators, normal users, and store owners.

## Features

### System administrator

- View counts for users, stores, and submitted ratings.
- Create system administrator, normal user, and store owner accounts.
- Create stores and optionally assign a store owner.
- Search and filter stores by name, email, and address.
- Search and filter users by name, email, address, and role.
- Sort store and user listings by supported fields.
- View store ratings and store owner ratings.

### Normal user

- Register and sign in.
- Browse stores and search by store name or address.
- See each store's overall rating and their own submitted rating.
- Submit a rating or update their existing rating.
- Change their password.

### Store owner

- View the average rating for their assigned store.
- View users who submitted ratings for that store.
- Change their password.

## Technology

- Frontend: React and Vite
- Backend: Node.js and Express
- Database: PostgreSQL
- Authentication: JSON Web Tokens
- Password hashing: bcrypt

## Requirements

Install Node.js, npm, and PostgreSQL before starting.

## Run locally

### 1. Clone the repository

```bash
git clone https://github.com/Jaykumar-Kale/store-rating-app.git
cd store-rating-app
```

### 2. Create the database

Create a PostgreSQL database named `store_rating_app`, then run the schema once:

```bash
createdb store_rating_app
psql -d store_rating_app -f backend/db/schema.sql
```

If you already created the database and tables, do not run the schema again.

### 3. Configure the backend

Copy the example environment file:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your PostgreSQL connection details. Set `JWT_SECRET` to a long random value.

### 4. Install dependencies

In one terminal:

```bash
cd store-rating-app/backend
npm install
```

Open a second terminal for the frontend:

```bash
cd store-rating-app/frontend
npm install
```

### 5. Start the application

In the backend terminal:

```bash
cd store-rating-app/backend
npm run dev
```

In the frontend terminal:

```bash
cd store-rating-app/frontend
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Create the first administrator

Run this once for a new database. In the backend terminal, set the administrator details for this command only, then run the seed script:

```bash
cd store-rating-app/backend
export ADMIN_NAME="System Administrator Account"
export ADMIN_EMAIL="admin@example.com"
export ADMIN_ADDRESS="Your address"
read -s "ADMIN_PASSWORD?Enter an admin password: "
echo
export ADMIN_PASSWORD
npm run seed-admin
unset ADMIN_NAME ADMIN_EMAIL ADMIN_ADDRESS ADMIN_PASSWORD
```

Use a password with 8–16 characters, including an uppercase letter and a special character. Do not commit passwords or other secrets.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register a normal user |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Get the signed-in user's account |
| `PUT` | `/api/auth/password` | Change password |
| `GET` | `/api/admin/dashboard` | Get platform totals |
| `POST` | `/api/admin/users` | Create a user |
| `POST` | `/api/admin/stores` | Create a store |
| `GET` | `/api/admin/users` | List, filter, and sort users |
| `GET` | `/api/admin/stores` | List, filter, and sort stores |
| `GET` | `/api/stores` | List and search stores as a normal user |
| `PUT` | `/api/stores/:storeId/rating` | Submit or update a rating |
| `GET` | `/api/owner/dashboard` | View the store owner's ratings dashboard |
| `GET` | `/api/health` | Check that the backend is running |
| `GET` | `/api/db-health` | Check the backend database connection |

Protected endpoints require a bearer token returned by the login endpoint.

## Validation rules

- Name: 20–60 characters
- Address: up to 400 characters
- Password: 8–16 characters, with at least one uppercase letter and one special character
- Rating: whole number from 1 to 5
- Email: valid email address

## Database design

The database has three main tables:

- `users`: account details, password hash, and role
- `stores`: store details and optional store owner
- `ratings`: one rating per user per store, constrained to values from 1 to 5

Passwords are stored as bcrypt hashes, never as plain text.

## Environment variables

See `backend/.env.example` for the backend configuration names. Keep real `.env` files and secrets private; do not commit them to Git.
