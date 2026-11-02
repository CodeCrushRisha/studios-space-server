import { Router } from "express";
import {
  categoryLabelFor,
  getStudioById,
  getStudiosByOwner,
  getFeaturedStudios,
  insertStudio,
  isKnownCategory,
  listStudios,
  removeStudio,
  toStudio,
  updateStudioDoc,
} from "../models/Studio.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Same validation rules and messages as the frontend's parseStudioBody().
function parseStudioBody(body) {
  if (!body || typeof body !== "object") {
    return { error: "Invalid request body" };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category =
    typeof body.category === "string" ? body.category.trim() : "";
  const location =
    typeof body.location === "string" ? body.location.trim() : "";
  const overview =
    typeof body.overview === "string" ? body.overview.trim() : "";
  const imageUrl =
    typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";

  if (!name) return { error: "Title is required" };
  if (!isKnownCategory(category)) {
    return { error: `Unknown category "${category}"` };
  }
  if (!location) return { error: "Location/Address is required" };

  const hourlyRate = Number(body.hourlyRate);
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    return { error: "Hourly Rate must be a positive number" };
  }

  const securityDeposit = Number(body.securityDeposit ?? 0);
  if (!Number.isFinite(securityDeposit) || securityDeposit < 0) {
    return { error: "Security Deposit cannot be negative" };
  }

  const maxCapacity = Number(body.maxCapacity ?? 1);
  if (!Number.isInteger(maxCapacity) || maxCapacity < 1) {
    return { error: "Max Capacity must be at least 1 person" };
  }

  const images = asStringArray(body.images);
  const finalImage = imageUrl || images[0] || "/images/studios/studio-1.jpg";
  const finalImages = images.length ? images : [finalImage];

  return {
    input: {
      name,
      category,
      hourlyRate,
      securityDeposit,
      maxCapacity,
      location,
      imageUrl: finalImage,
      images: finalImages,
      amenities: asStringArray(body.amenities),
      overview,
    },
  };
}

// GET /api/studios — list with search (?q=), filter (?category=) and sort
// (?sort=). (?featured=true limits to 6, same as the home page.)
router.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category =
      typeof req.query.category === "string" ? req.query.category : "";
    const sort = typeof req.query.sort === "string" ? req.query.sort : "";
    const featured =
      req.query.featured === "true" || req.query.featured === "1";

    const docs = await listStudios({ q, category, sort, featured });
    res.json({ studios: docs.map(toStudio) });
  } catch (err) {
    next(err);
  }
});

// GET /api/studios/featured — top 6 studios (rating desc, then newest)
router.get("/featured", async (req, res, next) => {
  try {
    const docs = await getFeaturedStudios();
    res.json({ studios: docs.map(toStudio) });
  } catch (err) {
    next(err);
  }
});

// GET /api/studios/mine — owner-specific listings ("My Studio Listings")
router.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const docs = await getStudiosByOwner(req.user.email);
    res.json({ studios: docs.map(toStudio) });
  } catch (err) {
    next(err);
  }
});

// GET /api/studios/:id — single studio
router.get("/:id", async (req, res, next) => {
  try {
    const doc = await getStudioById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: "Studio not found" });
    }
    res.json({ studio: toStudio(doc) });
  } catch (err) {
    next(err);
  }
});

// POST /api/studios — create a studio for the signed-in owner
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const parsed = parseStudioBody(req.body);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    const studio = await insertStudio({
      ...parsed.input,
      categoryLabel: categoryLabelFor(parsed.input.category),
      ownerEmail: req.user.email,
      ownerName: req.user.name,
      rating: 0,
      reviewCount: 0,
      reviews: [],
    });

    res.status(201).json({ studio: toStudio(studio) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/studios/:id — update a studio the caller owns
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await getStudioById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Studio not found" });
    }
    if (existing.ownerEmail !== req.user.email) {
      return res.status(403).json({ error: "You do not own this studio" });
    }

    const parsed = parseStudioBody(req.body);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }

    await updateStudioDoc(existing._id, {
      ...parsed.input,
      categoryLabel: categoryLabelFor(parsed.input.category),
    });

    const updated = await getStudioById(req.params.id);
    res.json({ studio: toStudio(updated) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/studios/:id — delete a studio the caller owns
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await getStudioById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Studio not found" });
    }
    if (existing.ownerEmail !== req.user.email) {
      return res.status(403).json({ error: "You do not own this studio" });
    }

    await removeStudio(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
