// netlify/functions/admin-load.js
// Loads all content_items from Supabase for admin panel
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
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Check admin password
  const adminPw = event.headers['x-admin-password'] || '';
  if (adminPw !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const { data, error } = await supabase
      .from('content_items')
      .select('id, type, content, updated_at');

    if (error) throw error;

    // Convert array to object map: { 'e0': '...content...', 'e1': '...' }
    const contentMap = {};
    (data || []).forEach(item => {
      contentMap[item.id] = item.content || '';
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, content: contentMap }),
    };

  } catch (err) {
    console.error('admin-load error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
