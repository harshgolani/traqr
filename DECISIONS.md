# Design Decisions

## Why a URL shortener

URL shorteners are a classic system design interview question — "Design bit.ly" comes up at Google, Meta, Amazon. Building one demonstrates you understand caching layers, database design, async operations, and high-throughput systems. Every recruiter who asks "have you worked with Redis?" can be answered with a real deployed example.

The personal motivation: running paid Instagram campaigns for The Case Factory meant trusting third-party link trackers I couldn't inspect or customize. Traqr is the tool I would have wanted.

## Redis as the caching layer

Every redirect hits Redis first. Redis stores short_code → original_url with a 24-hour TTL. If found, redirect happens immediately without touching PostgreSQL. If not found, fetch from PostgreSQL and populate the cache.

Why this matters: PostgreSQL can handle hundreds of reads/second. Redis handles hundreds of thousands. At scale, 99% of redirects never touch the database — the cache absorbs the load. This is how bit.ly and tinyurl actually work under the hood.

## PostgreSQL for persistence

Two tables — `urls` (short codes and metadata) and `clicks` (every click event with user_agent, referer, ip_address, timestamp). Indexed on short_code for O(log n) lookups.

Chose PostgreSQL over SQLite because Railway offers managed PostgreSQL with persistent storage — no configuration overhead, automatic backups, production-grade reliability. SQLite would require managing the file manually.

## Async click logging

Clicks are logged asynchronously — the redirect happens immediately and the INSERT fires without waiting for it to complete. This keeps redirect latency sub-100ms even under load. If the click log fails, the redirect still succeeds. Analytics accuracy is slightly sacrificed for redirect performance — correct trade-off for a URL shortener where redirect speed is the primary user experience.

## nanoid for short codes

nanoid(7) generates 7-character URL-safe random strings. At 7 characters with 64 possible characters per position, the collision probability is negligible for portfolio scale. nanoid is cryptographically random, smaller than uuid, and produces URL-safe output without encoding.

## Railway for backend hosting

Railway provides managed PostgreSQL and Redis in the same project, connected via internal networking with reference variables. No separate database provisioning, no connection string management across services — Railway injects `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}` automatically. Right tool for a Node.js + Postgres + Redis stack.

## Rate limiting — 50 requests/hour per IP

Portfolio project with no authentication. 50 requests/hour per IP is enough for a recruiter to test the product thoroughly while preventing systematic abuse. Uses express-rate-limit with trust proxy enabled for Railway's reverse proxy infrastructure.

## CORS restricted to Netlify URL

Same reasoning as other projects — open CORS in development, restricted to the frontend domain in production.

## Session-based analytics display

Analytics data is fetched on demand when a user clicks the Analytics button — not preloaded. Reduces initial page load, avoids unnecessary API calls for URLs the user doesn't care about. Data lives in React state, lost on refresh. For a portfolio demo, this is the right trade-off.
