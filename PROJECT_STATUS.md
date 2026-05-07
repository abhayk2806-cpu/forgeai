# ForgeAI — Project Status & External Memory
> **Last updated:** 2026-04-12 (Sessions 3 & 4)
> **Purpose:** Live project memory. Read this before doing ANY work on this codebase.

---

## ⚠️ COWORK INSTRUCTION BLOCK
*Read this first. Every time. No exceptions.*

- **Before ANY code change:** Read the relevant file(s) in full. Never edit blind.
- **Before ANY Supabase operation:** Confirm the table, column, and RLS implications.
- **Test prices are ACTIVE.** Do NOT launch at current prices. Real prices listed in Section 7.
- **Engine content is EMPTY.** All 14 engine prompts need to be filled via admin panel before launch.
- **Never delete data from Supabase without explicit owner instruction.**
- **All file edits go to `/sessions/.../repo_clone/` first**, then push via Git to Netlify.
- **Netlify auto-deploys** on every push to `main` branch.
- **Admin panel** is at `/admin/index.html` — password-protected. Not linked publicly.
- **When in doubt, ask before implementing.** Irreversible actions (Supabase deletes, Netlify deploys) require confirmation.
- **Engine content is EMPTY.** All 31 engine prompts need to be filled via admin panel before launch (8 pipeline engines + 23 others).
- **Pipeline engines are now INDIVIDUAL entries.** Engine 0 = `conversionos`, Engines 1–7 = `pipeline-e1` through `pipeline-e7`. All in Business & Strategy category, sort 13–20.

---

## 1. Project Overview

**ForgeAI** is a SaaS product that sells structured AI prompt systems ("engines") that transform Claude.ai into specialist AI agents for business and marketing tasks.

- **Domain:** `www.forgeai.digital` (production) ← UPDATED from aiconversionengine.io
- **Staging URL:** `https://ai-conversion-engines.netlify.app`
- **Hosting:** Netlify (static site + serverless functions)
- **Database:** Supabase (PostgreSQL)
- **Payment — India:** Cashfree (INR)
- **Payment — International:** Gumroad (USD)
- **Email:** Resend API (transactional emails via `hello@forgeai.digital`) ← UPDATED from onboarding@resend.dev
- **Analytics:** Facebook Pixel + Conversions API (CAPI)
- **Auth:** Supabase Auth (email + password)

### Product Tiers
| Tier | India Price | USD Price | Access |
|------|------------|-----------|--------|
| Starter | ₹999 | $37 | 4 engines (Copy Forge, Email Forge, Social Forge, Music Forge) |
| Pro | ₹1,999 | $67 | All 31 engines including all 8 Pipeline engines + all future engines |
| Upgrade | ₹1,000 | $30 | Starter → Pro upgrade |

> ⚠️ **CURRENT TEST PRICES (India only):** Starter ₹2, Pro ₹5, Upgrade ₹3. Must revert before public launch. See Section 7.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (no framework) |
| Backend | Netlify Serverless Functions (Node.js) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Auth | Supabase Auth (`@supabase/supabase-js`) |
| Payments (IN) | Cashfree Payments API |
| Payments (USD) | Gumroad Webhook |
| Email | Resend API |
| Ads tracking | Facebook Pixel + CAPI (`fb-capi.js`) |
| Deployment | Netlify CI/CD (auto-deploy on git push to main) |

### Supabase Config
- **Project URL:** `https://hutpurgvhbiouxmqkmpz.supabase.co`
- **Anon key:** In `supabase.js` (public, safe — limited RLS access)
- **Service key:** In Netlify environment variables only (never exposed to browser)

---

## 3. File Structure

