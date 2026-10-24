(function () {
  var id = document.currentScript && document.currentScript.dataset.gaId;
  if (!id) return;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", id);
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a.button");
    if (a && /Start .*trial/.test(a.textContent)) gtag("event", "begin_checkout");
  });
})();
