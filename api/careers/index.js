'use strict';

const { parse, clientIp } = require('../shared/request');
const { evaluate, isValidEmail } = require('../shared/spam');
const { sendNotification, MAX_ATTACHMENT_BYTES, RECIPIENT } = require('../shared/mail');

const OK = {
  ok: true,
  message: "Thank you — your application is in. We'll be in touch shortly.",
};

// Matches the accept attribute on the form. Checked by extension AND by magic
// bytes: a browser reports whatever content type the OS guessed, so the
// extension alone is not evidence of what the file actually is.
const ALLOWED_EXT = /\.(pdf|docx?|rtf|txt)$/i;

function sniff(buffer) {
  if (!buffer || buffer.length < 4) return 'unknown';
  const b = buffer;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';   // %PDF
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05)) return 'zip'; // docx
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'ole';   // legacy .doc
  if (b.slice(0, 5).toString('latin1') === '{\\rtf') return 'rtf';
  return 'unknown';
}

module.exports = async function (context, req) {
  const respond = (status, body) => {
    context.res = {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body,
    };
  };

  const { fields, files, malformed } = parse(req);
  if (malformed) {
    context.log.warn('careers: malformed request body');
    return respond(400, { ok: false, message: 'That submission could not be read. Please try again.' });
  }

  const first = String(fields.first_name || '').trim();
  const last = String(fields.last_name || '').trim();
  const email = String(fields.email || '').trim();

  if (!first || !last || !isValidEmail(email)) {
    return respond(400, {
      ok: false,
      message: 'Please provide your first name, last name and a valid email address.',
    });
  }

  const verdict = evaluate(fields, { ip: clientIp(req) });
  if (verdict.spam) {
    context.log.warn(`careers: blocked (score ${verdict.score}) — ${verdict.reasons.join('; ')}`);
    return respond(200, OK);
  }

  // Resume is optional — rejecting an otherwise good applicant because their
  // upload failed would lose a real candidate. A bad file is reported; a missing
  // one is simply noted in the email.
  let attachment;
  let resumeNote = 'No resume attached.';
  const resume = files.find((f) => f.field === 'resume') || files[0];

  if (resume) {
    if (resume.buffer.length > MAX_ATTACHMENT_BYTES) {
      return respond(413, {
        ok: false,
        message: `That resume is ${(resume.buffer.length / 1048576).toFixed(1)} MB. Please attach a file under 5 MB, or email it to ${RECIPIENT}.`,
      });
    }
    if (!ALLOWED_EXT.test(resume.name)) {
      return respond(415, {
        ok: false,
        message: 'Please attach the resume as a PDF, DOC, DOCX, RTF or TXT file.',
      });
    }
    const kind = sniff(resume.buffer);
    if (kind === 'unknown') {
      return respond(415, {
        ok: false,
        message: "That file doesn't look like a document we can open. Please attach a PDF, DOC, DOCX, RTF or TXT.",
      });
    }
    attachment = { name: resume.name, contentType: resume.contentType, buffer: resume.buffer };
    resumeNote = `${resume.name} (${(resume.buffer.length / 1024).toFixed(0)} KB, detected: ${kind})`;
  }

  const rows = [
    ['Name', `${first} ${last}`],
    ['Email', email],
    ['Phone', fields.phone],
    ['City & state', fields.city_state],
    ['RN license state', fields.license_state],
    ['Available from', fields.available_start],
    ['Resume', resumeNote],
    ['Notes', fields.message],
  ];

  try {
    await sendNotification({
      subject: `Application — ${first} ${last}`,
      heading: 'New career application',
      subheading: 'signiasolutions.com / careers',
      rows,
      footer: `Reply directly to this email to answer ${first}. Sent to ${RECIPIENT} by the website careers form.`,
      replyTo: email,
      attachment,
    });
  } catch (err) {
    if (err.code === 'ATTACHMENT_TOO_LARGE') {
      return respond(413, {
        ok: false,
        message: `Please attach a resume under 5 MB, or email it to ${RECIPIENT}.`,
      });
    }
    if (err.code === 'NOT_CONFIGURED') {
      context.log.error('careers: ACS_CONNECTION_STRING missing — application NOT delivered');
    } else {
      context.log.error(`careers: send failed — ${err.message}`);
    }
    return respond(502, {
      ok: false,
      message: 'Sorry, something went wrong sending that. Please call (763) 308-3282 and we will help right away.',
    });
  }

  context.log(`careers: delivered from ${email} (spam score ${verdict.score}, resume ${resume ? 'yes' : 'no'})`);
  return respond(200, OK);
};
