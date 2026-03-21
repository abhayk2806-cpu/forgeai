/**
 * ═══════════════════════════════════════════════════════════
 * ForgeAI — Frontend Pixel Events + CAPI Deduplication
 * File: pixel-events.js
 *
 * HOW DEDUPLICATION WORKS:
 *  1. Unique eventId generated here (browser)
 *  2. Same eventId sent to Meta Pixel (browser)
 *  3. Same eventId sent to CAPI via /fb-capi (server)
 *  4. Meta sees same eventId from both → counts as ONE event
 *
 * USAGE (add to landing page after Meta Pixel base code):
 *  <script src="/pixel-events.js"></script>
 *
 * EVENTS THIS FILE HANDLES:
 *  - InitiateCheckout  → when checkout button/modal opens
 *  - Lead              → when user submits email in any form
 *  - CompleteRegistration → when signup is successful
 *
 * EVENTS HANDLED BY OPUS LANDING PAGE:
 *  - PageView          → auto-fires with Pixel base code
 *
 * EVENTS HANDLED BY WEBHOOKS:
 *  - Purchase          → cashfree-webhook.js / gumroad-webhook.js
 * ═══════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════════════
  const CAPI_ENDPOINT = '/.netlify/functions/fb-capi';

  // ══════════════════════════════════════════════
  // UNIQUE EVENT ID GENERATOR
  // Format: eventName_timestamp_random
  // Must be unique per event instance
  // Same ID used for Pixel + CAPI → deduplication
  // ══════════════════════════════════════════════
  function generateEventId(eventName) {
    const ts     = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `${eventName}_${ts}_${random}`;
  }

  // ══════════════════════════════════════════════
  // GET FACEBOOK COOKIES
  // _fbp: Facebook browser ID cookie
  // _fbc: Facebook click ID (from fbclid URL param)
  // ══════════════════════════════════════════════
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : undefined;
  }

  function getFbp() {
    return getCookie('_fbp') || undefined;
  }

  function getFbc() {
    // First check cookie
    const cookieFbc = getCookie('_fbc');
    if (cookieFbc) return cookieFbc;

    // Then check URL param (fbclid) and build fbc format
    const urlParams = new URLSearchParams(window.location.search);
    const fbclid    = urlParams.get('fbclid');
    if (fbclid) {
      const fbc = `fb.1.${Date.now()}.${fbclid}`;
      // Store in session for later use
      try { sessionStorage.setItem('_fbc', fbc); } catch(e) {}
      return fbc;
    }

    // Check session storage
    try { return sessionStorage.getItem('_fbc') || undefined; } catch(e) {}
    return undefined;
  }

  // ══════════════════════════════════════════════
  // SEND EVENT TO CAPI (SERVER-SIDE)
  // Fire & forget — don't block UI
  // ══════════════════════════════════════════════
  function sendToCAPI({
    eventName,
    eventId,
    email,
    phone,
    firstName,
    lastName,
    customData = {},
  }) {
    const payload = {
      eventName,
      eventId,
      eventSourceUrl: window.location.href,
      email:          email     || undefined,
      phone:          phone     || undefined,
      firstName:      firstName || undefined,
      lastName:       lastName  || undefined,
      fbc:            getFbc()  || undefined,
      fbp:            getFbp()  || undefined,
      customData,
    };

    // Remove undefined keys
    Object.keys(payload).forEach(k => {
      if (payload[k] === undefined) delete payload[k];
    });

    fetch(CAPI_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    .then(res => res.json())
    .then(data => {
      console.log(`[ForgeAI Pixel] ✅ CAPI ${eventName} sent | eventId: ${eventId}`);
    })
    .catch(err => {
      console.warn(`[ForgeAI Pixel] ⚠️ CAPI ${eventName} failed:`, err.message);
      // Silent fail — Pixel still tracked it
    });
  }

  // ══════════════════════════════════════════════
  // SEND EVENT TO META PIXEL (BROWSER-SIDE)
  // With same eventID for deduplication
  // ══════════════════════════════════════════════
  function sendToPixel(eventName, eventData, eventId) {
    if (typeof fbq === 'undefined') {
      console.warn('[ForgeAI Pixel] fbq not loaded — Pixel event skipped:', eventName);
      return;
    }
    fbq('track', eventName, eventData || {}, { eventID: eventId });
    console.log(`[ForgeAI Pixel] 📡 Pixel ${eventName} sent | eventID: ${eventId}`);
  }

  // ══════════════════════════════════════════════
  // MAIN TRACK FUNCTION
  // Always call this — handles both Pixel + CAPI
  // ══════════════════════════════════════════════
  function track(eventName, options = {}) {
    const {
      email,
      phone,
      firstName,
      lastName,
      customData = {},
      pixelData  = {},
    } = options;

    // Generate unique eventId — SAME for both Pixel and CAPI
    const eventId = generateEventId(eventName);

    // 1. Send to Meta Pixel (browser)
    sendToPixel(eventName, pixelData, eventId);

    // 2. Send to CAPI (server) with same eventId
    sendToCAPI({
      eventName,
      eventId,
      email,
      phone,
      firstName,
      lastName,
      customData,
    });

    return eventId; // Return for reference if needed
  }

  // ══════════════════════════════════════════════
  // PUBLIC API
  // Expose ForgeAI.track() globally
  // ══════════════════════════════════════════════
  window.ForgeAI = window.ForgeAI || {};

  /**
   * Track InitiateCheckout
   * Call when: checkout modal opens OR buy button clicked
   *
   * Usage:
   *   ForgeAI.trackCheckout({ value: 999, currency: 'INR', tier: 'starter' });
   */
  window.ForgeAI.trackCheckout = function(options = {}) {
    const { value, currency = 'INR', tier = 'starter', email } = options;

    return track('InitiateCheckout', {
      email,
      customData: {
        value,
        currency,
        content_ids:  [tier],
        content_type: 'product',
      },
      pixelData: {
        value,
        currency,
        content_ids:  [tier],
        content_type: 'product',
      },
    });
  };

  /**
   * Track Lead
   * Call when: user submits email (newsletter, lead form, etc.)
   *
   * Usage:
   *   ForgeAI.trackLead({ email: 'user@email.com' });
   */
  window.ForgeAI.trackLead = function(options = {}) {
    const { email, firstName, lastName } = options;

    return track('Lead', {
      email,
      firstName,
      lastName,
      customData: { lead_type: 'email_capture' },
      pixelData:  {},
    });
  };

  /**
   * Track CompleteRegistration
   * Call when: signup is successful (after license key validated)
   *
   * Usage:
   *   ForgeAI.trackRegistration({ email: 'user@email.com', tier: 'starter' });
   */
  window.ForgeAI.trackRegistration = function(options = {}) {
    const { email, firstName, lastName, tier = 'starter' } = options;

    return track('CompleteRegistration', {
      email,
      firstName,
      lastName,
      customData: {
        content_name: `ForgeAI ${tier}`,
        status:       true,
      },
      pixelData: {
        content_name: `ForgeAI ${tier}`,
        status:       true,
      },
    });
  };

  /**
   * Track ViewContent
   * Call when: user views a specific section (pricing, demo, etc.)
   *
   * Usage:
   *   ForgeAI.trackViewContent({ contentName: 'Pricing', contentCategory: 'landing' });
   */
  window.ForgeAI.trackViewContent = function(options = {}) {
    const { contentName, contentCategory } = options;

    return track('ViewContent', {
      customData: {
        content_name:     contentName,
        content_category: contentCategory,
      },
      pixelData: {
        content_name:     contentName,
        content_category: contentCategory,
      },
    });
  };

  // ══════════════════════════════════════════════
  // AUTO-ATTACH: Checkout buttons
  // Finds all elements with data-track="checkout"
  // and attaches InitiateCheckout tracking
  //
  // Add to any button: data-track="checkout" data-tier="starter" data-value="999" data-currency="INR"
  // ══════════════════════════════════════════════
  function autoAttachCheckoutButtons() {
    document.querySelectorAll('[data-track="checkout"]').forEach(el => {
      el.addEventListener('click', function() {
        const tier     = this.dataset.tier     || 'starter';
        const value    = parseFloat(this.dataset.value)    || 0;
        const currency = this.dataset.currency || 'INR';
        window.ForgeAI.trackCheckout({ tier, value, currency });
      }, { once: false });
    });
  }

  // ══════════════════════════════════════════════
  // AUTO-ATTACH: Lead forms
  // Finds all forms/inputs with data-track="lead"
  // and attaches Lead tracking on submit/blur
  //
  // Add to email input: data-track="lead"
  // ══════════════════════════════════════════════
  function autoAttachLeadForms() {
    // Forms with data-track="lead"
    document.querySelectorAll('form[data-track="lead"]').forEach(form => {
      form.addEventListener('submit', function() {
        const emailInput = this.querySelector('input[type="email"]');
        const nameInput  = this.querySelector('input[name="name"], input[type="text"]');
        if (emailInput?.value) {
          const nameParts = (nameInput?.value || '').trim().split(' ');
          window.ForgeAI.trackLead({
            email:     emailInput.value,
            firstName: nameParts[0]              || undefined,
            lastName:  nameParts.slice(1).join(' ') || undefined,
          });
        }
      });
    });

    // Standalone email inputs with data-track="lead"
    document.querySelectorAll('input[type="email"][data-track="lead"]').forEach(input => {
      let tracked = false;
      input.addEventListener('blur', function() {
        if (!tracked && this.value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value)) {
          tracked = true; // Track only once per session
          window.ForgeAI.trackLead({ email: this.value });
        }
      });
    });
  }

  // ══════════════════════════════════════════════
  // INIT — Run after DOM ready
  // ══════════════════════════════════════════════
  function init() {
    autoAttachCheckoutButtons();
    autoAttachLeadForms();
    console.log('[ForgeAI Pixel] ✅ Tracking initialized');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
