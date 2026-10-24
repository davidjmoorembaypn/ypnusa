/*! ypn-ads loader. Load with:  <script src="/assets/ypn-ads.js" defer></script>
 *  Contract: slots are server-rendered as
 *    <div class="ypn-slot" data-ypn-slot="top" data-size="728x90"></div>
 *  and ypn-ads.css reserves their exact size, so nothing here may ever resize a slot.
 *  Never throws, never logs errors: any failure ends in a house ad or a below-the-fold collapse. */
(function () {
  "use strict";
  var API = "/api/ads";
  var TIMEOUT_MS = 350; // browser-side ceiling; the server DSP window is 150ms
  var DEBUG = /[?&]ypn_ads_debug=1/.test(location.search);
  var HOUSE_FALLBACK = { title: "Own your zip code", body: "Check if your zip code is open for exclusive loan officer leads.", cta: "Check your zip code", href: "/check-zip" };
  var CSP = "default-src 'none'; img-src https: data:; media-src https:; style-src 'unsafe-inline' https:; script-src 'unsafe-inline' https:; font-src https: data:; connect-src https:; frame-src https:; base-uri 'none'; form-action https:";

  function log() { if (DEBUG && window.console && console.debug) console.debug.apply(console, ["[ypn-ads]"].concat([].slice.call(arguments))); }
  function consent() {
    var c = (window.YPN_CONSENT && typeof window.YPN_CONSENT === "object") ? window.YPN_CONSENT : {};
    return { personalize: c.personalize === true && navigator.globalPrivacyControl !== true, usp: c.usp, gpp: c.gpp, gppSid: c.gppSid, tcf: c.tcf };
  }
  function belowFold(el) { var r = el.getBoundingClientRect(); return r.top > (window.innerHeight || document.documentElement.clientHeight); }
  function isVisible(el) { return el.offsetWidth > 0 && el.offsetHeight > 0; }

  function renderHouse(slot, ad) {
    var a = document.createElement("a");
    a.className = "ypn-house";
    var href = ad && typeof ad.href === "string" && ad.href.charAt(0) === "/" && ad.href.charAt(1) !== "/" ? ad.href : HOUSE_FALLBACK.href;
    a.href = href;
    var t = document.createElement("strong"); t.textContent = (ad && ad.title) || HOUSE_FALLBACK.title; a.appendChild(t);
    if (ad && ad.body !== "") { var p = document.createElement("span"); p.textContent = (ad && ad.body) || HOUSE_FALLBACK.body; a.appendChild(p); }
    var c = document.createElement("span"); c.className = "cta"; c.textContent = (ad && ad.cta) || HOUSE_FALLBACK.cta; a.appendChild(c);
    slot.textContent = "";
    slot.appendChild(a);
    slot.setAttribute("data-state", "filled");
    slot.setAttribute("data-kind", "house");
  }

  function renderBid(slot, ad) {
    var f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox");
    f.setAttribute("referrerpolicy", "no-referrer");
    f.setAttribute("scrolling", "no");
    f.setAttribute("title", "Advertisement");
    f.setAttribute("width", String(ad.w)); f.setAttribute("height", String(ad.h));
    f.srcdoc = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + CSP + '"><base target="_blank"><style>html,body{margin:0;padding:0;overflow:hidden}</style>' + ad.html;
    slot.textContent = "";
    slot.appendChild(f);
    slot.setAttribute("data-state", "filled");
    slot.setAttribute("data-kind", "bid");
    if (ad.token) watchImpression(slot, ad.token);
  }

  function watchImpression(slot, token) {
    if (!("IntersectionObserver" in window) || !navigator.sendBeacon) return;
    var timer = null, sent = false;
    var io = new IntersectionObserver(function (entries) {
      var e = entries[0];
      if (e.isIntersecting && e.intersectionRatio >= 0.5) {
        if (!timer && !sent) timer = setTimeout(function () { sent = true; try { navigator.sendBeacon(API + "/event", token); } catch (err) { log("beacon", err && err.message); } io.disconnect(); }, 1000);
      } else if (timer) { clearTimeout(timer); timer = null; }
    }, { threshold: [0.5] });
    io.observe(slot);
  }

  function failSlot(slot) {
    // A slot that is in view keeps its space and shows the house ad; one below the fold may
    // collapse because shifting content nobody can see is not a layout shift.
    if (!isVisible(slot)) return;
    if (belowFold(slot)) { slot.setAttribute("data-state", "collapsed"); return; }
    renderHouse(slot, null);
  }

  function request(slots) {
    var ctl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT_MS);
    var body = JSON.stringify({ page: location.href, consent: consent(), slots: slots.map(function (s) { return { id: s.getAttribute("data-ypn-slot"), size: s.getAttribute("data-size"), pos: s.getAttribute("data-pos") ? Number(s.getAttribute("data-pos")) : 0 }; }) });
    return fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: body, credentials: "same-origin", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw new Error("status"); return r.json(); });
  }

  function fill(slots) {
    var live = slots.filter(function (s) { return s.getAttribute("data-state") === "pending"; });
    if (!live.length) return;
    request(live).then(function (res) {
      live.forEach(function (slot) {
        try {
          var ad = res && res.slots && res.slots[slot.getAttribute("data-ypn-slot")];
          if (ad && ad.type === "bid" && typeof ad.html === "string") renderBid(slot, ad);
          else if (ad && ad.type === "house") renderHouse(slot, ad);
          else failSlot(slot);
        } catch (x) { log("render", x && x.message); failSlot(slot); }
      });
    }).catch(function (x) { log("request", x && x.message); live.forEach(failSlot); });
  }

  function init() {
    var slots = [].slice.call(document.querySelectorAll(".ypn-slot[data-ypn-slot]"));
    if (!slots.length) return;
    slots.forEach(function (s) { s.setAttribute("data-state", "pending"); });
    if (!("IntersectionObserver" in window)) { fill(slots); return; }
    var queue = [], flush = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); queue.push(e.target); } });
      if (queue.length && !flush) flush = setTimeout(function () { var batch = queue; queue = []; flush = null; fill(batch); }, 30);
    }, { rootMargin: "300px 0px" });
    slots.forEach(function (s) { io.observe(s); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
