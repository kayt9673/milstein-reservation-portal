import "dotenv/config";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.PORT || 8787);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const GOOGLE_WORKSPACE_DOMAIN = process.env.GOOGLE_WORKSPACE_DOMAIN || "cornell.edu";
const RESERVATION_START_MINUTES = 14 * 60;
const RESERVATION_END_MINUTES = 16 * 60;
const INTERVAL_MINUTES = 15;

interface AuthenticatedUser {
  uid: string;
  email: string;
  name: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

interface ReservationInput {
  unitId?: string;
  itemName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

interface ReservationRecord {
  id: string;
  unitId: string;
  itemName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "reserved" | "cancelled";
  userId: string;
  studentName: string;
  studentEmail: string;
  notes: string;
  createdAt?: FirebaseFirestore.Timestamp;
  cancelledAt?: FirebaseFirestore.Timestamp;
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return;
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json";

  const serviceAccount = JSON.parse(
    readFileSync(serviceAccountPath, "utf8")
  );

  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

initializeFirebaseAdmin();

const db = getFirestore();
const app = express();

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

function jsonError(response: Response, status: number, error: string) {
  return response.status(status).json({ ok: false, error });
}

async function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const header = request.header("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    jsonError(response, 401, "Please sign in with Google first.");
    return;
  }

