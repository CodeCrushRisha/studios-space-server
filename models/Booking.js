import { ObjectId } from "mongodb";
import { collection } from "../db.js";

function bookings() {
  return collection("bookings");
}

function isObjectIdHex(id) {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
}

export function bookingIdFilter(id) {
  if (!isObjectIdHex(id)) return { _id: id };
  return { $or: [{ _id: id }, { _id: new ObjectId(id) }] };
}

/**
 * Overlap filter against active (Pending/Confirmed) bookings. Times are
 * ISO-like strings compared lexicographically, exactly like the frontend.
 */
export function conflictFilter(studioId, startTime, endTime) {
  return {
    studioId,
    status: { $in: ["Pending", "Confirmed"] },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
}

export async function findConflictingBooking(
  studioId,
  startTime,
  endTime,
  excludeId = null
) {
  const filter = conflictFilter(studioId, startTime, endTime);
  if (excludeId) {
    filter._id =
      typeof excludeId === "string" && isObjectIdHex(excludeId)
        ? { $ne: new ObjectId(excludeId) }
        : { $ne: excludeId };
  }
  return bookings().findOne(filter);
}

export async function getBookingById(id) {
  return bookings().findOne(bookingIdFilter(id));
}

export async function insertBooking(doc) {
  const fullDoc = { ...doc, createdAt: new Date(), updatedAt: new Date() };
  const result = await bookings().insertOne(fullDoc);
  return { ...fullDoc, _id: result.insertedId };
}

export async function removeBooking(id) {
  await bookings().deleteOne(bookingIdFilter(id));
}

export async function getBookingsForUser(userEmail) {
  return bookings().find({ userEmail }).sort({ createdAt: -1 }).toArray();
}

export async function getBookingsForStudios(studioIds) {
  if (studioIds.length === 0) return [];
  return bookings()
    .find({ studioId: { $in: studioIds } })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function cancelBookingDoc(id) {
  await bookings().updateOne(bookingIdFilter(id), {
    $set: { status: "Cancelled", updatedAt: new Date() },
  });
}

// Serializes to the exact Booking shape the frontend expects.
export function toBooking(doc) {
  return {
    id: String(doc._id),
    studioId: doc.studioId,
    studioName: doc.studioName,
    userEmail: doc.userEmail,
    startTime: doc.startTime,
    endTime: doc.endTime,
    status: doc.status,
    hourlyRate: doc.hourlyRate,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : String(doc.createdAt),
  };
}
