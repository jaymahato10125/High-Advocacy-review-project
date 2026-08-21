# Proof Desk

A testimonial-review queue: a public submission form, a reviewer queue built for
filter-then-act-on-everything bulk work at tens-of-thousands scale, a read-only
approved gallery for viewers, and a notification log.

**Stack:** Node.js 24 · TypeScript · Express 5 · MySQL 8.4 (Drizzle ORM, `mysql2`) ·
React 19 · Vite · TailwindCSS 4 · shadcn/ui (components in `apps/web/src/components/ui`) ·
TanStack Query · React Hook Form · one Zod schema shared by client and server
(`packages/shared`).

---

## 🚀 Live Demo

* **Web Application:** [https://compassionate-sparkle-production-670a.up.railway.app](https://compassionate-sparkle-production-670a.up.railway.app)
* **Backend API Health:** [https://high-advocacy-review-project-production.up.railway.app/api/health](https://high-advocacy-review-project-production.up.railway.app/api/health)
* **Pre-seeded Dataset:** 20,000 realistic submissions + ~9,000 backfilled notifications.
* **Authentication:** No password needed — single-click role switcher (**Reviewer** / **Viewer**). Public submission form available at `/submit`.

> **Note on Free Tier:** The live demo is hosted on Railway's free plan. If the deployment is sleeping, offline, or exhausts trial limits, you can easily spin up the full project locally in under 2 minutes using Docker and the simple steps below.

---

## 💻 Running Locally (Quick & Easy)

### Prerequisites
* **Node.js** v20+
* **Docker Desktop** (running, for MySQL 8.4)

### 4 Simple Steps to Start:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start MySQL database in Docker:**
   ```bash
   npm run db:up
   ```
   *(Starts MySQL 8.4 configured with `innodb_ft_min_token_size=2` for short token search like "G2").*

3. **Run migrations and seed 20,000 submissions:**
   ```bash
   npm run db:migrate
   npm run seed
   ```

4. **Start both Frontend and API:**
   ```bash
   npm run dev
   ```
   * Open **[http://localhost:5173](http://localhost:5173)** in your browser.
   * Pick **Reviewer** or **Viewer** (no password required).
   * Backend API runs at `http://localhost:4000`.
   * Adminer database GUI is available at `http://localhost:8080` (Server: `mysql`, User: `root`, Password: `proofdesk`).

### Running Automated Tests:
```bash
npm test        # 41 Backend integration tests against isolated MySQL test database
npm run test:web    # 5 Frontend selection state tests
```

---

## 1. Data model, and the one decision I'm least sure about

Two tables, no `users` table (the two fixed users are constants, per "don't build
real login"):

- `submissions` — `VARCHAR` + `CHECK` for `type`/`status` instead of MySQL `ENUM`
  (adding a value later shouldn't touch column metadata; MySQL 8.4 actually
  enforces `CHECK`). Composite indexes `(status, submitted_at)` and
  `(status, rating)` cover the queue's default views; a `FULLTEXT` index over
  `name, company, testimonial_text, email` powers search.
- `notifications` — one row per affected submission per status change, FK to
  `submissions`, always written inside the same transaction as the update.

Field lengths are the same numbers as the shared Zod schema, so a payload that
fails validation can't reach a column that would have truncated it silently.

**Least-sure decision: offset pagination.** I picked it because the UI must jump
to an arbitrary page ("jump deep into the list"), which keyset/cursor pagination
doesn't support cleanly — but keyset is the more scalable choice for next/prev
browsing, and `OFFSET n` cost grows with `n`. At this project's size (20k rows,
200k at 10x) that cost isn't visible with proper indexes, which is exactly why
it's the "least sure" one: the tradeoff is real but hasn't bitten yet. If the
table ever reaches millions of rows, the move is keyset for next/prev plus a
separate "go to page" escape hatch, or a search engine with native deep paging.

## 2. Edge cases handled, and the ones skipped

**Handled** (each maps to a test or a code path):

- *Form input:* missing/blank/malformed fields, ratings of 0/6/negative/
  non-integer, 5,001-char text, whitespace-only text, `javascript:`/`data:` link
  schemes, invalid `type`, missing link when the type requires one, malformed
  JSON (clean 400), oversized payloads (413), Unicode/emoji, client-supplied
  `status` ignored (always created `pending`), IP rate limiting (10 / 10 min).
  HTML/script in text is stored but rendered inert — React escaping +
  `white-space: pre-wrap`, no `dangerouslySetInnerHTML` anywhere.
- *Browsing:* empty results are empty states (not errors); 2-char searches like
  "G2" work (`innodb_ft_min_token_size=2`, set before the index is built);
  FULLTEXT boolean-mode operators in user input are stripped, then each token
  becomes `+token*` (prefix matching, no syntax errors); every sortable column in
  both directions with an `id` tiebreak for stable pages; unrecognized `sort` is
  defaulted, not a SQL error; `page` past the end returns `[]` with correct
  totals; `pageSize` clamps to 100 server-side.
- *Bulk:* zero-match filter is a no-op (`updatedCount: 0`), not an error; the
  same call fired twice is a no-op the second time (the `status <> target` guard
  — retries and double-clicks are safe); `excludeIds` covers "select all, then
  uncheck a few"; rows that changed between page load and bulk fire are handled
  because the WHERE re-evaluates against live data; over `BULK_ACTION_MAX_ROWS`
  (250k default) fails loudly with a "narrow your filter" message; update +
  notifications commit or roll back together (one transaction); overlapping bulk
  actions serialize on `SELECT … FOR UPDATE` row locks; statements are chunked at
  2,000 rows so a 500-row and a 200,000-row batch are the same shape.
- *Authorization:* enforced server-side — viewer `?status=pending` is overridden
  to `approved` (not refused), reviewer-only endpoints 403 for viewers, detail of
  a non-approved row 404s for viewers (don't confirm existence), missing/
  tampered/expired cookie 401s, and a cookie reused after logout 401s (in-memory
  `jti` denylist).
- *Network:* skeleton loaders instead of blank screens; stale-response clobbering
  is structurally impossible (TanStack Query keys every request by its full
  filter state); DB failures surface as retryable error banners, not silent hangs.

**Skipped, deliberately:** duplicate/spam detection beyond IP rate limiting;
CAPTCHA; keyset pagination (see above); i18n/RTL; a first-class undo for bulk
actions (today: re-filter and run the opposite action — works, but isn't a
feature); the `jti` denylist is in-memory, so a server restart un-revokes logged-
out sessions (fine for a demo; Redis or short TTLs + refresh would fix it).

## 3. What breaks first at 10x, and what I'd do

**Data 10x (~200k rows):** the common case holds — `(status, submitted_at)` is
indexed and a 200k range scan is still fast (the seed-scale bulk smoke test did
8,150 updates + 8,150 notification inserts in ~0.45s). What degrades is
*unanticipated filter combinations*: MySQL generally uses one composite index per
query, so rating range + type + date range + search at once falls back to a
partial scan and filesort. Plan: watch real query patterns with `EXPLAIN` / the
slow query log and add composite indexes that match actual combinations instead
of guessing; cache status-tab counts on a short TTL; add a read replica if read
traffic grows independently of data.

**Reviewers 10x:** lock contention. Overlapping bulk actions on overlapping
filters queue on each other's `FOR UPDATE` locks — visible first as latency, then
timeouts. That's the actual trigger for BullMQ + Redis (deliberately *not* used
in v1 — with "notify" being a fast DB insert there is nothing slow to queue):
turn bulk into "enqueue → return immediately → progress indicator" instead of
holding an HTTP request and DB locks open. Connection-pool sizing stops being a
default at this point too.

**A third trigger worth naming:** the moment "notify" becomes a real email/Slack
API call, doing it synchronously inside the bulk transaction is actively wrong —
third-party latency and rate limits don't belong inside a DB transaction. That's
the unambiguous case for a queue + worker.

## 4. What I'd build next

Real auth (users table, `reviewed_by` becomes a proper FK); a full audit trail
beyond `reviewed_by`/`reviewed_at` + the notification log; CSV export of approved
testimonials for decks; tagging/theming; saved filter presets; duplicate-
submission heuristics; real email via the BullMQ+Redis path above; live queue
updates (SSE) when new submissions arrive; an analytics view (approval rate,
rating trend); granular reviewer permissions; first-class bulk undo.

## 5. How to run it / load fake data / log in as both users

See the top of this README. There is no password: the login screen has two
buttons — **Continue as Reviewer** (queue, bulk actions, notifications) and
**Continue as Viewer** (read-only approved gallery). The public form is at
`/submit` and needs no login at all.