  try {
    const token = await getAuth().verifyIdToken(match[1]);
    const email = token.email || "";

    if (!email) {
      jsonError(response, 403, "Your Google account does not include an email address.");
      return;
    }

    if (!email.toLowerCase().endsWith(`@${GOOGLE_WORKSPACE_DOMAIN}`)) {
      jsonError(response, 403, `Please sign in with your ${GOOGLE_WORKSPACE_DOMAIN} account.`);
      return;
    }

    request.user = {
      uid: token.uid,
      email,
      name: token.name || email,
    };
    next();
  } catch (error) {
    console.error("Auth error:", error);
    jsonError(response, 401, "Invalid or expired token.");
  }
}

function normalizeReservation(input: ReservationInput) {
  return {
    unitId: String(input.unitId || "").trim(),
    itemName: String(input.itemName || "").trim(),
    date: String(input.date || "").trim(),
    startTime: String(input.startTime || "").trim(),
    endTime: String(input.endTime || "").trim(),
    notes: String(input.notes || "").trim(),
  };
}

function validateReservation(reservation: ReturnType<typeof normalizeReservation>) {
  if (!reservation.unitId) return "Missing equipment unit.";
  if (!reservation.itemName) return "Missing equipment name.";
  if (!reservation.date) return "Missing reservation date.";

  const day = new Date(`${reservation.date}T12:00:00`).getDay();
  if (day !== 3 && day !== 4) return "Reservations are only available on Wednesdays and Thursdays.";

  const start = timeToMinutes(reservation.startTime);
  const end = timeToMinutes(reservation.endTime);

  if (start === null || end === null) return "Invalid reservation time.";
  if (start < RESERVATION_START_MINUTES || end > RESERVATION_END_MINUTES) {
    return "Reservation must be between 2:00 PM and 4:00 PM ET.";
  }
  if (start % INTERVAL_MINUTES !== 0 || end % INTERVAL_MINUTES !== 0) {
    return "Times must use 15-minute intervals.";
  }
  if (end <= start) return "End time must be after start time.";

  return "";
}

function timeToMinutes(timeLabel: string) {
  const match = String(timeLabel).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)(?:\s*ET)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function hasTimeOverlap(
  reservation: Pick<ReservationRecord, "startTime" | "endTime">,
  startTime: string,
  endTime: string,
) {
  const existingStart = timeToMinutes(reservation.startTime);
  const existingEnd = timeToMinutes(reservation.endTime);
  const nextStart = timeToMinutes(startTime);
  const nextEnd = timeToMinutes(endTime);

  if (existingStart === null || existingEnd === null || nextStart === null || nextEnd === null) {
    return false;
  }

  return nextStart < existingEnd && nextEnd > existingStart;
}

async function readInventory() {
  const currentFile = fileURLToPath(import.meta.url);
  const backendRoot = path.resolve(path.dirname(currentFile), "..", "..");
  const inventoryPath = path.resolve(backendRoot, "..", "frontend", "src", "data", "equipment-inventory.json");
  const file = await readFile(inventoryPath, "utf8");

  return JSON.parse(file);
}

function serializeReservation(
  snapshot: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
) {
  const data = snapshot.data() as Omit<ReservationRecord, "id"> | undefined;

  if (!data) {
    return null;
  }

  return {
    id: snapshot.id,
    ...data,
  };
}

async function getActiveReservationsForUnit(unitId: string, date: string) {
  const snapshot = await db
    .collection("reservations")
    .where("unitId", "==", unitId)
    .where("date", "==", date)
    .where("status", "==", "reserved")
    .get();

  return snapshot.docs
    .map((doc) => serializeReservation(doc))
    .filter((reservation): reservation is ReservationRecord => Boolean(reservation));
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/inventory", async (_request, response, next) => {
  try {
    response.json({ ok: true, equipment: await readInventory() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/reservations", async (request, response, next) => {
  try {
    const { date, startTime, endTime } = request.query;
    let query: FirebaseFirestore.Query = db.collection("reservations").where("status", "==", "reserved");

    if (typeof date === "string" && date) {
      query = query.where("date", "==", date);
    }

    const snapshot = await query.get();
    const reservations = snapshot.docs
      .map((doc) => serializeReservation(doc))
      .filter((reservation): reservation is ReservationRecord => Boolean(reservation))
      .filter((reservation) => {
        if (typeof startTime !== "string" || typeof endTime !== "string") {
          return true;
        }

        return hasTimeOverlap(reservation, startTime, endTime);
      })
      .map(({ studentEmail, studentName, userId, notes, ...reservation }) => reservation);

    response.json({ ok: true, reservations });
  } catch (error) {
    next(error);
  }
});

app.get("/api/me/reservations", requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const snapshot = await db
      .collection("reservations")
      .where("userId", "==", request.user?.uid)
      .orderBy("date", "desc")
      .get();

    response.json({
      ok: true,
      reservations: snapshot.docs.map((doc) => serializeReservation(doc)).filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/reservations", requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const reservation = normalizeReservation(request.body);
    const validationError = validateReservation(reservation);

    if (validationError) {
      jsonError(response, 400, validationError);
      return;
    }

    const existingReservations = await getActiveReservationsForUnit(reservation.unitId, reservation.date);
    const hasConflict = existingReservations.some((existingReservation) =>
      hasTimeOverlap(existingReservation, reservation.startTime, reservation.endTime),
    );

    if (hasConflict) {
      jsonError(response, 409, "That item is already reserved during that time.");
      return;
    }

    const doc = await db.collection("reservations").add({
      ...reservation,
      status: "reserved",
      userId: request.user?.uid,
      studentName: request.user?.name,
      studentEmail: request.user?.email,
      createdAt: FieldValue.serverTimestamp(),
    });
    const saved = await doc.get();

    response.status(201).json({ ok: true, reservation: serializeReservation(saved) });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/reservations/:reservationId/cancel", requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const doc = db.collection("reservations").doc(String(request.params.reservationId));
    const snapshot = await doc.get();
    const reservation = serializeReservation(snapshot);

    if (!reservation) {
      jsonError(response, 404, "Reservation was not found.");
      return;
    }

    if (reservation.userId !== request.user?.uid) {
      jsonError(response, 403, "You can only cancel your own reservations.");
      return;
    }

    await doc.update({
      status: "cancelled",
      cancelledAt: FieldValue.serverTimestamp(),
    });

    const updated = await doc.get();
    response.json({ ok: true, reservation: serializeReservation(updated) });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error("Backend error:", error);

  const message =
    error instanceof Error ? error.message : "Something went wrong.";

  jsonError(response, 500, message);
});

app.listen(PORT, () => {
  console.log(`Reservation backend listening on http://localhost:${PORT}`);
});
