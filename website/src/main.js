// Progressive enhancement only: the page reads fine and the interest check submits without JS.

const header = document.querySelector('.site-header');
if (header) {
  const onScroll = () => header.toggleAttribute('data-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

// Screenshots that have not been produced yet show a labelled placeholder instead of a broken image.
for (const img of document.querySelectorAll('.device img')) {
  const swap = () => {
    const missing = document.createElement('div');
    missing.className = 'shot-missing';
    missing.textContent = img.dataset.missing || img.alt;
    img.replaceWith(missing);
  };
  if (img.complete && img.naturalWidth === 0) swap();
  else img.addEventListener('error', swap, { once: true });
}

// Interest check: at least one option, then hand off to the Tally form (prefilled via query
// parameters). Without a configured form ID the build ships a form that explains it is not live.
const form = document.querySelector('form.interest');
if (form) {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const say = (tone, text) => {
    status.dataset.tone = tone;
    status.textContent = text;
  };

  form.addEventListener('change', () => {
    if (status.dataset.tone === 'error') say('', '');
  });

  form.addEventListener('submit', (event) => {
    const picked = form.querySelectorAll('input[type="checkbox"]:checked').length;
    if (picked === 0) {
      event.preventDefault();
      say('error', form.dataset.msgPick);
      form.querySelector('input[type="checkbox"]').focus();
      return;
    }
    if (!form.dataset.live) {
      event.preventDefault();
      say('error', form.dataset.msgOffline);
      return;
    }
    // The form opens Tally in a new tab; confirm here so the visitor knows what happened.
    button.setAttribute('aria-disabled', 'true');
    say('ok', form.dataset.msgSent);
    setTimeout(() => button.removeAttribute('aria-disabled'), 1500);
  });
}
