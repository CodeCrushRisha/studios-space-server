# StudioSpace API

Express + MongoDB backend for the StudioSpace app. Provides auth (HTTPOnly session cookie), studios, bookings, wishlist, and image uploads.

## Requirements

- Node.js 18+
- A MongoDB database (Atlas SRV connection string)

## Setup

```bash
npm install
```

Create a `.env` file in the project root:

```ini
MONGODB_URI=mongodb+srv://user:pass@cluster.example.mongodb.net/
MONGODB_DB_NAME=studiospace
JWT_SECRET=change-me
CLIENT_URL=http://localhost:3000
NODE_ENV=development
PORT=8000
IMGBB_API_KEY=your-imgbb-key
```

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string (Atlas SRV supported) |
| `MONGODB_DB_NAME` | Database name |
| `JWT_SECRET` | Signs the session token stored in the cookie |
| `CLIENT_URL` | Extra allowed CORS origins, comma-separated (frontend origin) |
| `NODE_ENV` | `production` enables `secure` cookies |
| `PORT` | Server port, defaults to `8000` |
| `IMGBB_API_KEY` | Key used by the image upload proxy |

## Scripts

```bash
npm run dev     # nodemon auto-reload
npm start       # node index.js
```

Server runs at `http://localhost:8000`.

## CORS and cookies

- Allowed origins are enforced in **every** environment: `http://localhost:3000`, `http://127.0.0.1:3000`, the Vite equivalents (`:5173`), the API origin itself, plus anything listed in `CLIENT_URL`.
- `Access-Control-Allow-Credentials: true` is always set so the browser can send the HTTPOnly session cookie from `http://localhost:3000`.
- Requests from any other origin get no CORS headers and are blocked by the browser.
- Session cookie: `studiospace_session` — `httpOnly`, `sameSite: "lax"`, `secure` in production.

## API

Base URL: `http://localhost:8000`

### Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` (or `/health`) | – | Status, uptime, DB state |
| GET | `/` | – | Plain "Hello World" |

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/register` | – | `{ name, email, password, photoUrl? }` → `201 { success: true }` (does not sign in) |
| POST | `/login` | – | `{ email, password }` → `200 { user }` + sets cookie |
| POST | `/logout` | – | Clears the session cookie |
| GET | `/me` | – | `{ user }` or `{ user: null }` |
| POST | `/google` | – | Demo social login for `google.demo@gmail.com` |

Password policy (same as the frontend): at least 6 characters, with at least one uppercase and one lowercase letter.

### Studios (`/api/studios`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | – | List — `?q=` search, `?category=`, `?sort=`, `?featured=true` (max 6) |
| GET | `/featured` | – | Featured studios (max 6) |
| GET | `/mine` | ✓ | Studios owned by the caller |
| GET | `/:id` | – | Single studio |
| POST | `/` | ✓ | Create studio |
| PUT | `/:id` | ✓ | Update own studio |
| DELETE | `/:id` | ✓ | Delete own studio |

### Bookings (`/api/bookings`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/` | ✓ | Create booking (overlap → `409`) |
| GET | `/` | ✓ | Caller's bookings |
| GET | `/host` | ✓ | Bookings on the caller's studios |
| PATCH | `/:id` | ✓ | Cancel/update (owner or booker only) |

### Wishlist (`/api/wishlist`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/` | ✓ | Saved studio ids |
| POST | `/` | ✓ | Toggle `{ studioId }` |

### Upload (`/api/upload`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/` | ✓ | Proxies a base64 image (`{ image, name? }`) to ImgBB → `{ url }`; `501` when `IMGBB_API_KEY` is unset, `413` over 10 MB, `502` upstream failure |

All responses are JSON: `{ ... }` on success, `{ "error": "..." }` on failure. Auth uses the session cookie, not `Authorization` headers.

## Tests

```bash
node test/api.test.mjs   # requires the server running on :8000
node test/cleanup.mjs    # removes test data created by the suite
```

## Project structure

```
index.js            # app entry: CORS, middleware, routes, error handling
db.js               # MongoDB connection
middleware/auth.js  # session token + requireAuth
models/             # User, Studio, Booking, Wishlist
routes/             # auth, studios, booking, wishlist, upload
test/               # end-to-end API suite + cleanup
```