```
/
├── index.html              ← Public landing page (pricing, checkout)
├── welcome.html            ← Post-signup welcome + feature comparison table
├── login.html              ← Auth: login
├── signup.html             ← Auth: signup with license key validation
├── forgot-password.html    ← Auth: forgot password
├── reset-password.html     ← Auth: password reset (email link)
├── dashboard.html          ← MAIN APP: engine browser, guides, ConversionOS pipeline
├── engine-page.html        ← Full engine view (single engine, copy prompt)
├── templates.html          ← Template library (future feature)
├── profile.html            ← User profile + tier info
├── resources.html          ← Learning resources
├── tool-page.html          ← Pro-only tool page (gated)
├── payment-success.html    ← Post-payment success (verifies order, shows instructions)
├── access-denied.html      ← Redirected here if Starter tries to access Pro page
├── contact.html            ← Contact form
├── supabase.js             ← Supabase client init (sets window.supabase)
├── auth.js                 ← Auth guard (runs on every protected page)
├── admin/
│   └── index.html          ← Admin panel (engines, categories, purchases, content)
├── netlify/functions/
│   ├── admin-read.js       ← Read all admin data (service key, password-protected)
│   ├── admin-write.js      ← Write engines/categories (service key, password-protected)
│   ├── admin-save.js       ← Upsert engine prompt content to content_items
│   ├── admin-load.js       ← Load engine prompt content from content_items
│   ├── create-order.js     ← Create Cashfree payment order
│   ├── cashfree-webhook.js ← Handle Cashfree payment success (saves to Supabase, sends email)
│   ├── gumroad-webhook.js  ← Handle Gumroad payment success (saves to Supabase, sends email)
│   ├── verify-payment.js   ← Verify Cashfree order status (called from payment-success.html)
│   └── fb-capi.js          ← Facebook Conversions API (shared utility + Netlify handler)
├── netlify.toml            ← Build config, CSP headers, redirects
└── package.json            ← Node deps (supabase-js only)
```

---

## 4. Database Schema (Supabase)

### `categories`
| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | slug, e.g. `writing`, `pipeline` |
| name | text | Display name |
| icon | text | Emoji |
| color | text | Hex (accent) |
| color_light | text | Hex (background) |
| sort_order | int | Display order |
| is_active | bool | Show/hide |

### `engines`
| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | slug, e.g. `engine-0`, `email-forge` |
| name | text | Display name |
| icon | text | Emoji |
| icon_bg | text | Hex background |
| category_id | text (FK) | References categories.id |
| tier | text | `'starter'` or `'pro'` |
| tagline | text | Short description |
| use_cases | text[] | Array of use case strings |
| badge | text | Optional badge label |
| sort_order | int | Display order |
| is_active | bool | Show/hide |
| last_updated | date | Auto-stamped by admin-write on ANY field change (session 3 fix) |
| update_notes | text | Changelog text shown on dashboard |

### `content_items`
| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | Matches engine.id exactly |
| type | text | Always `'engine'` |
| content | text | The actual AI prompt (can be very long) |
| updated_at | timestamptz | Auto-set on upsert |

> **Status:** 31 total engines have rows. All content is EMPTY — must be filled via admin panel before launch.
> Engine count breakdown: 14 original + 10 new (fb-tracking, google-tracking, prompt-forge, diagnostic-forge, content-idea-forge, decision-forge, client-forge, offer-forge, focus-forge, skill-roadmap-forge) + 7 new pipeline individual engines (pipeline-e1 through pipeline-e7). `conversionos` updated to be Pipeline Engine 0.

### `purchases`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Auto-generated |
| email | text | Buyer email |
| license_key | text | Format: `FRG-PRO-XXXXX` or `FRG-STR-XXXXX` |
| tier | text | `'starter'` or `'pro'` |
| currency | text | `'INR'` or `'USD'` |
| amount_paid | numeric | Actual amount charged |
| payment_gateway | text | `'cashfree'` or `'gumroad'` |
| order_id | text | Cashfree order_id or Gumroad sale_id |
| used | bool | Whether license key was used at signup |
| user_id | uuid | Linked after signup (nullable until then) |
| created_at | timestamptz | Auto-generated |

### RLS Policy Summary
- `categories` + `engines`: Public SELECT, no public write
- `content_items`: Protected — anon can SELECT (engine prompts are subscriber-only via auth gating in JS), no public write
- `purchases`: Protected — users can read own row by user_id, no public access
- All writes via service key through Netlify functions only

---

## 5. Auth Flow

1. User buys → license key emailed → goes to `/signup.html`
2. Signup validates license key against `purchases.license_key` (anon RLS select) → creates Supabase Auth user → links `purchases.user_id`
3. Every protected page loads `supabase.js` then `auth.js`
4. `auth.js` reads session, fetches tier from `purchases` (by `user_id` first, then `email` fallback)
5. Sets `window.COSU = { id, email, tier, isPro, session }`
6. Pages use `window.COSU.isPro` to show/hide Pro content

### Page Access Rules (defined in `auth.js`)
| Page | Rule |
|------|------|
| login.html, forgot-password.html, reset-password.html | `public` (always accessible) |
| dashboard.html, engine-page.html, templates.html, etc. | `any` (any logged-in user) |
| tool-page.html | `pro` (Pro only, redirects others to access-denied.html) |

