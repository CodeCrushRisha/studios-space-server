import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// POST /api/upload — proxies a base64 image to imgbb and returns its URL.
// The API key stays server-side; returns 501 when uploads are not
// configured so the UI can fall back to pasting an Image URL.
router.post("/", requireAuth, async (req, res) => {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    return res.status(501).json({
      error:
        "Image upload is not configured on this deployment. Paste an Image URL instead.",
    });
  }

  const body = req.body ?? {};
  const base64 =
    typeof body.image === "string"
      ? body.image.replace(/^data:image\/\w+;base64,/, "")
      : "";
  if (!base64) {
    return res.status(400).json({ error: "Image data is required" });
  }

  // Rough decoded-size check before sending the payload upstream.
  if (base64.length > (MAX_UPLOAD_BYTES * 4) / 3 + 1024) {
    return res
      .status(413)
      .json({ error: "Image is larger than the 10 MB upload limit" });
  }

  const name =
    (typeof body.name === "string" && body.name.trim()) ||
    `studiospace-${Date.now()}`;
  const params = new URLSearchParams({ key: apiKey, name });
  const form = new FormData();
  form.append("image", base64);

  try {
    const upstream = await fetch(
      `https://api.imgbb.com/1/upload?${params.toString()}`,
      { method: "POST", body: form }
    );
    const data = await upstream.json().catch(() => null);

    const url = data?.data?.display_url ?? data?.data?.url;
    if (!upstream.ok || !data?.success || !url) {
      return res
        .status(502)
        .json({ error: data?.error?.message ?? "imgbb upload failed" });
    }

    return res.json({ url });
  } catch (err) {
    console.warn("StudioSpace: imgbb upload failed.", err);
    return res
      .status(502)
      .json({ error: "Could not reach the image host. Try again." });
  }
});

export default router;
