/**
 * ═══════════════════════════════════════════════════════════
 * ForgeAI — Gumroad Webhook
 * File: netlify/functions/gumroad-webhook.js
 * ═══════════════════════════════════════════════════════════
 */

const { createClient } = require('@supabase/supabase-js');
const { sendEvent }    = require('./fb-capi');

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const SITE_URL         = (process.env.SITE_URL || 'https://www.forgeai.digital').replace(/\/$/, '');

const PRODUCT_PLAN_MAP = {
  'forgeai-starter':       'starter',
  'forgeai-pro':           'pro',
  'forgeai-upgrade':       'upgrade',
  // Legacy slugs
  'conversionos-core':     'starter',
  'conversionos-complete': 'pro',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

exports.handler = async (event) => {

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const params  = new URLSearchParams(event.body);
    const payload = Object.fromEntries(params.entries());

    console.log('Gumroad webhook received:', {
      product_permalink: payload.product_permalink,
      email:             payload.email,
      sale_id:           payload.sale_id,
    });

    // Skip refunds/disputes
    if (payload.refunded === 'true' || payload.disputed === 'true') {
      console.log('Skipping refunded/disputed sale');
      return { statusCode: 200, body: 'SKIPPED' };
    }

    // ── Determine tier ─────────────────────────────────────
    const permalink = payload.product_permalink?.toLowerCase() ?? '';
    let tier = null;

    for (const [slug, planTier] of Object.entries(PRODUCT_PLAN_MAP)) {
      if (permalink.includes(slug)) { tier = planTier; break; }
    }

    if (!tier) {
      // Fallback: Gumroad sends price in cents
      const price = parseFloat(payload.price ?? '0');
      tier = price >= 6000 ? 'pro' : 'starter'; // $60+ = Pro
    }

    // ── Handle Upgrade ─────────────────────────────────────
    if (tier === 'upgrade') {
      await handleUpgrade(payload.email, payload.sale_id);
      return { statusCode: 200, body: 'UPGRADED' };
    }

    // ── Duplicate check ────────────────────────────────────
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('order_id', payload.sale_id)
      .single();

    if (existing) {
      console.log('Duplicate webhook, skipping:', payload.sale_id);
      return { statusCode: 200, body: 'DUPLICATE' };
    }

    // ── Generate license key ───────────────────────────────
    const licenseKey = generateLicenseKey(tier);
    const amountUSD  = parseFloat(payload.price ?? '0') / 100;

    // ── Save to Supabase ───────────────────────────────────
    const { error: insertError } = await supabase
      .from('purchases')
      .insert({
        email:           payload.email,
        license_key:     licenseKey,
        tier,
        currency:        'USD',
        amount_paid:     amountUSD,
        payment_gateway: 'gumroad',
        order_id:        payload.sale_id,
        used:            false,
      });

    if (insertError) throw insertError;

    // ── Send welcome email ─────────────────────────────────
    await sendWelcomeEmail({
      email:      payload.email,
      name:       payload.full_name || 'there',
      licenseKey,
      tier,
      currency:   'USD',
    });

    // ── Facebook CAPI Purchase Event ───────────────────────
    // Gumroad doesn't pass frontend eventId
    // Use sale_id as eventId — unique per purchase
    const nameParts = (payload.full_name || '').trim().split(' ');
    await sendEvent({
      eventName:      'Purchase',
      eventId:        `purchase_gum_${payload.sale_id}`,
      eventSourceUrl: SITE_URL,
      userData: {
        email:     payload.email,
        firstName: nameParts[0]                || undefined,
        lastName:  nameParts.slice(1).join(' ')|| undefined,
      },
      customData: {
        currency:     'USD',
        value:        amountUSD,
        content_ids:  [tier],
        content_type: 'product',
        order_id:     payload.sale_id,
      },
    });

    console.log('✅ Gumroad purchase processed:', { email: payload.email, tier, licenseKey });
    return { statusCode: 200, body: 'OK' };

  } catch (err) {
    console.error('Gumroad webhook error:', err);
    return { statusCode: 500, body: 'Internal Error: ' + err.message };
  }
};

// ══════════════════════════════════════════════════════════
async function handleUpgrade(email, saleId) {
  // Update all purchases for this email to pro
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

  // Insert upgrade purchase record for dedup
  await supabase.from('purchases').insert({
    email,
    license_key:     `FRG-UPG-${saleId.substring(0,6).toUpperCase()}`,
    tier:            'pro',
    currency:        'USD',
    amount_paid:     0,
    payment_gateway: 'gumroad',
    order_id:        `UPG_GUM_${saleId}`,
    used:            true,
  });

  await sendUpgradeEmail(email);
  console.log('✅ Gumroad upgrade to Pro:', email);
}

// ══════════════════════════════════════════════════════════
async function sendUpgradeEmail(email) {
  if (!RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'ForgeAI <hello@forgeai.digital>',
      to:      [email],
      subject: '🚀 You\'ve been upgraded to ForgeAI Pro!',
      html: `<div style="font-family:sans-serif;padding:40px;max-width:500px;margin:0 auto">
        <h2 style="color:#F97316">⚡ ForgeAI</h2>
        <h1 style="color:#1A1A1A">You\'re now Pro! 🚀</h1>
        <p style="color:#4A4A4A">Your account has been upgraded to Pro — all engines are now unlocked, including all future engines forever.</p>
        <a href="${SITE_URL}/dashboard.html" style="display:block;background:#F97316;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:700;margin:24px 0">Open Dashboard →</a>
        <p style="font-size:12px;color:#999">© ForgeAI · The AI Engine for Everything</p>
      </div>`,
    }),
  });
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

  const firstName  = name.split(' ')[0];
  const planLabel  = tier === 'pro' ? 'Pro Plan' : 'Starter Plan';
  const priceLabel = currency === 'USD'
    ? (tier === 'pro' ? '$67' : '$37')
    : (tier === 'pro' ? '₹1,999' : '₹999');
  const accessInfo = tier === 'pro'
    ? 'All engines + ConversionOS Pipeline (8 specialist engines) + every future engine, forever'
    : '4 Starter engines — EmailForge, CopyForge, SocialForge, MusicForge';

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
    .btn{display:block;background:#F97316;color:#fff!important;text-decoration:none;text-align:center;padding:15px 24px;border-radius:10px;font-size:15px;font-weight:800;margin:24px 0}
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
      <div class="step"><div class="sn">3</div><div class="st">Open any engine → copy → paste into <strong>Claude.ai</strong> → start!</div></div>
    </div>
    <a href="${SITE_URL}/signup.html" class="btn">Create Your Account →</a>
    <hr>
    <div class="footer">
      <p>Questions? Reply to this email or visit <a href="${SITE_URL}/contact.html" style="color:#6B6B6B">${SITE_URL}/contact.html</a></p>
      <p style="margin-top:8px">© ForgeAI · The AI Engine for Everything</p>
    </div>
  </div></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'ForgeAI <hello@forgeai.digital>',
      to:      [email],
      subject: `⚡ Your ForgeAI ${planLabel} license key is here!`,
      html:    emailHtml,
    }),
  });

  if (!res.ok) console.error('Email send failed:', await res.text());
  else console.log('✅ Welcome email sent to:', email);
}
