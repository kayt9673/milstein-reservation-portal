# Milstein Reservation Portal

Centralized site to schedule meetings with program staff, reserve studio space, and rent tech equipment.

## Tech Equipment

Tech equipment reservations now use Firebase Auth plus a small backend API.

## Local Setup

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

The frontend reads `VITE_BACKEND_URL` from `frontend/.env`; locally it should point at `http://localhost:8787`.

The backend verifies Firebase Google sign-in tokens with Firebase Admin. For local development, create a Firebase service account key in Firebase Console, then set `GOOGLE_APPLICATION_CREDENTIALS` in `backend/.env` to that JSON file path. Keep `backend/.env` out of git.
