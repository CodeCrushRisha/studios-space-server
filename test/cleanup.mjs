// Removes StudioSpace test artifacts from MongoDB Atlas.
// Usage (from the project root): node test/cleanup.mjs
import dns from "node:dns/promises";
import "dotenv/config";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

const { MongoClient } = await import("mongodb");

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB_NAME || "studiospace");

const testEmails = [
  "test-owner@studiospace.test",
  "test-other@studiospace.test",
  "weak@studiospace.test",
  "google.demo@gmail.com",
];

const results = {};
results.users = (
  await db.collection("users").deleteMany({ email: { $in: testEmails } })
).deletedCount;
results.studios = (
  await db
    .collection("studios")
    .deleteMany({
      $or: [{ ownerEmail: { $in: testEmails } }, { name: /^Test Loft Studio/ }],
    })
).deletedCount;
results.bookings = (
  await db
    .collection("bookings")
    .deleteMany({
      $or: [
        { userEmail: { $in: testEmails } },
        { studioName: /^Test Loft Studio/ },
      ],
    })
).deletedCount;
results.wishlists = (
  await db.collection("wishlists").deleteMany({ _id: { $in: testEmails } })
).deletedCount;

console.log("cleanup:", JSON.stringify(results));
await client.close();
