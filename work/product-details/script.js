// Product details page interactions
(function () {
  var MIN = 1, MAX = 99;
  var qty = 1;

  // Quantity: the inline selector and the mobile bar share one value.
  var outputs = document.querySelectorAll('.qty__val');
  var steppers = document.querySelectorAll('.qty__btn');
  function renderQty() {
    outputs.forEach(function (o) { o.textContent = String(qty); });
    steppers.forEach(function (b) {
      var step = Number(b.getAttribute('data-step'));
      b.disabled = (step < 0 && qty <= MIN) || (step > 0 && qty >= MAX);
    });
  }
  steppers.forEach(function (b) {
    b.addEventListener('click', function () {
      qty = Math.min(MAX, Math.max(MIN, qty + Number(b.getAttribute('data-step'))));
      renderQty();
    });
  });
  renderQty();

  // Add to cart: brief confirmation on the button.
  document.querySelectorAll('.add').forEach(function (btn) {
    var label = btn.textContent;
    var timer;
    btn.addEventListener('click', function () {
      btn.textContent = 'ADDED (' + qty + ')';
      clearTimeout(timer);
      timer = setTimeout(function () { btn.textContent = label; }, 1600);
    });
  });

  // Descriptions disclosure.
  var accBtn = document.querySelector('.acc__btn');
  if (accBtn) {
    var panel = document.getElementById(accBtn.getAttribute('aria-controls'));
    accBtn.addEventListener('click', function () {
      var open = accBtn.getAttribute('aria-expanded') === 'true';
      accBtn.setAttribute('aria-expanded', String(!open));
      panel.hidden = open;
    });
  }

  // Mobile menu: reveals the primary nav under the header.
  var menuBtn = document.querySelector('.menu-btn');
  var nav = document.getElementById('site-nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });
  }

  // Newsletter: client-side check only.
  var form = document.querySelector('.toner__form');
  if (form) {
    var input = form.querySelector('.toner__input');
    var status = form.querySelector('.toner__status');
    var btn = form.querySelector('.toner__btn');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!input.checkValidity() || !input.value) {
        form.classList.add('is-error');
        status.textContent = 'Please enter a valid email address.';
        input.focus();
        return;
      }
      form.classList.remove('is-error');
      status.textContent = 'Thanks, you are subscribed.';
      btn.textContent = 'SUBSCRIBED';
      input.value = '';
    });
  }

  // Mobile sticky add-to-cart bar: shown while the inline one is off screen.
  var bar = document.getElementById('buybar');
  var buy = document.getElementById('buy');
  var mq = window.matchMedia('(max-width: 1023px)');
  if (bar && buy && 'IntersectionObserver' in window) {
    var offscreen = false;
    function sync() {
      var show = offscreen && mq.matches;
      bar.classList.toggle('is-visible', show);
      document.body.classList.toggle('has-buybar', show);
      if (show) { bar.removeAttribute('inert'); bar.removeAttribute('aria-hidden'); }
      else { bar.setAttribute('inert', ''); bar.setAttribute('aria-hidden', 'true'); }
    }
    new IntersectionObserver(function (entries) {
      offscreen = !entries[0].isIntersecting;
      sync();
    }).observe(buy);
    if (mq.addEventListener) mq.addEventListener('change', sync);
  }
})();
