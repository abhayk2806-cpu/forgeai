/**
 * ═══════════════════════════════════════════════════════════
 * ForgeAI — Facebook Conversions API (CAPI)
 * File: netlify/functions/fb-capi.js
 *
 * EVENTS TRACKED:
 *  - Purchase          → cashfree-webhook.js, gumroad-webhook.js
 *  - InitiateCheckout  → frontend pixel-events.js
 *  - Lead              → frontend pixel-events.js
 *  - PageView          → Opus landing page
 *  - CompleteRegistration → signup success
 *
 * DEDUPLICATION:
 *  - Frontend generates unique eventId
 *  - Same eventId sent to Pixel (browser) + CAPI (server)
 *  - Facebook deduplicates automatically
 *
 * ENV VARS REQUIRED:
 *  FB_PIXEL_ID         — Meta Pixel ID
 *  FB_CAPI_TOKEN       — CAPI Access Token
 *  FB_TEST_EVENT_CODE  — (optional) for testing in Events Manager
 * ═══════════════════════════════════════════════════════════
 */

const crypto = require('crypto');

const PIXEL_ID        = process.env.FB_PIXEL_ID;
const CAPI_TOKEN      = process.env.FB_CAPI_TOKEN;
const TEST_EVENT_CODE = process.env.FB_TEST_EVENT_CODE; // optional
const API_VERSION     = 'v21.0'; // Latest stable Graph API version

// ══════════════════════════════════════════════════════════
// SHA-256 HASH HELPER
// Meta requires all PII to be hashed before sending
// Format: lowercase → trim → sha256
// ══════════════════════════════════════════════════════════
function hash(value) {
  if (!value) return undefined;
  return crypto
    .createHash('sha256')
    .update(value.toString().toLowerCase().trim())
    .digest('hex');
}

// ══════════════════════════════════════════════════════════
// REMOVE UNDEFINED KEYS (recursive)
// Keeps payload clean — Meta rejects null/undefined fields
// ══════════════════════════════════════════════════════════
function removeUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null && v !== '')
  );
}

// ══════════════════════════════════════════════════════════
// CORE: SEND EVENT TO META CAPI
// Called from: this handler (frontend events)
//              cashfree-webhook.js (Purchase)
//              gumroad-webhook.js  (Purchase)
// ══════════════════════════════════════════════════════════
async function sendEvent({
  eventName,
  eventTime,
  eventId,
  eventSourceUrl,
  userData = {},
  customData = {},
}) {
  if (!PIXEL_ID || !CAPI_TOKEN) {
    console.warn('[FB CAPI] Not configured — skipping. Set FB_PIXEL_ID and FB_CAPI_TOKEN.');
    return null;
  }

  // Build user_data — hash all PII
  // Phone: strip non-digits before hashing (Meta requirement)
  const rawPhone = userData.phone ? userData.phone.toString().replace(/\D/g, '') : null;
  const user_data = removeUndefined({
    em:                userData.email     ? hash(userData.email)     : undefined,
    ph:                rawPhone           ? hash(rawPhone)           : undefined,
    fn:                userData.firstName ? hash(userData.firstName) : undefined,
    ln:                userData.lastName  ? hash(userData.lastName)  : undefined,
    country:           userData.country   ? hash(userData.country.toLowerCase()) : undefined,
    client_ip_address: userData.ip        || undefined,
    client_user_agent: userData.userAgent || undefined,
    fbc:               userData.fbc       || undefined,
    fbp:               userData.fbp       || undefined,
  });

  // Build event object
  const eventObj = removeUndefined({
    event_name:       eventName,
    event_time:       eventTime || Math.floor(Date.now() / 1000),
    event_id:         eventId   || undefined,
    event_source_url: eventSourceUrl || undefined,
    action_source:    'website',
    user_data,
    custom_data:      Object.keys(customData).length > 0 ? customData : undefined,
  });

  // Build full payload
  const payload = {
    data: [eventObj],
  };

  // Only include test_event_code if it's set (avoids polluting production data)
  if (TEST_EVENT_CODE) {
    payload.test_event_code = TEST_EVENT_CODE;
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`;

  try {
    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const responseData = await res.json();

    if (!res.ok) {
      console.error(`[FB CAPI] ❌ Error sending ${eventName}:`, JSON.stringify(responseData));
    } else {
      console.log(`[FB CAPI] ✅ ${eventName} sent | eventId: ${eventId} | events_received: ${responseData.events_received}`);
    }

    return responseData;

  } catch (err) {
    console.error(`[FB CAPI] ❌ Network error for ${eventName}:`, err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// NETLIFY HANDLER
// Called from frontend pixel-events.js for:
//  - InitiateCheckout
//  - Lead
//  - CompleteRegistration
//  - PageView (from Opus landing page)
//
// Frontend sends: eventName, eventId, email, fbc, fbp, etc.
// Server adds:    real IP, real User-Agent
// ══════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const headers = {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':'Content-Type',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Parse body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const {
    eventName,
    eventId,
    eventSourceUrl,
    email,
    phone,
    firstName,
    lastName,
    fbc,
    fbp,
    customData = {},
  } = body;

  // Validate event name — only allow known events
  const ALLOWED_EVENTS = [
    'PageView',
    'ViewContent',
    'InitiateCheckout',
    'Lead',
    'CompleteRegistration',
  ];

  if (!eventName || !ALLOWED_EVENTS.includes(eventName)) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: `Invalid eventName. Must be one of: ${ALLOWED_EVENTS.join(', ')}`,
      }),
    };
  }

  // eventId is REQUIRED for deduplication
  if (!eventId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'eventId is required for deduplication' }),
    };
  }

  // Get real client IP from Netlify/CDN headers (more accurate than frontend)
  const clientIp =
    event.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers['x-real-ip']                              ||
    event.headers['client-ip']                              ||
    '';

  // Get real User-Agent
  const clientUA = event.headers['user-agent'] || '';

  // Send to CAPI
  const result = await sendEvent({
    eventName,
    eventId,
    eventSourceUrl,
    userData: {
      email,
      phone,
      firstName,
      lastName,
      ip:        clientIp,
      userAgent: clientUA,
      fbc,
      fbp,
    },
    customData,
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success:   true,
      event:     eventName,
      eventId,
      capi_result: result,
    }),
  };
};

// ══════════════════════════════════════════════════════════
// EXPORT for use in cashfree-webhook.js & gumroad-webhook.js
// ══════════════════════════════════════════════════════════
exports.sendEvent = sendEvent;
