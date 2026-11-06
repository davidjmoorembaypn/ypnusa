/* YPN USA site behaviour: mobile menu, native lead forms, ZIP checker. No dependencies. */
(function () {
  'use strict';
  var btn = document.querySelector('.ypx-menu-btn'), nav = document.getElementById('ypx-nav');
  if (btn && nav) btn.addEventListener('click', function () { var open = nav.classList.toggle('is-open'); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); });

  function track(name, params) { try { (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: name }, params || {})); if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }

  document.querySelectorAll('form[data-ypx-lead]').forEach(function (f) {
    var out = f.querySelector('.ypx-res'), b = f.querySelector('button[type=submit]');
    try { var z = f.elements.zip, saved = localStorage.getItem('ypn_zip'); if (z && !z.value && /^\d{5}$/.test(saved || '')) z.value = saved; } catch (e) {}
    var qs = new URLSearchParams(location.search);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(f).entries());
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) { if (qs.get(k)) data[k] = qs.get(k); });
      if (!data.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) { out.textContent = 'Enter your first name and a valid email.'; return; }
      if (!f.elements.consent.checked) { out.textContent = 'Please confirm email permission.'; return; }
      if (data.zip && !/^\d{5}$/.test(data.zip)) { out.textContent = 'Enter a complete 5-digit ZIP or leave it blank.'; return; }
      b.disabled = true; out.textContent = 'Sending…';
      fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d && d.message || 'Please try again.'); return d; }); })
        .then(function (d) { out.textContent = d.message || 'Thanks! Check your inbox.'; f.reset(); track('generate_lead', { method: data.source || 'form' }); })
        .catch(function (err) { out.textContent = err.message || 'Please try again.'; })
        .then(function () { b.disabled = false; });
    });
  });

  var zf = document.querySelector('form[data-ypx-zip]');
  if (zf) {
    var input = zf.querySelector('input'), res = document.querySelector('.ypx-zipres'), next = document.querySelector('.ypx-zipnext');
    var check = function (zip) {
      res.className = 'ypx-zipres'; res.textContent = 'Checking ' + zip + '…';
      fetch('/api/zip-check/' + zip).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.available) {
          res.className = 'ypx-zipres is-open'; res.textContent = zip + ' is currently available. Checking does not reserve it.';
          try { localStorage.setItem('ypn_zip', zip); } catch (e) {}
          if (next) { next.hidden = false; var z = next.querySelector('input[name=zip]'); if (z) z.value = zip; }
          track('ypn_zip_available', { zip: zip });
        } else if (d && d.success) { res.className = 'ypx-zipres is-taken'; res.textContent = zip + ' is currently held by another loan officer. Try a nearby ZIP.'; track('ypn_zip_taken'); }
        else { res.textContent = (d && d.message) || "Couldn't check that ZIP right now. Please try again."; }
      }).catch(function () { res.textContent = "Couldn't reach the territory checker. Please try again."; });
    };
    zf.addEventListener('submit', function (e) { e.preventDefault(); var z = (input.value || '').trim(); if (!/^\d{5}$/.test(z)) { input.focus(); return; } history.replaceState(null, '', '?zip=' + z); check(z); });
    input.addEventListener('input', function () { input.value = input.value.replace(/\D/g, '').slice(0, 5); });
    var q = new URLSearchParams(location.search).get('zip');
    if (/^\d{5}$/.test(q || '')) { input.value = q; check(q); }
  }
})();
