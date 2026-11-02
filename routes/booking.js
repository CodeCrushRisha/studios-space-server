import { Router } from "express";
import {
  cancelBookingDoc,
  findConflictingBooking,
  getBookingById,
  getBookingsForStudios,
  getBookingsForUser,
  insertBooking,
  removeBooking,
  toBooking,
} from "../models/Booking.js";
import { getStudioById, getStudioIdsByOwner } from "../models/Studio.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Same label format as the frontend's conflict message.
function formatRange(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const date = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const startTimeLabel = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTimeLabel = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date}, ${startTimeLabel} – ${endTimeLabel}`;
}

function conflictResponse(res, conflict) {
  return res.status(409).json({
    error: `This time slot is already reserved (${formatRange(
      conflict.startTime,
      conflict.endTime
    )}). Please choose different hours.`,
    conflict: {
      startTime: conflict.startTime,
      endTime: conflict.endTime,
      status: conflict.status,
    },
  });
}

// POST /api/bookings — create a booking with double-booking prevention
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const studioId =
      typeof body.studioId === "string" ? body.studioId.trim() : "";
    const startTime =
      typeof body.startTime === "string" ? body.startTime.trim() : "";
    const endTime = typeof body.endTime === "string" ? body.endTime.trim() : "";

    if (!studioId || !startTime || !endTime) {
      return res.status(400).json({
        error: "studioId, startTime, and endTime are required",
      });
    }

    if (
      Number.isNaN(Date.parse(startTime)) ||
      Number.isNaN(Date.parse(endTime))
    ) {
      return res.status(400).json({
        error: "startTime and endTime must be valid date-time strings",
      });
    }

    if (endTime <= startTime) {
      return res.status(400).json({ error: "endTime must be after startTime" });
    }

    const studio = await getStudioById(studioId);
    if (!studio) {
      return res.status(404).json({ error: "Studio not found" });
    }

    const conflict = await findConflictingBooking(studioId, startTime, endTime);
    if (conflict) return conflictResponse(res, conflict);

    const booking = await insertBooking({
      studioId,
      studioName: studio.name,
      userEmail: req.user.email,
      startTime,
      endTime,
      hourlyRate: studio.hourlyRate,
      status: "Pending",
    });

    // Race guard: re-check after inserting so two simultaneous requests for
    // the same slot cannot both succeed.
    const race = await findConflictingBooking(
      studioId,
      startTime,
      endTime,
      booking._id
    );
    if (race) {
      await removeBooking(String(booking._id));
      return conflictResponse(res, race);
    }

    res.status(201).json({ booking: toBooking(booking) });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings — the caller's bookings (customer view)
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const docs = await getBookingsForUser(req.user.email);
    res.json({ bookings: docs.map(toBooking) });
  } catch (err) {
    next(err);
  }
});

// GET /api/bookings/host — bookings made on studios the caller owns
router.get("/host", requireAuth, async (req, res, next) => {
  try {
    const studioIds = await getStudioIdsByOwner(req.user.email);
    const docs = await getBookingsForStudios(studioIds);
    res.json({ bookings: docs.map(toBooking) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/bookings/:id — cancel the caller's Pending booking
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const booking = await getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    if (booking.userEmail !== req.user.email) {
      return res
        .status(403)
        .json({ error: "This booking belongs to another account" });
    }
    if (booking.status !== "Pending") {
      return res
        .status(409)
        .json({ error: "Only Pending bookings can be cancelled" });
    }

    await cancelBookingDoc(req.params.id);
    res.json({ success: true, status: "Cancelled" });
  } catch (err) {
    next(err);
  }
});

export default router;