---

## 6. Payment Flows

### India (Cashfree)
1. **Frontend** generates `fb_event_id`, sends POST to `/.netlify/functions/create-order`
2. `create-order.js` creates Cashfree order, returns `paymentSessionId`
3. **Frontend** opens Cashfree checkout modal
4. **Cashfree** calls webhook: `/.netlify/functions/cashfree-webhook`
5. `cashfree-webhook.js`:
   - Verifies HMAC signature
   - Checks for duplicate order_id
   - Detects tier from `order_note` string ("starter"/"pro"/"upgrade")
   - Generates license key (`FRG-PRO-XXXXX` or `FRG-STR-XXXXX`)
   - Saves to `purchases` table
   - Sends welcome email via Resend
   - Fires Facebook CAPI Purchase event

> **IMPORTANT — Tier fallback risk with test prices:** The final fallback in webhook is `amount >= 1800 ? 'pro' : 'starter'`. With test prices (₹2/₹5), this would always return 'starter'. However, the `order_note` detection fires first (`includes('pro')` / `includes('starter')`), so this fallback is never reached as long as `order_note` is set correctly (it always is via `create-order.js`).

### International (Gumroad)
1. User buys on Gumroad product page directly
2. Gumroad calls webhook: `/.netlify/functions/gumroad-webhook`
3. `gumroad-webhook.js`:
   - Matches product permalink to tier (via `PRODUCT_PLAN_MAP`)
   - Checks for duplicate sale_id
   - Generates license key
   - Saves to `purchases`
   - Sends welcome email
   - Fires Facebook CAPI Purchase event

### Upgrade Flow
- Both webhook handlers support `tier === 'upgrade'`
- Updates ALL `purchases` rows for that email to `tier: 'pro'`
- Also updates Supabase Auth `user_metadata.tier` to `'pro'`
- Sends upgrade email

### Post-Payment Redirects (Fixed Session 2)
| Scenario | On Success | On Cancel/Fail |
|----------|-----------|----------------|
| New purchase (Starter/Pro) | `/payment-success.html?plan=starter/pro` | `/#pricing` |
| Upgrade | `/payment-success.html?plan=upgrade` | `/dashboard.html` |

- `payment-success.html` detects `plan=upgrade` from URL params
- Shows "You're now Pro!" UI + "Open Dashboard" button for upgrades
- Shows "Payment Successful!" + "Create Account" button for new purchases
- `?preview=1` mode available to skip verification for UI review
- Cancel URL set conditionally in `create-order.js`: upgrades → `/dashboard.html`, others → `/#pricing`

---

## 7. ⚠️ CRITICAL: Test Prices — Must Revert Before Launch

Test prices were set for internal testing only (India-only). Production prices must be restored.

### Files to Update:

**`netlify/functions/create-order.js`** (line 52-55):
```js
// CURRENT (test):
starter: { amount: 2,    label: 'ForgeAI Starter Plan' },
pro:     { amount: 5,    label: 'ForgeAI Pro Plan' },
upgrade: { amount: 3,    label: 'ForgeAI Upgrade Starter to Pro' },

// RESTORE TO:
starter: { amount: 999,  label: 'ForgeAI Starter Plan' },
pro:     { amount: 1999, label: 'ForgeAI Pro Plan' },
upgrade: { amount: 1000, label: 'ForgeAI Upgrade Starter to Pro' },
```

**`index.html`** — Update all INR `data-value` attributes and displayed prices:
- Starter: `data-value="2"` → `data-value="999"`, displayed `₹2` → `₹999`
- Pro: `data-value="5"` → `data-value="1999"`, displayed `₹5` → `₹1,999`
- Upgrade: `data-value="3"` → `data-value="1000"`, displayed `₹3` → `₹1,000`

**`welcome.html`** — Update `PRICING.IN` config object:
```js
// RESTORE TO:
const PRICING = { IN: { core: 999, complete: 1999, upgrade: 1000 } ... }
```

**`dashboard.html`** — Update upgrade modal price display text from ₹3 → ₹1,000 and ₹5 → ₹1,999.

> Testing planned for April 1, 2026 (when Netlify function invocation limit resets).
> After testing confirms full flow works, immediately revert all test prices.

---

## 8. Admin Panel

