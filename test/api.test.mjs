// StudioSpace backend API test suite — runs against http://localhost:8000
const BASE = "http://localhost:8000";
let cookie = "";
let passed = 0;
let failed = 0;

async function call(method, path, body, useCookie = true) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (useCookie && cookie) headers["Cookie"] = cookie;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

function check(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label} -> ${JSON.stringify(detail)}`);
  }
}

const OWNER = "test-owner@studiospace.test";
const OTHER = "test-other@studiospace.test";
const PW = "Test1234";

async function main() {
  // --- health ---
  console.log("HEALTH");
  let r = await call("GET", "/api/health", undefined, false);
  check("health ok + db connected", r.status === 200 && r.data?.status === "ok" && r.data?.database === "connected", r);

  // --- auth ---
  console.log("AUTH");
  cookie = "";
  r = await call("POST", "/api/auth/register", { name: "Backend Test Owner", email: OWNER, password: PW }, false);
  check("register 201", r.status === 201 && r.data?.success === true, r);
  r = await call("POST", "/api/auth/register", { name: "Dup", email: OWNER, password: PW }, false);
  check("register duplicate 400", r.status === 400 && /already exists/.test(r.data?.error ?? ""), r);
  r = await call("POST", "/api/auth/register", { name: "Weak", email: "weak@studiospace.test", password: "abc" }, false);
  check("register weak pw 400", r.status === 400 && /at least 6/.test(r.data?.error ?? ""), r);
  r = await call("POST", "/api/auth/register", { name: "NoMail", email: "notanemail", password: PW }, false);
  check("register bad email 400", r.status === 400, r);

  r = await call("POST", "/api/auth/login", { email: OWNER, password: PW }, false);
  check("login 200 + user + cookie", r.status === 200 && r.data?.user?.email === OWNER && cookie.includes("studiospace_session"), r);
  const ownerCookie = cookie;
  r = await call("GET", "/api/auth/me");
  check("me with cookie", r.status === 200 && r.data?.user?.email === OWNER, r);
  cookie = "";
  r = await call("GET", "/api/auth/me", undefined, false);
  check("me without cookie -> null", r.status === 200 && r.data?.user === null, r);
  r = await call("POST", "/api/auth/login", { email: OWNER, password: "Wrong1234" }, false);
  check("login wrong pw 401", r.status === 401, r);
  cookie = ownerCookie;

  // --- studios ---
  console.log("STUDIOS");
  const studioBody = {
    name: "Test Loft Studio",
    category: "photo",
    hourlyRate: 50,
    securityDeposit: 100,
    maxCapacity: 8,
    location: "Test City, TS",
    imageUrl: "https://example.com/test.jpg",
    images: ["https://example.com/test.jpg"],
    amenities: ["Wi-Fi"],
    overview: "A test studio.",
  };
  r = await call("POST", "/api/studios", studioBody);
  check("create studio 201 + shape", r.status === 201 && r.data?.studio?.id && r.data?.studio?.categoryLabel === "Photo Studio" && r.data?.studio?.ownerEmail === OWNER, r);
  const studioId = r.data?.studio?.id;

  r = await call("POST", "/api/studios", { ...studioBody, category: "nope" });
  check("create studio unknown category 400", r.status === 400 && /Unknown category/.test(r.data?.error ?? ""), r);
  r = await call("POST", "/api/studios", { ...studioBody, hourlyRate: -5 });
  check("create studio bad rate 400", r.status === 400, r);

  r = await call("GET", "/api/studios", undefined, false);
  check("list studios 200 + array", r.status === 200 && Array.isArray(r.data?.studios) && r.data.studios.some((s) => s.id === studioId), r);
  r = await call("GET", "/api/studios?featured=true", undefined, false);
  check("featured flag <= 6", r.status === 200 && r.data.studios.length <= 6, r);
  r = await call("GET", "/api/studios/featured", undefined, false);
  check("featured endpoint <= 6", r.status === 200 && r.data.studios.length <= 6, r);
  r = await call("GET", "/api/studios?q=test+loft", undefined, false);
  check("search by name", r.status === 200 && r.data.studios.some((s) => s.id === studioId), r);
  r = await call("GET", "/api/studios?category=photo", undefined, false);
  check("filter by category", r.status === 200 && r.data.studios.some((s) => s.id === studioId), r);
  r = await call("GET", "/api/studios?sort=price_asc", undefined, false);
  check("sort price_asc", r.status === 200 && Array.isArray(r.data?.studios), r);
  r = await call("GET", "/api/studios/mine");
  check("mine lists own studio", r.status === 200 && r.data.studios.some((s) => s.id === studioId), r);
  r = await call("GET", `/api/studios/${studioId}`, undefined, false);
  check("get by id 200", r.status === 200 && r.data?.studio?.name === "Test Loft Studio", r);
  r = await call("GET", "/api/studios/aaaaaaaaaaaaaaaaaaaaaaaa", undefined, false);
  check("get missing id 404", r.status === 404, r);

  r = await call("PUT", `/api/studios/${studioId}`, { ...studioBody, name: "Test Loft Studio Updated" });
  check("update own studio 200", r.status === 200 && r.data?.studio?.name === "Test Loft Studio Updated", r);

  // second user for authz checks
  await call("POST", "/api/auth/register", { name: "Other User", email: OTHER, password: PW }, false);
  r = await call("POST", "/api/auth/login", { email: OTHER, password: PW }, false);
  const otherCookie = cookie;
  r = await call("PUT", `/api/studios/${studioId}`, studioBody);
  check("update foreign studio 403", r.status === 403 && /do not own/.test(r.data?.error ?? ""), r);
  r = await call("DELETE", `/api/studios/${studioId}`);
  check("delete foreign studio 403", r.status === 403, r);
  cookie = "";
  r = await call("POST", "/api/studios", studioBody, false);
  check("create studio unauth 401", r.status === 401, r);
  cookie = ownerCookie;

  // --- bookings ---
  console.log("BOOKINGS");
  const start = "2027-03-01T10:00:00";
  const end = "2027-03-01T12:00:00";
  r = await call("POST", "/api/bookings", { studioId, startTime: start, endTime: end });
  check("create booking 201 + shape", r.status === 201 && r.data?.booking?.id && r.data.booking.status === "Pending" && r.data.booking.studioName === "Test Loft Studio Updated", r);
  const bookingId = r.data?.booking?.id;

  r = await call("POST", "/api/bookings", { studioId, startTime: "2027-03-01T11:00:00", endTime: "2027-03-01T13:00:00" });
  check("double-booking overlap 409 + conflict", r.status === 409 && r.data?.conflict?.startTime === start && /already reserved/.test(r.data?.error ?? ""), r);
  r = await call("POST", "/api/bookings", { studioId, startTime: "2027-03-01T13:00:00", endTime: "2027-03-01T14:00:00" });
  check("adjacent slot ok 201", r.status === 201, r);
  const booking2Id = r.data?.booking?.id;
  r = await call("POST", "/api/bookings", { studioId, startTime: end, endTime: start });
  check("end before start 400", r.status === 400, r);
  r = await call("POST", "/api/bookings", { studioId: "aaaaaaaaaaaaaaaaaaaaaaaa", startTime: start, endTime: end });
  check("booking missing studio 404", r.status === 404, r);

  r = await call("GET", "/api/bookings");
  check("customer bookings list", r.status === 200 && r.data.bookings.length >= 2 && r.data.bookings.every((b) => b.userEmail === OWNER), r);

  // other user books on owner's studio -> host view
  cookie = otherCookie;
  r = await call("POST", "/api/bookings", { studioId, startTime: "2027-03-02T09:00:00", endTime: "2027-03-02T10:00:00" });
  check("other user booking 201", r.status === 201, r);
  const otherBookingId = r.data?.booking?.id;
  cookie = ownerCookie;
  r = await call("GET", "/api/bookings/host");
  check("host bookings include other user's", r.status === 200 && r.data.bookings.some((b) => b.id === otherBookingId), r);
  cookie = otherCookie;
  r = await call("GET", "/api/bookings/host");
  check("host bookings for non-owner empty", r.status === 200 && r.data.bookings.length === 0, r);

  // cancellation
  cookie = ownerCookie;
  r = await call("PATCH", `/api/bookings/${bookingId}`);
  check("cancel own pending 200", r.status === 200 && r.data?.success === true && r.data?.status === "Cancelled", r);
  r = await call("PATCH", `/api/bookings/${bookingId}`);
  check("cancel again 409", r.status === 409 && /Only Pending/.test(r.data?.error ?? ""), r);
  cookie = otherCookie;
  r = await call("PATCH", `/api/bookings/${booking2Id}`);
  check("cancel foreign booking 403", r.status === 403, r);
  r = await call("PATCH", "/api/bookings/aaaaaaaaaaaaaaaaaaaaaaaa");
  check("cancel missing booking 404", r.status === 404, r);
  cookie = ownerCookie;

  // --- wishlist ---
  console.log("WISHLIST");
  r = await call("GET", "/api/wishlist");
  check("wishlist empty", r.status === 200 && Array.isArray(r.data?.studioIds) && r.data.studioIds.length === 0, r);
  r = await call("POST", "/api/wishlist", { studioId });
  check("wishlist save", r.status === 200 && r.data?.saved === true, r);
  r = await call("POST", "/api/wishlist", { studioId });
  check("wishlist unsave", r.status === 200 && r.data?.saved === false, r);
  r = await call("POST", "/api/wishlist", {});
  check("wishlist missing id 400", r.status === 400, r);

  // --- upload ---
  console.log("UPLOAD");
  r = await call("POST", "/api/upload", { image: "AAAA" });
  check("upload without key 501", r.status === 501, r);
  cookie = "";
  r = await call("POST", "/api/upload", { image: "AAAA" }, false);
  check("upload unauth 401", r.status === 401, r);
  cookie = ownerCookie;

  // --- logout + misc ---
  console.log("MISC");
  r = await call("POST", "/api/auth/google", {}, false);
  check("google demo login 200", r.status === 200 && r.data?.user?.email === "google.demo@gmail.com", r);
  cookie = ownerCookie;
  r = await call("POST", "/api/auth/logout");
  check("logout 200", r.status === 200 && r.data?.success === true, r);
  cookie = "";
  r = await call("GET", "/api/auth/me", undefined, false);
  check("me after logout null", r.data?.user === null, r);
  r = await call("GET", "/api/nope", undefined, false);
  check("404 handler json", r.status === 404 && r.data?.error === "Not found", r);

  // CORS preflight
  const pre = await fetch(BASE + "/api/auth/login", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000", "Access-Control-Request-Method": "POST" },
  });
  check("CORS preflight allows frontend", pre.status === 204 || pre.status === 200, { status: pre.status });

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("SUITE CRASH:", err);
  process.exit(2);
});
