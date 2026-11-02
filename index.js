import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dns from "node:dns/promises";
import "dotenv/config";
import { connectToMongoDB, getDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import studioRoutes from "./routes/studios.js";
import bookingRoutes from "./routes/booking.js";
import wishlistRoutes from "./routes/wishlist.js";
import uploadRoutes from "./routes/upload.js";

// Use public DNS so MongoDB Atlas SRV records resolve reliably.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const isProduction = process.env.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// CORS — allowlist enforced in production, open during development.
// CLIENT_URL (comma-separated) is always allowed and must be the frontend
// origin (e.g. http://localhost:3000).
// ---------------------------------------------------------------------------
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);
for (const value of (process.env.CLIENT_URL ?? "").split(",")) {
  const origin = value.trim().replace(/\/+$/, "");
  if (origin) allowedOrigins.add(origin);
}

app.use(
  cors({
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    origin(origin, callback) {
      if (!origin || !isProduction || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
  })
);

// 16mb JSON limit so base64 image uploads (≈10MB decoded) fit comfortably.
app.use(express.json({ limit: "16mb" }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Basic routes
// ---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.send("Hello World");
});

// GET /api/health — API health check (also available at /health)
function healthHandler(req, res) {
  let database = "disconnected";
  try {
    getDb();
    database = "connected";
  } catch {
    database = "disconnected";
  }
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database,
  });
}
app.get("/api/health", healthHandler);
app.get("/health", healthHandler);

app.post("/add-destination", (req, res) => {
  res.send("Destination added successfully");
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/studios", studioRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/upload", uploadRoutes);

// ---------------------------------------------------------------------------
// 404 + error handling
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid request body" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request payload too large" });
  }
  if (err.status === 503) {
    return res.status(503).json({ error: "Database not connected" });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: "Internal server error" });
});

async function start() {
  try {
    await connectToMongoDB();
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

start();

export { app, connectToMongoDB };