**URL:** `/admin/index.html`
**Auth:** Password via `x-admin-password` header (`ADMIN_PASSWORD` env var, default: `ForgeAI@Admin2025`)
**Change the default password in Netlify env vars before launch.**

### Admin Capabilities
- **Engines tab:** Add, edit, delete, toggle active/inactive engines. Includes: name, icon, icon_bg, category, tier, tagline, use cases, badge, sort_order, update_notes, last_updated.
- **Categories tab:** Add, delete categories.
- **Content tab:** Select engine → write/paste prompt → save to `content_items`.
- **Purchases tab:** View all purchase records.

### Admin Functions
| Function | Route |
|----------|-------|
| admin-read.js | `GET /.netlify/functions/admin-read` |
| admin-write.js | `POST /.netlify/functions/admin-write` |
| admin-save.js | `POST /.netlify/functions/admin-save` |
| admin-load.js | `GET /.netlify/functions/admin-load` |

---

## 9. Dashboard Architecture

`dashboard.html` is a single-page app with three views:
- `viewDashboard` — Home: tier overview, featured engines, ConversionOS Pipeline section
- `viewEngines` — Full engine grid, filterable by category
- `viewGuides` — Step-by-step guides including pipeline walkthrough

### Key Functions
| Function | Purpose |
|----------|---------|
| `init()` | Bootstrap: fetch engines + categories, apply tier, show onboarding |
| `applyTier()` | Lock/unlock engines based on `window.COSU.tier` |
| `showView(view)` | Switch between dashboard/engines/guides views |
| `updateStats()` | Recalculate and display engine counts |
| `renderEngineCard(engine)` | Build individual engine card HTML |
| `openModal(id)` | Shows disclaimer modal first, then calls `_openModalActual(id)` |
| `_openModalActual(id)` | Original openModal logic — opens engine preview modal |
| `showDisclaimerModal(engineName, callback)` | Shows blocking disclaimer modal before any engine opens |
| `disclaimerCheckChanged()` | Enables/disables "I Agree" button based on checkbox state |
| `disclaimerAgree()` | Handles agree action — saves skip pref if checked, fires callback |
| `copyEngineFromModal()` | Copy prompt from modal |
| `copyEngineFromPanel()` | Copy prompt from side panel |
| `showCopyDisclaimer()` | No-op shim for backward compat (disclaimer is now pre-open, not post-copy) |
| `maybeShowOnboarding()` | Show 4-step onboarding overlay on first login |
| `toggleUpdateNotes(safeId)` | Expand/collapse engine changelog strip |

### Global State
- `window.COSU` — Auth + tier object (set by auth.js)
- `window.supabase` — Supabase client (set by supabase.js)
- `panelContentCache` — Object caching engine prompt content (only caches real content, not fallback strings starting with `[`)

### localStorage Keys
| Key | Value | Purpose |
|-----|-------|---------|
| `forgeai_onboarded_v1` | `'true'` | Gates 4-step onboarding overlay (shown once) |
| `forgeai_disclaimer_v2` | `'skip'` | Skip disclaimer modal for all future engine opens |

### Dashboard UI Elements Added (Session 3)
- **Disclaimer ticker** — sticky strip above topbar, infinite scroll animation, always-visible legal warning
- **Disclaimer modal** — blocking modal that fires before any engine opens. Has: engine name in header, explanation text, "I understand" checkbox (must check to enable agree button), "Don't show again" checkbox, "I Agree — Continue" button
- Both the engine preview modal and disclaimer modal use **mobile bottom-sheet** pattern on screens ≤768px

---

## 10. Facebook CAPI & Tracking

**Events tracked:**
| Event | Trigger | Source |
|-------|---------|--------|
| Purchase | Cashfree webhook success | cashfree-webhook.js |
| Purchase | Gumroad webhook success | gumroad-webhook.js |
| InitiateCheckout | User clicks buy button | frontend → fb-capi.js handler |
| Lead | User submits lead form | frontend → fb-capi.js handler |
| CompleteRegistration | Signup success | frontend → fb-capi.js handler |
| PageView | Landing page visit | frontend → fb-capi.js handler |

**Deduplication:** Frontend generates `fb_event_id` UUID before calling any event. Same ID passed to both Pixel (browser) and CAPI (server). Meta deduplicates automatically.

**PII handling:** All PII (email, phone, name) is SHA-256 hashed before sending to Meta. Phone numbers are digit-stripped before hashing (Meta requirement).

