// netlify/functions/save-lead.js
// Saves email leads from the landing page capture form to Supabase
// AND sends the Copy Forge engine as a free lead magnet via Resend

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY   = process.env.RESEND_API_KEY;
const SITE_URL         = process.env.SITE_URL || 'https://www.forgeai.digital';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: 'Method not allowed' };
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!email || !email.includes('@')) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const { error } = await sb
      .from('email_leads')
      .upsert({ email: cleanEmail, source: 'landing_page' }, { onConflict: 'email' });

    if (error) throw error;

    // Send lead magnet email (non-blocking — don't fail the response if email fails)
    sendLeadMagnetEmail(cleanEmail).catch(err =>
      console.error('Lead magnet email failed:', err.message)
    );

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('save-lead error:', err.message);
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ error: 'Failed to save' }),
    };
  }
};

async function sendLeadMagnetEmail(email) {
  if (!RESEND_API_KEY) {
    console.log('No RESEND_API_KEY — skipping lead magnet email for:', email);
    return;
  }

  const downloadUrl = `${SITE_URL}/engines/copy-forge.txt`;
  const upgradeUrl  = `${SITE_URL}/#pricing`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Free Copy Forge Engine</title>
<style>
  body { margin:0; padding:0; background:#F7F7F5; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .wrap { max-width:600px; margin:0 auto; padding:32px 16px; }
  .card { background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
  .header { background:#F97316; padding:32px 36px; }
  .logo { font-size:22px; font-weight:800; color:#ffffff; letter-spacing:-0.5px; }
  .logo span { color:rgba(255,255,255,0.7); }
  .body { padding:36px; }
  h1 { font-size:24px; font-weight:800; color:#111827; margin:0 0 8px; line-height:1.25; }
  .sub { font-size:15px; color:#6B7280; margin:0 0 28px; line-height:1.5; }
  .dl-btn { display:block; background:#F97316; color:#ffffff; text-decoration:none; font-weight:700; font-size:16px; text-align:center; padding:16px 24px; border-radius:12px; margin-bottom:10px; letter-spacing:0.2px; }
  .dl-note { font-size:12px; color:#9CA3AF; text-align:center; margin-bottom:32px; }
  .divider { border:none; border-top:1px solid #E8E8E4; margin:32px 0; }
  .guide-title { font-size:18px; font-weight:800; color:#111827; margin:0 0 16px; }
  .step { display:flex; gap:14px; margin-bottom:18px; align-items:flex-start; }
  .step-num { width:28px; height:28px; min-width:28px; background:#FFF4ED; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:#F97316; }
  .step-text { font-size:14px; color:#374151; line-height:1.55; padding-top:4px; }
  .step-text strong { color:#111827; }
  .tip-box { background:#FFF4ED; border-left:3px solid #F97316; border-radius:0 8px 8px 0; padding:14px 16px; margin:24px 0; font-size:13px; color:#7C3A00; line-height:1.55; }
  .tip-box strong { color:#F97316; }
  .upgrade-box { background:#F9FAFB; border:1px solid #E8E8E4; border-radius:12px; padding:24px; margin-top:32px; text-align:center; }
  .upgrade-box p { font-size:14px; color:#6B7280; margin:0 0 16px; line-height:1.5; }
  .upgrade-btn { display:inline-block; background:#111827; color:#ffffff; text-decoration:none; font-weight:700; font-size:14px; padding:12px 24px; border-radius:10px; }
  .footer { padding:24px 36px; font-size:12px; color:#9CA3AF; text-align:center; line-height:1.6; }
  .footer a { color:#9CA3AF; }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">

    <div class="header">
      <div class="logo">Forge<span>AI</span></div>
    </div>

    <div class="body">
      <h1>Your free Copy Forge engine is here 🔥</h1>
      <p class="sub">This is a real ForgeAI engine — the same system our paid users run inside Claude and ChatGPT to generate high-converting copy. No watered-down version. The full thing.</p>

      <a class="dl-btn" href="${downloadUrl}" target="_blank">⬇ Download Copy Forge Engine</a>
      <p class="dl-note">Opens a plain text file — right-click and "Save As" to download</p>

      <hr class="divider">

      <div class="guide-title">How to use this engine (3 steps)</div>

      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text"><strong>Go to Claude.ai and create a Project.</strong> Click "Projects" in the left sidebar → New Project. Name it something like "Copy Forge".</div>
      </div>

      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text"><strong>Paste the engine as Project Instructions.</strong> Open the downloaded file, select all (Ctrl+A / Cmd+A), copy it, then paste it into the "Project Instructions" field. Hit Save.</div>
      </div>

      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text"><strong>Start a new chat inside that Project and tell it what you need.</strong> Example: "Write a Facebook ad for my online fitness coaching program targeting busy moms aged 28–40." The engine takes over from there.</div>
      </div>

      <div class="tip-box">
        <strong>Pro tip:</strong> The more context you give it about your product, audience, and goal — the sharper the output. Treat it like briefing a real copywriter, not prompting a chatbot.
      </div>

      <div class="step">
        <div class="step-num" style="background:#E8E8E4;color:#6B7280;">✓</div>
        <div class="step-text" style="color:#6B7280;"><strong>Works on ChatGPT too.</strong> Go to ChatGPT → Explore GPTs → Create → paste the engine in the Instructions field. Or just start a conversation and paste the engine text first, then give your brief.</div>
      </div>

      <div class="upgrade-box">
        <p>Copy Forge is just one of 31 engines in ForgeAI. There are engines for SEO, Facebook Ads, sales funnels, offer creation, business strategy, AI productivity, and more — all built to the same standard.</p>
        <a class="upgrade-btn" href="${upgradeUrl}" target="_blank">See all 31 engines →</a>
      </div>
    </div>

    <div class="footer">
      You're getting this because you signed up at forgeai.digital.<br>
      Questions? <a href="mailto:thesaanvihub@gmail.com">Reply to this email</a> — we read every one.<br><br>
      © ForgeAI · <a href="${SITE_URL}">forgeai.digital</a>
    </div>

  </div>
</div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'ForgeAI <hello@forgeai.digital>',
      to:      [email],
      subject: 'Your free Copy Forge engine 🔥',
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }

  console.log('✅ Lead magnet email sent to:', email);
}
