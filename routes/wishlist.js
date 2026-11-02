import { Router } from "express";
import { getWishlist, toggleWishlist } from "../models/Wishlist.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/wishlist — the caller's saved studio ids
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const studioIds = await getWishlist(req.user.email);
    res.json({ studioIds });
  } catch (err) {
    next(err);
  }
});

// POST /api/wishlist — toggle a studio in the caller's wishlist
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const studioId =
      typeof body.studioId === "string" ? body.studioId.trim() : "";
    if (!studioId) {
      return res.status(400).json({ error: "studioId is required" });
    }

    const saved = await toggleWishlist(req.user.email, studioId);
    res.json({ studioId, saved });
  } catch (err) {
    next(err);
  }
});

export default router;
