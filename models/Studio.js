import { ObjectId } from "mongodb";
import { collection } from "../db.js";

// Same category set as the frontend (src/lib/studio-categories.ts).
const CATEGORY_LABELS = Object.freeze({
  photo: "Photo Studio",
  "sound-stage": "Film Stage",
  podcast: "Podcast Lounge",
  music: "Music Suite",
  art: "Workshop",
});

export const SORT_OPTIONS = Object.freeze({
  rating: { rating: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price_asc: { hourlyRate: 1 },
  price_desc: { hourlyRate: -1 },
  name: { name: 1 },
});

export function categoryLabelFor(slug) {
  return CATEGORY_LABELS[slug] ?? slug;
}

export function isKnownCategory(slug) {
  return Object.hasOwn(CATEGORY_LABELS, slug);
}

function studios() {
  return collection("studios");
}

function isObjectIdHex(id) {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
}

// Same id filter as the frontend: supports ObjectId ids and any legacy
// string ids without letting the driver throw on invalid ObjectIds.
export function studioIdFilter(id) {
  if (!isObjectIdHex(id)) return { _id: id };
  return { $or: [{ _id: id }, { _id: new ObjectId(id) }] };
}

export async function getStudioById(id) {
  return studios().findOne(studioIdFilter(id));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Lists studios with optional search (q), category filter, sort and the
 * featured flag (limit 6, matching the home page).
 */
export async function listStudios({ q, category, sort, featured } = {}) {
  const filter = {};
  if (category) filter.category = category;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { name: rx },
      { location: rx },
      { categoryLabel: rx },
      { category: rx },
    ];
  }

  const sortSpec = SORT_OPTIONS[sort] ?? SORT_OPTIONS.rating;
  let cursor = studios().find(filter).sort(sortSpec);
  if (featured) cursor = cursor.limit(6);
  return cursor.toArray();
}

export async function getFeaturedStudios() {
  return studios()
    .find({})
    .sort({ rating: -1, createdAt: -1 })
    .limit(6)
    .toArray();
}

export async function getStudiosByOwner(ownerEmail) {
  return studios().find({ ownerEmail }).sort({ createdAt: -1 }).toArray();
}

export async function getStudioIdsByOwner(ownerEmail) {
  const docs = await studios()
    .find({ ownerEmail })
    .project({ _id: 1 })
    .toArray();
  return docs.map((doc) => String(doc._id));
}

export async function insertStudio(doc) {
  const now = new Date();
  const fullDoc = { ...doc, createdAt: now, updatedAt: now };
  const result = await studios().insertOne(fullDoc);
  return { ...fullDoc, _id: result.insertedId };
}

export async function updateStudioDoc(id, patch) {
  const result = await studios().updateOne(studioIdFilter(id), {
    $set: { ...patch, updatedAt: new Date() },
  });
  return result.matchedCount > 0;
}

export async function removeStudio(id) {
  const result = await studios().deleteOne(studioIdFilter(id));
  return result.deletedCount > 0;
}

// Serializes to the exact Studio shape the frontend expects.
export function toStudio(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    category: doc.category,
    categoryLabel: doc.categoryLabel || categoryLabelFor(doc.category),
    imageUrl: doc.imageUrl,
    images: doc.images?.length ? doc.images : [doc.imageUrl],
    hourlyRate: doc.hourlyRate,
    securityDeposit: doc.securityDeposit ?? 0,
    maxCapacity: doc.maxCapacity ?? 0,
    amenities: doc.amenities ?? [],
    overview: doc.overview ?? "",
    rating: doc.rating ?? 0,
    reviewCount: doc.reviewCount ?? 0,
    location: doc.location,
    ownerEmail: doc.ownerEmail,
    ownerName: doc.ownerName,
    reviews: doc.reviews ?? [],
  };
}
