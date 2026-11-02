import jwt from "jsonwebtoken";

// Must match the frontend's session cookie (src/lib/session.ts).
export const SESSION_COOKIE = "studiospace_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};

export function createSessionToken(user) {
  return jwt.sign(
    { name: user.name, avatarUrl: user.avatarUrl ?? "" },
    process.env.JWT_SECRET,
    {
      subject: user.email,
      expiresIn: SESSION_DURATION_SECONDS,
      algorithm: "HS256",
    }
  );
}

export function verifySessionToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof payload.sub !== "string" || typeof payload.name !== "string") {
      return null;
    }
    return {
      email: payload.sub,
      name: payload.name,
      avatarUrl:
        typeof payload.avatarUrl === "string" && payload.avatarUrl
          ? payload.avatarUrl
          : undefined,
    };
  } catch {
    return null;
  }
}

export function getSession(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  return verifySessionToken(token);
}

export function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.user = session;
  next();
}

export default requireAuth;
