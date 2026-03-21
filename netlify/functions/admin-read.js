// netlify/functions/admin-read.js
// Reads all admin data via service key — bypasses RLS
// Returns: categories, engines, content_items, purchases
// Protected by admin password

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD || 'ForgeAI@Admin2025';

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const adminPw = event.headers['x-admin-password'] || '';
  if (adminPw !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const table = event.queryStringParameters?.table || 'all';

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    if (table === 'purchases') {
      const { data, error } = await sb
        .from('purchases')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
    }

    if (table === 'content_items') {
      const { data, error } = await sb
        .from('content_items')
        .select('id, type, content, updated_at');
      if (error) throw error;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
    }

    // Default: return categories + engines together
    const [catRes, engRes] = await Promise.all([
      sb.from('categories').select('*').order('sort_order'),
      sb.from('engines').select('*').order('sort_order'),
    ]);
    if (catRes.error) throw catRes.error;
    if (engRes.error) throw engRes.error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success:    true,
        categories: catRes.data || [],
        engines:    engRes.data || [],
      }),
    };

  } catch (err) {
    console.error('admin-read error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
