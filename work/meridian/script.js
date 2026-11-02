// Meridian landing page interactions
(function () {
  // Walkthrough feature list: one active item at a time.
  var features = document.querySelectorAll('.feature');
  features.forEach(function (btn) {
    btn.addEventListener('click', function () {
      features.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    });
  });

  // FAQ: questions with an answer toggle it open and closed.
  document.querySelectorAll('.bubble--q[aria-controls]').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
  });
})();
