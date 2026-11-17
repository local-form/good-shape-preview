// Shared by every page: the phone menu, gentle reveals, and hours that know what day it is in Montclair.
const html = document.documentElement, toggle = document.querySelector('.menu-toggle'), nav = document.getElementById('nav');
if (toggle && nav) {
  const close = () => { html.classList.remove('nav-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open menu'); };
  toggle.addEventListener('click', () => { const open = !html.classList.contains('nav-open'); html.classList.toggle('nav-open', open); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); });
  nav.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  matchMedia('(min-width: 861px)').addEventListener('change', close);
}

{ const els = [...document.querySelectorAll('[data-reveal]')];
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) els.forEach(e => e.classList.add('is-visible'));
  else { const n = new Map(); els.forEach(e => { const p = e.parentElement, i = n.get(p) || 0; e.style.setProperty('--d', Math.min(i, 6) * 0.07 + 's'); n.set(p, i + 1); });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } }), { threshold: 0.01, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e)); setTimeout(() => els.forEach(e => { if (e.getBoundingClientRect().top < innerHeight) e.classList.add('is-visible'); }), 1500); } }

// Example hours. Shop: Tue-Sat 11-8, Sun 11-5. Bar seatings Tue-Sat. Closed Monday. All in New York time.
export const SHOP = { 0: [11, 17], 2: [11, 20], 3: [11, 20], 4: [11, 20], 5: [11, 20], 6: [11, 20] };
export const SEATINGS = ['5:30 pm', '7:15 pm', '9:00 pm'], BAR_DAYS = [2, 3, 4, 5, 6];
export function nyNow() { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', year: 'numeric', month: 'numeric', day: 'numeric', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), mins: (+p.hour % 24) * 60 + +p.minute, y: +p.year, m: +p.month, d: +p.day }; }
export const hourWords = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${((hh + 11) % 12) + 1}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${hh < 12 ? 'am' : 'pm'}`; };
{ const now = nyNow(); document.querySelectorAll('[data-day]').forEach(r => { if (+r.dataset.day === now.day) r.classList.add('today'); });
  const pill = document.querySelector('[data-open]'); if (pill) { const h = SHOP[now.day];
    pill.textContent = h && now.mins >= h[0] * 60 && now.mins < h[1] * 60 ? `Open now until ${hourWords(h[1])}` : h && now.mins < h[0] * 60 ? `Opens today at ${hourWords(h[0])}` : 'Closed now. Order ahead for pickup'; } }
