'use strict';

/**
 * Spam scoring for the public forms.
 *
 * Design notes, because the obvious approaches are the wrong ones here:
 *
 * - No CAPTCHA. Turnstile/hCaptcha would mean loosening the site's CSP from
 *   `script-src 'self'` to allow a third-party script, and pulling a third-party
 *   into the submission path of a healthcare site. Every check below runs on our
 *   own server against data the client already sent.
 *
 * - Nothing here rejects on a single weak signal. Each check adds to a score and
 *   only the total crosses the threshold. A real DON typing in a hurry from a
 *   phone trips one or two of these; a bot trips five. Rejecting a genuine
 *   inquiry is far more expensive than accepting a spam one, so the threshold is
 *   set deliberately high and every decision is logged with its reasons.
 */

// Reject at or above this. Tuned so that no single check can reject alone.
const REJECT_AT = 6;

// A human cannot read the page, type a message and submit in under this.
const MIN_FILL_MS = 3000;
// Older than this and the timestamp is stale/forged rather than a slow visitor.
const MAX_FILL_MS = 24 * 60 * 60 * 1000;

const SPAM_PHRASES = [
  'seo service', 'seo expert', 'rank your website', 'first page of google',
  'backlink', 'guest post', 'link building', 'increase your traffic',
  'web design service', 'mobile app development', 'hire developers',
  'crypto', 'bitcoin', 'forex', 'binary option', 'casino', 'viagra',
  'loan offer', 'work from home', 'make money online', 'bulk email',
  'lead generation service', 'cheap price', 'best offer', 'telegram me',
];

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'throwawaymail.com', 'yopmail.com', 'trashmail.com', 'sharklasers.com',
  'getnada.com', 'dispostable.com', 'maildrop.cc', 'temp-mail.org',
]);

/** Requests seen per IP, in memory. See the caveat in rateLimit(). */
const recentByIp = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

/**
 * @returns {0|1|2} 0 = under the limit, 1 = over it, 2 = flooding.
 *
 * Two levels on purpose. A flat "over the limit" only ever CONTRIBUTED to the
 * score, which meant a bot posting innocuous-looking text with a valid email and
 * plausible timing scored 4 and sailed through forever — the test suite caught
 * exactly that, 0 of 8 blocked. Past twice the limit nothing legitimate is
 * happening, so that tier rejects on its own.
 *
 * In-memory, so this is per Function instance and resets on cold start. It will
 * not stop a distributed flood; it does stop the common case — one script
 * hammering one endpoint — at zero cost and with no extra infrastructure. If
 * volume ever justifies it, move to Table Storage; this signature does not change.
 */
function rateLimit(ip) {
  if (!ip) return 0;
  const now = Date.now();
  const hits = (recentByIp.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recentByIp.set(ip, hits);

  if (recentByIp.size > 5000) {
    for (const [key, times] of recentByIp) {
      if (!times.some((t) => now - t < RATE_WINDOW_MS)) recentByIp.delete(key);
    }
  }
  if (hits.length > RATE_MAX * 2) return 2;
  return hits.length > RATE_MAX ? 1 : 0;
}

function countLinks(text) {
  const m = String(text || '').match(/https?:\/\/|www\.|\[url|<a\s/gi);
  return m ? m.length : 0;
}

function nonLatinRatio(text) {
  const s = String(text || '');
  const letters = s.replace(/[^\p{L}]/gu, '');
  if (letters.length < 12) return 0;
  const nonLatin = letters.replace(/[\p{Script=Latin}]/gu, '');
  return nonLatin.length / letters.length;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(email || '').trim());
}

/**
 * @returns {{spam: boolean, score: number, reasons: string[]}}
 */
function evaluate(fields, meta = {}) {
  const reasons = [];
  let score = 0;
  const add = (points, why) => { score += points; reasons.push(`${why} (+${points})`); };

  // 1. Honeypot. A hidden field no human ever sees, so any value at all is a bot
  //    filling every input it finds. This one IS decisive on its own.
  const honeypot = String(fields['company-website'] || '').trim();
  if (honeypot) add(REJECT_AT, 'honeypot filled');

  // 2. Submission speed.
  const started = Number(fields.form_started || 0);
  if (started > 0) {
    const elapsed = Date.now() - started;
    if (elapsed < MIN_FILL_MS) add(4, `submitted in ${elapsed}ms`);
    else if (elapsed > MAX_FILL_MS) add(2, 'stale form timestamp');
  } else {
    // Missing entirely means the form was posted without rendering the page.
    add(3, 'no form timestamp');
  }

  // 3. Rate limit. Over the limit contributes; a sustained flood rejects outright.
  const rl = rateLimit(meta.ip);
  if (rl === 2) add(REJECT_AT, `flooding from this IP (>${RATE_MAX * 2} in ${RATE_WINDOW_MS / 60000}m)`);
  else if (rl === 1) add(4, `rate limit exceeded for this IP (>${RATE_MAX} in ${RATE_WINDOW_MS / 60000}m)`);

  const message = String(fields.message || '');
  const name = `${fields.first_name || ''} ${fields.last_name || ''}`.trim();
  const email = String(fields.email || '').trim();
  const haystack = `${name} ${email} ${fields.organization || ''} ${message}`.toLowerCase();

  // 4. Links. A senior-living administrator asking about triage has no reason to
  //    paste three URLs; an SEO spammer always does.
  const links = countLinks(message);
  if (links >= 3) add(4, `${links} links in message`);
  else if (links === 2) add(2, '2 links in message');

  // 5. Known solicitation phrases.
  const hits = SPAM_PHRASES.filter((p) => haystack.includes(p));
  if (hits.length) add(Math.min(6, hits.length * 3), `spam phrases: ${hits.slice(0, 3).join(', ')}`);

  // 6. Script mismatch. The audience is Minnesota senior living; a message that is
  //    mostly non-Latin script is not a lost prospect.
  const ratio = nonLatinRatio(message);
  if (ratio > 0.4) add(4, `non-Latin script ${Math.round(ratio * 100)}%`);

  // 7. Email sanity.
  if (!isValidEmail(email)) add(3, 'invalid email address');
  const domain = email.split('@')[1];
  if (domain && DISPOSABLE_DOMAINS.has(domain.toLowerCase())) add(3, 'disposable email domain');

  // 8. Name that is clearly not a name.
  if (name && (countLinks(name) > 0 || name.length > 80)) add(3, 'name field contains a link or is absurdly long');

  return { spam: score >= REJECT_AT, score, reasons };
}

module.exports = { evaluate, isValidEmail, REJECT_AT };