---

## 11. Current Feature Status

### ✅ Completed & Live
- [x] Landing page (`index.html`) with pricing, checkout
- [x] Auth flow (signup with license key, login, forgot/reset password)
- [x] Dashboard with three-view architecture
- [x] Engine grid with Starter/Pro tier gating
- [x] Admin panel (full CRUD for engines, categories, content)
- [x] Cashfree payment integration (India)
- [x] Gumroad payment integration (International)
- [x] Welcome email via Resend
- [x] Facebook CAPI tracking
- [x] ConversionOS Pipeline guide — fully rewritten in simple language (Session 4)
- [x] Engine 0 featured as "START HERE" with visual prominence
- [x] Help & Support floating button on all 5 portal pages
- [x] **Disclaimer modal** — blocks engine open, requires checkbox + agree button. "Don't show again" option stored in `forgeai_disclaimer_v2` localStorage (Session 3)
- [x] **Disclaimer ticker** — sticky always-scrolling warning strip in dashboard header (Session 3)
- [x] Engine last_updated + update_notes system — now auto-stamps on ANY field change (Session 3)
- [x] First-time user onboarding overlay (4-step, localStorage-gated, replayable)
- [x] **welcome.html** — Updated to show all 24 engines (4 Starter + 20 Pro locked rows) with corrected unlock loop (Session 3)
- [x] **6 categories** renamed: Writing & Content, Marketing & Ads, Visual & Video, Business & Strategy, AI Productivity, Personal & Career (Session 3, Supabase only)
- [x] **14 existing engines** — names, taglines, category assignments all updated in Supabase (Session 3)
- [x] **10 new engines** seeded in Supabase: fb-tracking, google-tracking, prompt-forge, diagnostic-forge, content-idea-forge, decision-forge, client-forge, offer-forge, focus-forge, skill-roadmap-forge (Session 3)
- [x] **8 Pipeline engines** — now individual Supabase entries (Engine 0 updated, E1–E7 inserted), each available for content via admin panel (Session 4)
- [x] **Pipeline guide** — rewritten in plain, simple language — usable by a first-time user with no marketing knowledge (Session 4)
- [x] `content_items` rows seeded for all 31 engines (empty — needs filling)
- [x] **payment-success.html** — Separate upgrade vs new purchase UI, preview mode added
- [x] **create-order.js** — Conditional cancel URL (upgrade→dashboard, new→pricing), domain updated
- [x] **welcome.html** — Critical tier bug fixed (`complete` → `pro` in `applyTier()`), `fb_event_id` added to upgrade checkout
- [x] **login.html** — Brand color fixed: `#1A1A1A` → `#F97316` throughout, tagline updated
- [x] **signup.html** — Brand color fixed, card titles rewritten for post-purchase clarity
- [x] **forgot-password.html** — CRITICAL BUG FIXED: was a fake simulation, now calls real Supabase `resetPasswordForEmail()`; Supabase scripts were missing entirely, now added
- [x] **reset-password.html** — Logo mark and input focus colors updated to orange
- [x] **access-denied.html** — Rebranded to "Pro Access Required", upgrade CTA added, brand color fixed
- [x] **cashfree-webhook.js** — Domain updated, email `from` updated, accessInfo copy updated, email CTA button orange, upgrade email completely redesigned
- [x] **gumroad-webhook.js** — Same as above
- [x] **SITE_URL fallback** — All functions now default to `https://www.forgeai.digital`

### ⏳ Pending / Not Yet Done
- [ ] **Engine content** — All 31 engine prompts are empty. Owner must fill via Admin Panel → Content tab before selling.
- [ ] **Test price revert** — Do after April 1, 2026 testing (testing delayed — prices still at ₹2/₹5/₹3)
- [ ] **Engine ratings** — Simple thumbs up/down per engine (discussed, not built)
- [ ] **Testing complete flow** — End-to-end: buy → email → signup → dashboard → copy engine → paste to Claude
- [ ] **Admin password change** — Change from default `ForgeAI@Admin2025` before launch
- [ ] **Custom domain DNS** — Connect `www.forgeai.digital` in Netlify → update DNS in domain registrar, verify SSL
- [ ] **Netlify SITE_URL env var** — Must be set to `https://www.forgeai.digital` in Netlify dashboard before launch

