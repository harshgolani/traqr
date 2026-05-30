# Traqr

URL shortener with click analytics. Paste a long URL, get a short one. Every click is tracked.

**Live:** https://traqr-app.netlify.app
**Backend:** https://traqr-production-fbdd.up.railway.app

---

## What it does

- Shorten any URL to a short code
- Every redirect is tracked — timestamp, user agent, referer, IP
- Analytics dashboard per URL — total clicks, clicks by day, top referers
- Redis caching for sub-100ms redirect latency
- PostgreSQL for persistent storage of URLs and click events

---

## Architecture

Frontend (React + Vite) → Netlify
Backend (Node.js + Express) → Railway
Cache (Redis) → Railway managed
Database (PostgreSQL) → Railway managed

**Redirect flow:**
1. Request hits `/:short_code`
2. Check Redis — if hit, redirect immediately (~1ms)
3. If miss, query PostgreSQL, cache result, redirect
4. Log click asynchronously — doesn't block redirect

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Recharts |
| Backend | Node.js + Express |
| Cache | Redis |
| Database | PostgreSQL |
| Frontend hosting | Netlify |
| Backend hosting | Railway |

---

## Run locally

Prerequisites: PostgreSQL and Redis installed and running locally.

**Backend:**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your local DATABASE_URL and REDIS_URL
node index.js
# Runs on http://localhost:3000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

**Create tables (run once in psql):**
```sql
CREATE TABLE urls (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(10) UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    click_count INTEGER DEFAULT 0
);

CREATE TABLE clicks (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(10) NOT NULL,
    clicked_at TIMESTAMP DEFAULT NOW(),
    user_agent TEXT,
    referer TEXT,
    ip_address VARCHAR(45)
);

CREATE INDEX idx_clicks_short_code ON clicks(short_code);
CREATE INDEX idx_urls_short_code ON urls(short_code);
```

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | Health check |
| POST | /api/shorten | Shorten a URL |
| GET | /:short_code | Redirect to original URL |
| GET | /api/analytics/:short_code | Get click analytics |
| GET | /api/urls | List all URLs |
| DELETE | /api/urls/:short_code | Delete a URL |

---

## Security

- CORS restricted to Netlify frontend URL
- Rate limiting: 50 requests/hour per IP via express-rate-limit
- trust proxy enabled for Railway's reverse proxy
- Credentials stored as environment variables, never in code
