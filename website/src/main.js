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

// Interest check: ticking an option counts it as an Umami event, once per option and page view
// (Umami only loads on the live host, so dev never counts). "Counted" is only shown once the event
// was handed to Umami; when it never loads (blocked, offline, dev) the visitor is pointed to the
// button instead, whose Tally form also records the choice. The button is the optional launch
// e-mail: it hands off to the Tally form, prefilled with the choice via query parameters. Without
// a configured form ID the build ships a form that explains it is not live.
const form = document.querySelector('form.interest');
if (form) {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const say = (tone, text) => {
    status.dataset.tone = tone;
    status.textContent = text;
  };
  const counted = new Set();

  // Umami's script is deferred, so a quick tick can come before it is ready: wait a moment.
  const umamiReady = () =>
    new Promise((resolve) => {
      const started = Date.now();
      const check = () => {
        if (window.umami) resolve(window.umami);
        else if (Date.now() - started > 4000) resolve(null);
        else setTimeout(check, 200);
      };
      check();
    });

  form.addEventListener('change', async (event) => {
    const option = event.target;
    if (!option.checked || counted.has(option.name)) return;
    counted.add(option.name);
    const umami = await umamiReady();
    if (!umami) {
      counted.delete(option.name);
      say('note', form.dataset.msgBlocked);
      return;
    }
    umami.track('interest', { option: option.name });
    say('ok', form.dataset.msgCounted);
  });

  form.addEventListener('submit', (event) => {
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

// The spreadsheet illustration is one keyboard stop (the broken #REF! cell); arrow keys move
// between cells, and the formula bar follows focus through CSS. Home/End jump within a row.
const sheet = document.querySelector('.sheet--live');
if (sheet) {
  const cells = [...sheet.querySelectorAll('td[data-c]')];
  const at = (col, row) => sheet.querySelector(`td[data-c="${col}${row}"]`);
  const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  sheet.addEventListener('keydown', (event) => {
    const cell = event.target.closest('td[data-c]');
    if (!cell) return;
    const col = cell.dataset.c.charCodeAt(0);
    const row = Number(cell.dataset.c.slice(1));
    let next = null;
    if (event.key in moves) {
      const [dx, dy] = moves[event.key];
      next = at(String.fromCharCode(col + dx), row + dy);
    } else if (event.key === 'Home') next = at('B', row);
    else if (event.key === 'End') next = at('E', row);
    if (!next) return;
    event.preventDefault();
    for (const c of cells) c.tabIndex = c === next ? 0 : -1;
    next.focus();
  });
}
