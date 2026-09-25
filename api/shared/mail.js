'use strict';

const { EmailClient } = require('@azure/communication-email');

/**
 * Email delivery via Azure Communication Services.
 *
 * Everything stays inside the Signia Azure tenant — no third-party form service
 * sits in the submission path. That is deliberate: the privacy policy on this
 * site tells visitors we share data only with providers who need it to operate,
 * and on a healthcare site a form vendor with no BAA is exactly the dependency
 * worth not having.
 */

const CONNECTION_STRING = process.env.ACS_CONNECTION_STRING;
const SENDER = process.env.ACS_SENDER_ADDRESS || 'DoNotReply@forms.signiasolutions.com';
const RECIPIENT = process.env.FORM_RECIPIENT || 'hi@signiasolutions.com';

// Attachments ride inside the notification email, so this ceiling is about what
// a mailbox will accept, not what the Function can hold.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip CR/LF so a submitted value can never inject extra mail headers. */
function headerSafe(value) {
  return String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').trim();
}

function renderRows(rows) {
  return rows
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([label, value]) => `
      <tr>
        <td style="padding:8px 14px 8px 0;vertical-align:top;color:#5C6979;font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;white-space:nowrap;">${escapeHtml(label)}</td>
        <td style="padding:8px 0;vertical-align:top;color:#18212F;font:14px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;">${escapeHtml(value).replace(/\n/g, '<br>')}</td>
      </tr>`)
    .join('');
}

function renderHtml({ heading, subheading, rows, footer }) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#F2F8FD;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #DCEBFA;border-radius:12px;">
    <tr><td style="padding:22px 26px;border-bottom:1px solid #EDF1F6;">
      <div style="font:700 17px/1.3 -apple-system,Segoe UI,Roboto,sans-serif;color:#18212F;">${escapeHtml(heading)}</div>
      <div style="font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#5C6979;margin-top:4px;">${escapeHtml(subheading)}</div>
    </td></tr>
    <tr><td style="padding:18px 26px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${renderRows(rows)}</table>
    </td></tr>
    <tr><td style="padding:14px 26px 20px;border-top:1px solid #EDF1F6;font:12px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;color:#5C6979;">
      ${escapeHtml(footer)}
    </td></tr>
  </table>
</body></html>`;
}

function renderText(rows) {
  return rows
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}

/**
 * @param {object} opts
 * @param {string} opts.subject
 * @param {string} opts.heading
 * @param {string} opts.subheading
 * @param {Array<[string, any]>} opts.rows
 * @param {string} opts.footer
 * @param {string} [opts.replyTo]
 * @param {{name: string, contentType: string, buffer: Buffer}} [opts.attachment]
 */
async function sendNotification(opts) {
  if (!CONNECTION_STRING) {
    const err = new Error('ACS_CONNECTION_STRING is not configured');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }

  const client = new EmailClient(CONNECTION_STRING);

  const message = {
    senderAddress: SENDER,
    content: {
      subject: headerSafe(opts.subject),
      plainText: `${renderText(opts.rows)}\n\n---\n${opts.footer}`,
      html: renderHtml(opts),
    },
    recipients: { to: [{ address: RECIPIENT }] },
  };

  // Reply-To means hitting Reply in Outlook answers the person who submitted,
  // not the no-reply sender. Header-injection is stripped above.
  if (opts.replyTo) {
    const clean = headerSafe(opts.replyTo);
    if (clean) message.replyTo = [{ address: clean }];
  }

  if (opts.attachment && opts.attachment.buffer && opts.attachment.buffer.length) {
    if (opts.attachment.buffer.length > MAX_ATTACHMENT_BYTES) {
      const err = new Error('Attachment exceeds the size limit');
      err.code = 'ATTACHMENT_TOO_LARGE';
      throw err;
    }
    message.attachments = [{
      name: headerSafe(opts.attachment.name) || 'attachment',
      contentType: opts.attachment.contentType || 'application/octet-stream',
      contentInBase64: opts.attachment.buffer.toString('base64'),
    }];
  }

  const poller = await client.beginSend(message);
  return poller.pollUntilDone();
}

module.exports = { sendNotification, escapeHtml, headerSafe, MAX_ATTACHMENT_BYTES, RECIPIENT, SENDER };
