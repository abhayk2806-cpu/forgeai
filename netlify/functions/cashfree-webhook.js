/**
 * ═══════════════════════════════════════════════════════════
 * ForgeAI — Cashfree Webhook
 * File: netlify/functions/cashfree-webhook.js
 *
 * DEDUPLICATION NOTE:
 * Frontend sends eventId in order_tags when creating order.
 * Same eventId used here for CAPI Purchase event.
 * Pixel purchase event (if any) uses same eventId → Meta deduplicates.
 * ═══════════════════════════════════════════════════════════
 */

const { createClient } = require('@supabase/supabase-js');
const crypto           = require('crypto');
const { sendEvent }    = require('./fb-capi');

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const CF_SECRET_KEY    = process.env.CASHFREE_WEBHOOK_SECRET;
const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const SITE_URL         = (process.env.SITE_URL || 'https://ai-conversion-engines.netlify.app').replace(/\/$/, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

exports.handler = async (event) => {

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);

    // ── Verify Cashfree Signature ──────────────────────────
    if (CF_SECRET_KEY) {
      const ts        = event.headers['x-webhook-timestamp'];
      const signature = event.headers['x-webhook-signature'];
      const expected  = crypto
        .createHmac('sha256', CF_SECRET_KEY)
        .update(ts + event.body)
        .digest('base64');

      if (signature !== expected) {
        console.error('Invalid Cashfree signature');
        return { statusCode: 401, body: 'Invalid signature' };
      }
    }

    // ── Only process PAYMENT_SUCCESS ──────────────────────
    const eventType = payload.type ?? payload.event ?? '';
    if (!eventType.includes('PAYMENT_SUCCESS') && !eventType.includes('payment.success')) {
      console.log('Ignoring non-payment event:', eventType);
      return { statusCode: 200, body: 'IGNORED' };
    }

    const data     = payload.data ?? payload;
    const order    = data.order   ?? {};
    const payment  = data.payment ?? {};
    const customer = data.customer_details ?? {};

    const email   = customer.customer_email ?? order.customer_email ?? '';
    const name    = customer.customer_name  ?? order.customer_name  ?? 'there';
    const orderId = order.order_id          ?? payment.cf_payment_id ?? '';
    const amount  = parseFloat(order.order_amount ?? payment.payment_amount ?? 0);

    // ── Extract Facebook tracking params from order_tags ──
    // These are passed from create-order.js when user clicks buy
    const orderTags = order.order_tags ?? {};
    const fbc       = orderTags.fbc     || undefined;
    const fbp       = orderTags.fbp     || undefined;
    const phone     = orderTags.phone   || undefined;
    // eventId from frontend — for deduplication with Pixel
    const fbEventId = orderTags.fb_event_id || `purchase_cf_${orderId}`;

    if (!email) {
      console.error('No email in Cashfree payload');
      return { statusCode: 200, body: 'NO_EMAIL' };
    }

    // ── Duplicate check ────────────────────────────────────
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('order_id', orderId)
      .single();

    if (existing) {
      console.log('Duplicate webhook, skipping:', orderId);
      return { statusCode: 200, body: 'DUPLICATE' };
    }

    // ── Determine tier ─────────────────────────────────────
    const orderNote = (order.order_note ?? '').toLowerCase();
    let tier = null;

    if      (orderNote.includes('pro'))     tier = 'pro';
    else if (orderNote.includes('upgrade')) tier = 'upgrade';
    else if (orderNote.includes('starter')) tier = 'starter';
    else    tier = amount >= 1800 ? 'pro' : 'starter';

    // ── Handle Upgrade ─────────────────────────────────────
    if (tier === 'upgrade') {
      await handleUpgrade(email, fbc, fbp, fbEventId, orderId, amount, phone);
      return { statusCode: 200, body: 'UPGRADED' };
    }

    // ── Generate License Key ───────────────────────────────
    const licenseKey = generateLicenseKey(tier);

    // ── Save to Supabase ───────────────────────────────────
    const { error: insertError } = await supabase
      .from('purchases')
      .insert({
        email,
        license_key:     licenseKey,
        tier,
        currency:        'INR',
        amount_paid:     amount,
        payment_gateway: 'cashfree',
        order_id:        orderId,
        used:            false,
      });

    if (insertError) throw insertError;

    // ── Send Welcome Email ─────────────────────────────────
    await sendWelcomeEmail({ email, name, licenseKey, tier, currency: 'INR' });

    // ── Facebook CAPI Purchase Event ───────────────────────
    // Uses fbEventId from frontend for deduplication
    const nameParts = name.trim().split(' ');
    await sendEvent({
      eventName:      'Purchase',
      eventId:        fbEventId,
      eventSourceUrl: SITE_URL,
      userData: {
        email,
        phone,
        firstName: nameParts[0]                || undefined,
        lastName:  nameParts.slice(1).join(' ')|| undefined,
        country:   'in',
        fbc,
        fbp,
      },
      customData: {
        currency:     'INR',
        value:        amount,
        content_ids:  [tier],
        content_type: 'product',
        order_id:     orderId,
      },
    });

    console.log('✅ Cashfree purchase processed:', { email, tier, licenseKey });
    return { statusCode: 200, body: 'OK' };

  } catch (err) {
    console.error('Cashfree webhook error:', err);
    return { statusCode: 500, body: 'Error: ' + err.message };
  }
};

