import { Router } from "express";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { findUserByEmail, insertUser } from "../models/User.js";
import {
  SESSION_COOKIE,
  createSessionToken,
  getSession,
  sessionCookieOptions,
} from "../middleware/auth.js";

const router = Router();

// Same password storage format as the frontend (src/lib/users.ts) so
// accounts registered through either app can log in to both.
function hashPassword(password) {
  return `sha256:${createHash("sha256")
    .update(`studiospace:${password}`)
    .digest("hex")}`;
}

function verifyPassword(stored, password) {
  if (!stored || typeof stored !== "string") return false;
  if (stored.startsWith("$2")) {
    try {
      return bcrypt.compareSync(password, stored);
    } catch {
      return false;
    }
  }
  return stored === hashPassword(password);
}

// Same policy as the frontend's validatePassword().
function validatePassword(password) {
  if (password.length < 6) {
    return "Password must be at least 6 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }
  return null;
}

function serializeUser(user) {
  const photoUrl = user.photoUrl || undefined;
  return {
    name: user.name,
    email: user.email,
    ...(photoUrl ? { photoUrl, avatarUrl: photoUrl } : {}),
  };
}

function clearSessionCookie(res) {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions;
  res.clearCookie(SESSION_COOKIE, options);
}

// POST /api/auth/register — 201 { success: true } (does not sign the user in)
router.post("/register", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const photoUrl =
      typeof body.photoUrl === "string" ? body.photoUrl.trim() : "";

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (photoUrl && !/^https?:\/\//.test(photoUrl)) {
      return res
        .status(400)
        .json({ error: "Photo URL must start with http:// or https://" });
    }

    const policyError = validatePassword(password);
    if (policyError) {
      return res.status(400).json({ error: policyError });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res
        .status(400)
        .json({ error: "An account with this email already exists." });
    }

    await insertUser({ name, email, password: hashPassword(password), photoUrl });

    return res.status(201).json({ success: true });
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(400)
        .json({ error: "An account with this email already exists." });
    }
    next(err);
  }
});

// POST /api/auth/login — 200 { user } + sets the session cookie
router.post("/login", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(user.password, password)) {
      return res.status(401).json({
        error: "Invalid email or password. Please try again.",
      });
    }

    res.cookie(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
    return res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout — 200 { success: true } + clears the session cookie
router.post("/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

// GET /api/auth/me — 200 { user } (null when not signed in)
router.get("/me", (req, res) => {
  res.json({ user: getSession(req) });
});

// POST /api/auth/google — demo social login (same behavior as the frontend)
router.post("/google", async (req, res, next) => {
  try {
    const email = "google.demo@gmail.com";
    let user = await findUserByEmail(email);
    if (!user) {
      user = await insertUser({
        name: "Google Demo User",
        email,
        password: hashPassword("GoogleDemo1"),
        photoUrl: "",
      });
    }

    res.cookie(SESSION_COOKIE, createSessionToken(user), sessionCookieOptions);
    return res.json({ user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
