/* Signia Solutions — site behaviour.
   Deferred, dependency-free, ~2KB. Everything here is progressive enhancement:
   the site is fully readable and navigable with JavaScript disabled. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     Mobile navigation
     --------------------------------------------------------------- */
  var toggle = document.querySelector('.nav__toggle');
  var menu = document.getElementById('nav-menu');

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      menu.classList.toggle('is-open', !open);
    });

    // Close on Escape, and return focus to the button.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        toggle.setAttribute('aria-expanded', 'false');
        menu.classList.remove('is-open');
        toggle.focus();
      }
    });

    // Close when the viewport grows past the mobile breakpoint.
    var mq = window.matchMedia('(min-width: 941px)');
    var onChange = function (e) {
      if (e.matches) {
        toggle.setAttribute('aria-expanded', 'false');
        menu.classList.remove('is-open');
      }
    };
    if (mq.addEventListener) { mq.addEventListener('change', onChange); }
    else if (mq.addListener) { mq.addListener(onChange); }
  }

  /* ---------------------------------------------------------------
     Header shadow once the page scrolls
     --------------------------------------------------------------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
    document.body.prepend(sentinel);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        header.classList.toggle('is-stuck', !entries[0].isIntersecting);
      }).observe(sentinel);
    }
  }

  /* ---------------------------------------------------------------
     Reveal-on-scroll (skipped when the user prefers reduced motion)
     --------------------------------------------------------------- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var revealables = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(revealables, function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    Array.prototype.forEach.call(revealables, function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------
     Current year in the footer
     --------------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------------------------------------------------------------
     Forms
     ---------------------------------------------------------------
     Static site, so there is no server here. Two supported modes:

       1. Host on Netlify / Cloudflare Pages with Forms enabled — the
          `data-netlify="true"` attribute on the <form> is enough and this
          script simply lets the normal POST happen.
       2. Point `action` at any HTTPS endpoint that accepts a POST and
          returns 2xx (Formspree, Basin, Getform, a Zapier catch hook, or
          your own handler). Add `data-ajax="true"` and the submission is
          sent in the background with an inline success message.

     Client-side validation here is a convenience only. Whatever endpoint
     receives this data must validate and sanitise server-side, and must
     never be used to collect PHI — see README.
  */
  Array.prototype.forEach.call(document.querySelectorAll('form[data-ajax="true"]'), function (form) {
    var status = form.querySelector('.form-status');
    var submit = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', function (e) {
      if (!form.action || form.action.indexOf('REPLACE_ME') !== -1) {
        // Endpoint not configured yet — let the author know rather than
        // silently pretending the message was delivered.
        e.preventDefault();
        show('err', 'This form is not connected to an endpoint yet. Set the form action in the HTML — see README.md.');
        return;
      }
      if (!form.checkValidity()) { return; } // let the browser show its messages

      e.preventDefault();
      var original = submit ? submit.textContent : '';
      if (submit) { submit.disabled = true; submit.textContent = 'Sending…'; }

      fetch(form.action, {
        method: form.method || 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      })
        .then(function (res) {
          if (!res.ok) { throw new Error('Request failed: ' + res.status); }
          form.reset();
          show('ok', form.getAttribute('data-success') ||
            'Thank you — your message is on its way. We reply to most inquiries within one business day.');
        })
        .catch(function () {
          show('err', 'Sorry, something went wrong sending that. Please call (763) 308-3282 and we will help right away.');
        })
        .then(function () {
          if (submit) { submit.disabled = false; submit.textContent = original; }
        });
    });

    function show(kind, message) {
      if (!status) { window.alert(message); return; }
      status.textContent = message;
      status.className = 'form-status is-visible form-status--' + (kind === 'ok' ? 'ok' : 'err');
      status.setAttribute('role', 'status');
      status.focus && status.focus();
      status.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    }
  });
})();