// ══════════════════════════════════════════════════════════
async function handleUpgrade(email, fbc, fbp, fbEventId, orderId, amount, phone) {
  // Update purchases table
  await supabase.from('purchases').update({ tier: 'pro' }).eq('email', email);

  // Update Supabase Auth user metadata
  const { data: purchase } = await supabase
    .from('purchases')
    .select('user_id')
    .eq('email', email)
    .not('user_id', 'is', null)
    .single();

  if (purchase?.user_id) {
    await supabase.auth.admin.updateUserById(purchase.user_id, {
      user_metadata: { tier: 'pro' }
    });
  }

  await sendUpgradeEmail(email);

  // CAPI for upgrade purchase
  await sendEvent({
    eventName:      'Purchase',
    eventId:        fbEventId || `upgrade_cf_${orderId}`,
    eventSourceUrl: SITE_URL,
    userData:       { email, phone, country: 'in', fbc, fbp },
    customData: {
      currency:     'INR',
      value:        amount,
      content_ids:  ['upgrade'],
      content_type: 'product',
    },
  });

  console.log('✅ User upgraded to Pro:', email);
}

// ══════════════════════════════════════════════════════════
function generateLicenseKey(tier) {
  const prefix = tier === 'pro' ? 'FRG-PRO' : 'FRG-STR';
  const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = Array.from({ length: 5 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `${prefix}-${random}`;
}

// ══════════════════════════════════════════════════════════
async function sendWelcomeEmail({ email, name, licenseKey, tier, currency }) {
  if (!RESEND_API_KEY) {
    console.log('No RESEND_API_KEY — skipping email for:', email);
    return;
  }

  const firstName  = (name || 'there').split(' ')[0];
  const planLabel  = tier === 'pro' ? 'Pro Plan' : 'Starter Plan';
  const priceLabel = currency === 'INR'
    ? (tier === 'pro' ? '₹1,999' : '₹999')
    : (tier === 'pro' ? '$67' : '$37');
  const accessInfo = tier === 'pro'
    ? 'All 11 engines + ForgeAI Pipeline + ALL future engines forever'
    : '4 Starter engines (EmailForge, Copy Forge, Social Forge, Music Forge)';

  const emailHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <style>
    body{font-family:-apple-system,sans-serif;background:#F4F2EE;margin:0;padding:24px}
    .card{background:#fff;border-radius:16px;max-width:520px;margin:0 auto;padding:36px 32px;border:1px solid #E2E0DA}
    .badge{font-size:11px;font-weight:700;background:#F0EDE8;color:#6B5E4E;padding:3px 10px;border-radius:100px}
    h1{font-size:24px;font-weight:800;color:#1A1A1A;margin:0 0 8px}
    p{font-size:15px;color:#4A4A4A;line-height:1.65;margin:0 0 14px}
    .key-box{background:#1A1A1A;border-radius:12px;padding:20px 24px;margin:22px 0}
    .key-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.4);margin-bottom:8px}
    .key-value{font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#22C55E;letter-spacing:1.5px}
    .key-hint{font-size:12px;color:rgba(255,255,255,.35);margin-top:8px}
    .access-box{background:#EDFBF3;border:1px solid #B7E8CC;border-radius:10px;padding:14px 18px;margin:0 0 20px}
    .access-box p{color:#2D6A4F;margin:0;font-size:14px}
    .step{display:flex;gap:14px;margin-bottom:12px;align-items:flex-start}
    .sn{width:24px;height:24px;min-width:24px;background:#1A1A1A;color:#fff;border-radius:50%;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px}
    .st{font-size:14px;color:#4A4A4A;line-height:1.5}
    .btn{display:block;background:#1A1A1A;color:#fff!important;text-decoration:none;text-align:center;padding:15px 24px;border-radius:10px;font-size:15px;font-weight:800;margin:24px 0}
    hr{border:none;border-top:1px solid #E2E0DA;margin:24px 0}
    .footer{font-size:12px;color:#ABABAB;text-align:center;line-height:1.6}
  </style></head><body>
  <div class="card">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
      <span style="font-size:20px">⚡</span>
      <span style="font-size:16px;font-weight:800;color:#1A1A1A">ForgeAI</span>
      <span class="badge">${planLabel}</span>
    </div>
    <h1>Welcome, ${firstName}! 🎉</h1>
    <p>Payment confirmed (${priceLabel}). Your license key is below.</p>
    <div class="key-box">
      <div class="key-label">Your License Key</div>
      <div class="key-value">${licenseKey}</div>
      <div class="key-hint">Save this email. You'll need this key to sign up.</div>
    </div>
    <div class="access-box"><p>✅ <strong>Your access:</strong> ${accessInfo}</p></div>
    <div>
      <div class="step"><div class="sn">1</div><div class="st">Go to <strong>${SITE_URL}/signup.html</strong></div></div>
      <div class="step"><div class="sn">2</div><div class="st">Enter your email, paste the license key, and set a password</div></div>
      <div class="step"><div class="sn">3</div><div class="st">Open any engine → copy → paste into <strong>Claude.ai</strong> → start building!</div></div>
    </div>
    <a href="${SITE_URL}/signup.html" class="btn">Create My Account Now →</a>
    <hr>
    <div class="footer">
      <p>Questions? Reply to this email or visit <a href="${SITE_URL}/contact.html" style="color:#6B6B6B">${SITE_URL}/contact.html</a></p>
      <p style="margin-top:8px">© ForgeAI · The AI Engine for Everything</p>
    </div>
  </div></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'ForgeAI <onboarding@resend.dev>',
      to:      [email],
      subject: `⚡ Your ForgeAI ${planLabel} is ready — license key inside`,
      html:    emailHtml,
    }),
  });

  if (!res.ok) console.error('Email failed:', await res.text());
  else console.log('✅ Email sent to:', email);
}

async function sendUpgradeEmail(email) {
  if (!RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'ForgeAI <onboarding@resend.dev>',
      to:      [email],
      subject: '🚀 Upgraded to ForgeAI Pro!',
      html: `<div style="font-family:sans-serif;padding:40px;max-width:500px;margin:0 auto">
        <h2>⚡ ForgeAI</h2>
        <h1>You've been upgraded to Pro! 🚀</h1>
        <p>Your account now has access to all engines + ALL future engines forever.</p>
        <a href="${SITE_URL}/dashboard.html" style="display:block;background:#1A1A1A;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:700;margin:24px 0">Open Dashboard →</a>
        <p style="font-size:12px;color:#999">© ForgeAI · The AI Engine for Everything</p>
      </div>`,
    }),
  });
}
