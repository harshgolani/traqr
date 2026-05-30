# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Traqr is a URL shortener with click analytics. It has two independent apps:
- `backend/` — Node.js/Express REST API
- `frontend/` — React 19 + Vite 8 (currently default scaffold, not yet wired to the backend)

## Commands

### Backend (`backend/`)
```bash
npm run dev      # nodemon hot-reload
npm start        # production (node index.js)
```

### Frontend (`frontend/`)
```bash
npm run dev      # Vite dev server (HMR)
npm run build    # production build
npm run lint     # ESLint
npm run preview  # preview production build
```

## Environment setup

The backend requires PostgreSQL and Redis. Copy `backend/.env.example` to `backend/.env` and adjust:

```
DATABASE_URL=postgresql://localhost:5432/traqr
REDIS_URL=redis://localhost:6379
PORT=3000
BASE_URL=http://localhost:3000
```

The database needs two tables (not yet migrated via a migration file — create manually):

```sql
CREATE TABLE urls (
  short_code TEXT PRIMARY KEY,
  original_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  click_count INTEGER DEFAULT 0
);

CREATE TABLE clicks (
  id SERIAL PRIMARY KEY,
  short_code TEXT REFERENCES urls(short_code),
  user_agent TEXT,
  referer TEXT,
  ip_address TEXT,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Architecture

### Backend (`backend/index.js`)

Single-file Express app. All logic lives here — no routers, controllers, or separate modules.

**Request flow for redirects:**
1. `GET /:short_code` — checks Redis first (24h TTL); falls back to PostgreSQL
2. On hit, fires `logClick()` async (non-blocking) which inserts into `clicks` and increments `urls.click_count`

**API endpoints:**
- `POST /api/shorten` — creates a short code via nanoid(7), writes to Postgres + Redis
- `GET /api/analytics/:short_code` — returns total clicks, clicks-by-day (last 30), top 5 referers
- `GET /api/urls` — lists 50 most recent URLs
- `DELETE /api/urls/:short_code` — removes from Postgres (both tables) and Redis

Rate limiting: 50 requests/hour per IP on all `/api/` routes.

### Frontend (`frontend/`)

Still the default Vite scaffold. `src/App.jsx` needs to be replaced with actual UI that calls the backend API. No proxy is configured in `vite.config.js` yet — add one when connecting to the backend:

```js
server: { proxy: { '/api': 'http://localhost:3000' } }
```