### 🔮 Future / Parked
- [ ] Claude Plugin/Skills conversion (when Anthropic opens web plugin ecosystem)
- [ ] Template library (templates.html currently empty)
- [ ] Community/forum (no timeline)

---

## 12. Environment Variables (Netlify)

| Variable | Used In | Notes |
|----------|---------|-------|
| `SUPABASE_URL` | All functions | Project URL |
| `SUPABASE_SERVICE_KEY` | All functions | Service role key — bypasses RLS |
| `ADMIN_PASSWORD` | admin-read, admin-write, admin-save, admin-load | Default: `ForgeAI@Admin2025` — CHANGE THIS |
| `CASHFREE_APP_ID` | create-order, verify-payment | Cashfree API credentials |
| `CASHFREE_SECRET_KEY` | create-order, verify-payment | Cashfree API credentials |
| `CASHFREE_WEBHOOK_SECRET` | cashfree-webhook | HMAC signature verification |
| `CASHFREE_ENV` | create-order, verify-payment | `'PROD'` or `'SANDBOX'` |
| `RESEND_API_KEY` | cashfree-webhook, gumroad-webhook | Email sending |
| `SITE_URL` | cashfree-webhook, gumroad-webhook | Return URL base |
| `FB_PIXEL_ID` | fb-capi | Meta Pixel ID |
| `FB_CAPI_TOKEN` | fb-capi | Meta CAPI Access Token |
| `FB_TEST_EVENT_CODE` | fb-capi | Optional — for testing in Events Manager |

---

## 13. Risk Register

| Risk | Severity | Status |
|------|---------|--------|
| Test prices live in production | HIGH | Active — revert after testing |
| Engine content is empty | HIGH | Active — fill before selling |
| Admin password is default | MEDIUM | Active — change before launch |
| SITE_URL env var not set in Netlify | MEDIUM | Active — must set to `https://www.forgeai.digital` before launch |
| Custom domain not yet connected | MEDIUM | Active — connect domain in Netlify, update DNS |
| Cashfree tier detection fallback breaks with test prices | LOW | Mitigated — order_note detection fires first |
| Supabase anon key in public JS (supabase.js) | LOW | Acceptable — anon key is limited by RLS; service key is server-only |
| Gumroad doesn't pass frontend fb_event_id | LOW | Known — uses `purchase_gum_{sale_id}` as eventId, low duplicate risk |

---

## 14. Key Decisions Made

1. **No comment/rating system yet** — Ratings (thumbs up/down) discussed and accepted; not yet built. Comments rejected as too complex for current phase.

2. **No Claude Skills conversion yet** — Current Claude Skills are CLI/developer tools, not Claude.ai web. Decision: park until Anthropic opens web plugin ecosystem. Engines are already structured correctly to convert when ready.

