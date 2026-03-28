# ForgeAI — Project Status & External Memory
> **Last updated:** 2026-03-28
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

---

## 1. Project Overview

**ForgeAI** is a SaaS product that sells structured AI prompt systems ("engines") that transform Claude.ai into specialist AI agents for business and marketing tasks.

- **Domain:** `aiconversionengine.io` (production)
- **Staging URL:** `https://ai-conversion-engines.netlify.app`
- **Hosting:** Netlify (static site + serverless functions)
- **Database:** Supabase (PostgreSQL)
- **Payment — India:** Cashfree (INR)
- **Payment — International:** Gumroad (USD)
- **Email:** Resend API (transactional emails via `onboarding@resend.dev`)
- **Analytics:** Facebook Pixel + Conversions API (CAPI)
- **Auth:** Supabase Auth (email + password)

### Product Tiers
| Tier | India Price | USD Price | Access |
|------|------------|-----------|--------|
| Starter | ₹999 | $37 | 4 engines (EmailForge, CopyForge, SocialForge, MusicForge) |
| Pro | ₹1,999 | $67 | All 11+ engines + ConversionOS Pipeline + all future engines |
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
| last_updated | date | Auto-stamped by admin-write on meaningful update |
| update_notes | text | Changelog text shown on dashboard |

### `content_items`
| Column | Type | Notes |
|--------|------|-------|
| id | text (PK) | Matches engine.id exactly |
| type | text | Always `'engine'` |
| content | text | The actual AI prompt (can be very long) |
| updated_at | timestamptz | Auto-set on upsert |

> **Status:** All 14 engines + 8 pipeline engines (E0-E7) have rows. All content is EMPTY — must be filled via admin panel before launch.

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
| `openEngineModal(engine)` | Show full engine detail + copy prompt |
| `copyEngineFromModal()` | Copy prompt from modal + show disclaimer toast |
| `copyEngineFromPanel()` | Copy prompt from side panel + show disclaimer toast |
| `showCopyDisclaimer(name)` | Display 8-second disclaimer toast with engine name |
| `maybeShowOnboarding()` | Show 4-step onboarding overlay on first login |
| `toggleUpdateNotes(safeId)` | Expand/collapse engine changelog strip |

### Global State
- `window.COSU` — Auth + tier object (set by auth.js)
- `window.supabase` — Supabase client (set by supabase.js)
- `panelContentCache` — Object caching engine prompt content (only caches real content, not fallback strings starting with `[`)

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
- [x] ConversionOS Pipeline guide (E0-E7) with engine cards
- [x] Engine 0 featured as "START HERE" with visual prominence
- [x] Help & Support floating button on all 5 portal pages
- [x] Copy disclaimer toast (fires on every engine copy with dynamic name)
- [x] Engine last_updated + update_notes system (DB columns + admin panel + dashboard strip)
- [x] First-time user onboarding overlay (4-step, localStorage-gated, replayable)
- [x] welcome.html updated — Starter/Pro plan names throughout
- [x] `content_items` rows seeded for engine-0 through engine-7

### ⏳ Pending / Not Yet Done
- [ ] **Engine content** — All 14 engine prompts are empty. Must fill via admin panel before selling.
- [ ] **Test price revert** — Do after April 1, 2026 testing
- [ ] **Engine ratings** — Simple thumbs up/down per engine (discussed, not built)
- [ ] **Testing complete flow** — End-to-end: buy → email → signup → dashboard → copy engine → paste to Claude
- [ ] **Admin password change** — Change from default before launch
- [ ] **Custom domain DNS** — Verify `aiconversionengine.io` fully propagated and SSL active

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
| Cashfree tier detection fallback breaks with test prices | LOW | Mitigated — order_note detection fires first |
| Supabase anon key in public JS (supabase.js) | LOW | Acceptable — anon key is limited by RLS; service key is server-only |
| Gumroad doesn't pass frontend fb_event_id | LOW | Known — uses `purchase_gum_{sale_id}` as eventId, low duplicate risk |

---

## 14. Key Decisions Made

1. **No comment/rating system yet** — Ratings (thumbs up/down) discussed and accepted; not yet built. Comments rejected as too complex for current phase.

2. **No Claude Skills conversion yet** — Current Claude Skills are CLI/developer tools, not Claude.ai web. Decision: park until Anthropic opens web plugin ecosystem. Engines are already structured correctly to convert when ready.

3. **Onboarding overlay instead of email sequence** — Gap 1 (users don't know how to activate engines) solved with 4-step in-app overlay, not email. Triggered once via localStorage, replayable from sidebar.

4. **welcome.html plan names** — "Core" and "Complete" replaced with "Starter" and "Pro" everywhere to eliminate naming confusion.

5. **Engine update date auto-stamped only on meaningful changes** — `last_updated` is only updated in `admin-write.js` when `update_notes` is also being changed. Prevents false "recently updated" signals.

6. **Copy disclaimer is global, not per-engine** — Hooked into the two copy functions (`copyEngineFromModal`, `copyEngineFromPanel`), not into each engine individually. Works for all current and future engines automatically.

7. **Admin panel is not linked publicly** — Access via direct URL only. No nav link from portal pages.

8. **`panelContentCache` doesn't cache fallback strings** — Cache only stores real content (strings not starting with `[`), preventing stale fallback text from persisting across sessions.
