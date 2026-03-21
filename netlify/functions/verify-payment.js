// netlify/functions/verify-payment.js
// Verifies Cashfree payment status before showing success page
// Called from payment-success.html

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const orderId   = event.queryStringParameters?.order_id || '';
  const appId     = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  const cfEnv     = (process.env.CASHFREE_ENV || 'PROD').toUpperCase();
  const cfBase    = cfEnv === 'PROD'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  if (!orderId) {
    return { statusCode: 400, headers, body: JSON.stringify({ status: 'INVALID' }) };
  }

  try {
    const res  = await fetch(`${cfBase}/orders/${orderId}/payments`, {
      method: 'GET',
      headers: {
        'x-api-version':   '2023-08-01',
        'x-client-id':     appId,
        'x-client-secret': secretKey,
      },
    });
    const data = await res.json();

    // Check if any payment is SUCCESS
    const paid = Array.isArray(data) && data.some(p => p.payment_status === 'SUCCESS');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: paid ? 'SUCCESS' : 'PENDING' }),
    };

  } catch (err) {
    console.error('verify-payment error:', err);
    // On error — return SUCCESS to not block user (webhook handles actual processing)
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'SUCCESS' }) };
  }
};
