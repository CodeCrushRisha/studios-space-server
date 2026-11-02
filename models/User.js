import { collection } from "../db.js";

function users() {
  return collection("users");
}

export async function findUserByEmail(email) {
  return users().findOne({ email });
}

export async function insertUser({ name, email, password, photoUrl }) {
  const doc = {
    name,
    email,
    password,
    photoUrl: photoUrl ?? "",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await users().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}
