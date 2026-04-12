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

## SECTION A5 ADDENDUM — localStorage Keys (DO NOT CONFLICT)
- `forgeai_onboarded_v1` = `'true'` → gates the 4-step onboarding overlay
- `forgeai_disclaimer_v2` = `'skip'` → skips the disclaimer modal for all future engine opens
If you add any new localStorage usage, use a new key. Never reuse or clear existing keys.

---

## SECTION B — Current Phase (Updates With Project Phase)

### Phase: PRE-LAUNCH (as of 2026-04-12, Sessions 3 & 4)

**Current priority:** Fill engine content → revert test prices → run full flow test → launch.

---

### B1. Active Blockers (Must Fix Before Launch)

**BLOCKER 1 — Engine content is EMPTY (31 engines)**
All 31 engines have empty `content_items` rows in Supabase — no AI prompts are loaded.
Must be filled via Admin Panel → Content tab before selling a single unit.
Pipeline engines need special attention: `conversionos` (E0), `pipeline-e1` through `pipeline-e7`.
This is the owner's task — no code work needed.

**BLOCKER 2 — Test prices are live**
Files to update: `create-order.js`, `index.html`, `welcome.html`, `dashboard.html`
See `PROJECT_STATUS.md` Section 7 for exact values. Do NOT launch at test prices.
Testing was planned for April 1, 2026 but is still pending.

**BLOCKER 3 — Admin password is default**
Default: `ForgeAI@Admin2025`. Change in Netlify env vars before launch.

---

### B2. Next Tasks (In Priority Order)

1. **[OWNER TASK] Fill all 31 engine prompts via admin panel**
   - Admin Panel → Content tab → select each engine → paste instruction → save
   - Pipeline engines: E0 (`conversionos`), E1–E7 (`pipeline-e1` through `pipeline-e7`)

2. **[TESTING] Run full end-to-end flow test**
   - Test Starter purchase: buy → email → signup → dashboard access → copy engine → paste to Claude
   - Test Pro purchase: buy → email → signup → all 31 engines visible → pipeline engines openable
   - Test Upgrade: buy as Starter → upgrade → verify Pro tier in Supabase + dashboard
   - Monitor: Supabase `purchases` table, Netlify function logs, Resend email logs
   - Check: Facebook CAPI events in Meta Events Manager

3. **[AFTER TESTING] Revert test prices**
   - `create-order.js`: starter 999, pro 1999, upgrade 1000
   - `index.html`: all data-value attrs + displayed prices
   - `welcome.html`: PRICING.IN config
   - `dashboard.html`: upgrade modal price text

4. **[PENDING] Engine Ratings**
   - Simple thumbs up / thumbs down per engine
   - Store in Supabase (new table: `engine_ratings` with engine_id, user_id, rating)
   - Show aggregate score on engine card
   - Not yet started — design before building

---

### B3. Known Technical Debt

- `gumroad-webhook.js` doesn't receive `fb_event_id` from frontend (Gumroad doesn't support custom metadata in checkout). CAPI deduplication for Gumroad purchases relies on `purchase_gum_{sale_id}` — low risk, acceptable for now.

- `verify-payment.js` returns `SUCCESS` on network error (line 46) to avoid blocking users. This is intentional but means a failed verification still shows success page. The actual source of truth is the webhook, not the verify call.

- Email templates are HTML-in-JS strings inside `cashfree-webhook.js` and `gumroad-webhook.js`. If the same template needs changes, it must be updated in two places. Consider extracting to a shared email module later.

- `panelContentCache` on dashboard is in-memory only (resets on page reload). Not a bug, but means an extra Supabase fetch per page load per engine.

- `welcome.html` still shows "24 engines" in the upgrade strip but total is now 31. Update when owner is ready to advertise the full count.

---

### B4. Contacts & Accounts

- **Support email:** thesaanvihub@gmail.com (all Help & Support modal links go here)
- **Email from:** `hello@forgeai.digital` via Resend API
- **Netlify site name:** ai-conversion-engines
- **Supabase project ID:** hutpurgvhbiouxmqkmpz
- **Production domain:** `www.forgeai.digital`
- **SITE_URL env var:** Must be set to `https://www.forgeai.digital` in Netlify before launch

---

### B5. Engine Inventory (as of 2026-04-12) — 31 Total

**Writing & Content (category: content)** — sort 1–4
- copy-forge, email-forge, seo-forge, social-forge

**Marketing & Ads (category: social)** — sort 5–8, 21–22
- ad-forge, page-forge, marketing-forge, ig-forge, fb-tracking, google-tracking

**Visual & Video (category: visual)** — sort 9–11
- cinematic-ai, pixel-ai, music-forge

**Business & Strategy (category: business)** — sort 12–20
- business-forge, conversionos (E0), pipeline-e1, pipeline-e2, pipeline-e3, pipeline-e4, pipeline-e5, pipeline-e6, pipeline-e7

**AI Productivity (category: exclusive)** — sort 23–26
- prompt-forge, diagnostic-forge, content-idea-forge, decision-forge

**Personal & Career (category: career)** — sort 27–31
- resume-forge, client-forge, offer-forge, focus-forge, skill-roadmap-forge

---

### B6. What Was Done in Sessions 3 & 4 (2026-04-12)

**Session 3 — Engine Overhaul + Dashboard UX:**
- Renamed 6 Supabase categories (kept IDs, updated display names/icons/colors)
- Updated all 14 existing engine names, taglines, category assignments
- Inserted 10 new engines into Supabase + seeded empty content_items
- `admin-write.js`: `last_updated` now auto-stamps on ANY field change (not just update_notes)
- `dashboard.html`: Old copy disclaimer toast → replaced with blocking disclaimer modal (requires checkbox + agree before engine opens). "Don't show again" → `forgeai_disclaimer_v2` localStorage
- `dashboard.html`: Added sticky scrolling disclaimer ticker above topbar
- `dashboard.html`: Mobile bottom-sheet pattern for both modals, mobile layout fixes
- `welcome.html`: Updated to show all 24 engines (4 Starter + 20 Pro locked), updated unlock loop IDs

**Session 4 — Pipeline Engines Split + Guide Rewrite:**
- `conversionos` updated → Pipeline Engine 0 — Intelligent Router (new tagline, use_cases, badge)
- sort_order of engines 14+ shifted up by 7 to make room
- 7 new individual pipeline engines inserted (pipeline-e1 through pipeline-e7, sort 14–20)
- Empty content_items seeded for all 7 new engines
- Total engines in Supabase: **31**
- Pipeline guide in `dashboard.html` completely rewritten in simple everyday language (10th grade level)
- Each engine explained with "What it does" + "You get", Foundation Block explained simply, 9-step guide, Engine 7 warning highlighted

---

### B7. Previous Sessions (For Reference)

**Sessions 1 & 2 — 2026-03-28:** See `PROJECT_STATUS.md` Session Log (Sections 15) for full details. Key: auth pages brand color fixes, domain migration, forgot-password critical bug fix, payment flow split (upgrade vs new purchase), email template redesign.
