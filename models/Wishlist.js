import { collection } from "../db.js";

// The frontend stores wishlists with the user's email as the document _id,
// so keep the same shape for shared-database compatibility.
function wishlists() {
  return collection("wishlists");
}

export async function getWishlist(userEmail) {
  const doc = await wishlists().findOne({ _id: userEmail });
  return doc?.studioIds ?? [];
}

/**
 * Toggles a studio in the user's wishlist.
 * Returns `true` when the studio is now saved.
 */
export async function toggleWishlist(userEmail, studioId) {
  const existing = await wishlists().findOne({ _id: userEmail });
  const isSaved = existing?.studioIds?.includes(studioId) ?? false;

  if (isSaved) {
    await wishlists().updateOne(
      { _id: userEmail },
      { $pull: { studioIds: studioId } }
    );
    return false;
  }

  await wishlists().updateOne(
    { _id: userEmail },
    { $addToSet: { studioIds: studioId } },
    { upsert: true }
  );
  return true;
}
