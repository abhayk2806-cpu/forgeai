// netlify/functions/admin-write.js
// Handles all admin write operations: insert/update/delete engines + categories
// Uses SERVICE KEY — bypasses RLS. Protected by admin password.
//
// Actions:
//   engine:insert  — add new engine row
//   engine:update  — update existing engine row
//   engine:delete  — delete engine row
//   engine:toggle  — toggle is_active on engine
//   category:insert — add new category row
//   category:delete — delete category row

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD || 'ForgeAI@Admin2025';

const ALLOWED_ACTIONS = [
  'engine:insert', 'engine:update', 'engine:delete', 'engine:toggle',
  'category:insert', 'category:delete',
];

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── Auth ─────────────────────────────────────────────────
  const adminPw = event.headers['x-admin-password'] || '';
  if (adminPw !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // ── Parse body ───────────────────────────────────────────
  let action, payload;
  try {
    ({ action, payload } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid action. Must be one of: ${ALLOWED_ACTIONS.join(', ')}` }) };
  }

  if (!payload) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'payload required' }) };
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    let error, data;

    // ── ENGINE ops ───────────────────────────────────────────
    if (action === 'engine:insert') {
      const { id, name, icon, icon_bg, category_id, tier, tagline, use_cases, badge, sort_order } = payload;
      if (!id || !name || !category_id) throw new Error('id, name, category_id required');
      ({ error } = await sb.from('engines').insert({
        id, name,
        icon:        icon        || '⚡',
        icon_bg:     icon_bg     || '#FFF4ED',
        category_id,
        tier:        tier        || 'pro',
        tagline:     tagline     || '',
        use_cases:   use_cases   || [],
        badge:       badge       || '',
        sort_order:  sort_order  || 99,
        is_active:   true,
      }));
    }

    else if (action === 'engine:update') {
      const { id, ...fields } = payload;
      if (!id) throw new Error('id required');
      ({ error } = await sb.from('engines').update(fields).eq('id', id));
    }

    else if (action === 'engine:delete') {
      const { id } = payload;
      if (!id) throw new Error('id required');
      // Also delete associated content_items row
      await sb.from('content_items').delete().eq('id', id);
      ({ error } = await sb.from('engines').delete().eq('id', id));
    }

    else if (action === 'engine:toggle') {
      const { id, is_active } = payload;
      if (!id || is_active === undefined) throw new Error('id and is_active required');
      ({ error } = await sb.from('engines').update({ is_active }).eq('id', id));
    }

    // ── CATEGORY ops ─────────────────────────────────────────
    else if (action === 'category:insert') {
      const { id, name, icon, color, color_light, sort_order } = payload;
      if (!id || !name) throw new Error('id and name required');
      ({ error } = await sb.from('categories').insert({
        id, name,
        icon:        icon        || '📁',
        color:       color       || '#F97316',
        color_light: color_light || '#FFF4ED',
        sort_order:  sort_order  || 99,
        is_active:   true,
      }));
    }

    else if (action === 'category:delete') {
      const { id } = payload;
      if (!id) throw new Error('id required');
      ({ error } = await sb.from('categories').delete().eq('id', id));
    }

    if (error) throw error;

    console.log(`✅ admin-write: ${action} — ${payload.id || 'ok'}`);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error(`admin-write error [${action}]:`, err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
