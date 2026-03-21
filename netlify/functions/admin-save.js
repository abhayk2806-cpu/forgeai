// netlify/functions/admin-save.js
// Admin content save — uses SERVICE KEY server-side (never exposed to browser)
// Protected by admin password check

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD || 'ForgeAI@Admin2025';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── Check admin password ──────────────────────────────────
  const adminPw = event.headers['x-admin-password'] || '';
  if (adminPw !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let id, content;
  try {
    ({ id, content } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!id || content === undefined) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'id and content required' }) };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const { error } = await supabase
      .from('content_items')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    console.log('✅ Content saved:', id);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('admin-save error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
