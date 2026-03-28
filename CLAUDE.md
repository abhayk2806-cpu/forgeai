# ForgeAI — Claude Instructions
> Permanent instruction set for AI-assisted development on this project.
> **Section A** never changes. **Section B** updates as the project phase changes.

---

## SECTION A — CORE RULES (Permanent)

### A1. Read Before You Write
- Before editing any file, read it in full first.
- Before any Supabase operation, confirm table, columns, and RLS rules.
- `PROJECT_STATUS.md` must be read at the start of every session involving this codebase.

### A2. Never Break the Payment Flow
The payment flow is the most critical path. It touches: `index.html` → `create-order.js` → Cashfree → `cashfree-webhook.js` → Supabase `purchases` table → Resend email → user.
- Never edit `create-order.js` or `cashfree-webhook.js` without reading both files completely first.
- Never change `order_note` format or `order_tags` keys without updating the webhook to match.
- Never change tier detection logic without testing locally first.

### A3. Supabase Rules
- **Service key** (`SUPABASE_SERVICE_KEY`) lives only in Netlify env vars. Never in frontend JS. Never hardcoded.
- **Anon key** lives in `supabase.js`. It's intentionally public. It's safe because RLS restricts what it can do.
- When adding a new Netlify function that needs to bypass RLS, use `createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)`.
- Before running any SQL via MCP, state what it will do and why.

### A4. Auth System Rules
- `auth.js` runs on every protected page. Do not add page-specific auth logic — put it in `auth.js`.
- Tier is read from the `purchases` table, NOT from `user_metadata`. The `user_metadata.tier` field is only used as a secondary sync.
- `window.COSU` is the single source of truth for auth state on any page.

### A5. Frontend Conventions
- No frontend framework. Vanilla HTML/CSS/JS only.
- CSS design tokens: `--accent:#F97316`, `--bg:#F7F7F5`, `--surface:#FFFFFF`, `--border:#E8E8E4`, `--text-muted:#9CA3AF`
- Admin password header: `x-admin-password` (lowercase, exactly)
- Don't use `localStorage` for anything security-sensitive. It's currently only used for the onboarding flag (`forgeai_onboarded_v1`).

### A6. Git & Deploy
- All edits happen in `/sessions/.../repo_clone/`
- Push to `main` triggers Netlify auto-deploy
- Before pushing, verify: no hardcoded secrets, no debug console.logs with sensitive data, no temp test code left in
- Commit message format: `feat:`, `fix:`, `chore:`, or `refactor:` prefix

### A7. What to Challenge (Don't Just Implement)
- Any change to pricing without explicit owner instruction → pause and confirm
- Any bulk delete from Supabase → stop and confirm with owner
- Any new payment flow change → explain full impact before proceeding
- Any change that affects the email templates (welcome/upgrade) → confirm before pushing, emails are irreversible

---

## SECTION B — Current Phase (Updates With Project Phase)

### Phase: PRE-LAUNCH (as of 2026-03-28)

**Current priority:** Complete testing → revert test prices → fill engine content → launch.

---

### B1. Active Blockers (Must Fix Before Launch)

**BLOCKER 1 — Test prices are live**
Files to update: `create-order.js`, `index.html`, `welcome.html`, `dashboard.html`
See `PROJECT_STATUS.md` Section 7 for exact changes. Do NOT launch at test prices.
Target: Revert on or after April 1, 2026 (after testing completes).

**BLOCKER 2 — Engine content is empty**
All 14+ engines have empty `content_items` rows in Supabase.
Must be filled via Admin Panel → Content tab before selling.
No code work needed — this is the owner's task.

**BLOCKER 3 — Admin password is default**
Default: `ForgeAI@Admin2025`. Must change in Netlify env vars before launch.

---

### B2. Next Tasks (In Priority Order)

1. **[TESTING — April 1, 2026]**
   - Test Starter purchase: buy → email → signup → dashboard access
   - Test Pro purchase: buy → email → signup → all engines unlocked
   - Test Upgrade: buy as Starter → upgrade → verify Pro tier in Supabase + dashboard
   - Monitor: Supabase `purchases` table, Netlify function logs, Resend email logs
   - Check: Facebook CAPI events in Meta Events Manager

2. **[AFTER TESTING] Revert test prices**
   - `create-order.js`: starter 999, pro 1999, upgrade 1000
   - `index.html`: all data-value attrs + displayed prices
   - `welcome.html`: PRICING.IN config
   - `dashboard.html`: upgrade modal price text

3. **[PENDING] Engine Ratings**
   - Simple thumbs up / thumbs down per engine
   - Store in Supabase (new table: `engine_ratings` with engine_id, user_id, rating)
   - Show aggregate score on engine card
   - Not yet started — design before building

4. **[PENDING] Fill Engine Content**
   - Owner task (not code)
   - 14 engines need prompts via admin panel → Content tab

---

### B3. Known Technical Debt

- `gumroad-webhook.js` doesn't receive `fb_event_id` from frontend (Gumroad doesn't support custom metadata in checkout). CAPI deduplication for Gumroad purchases relies on `purchase_gum_{sale_id}` — low risk, acceptable for now.

- `verify-payment.js` returns `SUCCESS` on network error (line 46) to avoid blocking users. This is intentional but means a failed verification still shows success page. The actual source of truth is the webhook, not the verify call.

- Email templates are HTML-in-JS strings inside `cashfree-webhook.js` and `gumroad-webhook.js`. If the same template needs changes, it must be updated in two places. Consider extracting to a shared email module later.

- `panelContentCache` on dashboard is in-memory only (resets on page reload). Not a bug, but means an extra Supabase fetch per page load per engine.

---

### B4. Contacts & Accounts

- **Support email:** thesaanvihub@gmail.com (all Help & Support modal links go here)
- **Email from:** `onboarding@resend.dev` via Resend API
- **Netlify site name:** ai-conversion-engines
- **Supabase project ID:** hutpurgvhbiouxmqkmpz
- **Production domain:** aiconversionengine.io

---

### B5. What Was Done in Last Session (2026-03-28)

- Added `last_updated` (date) and `update_notes` (text) columns to Supabase `engines` table
- Seeded all 14 engines with `last_updated = '2026-03-01'` and default update notes
- Updated `admin-write.js`: auto-stamp date on insert + auto-stamp on update when notes change
- Updated admin panel: Update Notes textarea in both Add and Edit modals
- Added expandable update changelog strip to every engine card on dashboard
- Added 4-step first-time onboarding overlay to `dashboard.html`
- Added Help & Support floating button + modal to all 5 portal pages
- Added global copy disclaimer toast to both copy functions on dashboard
- Updated `welcome.html`: removed "Core"/"Complete" plan references, replaced with Starter/Pro
- Set test prices: ₹2 / ₹5 / ₹3 in `create-order.js`, `index.html`, `welcome.html`, `dashboard.html`
- Added ConversionOS Pipeline full guide with E0-E7 engine cards to dashboard
- Engine 0 featured with gradient, border, "START HERE" badge
- Seeded `content_items` rows for engine-0 through engine-7 (empty)
