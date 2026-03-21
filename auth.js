/**
 * ForgeAI — AUTH v4.1
 * Tier checked from purchases table.
 * Uses window.supabase (set by supabase.js)
 */

document.documentElement.style.visibility = 'hidden';

(async function () {
  'use strict';

  function showPage() { document.documentElement.style.visibility = ''; }

  // Wait for window.supabase (max 3s)
  let waited = 0;
  while (!window.supabase?.auth && waited < 30) {
    await new Promise(r => setTimeout(r, 100));
    waited++;
  }
  if (!window.supabase?.auth) {
    window.location.replace('/login.html');
    return;
  }

  const sb = window.supabase;

  // ── PAGE RULES ──
  const PAGE_RULES = {
    '/login.html':           'public',
    '/forgot-password.html': 'public',
    '/reset-password.html':  'public',
    '/welcome.html':         'any',
    '/dashboard.html':       'any',
    '/templates.html':       'any',
    '/resources.html':       'any',
    '/profile.html':         'any',
    '/contact.html':         'any',
    '/tool-page.html':       'pro',
  };

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const rule = PAGE_RULES[path] ?? 'any';

  if (rule === 'public') { showPage(); return; }

  let { data: { session } } = await sb.auth.getSession();

  // If no session yet, wait briefly for onAuthStateChange to hydrate it
  // (Supabase can be slow to restore session from cookie right after redirect)
  if (!session) {
    session = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 1500);
      const { data: { subscription } } = sb.auth.onAuthStateChange((event, s) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          clearTimeout(timer);
          subscription.unsubscribe();
          resolve(s);
        }
      });
    });
  }

  if (!session) {
    try { sessionStorage.setItem('cos_redirect_after_login', window.location.href); } catch(e) {}
    window.location.replace('/login.html');
    return;
  }

  const user = session.user;
  let tier = 'starter';

  try {
    // Try by user_id first
    let { data: p } = await sb.from('purchases').select('tier')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();

    if (!p?.tier) {
      // Fallback: by email
      const res = await sb.from('purchases').select('tier')
        .eq('email', user.email).order('created_at', { ascending: false }).limit(1).single();
      p = res.data;
    }

    if (p?.tier) tier = p.tier;
  } catch(e) { /* default starter */ }

  window.COSU = { id: user.id, email: user.email, tier, isPro: tier === 'pro', session };

  if (rule === 'pro' && tier !== 'pro') {
    window.location.replace('/access-denied.html');
    return;
  }

  showPage();

  window.cosLogout = async () => { await sb.auth.signOut(); window.location.replace('/login.html'); };

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.replace('/login.html');
  });

})();
