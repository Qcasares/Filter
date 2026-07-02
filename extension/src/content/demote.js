// Demote UI: collapse a matched element to a slim reveal bar, injected inside a
// shadow root so site CSS cannot mangle the bar and the bar's CSS cannot leak
// into the page. Demote, never delete: the original element is only hidden and
// is restored intact on reveal.

const BAR_TEXT = 'US story hidden · tap to reveal';
const SESSION_KEY = 'hemi:revealed';

// One shadow host per demoted element.
const hostFor = new WeakMap();

// Reveals are remembered for the browsing session so a story the owner chose to
// see does not snap shut again on the next scan or threshold change.
const revealed = loadRevealed();

function loadRevealed() {
  try {
    const raw = globalThis.sessionStorage?.getItem(SESSION_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function persistRevealed() {
  try {
    globalThis.sessionStorage?.setItem(SESSION_KEY, JSON.stringify([...revealed]));
  } catch {
    /* private mode or storage disabled: keep the in-memory set only */
  }
}

export function isRevealed(hash) {
  return revealed.has(hash);
}

export function markRevealed(hash) {
  revealed.add(hash);
  persistRevealed();
}

function buildBar(doc, onClick) {
  const host = doc.createElement('div');
  host.className = 'hemi-bar-host';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = `
    :host { all: initial; display: block; }
    .bar {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      width: 100%;
      height: 28px;
      padding: 0 10px;
      background: #f2f2f2;
      border: 0;
      border-left: 3px solid #c8961e;
      color: #555;
      font: inherit;
      font-size: 13px;
      line-height: 28px;
      text-align: left;
      cursor: pointer;
    }
    .bar:hover { background: #ececec; }
  `;
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'bar';
  button.textContent = BAR_TEXT;
  button.addEventListener('click', onClick);
  shadow.append(style, button);
  return host;
}

/**
 * Collapse an element to the reveal bar. Idempotent: a second call on an
 * already-demoted element does nothing.
 * @param {Element} el the element to hide
 * @param {string} hash headline hash, used to remember reveals
 * @param {{ onReveal?: (hash:string)=>void }} [opts]
 */
export function demote(el, hash, opts = {}) {
  if (!el || el.dataset.hemiDemoted === '1') return null;
  const doc = el.ownerDocument;
  const host = buildBar(doc, () => reveal(el, hash, opts.onReveal));

  el.dataset.hemiDemoted = '1';
  el.dataset.hemiDisplay = el.style.display || '';
  el.parentNode.insertBefore(host, el);
  el.style.display = 'none';
  hostFor.set(el, host);
  return host;
}

/**
 * Restore a demoted element without recording a user reveal. Used when the
 * threshold moves or the site is disabled, so the bar disappears silently.
 */
export function undemote(el) {
  if (!el || el.dataset.hemiDemoted !== '1') return;
  el.style.display = el.dataset.hemiDisplay || '';
  delete el.dataset.hemiDemoted;
  delete el.dataset.hemiDisplay;
  const host = hostFor.get(el);
  if (host) { host.remove(); hostFor.delete(el); }
}

// User clicked the bar: restore and remember the reveal for the session.
function reveal(el, hash, onReveal) {
  undemote(el);
  markRevealed(hash);
  if (onReveal) onReveal(hash);
}
