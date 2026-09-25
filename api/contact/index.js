'use strict';

const { parse, clientIp } = require('../shared/request');
const { evaluate, isValidEmail } = require('../shared/spam');
const { sendNotification, RECIPIENT } = require('../shared/mail');

const OK = {
  ok: true,
  message: 'Thank you — your message is on its way. We reply to most inquiries within one business day.',
};

module.exports = async function (context, req) {
  const respond = (status, body) => {
    context.res = {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body,
    };
  };

  const { fields, malformed } = parse(req);
  if (malformed) {
    context.log.warn('contact: malformed request body');
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
    // Answer 200 with the normal success text. Telling a bot it was blocked just
    // teaches whoever wrote it which check to defeat next, and a false positive
    // on a real inquiry at least does not show the visitor an error. The message
    // is dropped, and the reasons are logged so a genuine miss can be traced.
    context.log.warn(`contact: blocked (score ${verdict.score}) — ${verdict.reasons.join('; ')}`);
    return respond(200, OK);
  }

  const rows = [
    ['Name', `${first} ${last}`],
    ['Email', email],
    ['Phone', fields.phone],
    ['Organization', fields.organization],
    ['Care setting', fields.care_setting],
    ['Approx. census', fields.census],
    ['Message', fields.message],
  ];

  try {
    await sendNotification({
      subject: `Website inquiry — ${first} ${last}${fields.organization ? ` (${fields.organization})` : ''}`,
      heading: 'New contact form submission',
      subheading: 'signiasolutions.com / contact',
      rows,
      footer: `Reply directly to this email to answer ${first}. Sent to ${RECIPIENT} by the website contact form.`,
      replyTo: email,
    });
  } catch (err) {
    if (err.code === 'NOT_CONFIGURED') {
      context.log.error('contact: ACS_CONNECTION_STRING missing — submission NOT delivered');
    } else {
      context.log.error(`contact: send failed — ${err.message}`);
    }
    // 5xx on purpose: the browser outbox treats it as retryable, so a transient
    // ACS outage does not silently swallow a lead.
    return respond(502, {
      ok: false,
      message: 'Sorry, something went wrong sending that. Please call (763) 308-3282 and we will help right away.',
    });
  }

  context.log(`contact: delivered from ${email} (spam score ${verdict.score})`);
  return respond(200, OK);
};
