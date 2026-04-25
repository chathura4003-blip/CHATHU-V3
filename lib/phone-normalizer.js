'use strict';

const PAIRING_PHONE_ERROR = 'Invalid phone number. Use full international format (e.g. 947XXXXXXXX, 14155551234, 447911123456) — digits only, country code included, no + or spaces.';

// WhatsApp / E.164 numbers are 7-15 digits including country code.
const INTL_PHONE_RE = /^[1-9]\d{6,14}$/;

function normalizeSriLankanPhoneNumber(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return { ok: false, error: PAIRING_PHONE_ERROR };
    }

    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
        return { ok: false, error: PAIRING_PHONE_ERROR };
    }

    // Sri Lankan convenience: local "07XXXXXXXX" → rewrite to 94XXXXXXXXX.
    if (/^07\d{8}$/.test(cleaned)) {
        return { ok: true, phone: `94${cleaned.slice(1)}` };
    }

    // Generic international fallback (covers LK 947…, US 1…, UK 44…, IN 91…, etc.).
    if (INTL_PHONE_RE.test(cleaned)) {
        return { ok: true, phone: cleaned };
    }

    return { ok: false, error: PAIRING_PHONE_ERROR };
}

// Alias under a more accurate name for new call sites. Keep the historical name
// exported so existing imports (bot.js, session-manager.js, dashboard.js,
// lib/automation-runtime.js, etc.) keep working without edits.
const normalizePhoneNumber = normalizeSriLankanPhoneNumber;

module.exports = {
    PAIRING_PHONE_ERROR,
    normalizeSriLankanPhoneNumber,
    normalizePhoneNumber,
};
