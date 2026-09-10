// Toggles the mobile hamburger disclosure open/closed for every
// gift-header-bar instance on the page (desktop ignores the toggle, it's
// hidden via CSS there).
document.querySelectorAll('.gift-header-bar').forEach(function (root) {
  var toggle = root.querySelector('.gift-header-bar__toggle');
  if (!toggle) return;

  toggle.addEventListener('click', function () {
    var isOpen = root.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
});
