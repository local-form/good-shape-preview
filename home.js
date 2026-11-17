import './common.js';
import { SHAPES, SAUCES, get, set, subscribe, totals, money, portionWords, pastaWords } from './store.js';

const $ = s => document.querySelector(s), hero = $('#top'), V = '1';
let die = null, shape = 'rigatoni', heroSeen = true;

// ----- the scale card and the order bar: both read the same order -----
const $g = $('#grams'), $what = $('#what'), $por = $('#portions'), $usd = $('#price'), $bar = $('#orderbar'), $barText = $('#orderbar-text');
let shown = 0, raf = 0;
function tickGrams() { const t = totals().grams; shown += (t - shown) * 0.2; if (Math.abs(t - shown) < 0.6) shown = t; $g.textContent = Math.round(shown); raf = shown === t ? 0 : requestAnimationFrame(tickGrams); }
subscribe(s => { const t = totals(s);
  if (!raf) raf = requestAnimationFrame(tickGrams);
  $what.textContent = t.grams ? pastaWords(s) : 'Drag down, then tap to cut'; $por.textContent = portionWords(t.grams); $usd.textContent = money(t.pasta);
  $barText.innerHTML = t.grams ? `${pastaWords(s)}${t.sauce ? ' with ' + t.sauce.name.toLowerCase() : ''} · <b>${money(t.total)}</b>` : '';
  document.querySelectorAll('.sauce').forEach(li => { const on = li.dataset.id === s.sauce; li.classList.toggle('on', on); li.querySelector('input').checked = on; });
  markMatches(s); showBar(); });

// ----- sauces: built from the same list the order page uses -----
const list = $('#sauce-list');
list.innerHTML = SAUCES.map((s, i) => `<li class="sauce" data-id="${s.id}" data-reveal><input type="radio" name="sauce" value="${s.id}" aria-label="${s.name}, ${money(s.price)}"><span class="n">${String(i + 1).padStart(2, '0')}</span><h3>${s.name}</h3><p class="d">${s.desc}</p><p class="p">${money(s.price)}<small>tub for two</small></p><p class="tags"><span>Holds best on</span>${s.best.map(b => `<span class="tag" data-shape="${b}">${SHAPES[b].name}</span>`).join('')}</p></li>`).join('');
list.addEventListener('change', e => { if (e.target.name === 'sauce') set({ sauce: e.target.value }); });
list.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-visible'));
function markMatches(s) { const mine = Object.keys(s.pasta).length ? Object.keys(s.pasta) : [shape];
  document.querySelectorAll('.sauce .tag').forEach(t => { const m = mine.includes(t.dataset.shape); t.classList.toggle('match', m); const name = SHAPES[t.dataset.shape].name; t.textContent = m ? 'Made for your ' + name.toLowerCase() : name; }); }

// ----- the order bar shows once you've left the hero with pasta in the tray -----
function showBar() { $bar.classList.toggle('show', !heroSeen && totals().grams > 0); }
if ('IntersectionObserver' in window) new IntersectionObserver(es => { heroSeen = es[0].intersectionRatio > 0.35; showBar(); }, { threshold: [0, 0.35, 0.6] }).observe(hero);

// ----- die buttons -----
const dieButtons = [...document.querySelectorAll('[data-die]')];
function pressed(key) { shape = key; dieButtons.forEach(b => { if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', String(b.dataset.die === key)); }); markMatches(get()); }
dieButtons.forEach(b => b.addEventListener('click', () => { const key = b.dataset.die; if (die) die.setShape(key); else pressed(key); if (!b.closest('.hero')) { scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); if (die) die.toDie(); } }));

$('#start-over').addEventListener('click', () => { set({ pasta: {} }); if (die) { die.clear(); die.toDie(); } });
$('#see-die').addEventListener('click', () => die && die.toDie());
$('#key-push').addEventListener('click', () => die && die.push(1.5));
$('#key-cut').addEventListener('click', () => die && die.cut());
addEventListener('keydown', e => { if (!die || /INPUT|TEXTAREA|SELECT|BUTTON|A/.test(document.activeElement.tagName) || scrollY > innerHeight * 0.5) return; if (e.key === 'ArrowDown') { die.push(0.6); e.preventDefault(); } if (e.key === ' ' || e.key === 'Enter') { die.cut(); e.preventDefault(); } });

// ----- start the 3D once the page has painted. The poster holds the first frame until then. -----
async function start() {
  try { await document.fonts.load('700 40px "Hanken"'); } catch (e) { /* the rim lettering falls back */ }
  try {
    const { boot } = await import('./hero.js?v=' + V);
    die = boot({ canvas: $('#gl'), hero, stage: $('#stage'), shape, grams: get().pasta,
      onChange: pasta => set({ pasta }), onShape: pressed,
      onView: v => hero.classList.toggle('work', !!v),
      onFull: () => { $por.textContent = 'That’s a full tray. Pick a sauce.'; } });
    requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-live')));
  } catch (err) { // no WebGL: the poster stays and the order page does the job by weight
    console.warn('3D die unavailable', err); const h = $('.hint'); if (h) h.innerHTML = '<span>Your browser can’t run the die. <a class="link" href="order.html">Order by weight instead</a></span>';
  }
}
if (document.readyState === 'complete') start(); else addEventListener('load', () => ('requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 600 }) : setTimeout(start, 60)));
