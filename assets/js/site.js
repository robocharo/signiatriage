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
     Both forms POST to this site's own API — Azure Static Web Apps managed
     Functions at /api/contact and /api/careers — which mail the submission
     to hi@signiasolutions.com via Azure Communication Services. Nothing
     leaves the Signia tenant, so no third-party form service becomes a data
     processor for a healthcare site.

     Everything below is convenience only. The server independently validates
     every field, scores the submission for spam, and sniffs uploaded files;
     none of it trusts this script. In particular `form_started` is a hint the
     server weighs, never a gate it obeys — a bot can forge it trivially.

     Neither form may be used to collect PHI. See README.
  */
  Array.prototype.forEach.call(document.querySelectorAll('form[data-ajax="true"]'), function (form) {
    var status = form.querySelector('.form-status');
    var submit = form.querySelector('button[type="submit"]');

    // Stamp when the form became fillable. A submission that arrives a few
    // hundred milliseconds later was not typed by a person.
    var started = form.querySelector('input[name="form_started"]');
    if (started) { started.value = String(Date.now()); }

    form.addEventListener('submit', function (e) {
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
          // Read the body either way: the API explains WHY it refused (file too
          // large, wrong type, missing field), and that reason is far more
          // useful to the visitor than a generic failure.
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (r) {
          if (r.ok && r.data.ok !== false) {
            form.reset();
            if (started) { started.value = String(Date.now()); } // allow a second send
            show('ok', r.data.message || form.getAttribute('data-success') ||
              'Thank you — your message is on its way. We reply to most inquiries within one business day.');
          } else {
            show('err', r.data.message ||
              'Sorry, something went wrong sending that. Please call (763) 308-3282 and we will help right away.');
          }
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