3. **Onboarding overlay instead of email sequence** — Gap 1 (users don't know how to activate engines) solved with 4-step in-app overlay, not email. Triggered once via localStorage, replayable from sidebar.

4. **welcome.html plan names** — "Core" and "Complete" replaced with "Starter" and "Pro" everywhere to eliminate naming confusion.

5. **Engine update date now auto-stamped on ANY field change** — Changed in Session 3. `last_updated` is updated in `admin-write.js` whenever any field is edited, not just when `update_notes` changes. Previous note about "meaningful changes only" is outdated.

6. **Copy disclaimer is global, not per-engine** — Hooked into the two copy functions (`copyEngineFromModal`, `copyEngineFromPanel`), not into each engine individually. Works for all current and future engines automatically.

7. **Admin panel is not linked publicly** — Access via direct URL only. No nav link from portal pages.

8. **`panelContentCache` doesn't cache fallback strings** — Cache only stores real content (strings not starting with `[`), preventing stale fallback text from persisting across sessions.

9. **Separate success pages for upgrade vs new purchase** — `payment-success.html` uses URL param `plan=upgrade` to detect and show distinct UI: "You're now Pro!" + Open Dashboard (upgrade) vs "Payment Successful!" + Create Account (new purchase). This prevents confusion where upgrading users were shown the signup flow.

10. **Domain migrated to `www.forgeai.digital`** — All code fallbacks, email `from` address, and Resend sender updated. `SITE_URL` Netlify env var must be updated manually before launch to match.

11. **`forgot-password.html` was silently broken since launch** — The submit handler was a fake 1200ms setTimeout simulation. No email was ever sent. Supabase scripts were missing too. Both fixed. Passwords can now actually be reset.

---

## 15. Session Log

### Session 1 — 2026-03-28
- Added `last_updated` + `update_notes` to engines table
- Seeded all 14 engines with default values
- Updated admin-write.js auto-stamp logic
- Added onboarding overlay (4-step, localStorage-gated)
- Added Help & Support floating button on all 5 portal pages
- Added copy disclaimer toast to dashboard copy functions
- Added ConversionOS Pipeline guide (E0-E7) to dashboard
- Engine 0 featured with "START HERE" badge
- Seeded content_items rows for engine-0 through engine-7 (empty)
- Set test prices: ₹2 / ₹5 / ₹3
- Updated welcome.html plan names (Core→Starter, Complete→Pro)

### Session 2 — 2026-03-28
**Domain & Email:**
- Production domain changed: `aiconversionengine.io` → `www.forgeai.digital`
- Email sender changed: `onboarding@resend.dev` → `hello@forgeai.digital`
- All SITE_URL fallbacks in serverless functions updated

**Payment Flow Fixes:**
- `payment-success.html`: Added separate `#upgrade-state` div, JS detects `plan=upgrade` URL param, shows appropriate UI
- `create-order.js`: `cancel_url` now conditional — upgrades → `/dashboard.html`, new purchases → `/#pricing`
- `payment-success.html`: Added `?preview=1` mode to skip verification for design review

**welcome.html Bug Fix:**
- `applyTier()` was checking `t === 'complete'` — Pro users saw Starter UI. Fixed to `t === 'pro'`
- Removed orphaned `const tier = 'core'` placeholder
- Added `fb_event_id` to upgrade checkout `submitCheckout()` call

**Auth Pages — Brand Color Fix (all pages had black `#1A1A1A` instead of orange `#F97316`):**
- `login.html`: `--accent`, `--accent-hover`, `--input-focus`, focus shadow, logo shadow → orange; tagline rewritten
- `signup.html`: Same color changes; card title → "Activate Your Access"; subtitle → post-purchase focused copy
- `forgot-password.html`: Same color changes
- `reset-password.html`: Logo mark + input focus → orange

**forgot-password.html Critical Fix:**
- Supabase scripts were completely absent — page was broken
- Submit handler was a fake 1200ms setTimeout simulation — no email was ever sent
- Fixed: Added Supabase scripts, implemented real `supabase.auth.resetPasswordForEmail()` call with `redirectTo: https://www.forgeai.digital/reset-password.html`
- Resend button also fixed to call Supabase properly

**access-denied.html Rebrand:**
- H1: "Access Denied" → "Pro Access Required"
- Copy updated to highlight Pro value
- Primary button: "Go to Login" → "Upgrade to Pro →" (links to /dashboard.html)
- Secondary: "Back to Dashboard" → "Sign In"
- Button color: `#1A1A1A` → `#F97316`

**Email Templates (cashfree-webhook.js + gumroad-webhook.js):**
- Email CTA button: `background:#1A1A1A` → `background:#F97316`
- `accessInfo` for Pro: updated to "All engines + ConversionOS Pipeline (8 specialist engines) + every future engine, forever"
- `accessInfo` for Starter: updated to "4 Starter engines — EmailForge, CopyForge, SocialForge, MusicForge"
- Upgrade email: completely redesigned with proper branded HTML template

---

### Session 3 — 2026-04-12 (Part 1)

**Supabase — Engine & Category Overhaul:**
- Renamed all 6 categories: Writing & Content, Marketing & Ads, Visual & Video, Business & Strategy, AI Productivity, Personal & Career (kept same IDs, only updated display names/icons/colors)
- Updated all 14 existing engines with new names, taglines, and correct category assignments
- Inserted 10 new engines: `fb-tracking`, `google-tracking` (Marketing & Ads), `prompt-forge`, `diagnostic-forge`, `content-idea-forge`, `decision-forge` (AI Productivity), `client-forge`, `offer-forge`, `focus-forge`, `skill-roadmap-forge` (Personal & Career)
- Created empty `content_items` rows for all 10 new engines

**admin-write.js:**
- Fixed: `last_updated` now auto-stamped on ANY field change during engine update, not only when `update_notes` is present

**dashboard.html — Disclaimer System Overhaul:**
- Removed old post-copy toast, replaced with blocking disclaimer modal that fires when user clicks an engine card (before it opens)
- Modal requires checking "I understand" checkbox before "I Agree" button becomes clickable
- "Don't show this again" option saves `forgeai_disclaimer_v2 = 'skip'` to localStorage
- `openModal(id)` now calls `showDisclaimerModal()` first, then `_openModalActual(id)` as callback
- `showCopyDisclaimer()` kept as no-op shim for backward compatibility

**dashboard.html — Disclaimer Ticker:**
- Sticky always-scrolling warning strip at top of dashboard
- 4 repeated disclaimer spans for seamless infinite loop via CSS `tickerScroll` animation
- Topbar z-index updated 50 → 99 (ticker is z-index 200)

**dashboard.html — Mobile Fixes:**
- Both engine preview modal and disclaimer modal use bottom-sheet pattern on ≤768px
- Mobile fixes for guide-nav, engine panel, buttons

**welcome.html — 24 Engines:**
- Replaced 10-item list with all 24 engines (4 Starter unlocked + 20 Pro locked)
- Row IDs: `tool-row-pro-1` through `tool-row-pro-20`
- `applyTier()` updated to loop pro-1 to pro-20
- Upgrade strip: "13+ engines" → "24 engines"

---

### Session 4 — 2026-04-12 (Part 2)

**Supabase — Pipeline Engines Split Into Individual Entries:**
- `conversionos` updated → "Pipeline Engine 0 — Intelligent Router"
- Shifted sort_order of all engines at 14+ up by 7 to make room
- Inserted 7 new individual pipeline engines: `pipeline-e1` through `pipeline-e7` (sort 14–20)
- Empty `content_items` rows created for all 7 new pipeline engines
- **Total engines in Supabase: 31** (all empty — must fill via admin panel before launch)

**dashboard.html — Pipeline Guide Rewrite:**
- Entire pipeline guide rewritten in plain everyday language (10th grade level)
- Each engine has "What it does" + "You get" in simple terms
- Foundation Block explained with a simple analogy
- Step-by-step now has 9 concrete steps
- Engine 7 visually marked in red/warning so users don't run it prematurely
- Added "Not sure? Just run Engine 0" callout at end

---

### Session 5 — 2026-05-07

**Pipeline Home Section (dashboard.html):**
- Added dedicated `#dashPipelineSection` HTML block on dashboard home view
- 8 pipeline engines now render in horizontal scrollable track (E0–E7) in fixed order
- `renderPipelineSection()` function added — pulls engines by ID, not sort_order
- Starter users see locked overlay on E1–E7, Pro users see all unlocked
- E0 has special gradient card + "⭐ START" badge
- CSS added: `.pipeline-home`, `.pipe-card`, `.pipe-locked-overlay`, `.pipe-start-badge`, etc.
- Stats card updated: 24 → 31 engines

**Landing Page Copy Overhaul (index.html):**
- All "23 engines" references → "31 engines" across hero, CTA, pricing, FAQ
- Hero h1 rewritten: new hook focused on output quality vs AI-sounding text
- Pro pricing features restructured by category (Marketing, Tracking, AI Productivity, Business & Career, Pipeline)
- Pipeline section description rewritten — explains WHY connected engines matter
- All 8 pipeline flow cards updated with proper names and descriptions

**Lead Magnet Email System:**
- `engines/copy-forge.txt` added to repo — full Copy Forge engine served as static file at `/engines/copy-forge.txt`
- `netlify/functions/save-lead.js` updated — now sends Resend email after Supabase save
- Email includes: branded HTML template, download button linking to engine file, 3-step usage guide (Claude Projects + ChatGPT), soft upgrade CTA
- Email is non-blocking — Supabase save succeeds even if Resend fails
- Committed and pushed: `feat: lead magnet email system — Copy Forge engine delivery on signup`

**Social Media Strategy Folder Created:**
- `/ForgeAI-Workspace/social-media-strategy/` — new dedicated folder, separate from dev workspace
- `business-context.md` — comprehensive business context file for content/social media sessions
- `testimonial-request-templates.md` — 3 WhatsApp/email templates for collecting real customer testimonials post-purchase, with editing guide and display format options

**Memory & Session Protocol:**
- `.claude/CLAUDE.md` updated — now has mandatory SESSION START PROTOCOL (read PROJECT_STATUS.md + CLAUDE.md every session) and AFTER EVERY ACTION rule (update PROJECT_STATUS.md immediately after each change)
- `ForgeAI-Workspace/CLAUDE.md` — A1 rule updated with auto-update requirement and business-context.md read rule
