import { MongoClient } from "mongodb";
import "dotenv/config";

let client = null;
let db = null;

/**
 * Connects to MongoDB Atlas using the official native driver.
 * Uses MONGODB_DB_NAME (default "studiospace") so the database matches
 * what the frontend uses. Safe to call more than once.
 */
export async function connectToMongoDB() {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI is not set — running without a database");
    return null;
  }

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db(process.env.MONGODB_DB_NAME || "studiospace");
  console.log("Connected to MongoDB Atlas");

  await ensureIndexes(db);
  return db;
}

/**
 * Returns the live database handle or throws a 503 the error handler
 * turns into a clean JSON response when the server has no connection.
 */
export function getDb() {
  if (!db) {
    const err = new Error("Database is not connected");
    err.status = 503;
    throw err;
  }
  return db;
}

export function collection(name) {
  return getDb().collection(name);
}

async function ensureIndexes(database) {
  try {
    await database
      .collection("users")
      .createIndex({ email: 1 }, { unique: true });
    await database.collection("studios").createIndex({ ownerEmail: 1 });
    await database
      .collection("studios")
      .createIndex({ rating: -1, createdAt: -1 });
    await database.collection("studios").createIndex({ category: 1 });
    await database.collection("bookings").createIndex({ userEmail: 1 });
    await database
      .collection("bookings")
      .createIndex({ studioId: 1, status: 1, startTime: 1, endTime: 1 });
  } catch (err) {
    console.warn("Could not ensure MongoDB indexes:", err.message);
  }
}

export async function closeMongoDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
