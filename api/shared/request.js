'use strict';

const multipart = require('parse-multipart-data');

/**
 * Normalise an incoming form POST into { fields, files }.
 *
 * The two forms on this site post differently — careers is multipart because it
 * carries a resume, contact is urlencoded — and the browser also retries as JSON
 * in some offline-replay paths. Rather than make each handler care, everything
 * lands in the same shape here.
 *
 * Bindings declare `dataType: "binary"`, so `req.body` is a Buffer and multipart
 * boundaries survive intact. Decoding it as a string first is what corrupts
 * uploaded files, which is why that is not done anywhere in this file.
 */

const MAX_FIELD_LEN = 20000;

function clamp(value) {
  const s = String(value == null ? '' : value);
  return s.length > MAX_FIELD_LEN ? s.slice(0, MAX_FIELD_LEN) : s;
}

function bodyBuffer(req) {
  const b = req.rawBody != null ? req.rawBody : req.body;
  if (b == null) return Buffer.alloc(0);
  if (Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') return Buffer.from(b, 'utf8');
  return Buffer.from(JSON.stringify(b), 'utf8');
}

function parse(req) {
  const fields = {};
  const files = [];
  const contentType = String(
    (req.headers && (req.headers['content-type'] || req.headers['Content-Type'])) || ''
  );
  const buf = bodyBuffer(req);

  if (contentType.includes('multipart/form-data')) {
    const m = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    const boundary = m ? (m[1] || m[2]).trim() : null;
    if (boundary && buf.length) {
      let parts = [];
      try {
        parts = multipart.parse(buf, boundary);
      } catch (err) {
        // A malformed body is a client problem, not a server one. Returning
        // empty fields makes the caller answer 400 rather than 500 — which
        // matters because the browser outbox treats 5xx as retryable and would
        // replay a broken payload for hours.
        return { fields, files, malformed: true };
      }
      for (const part of parts) {
        if (part.filename) {
          if (part.data && part.data.length) {
            files.push({
              field: part.name,
              name: part.filename,
              contentType: part.type || 'application/octet-stream',
              buffer: part.data,
            });
          }
        } else if (part.name) {
          fields[part.name] = clamp(part.data ? part.data.toString('utf8') : '');
        }
      }
    }
    return { fields, files };
  }

  const text = buf.toString('utf8');

  if (contentType.includes('application/json')) {
    try {
      const obj = JSON.parse(text || '{}');
      for (const [k, v] of Object.entries(obj || {})) fields[k] = clamp(v);
    } catch (err) {
      return { fields, files, malformed: true };
    }
    return { fields, files };
  }

  // Default: application/x-www-form-urlencoded
  const params = new URLSearchParams(text);
  for (const [k, v] of params.entries()) fields[k] = clamp(v);
  return { fields, files };
}

/** Best-effort caller IP, for rate limiting only. */
function clientIp(req) {
  const h = req.headers || {};
  const fwd = h['x-forwarded-for'] || h['X-Forwarded-For'] || '';
  const first = String(fwd).split(',')[0].trim();
  // Azure appends :port on forwarded addresses; strip it, but leave IPv6 alone.
  const noPort = first.includes(':') && first.split(':').length === 2 ? first.split(':')[0] : first;
  return noPort || h['x-azure-clientip'] || h['x-client-ip'] || '';
}

module.exports = { parse, clientIp, MAX_FIELD_LEN };
