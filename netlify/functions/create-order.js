/**
 * ═══════════════════════════════════════════════════════════
 * ForgeAI — Cashfree Order Creator
 * File: netlify/functions/create-order.js
 *
 * DEDUPLICATION:
 * Frontend generates fb_event_id before calling this.
 * We store it in order_tags so cashfree-webhook.js
 * can use same eventId for CAPI Purchase event.
 * ═══════════════════════════════════════════════════════════
 */

exports.handler = async (event) => {

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let name, email, phone, plan, fbc, fbp, fb_event_id;
  try {
    ({ name, email, phone, plan, fbc, fbp, fb_event_id } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // ── Validate inputs ───────────────────────────────────────────
  if (!name || name.trim().length < 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid name is required' }) };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email is required' }) };
  }
  if (!plan || !['starter', 'pro', 'upgrade'].includes(plan)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid plan is required' }) };
  }

  const cleanName  = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  // ── Plan config (ForgeAI pricing) ─────────────────────────────
  const PLANS = {
    starter: { amount: 2,    label: 'ForgeAI Starter Plan'          },
    pro:     { amount: 5,    label: 'ForgeAI Pro Plan'               },
    upgrade: { amount: 3,    label: 'ForgeAI Upgrade Starter to Pro' },
  };
  const selectedPlan = PLANS[plan];

  // ── Cashfree config ───────────────────────────────────────────
  const appId     = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  const cfEnv     = (process.env.CASHFREE_ENV || 'PROD').toUpperCase();
  const siteUrl   = (process.env.SITE_URL || 'https://ai-conversion-engines.netlify.app').replace(/\/$/, '');

  if (!appId || !secretKey) {
    console.error('Missing Cashfree credentials');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Payment configuration error' }) };
  }

  const cfBase = cfEnv === 'PROD'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  // ── Unique order ID ───────────────────────────────────────────
  const orderId = `FRG_${plan.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substr(2,5).toUpperCase()}`;

  // ── Build order ───────────────────────────────────────────────
  const orderBody = {
    order_id:       orderId,
    order_amount:   selectedPlan.amount,
    order_currency: 'INR',
    customer_details: {
      customer_id:    `cust_${cleanEmail.replace(/[^a-z0-9]/g, '_').substring(0, 40)}`,
      customer_name:  cleanName,
      customer_email: cleanEmail,
      customer_phone: '9999999999',
    },
    order_meta: {
      return_url: `${siteUrl}/payment-success.html?order_id={order_id}&plan=${plan}`,
      notify_url: `${siteUrl}/.netlify/functions/cashfree-webhook`,
      cancel_url: `${siteUrl}/#pricing`,
    },
    order_note: selectedPlan.label,
    order_tags: {
      plan,
      phone:        phone        || '',
      fbc:          fbc          || '',
      fbp:          fbp          || '',
      // Pass frontend-generated eventId for CAPI deduplication
      fb_event_id:  fb_event_id  || `purchase_cf_${orderId}`,
    },
  };

  try {
    const res = await fetch(`${cfBase}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-version':   '2023-08-01',
        'x-client-id':     appId,
        'x-client-secret': secretKey,
      },
      body: JSON.stringify(orderBody),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Cashfree order error:', JSON.stringify(data));
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'Order creation failed', detail: data.message || '' }),
      };
    }

    console.log('✅ Order created:', orderId, '| plan:', plan, '| amount:', selectedPlan.amount);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        paymentSessionId: data.payment_session_id,
        orderId:          data.order_id,
        cfEnv,
      }),
    };

  } catch (err) {
    console.error('create-order error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
