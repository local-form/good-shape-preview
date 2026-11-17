import { SHOP, nyNow, hourWords } from './common.js';
import { SHAPES, SAUCES, EXTRAS, PER_G, get, set, subscribe, totals, money, portionWords, reset } from './store.js';

const $ = s => document.querySelector(s), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STEP = 50, MAX = 1500;

// ----- pasta by weight: works on its own, and picks up whatever was made on the die -----
$('#pasta-rows').innerHTML = Object.entries(SHAPES).map(([k, s]) => `<li><span class="nm"><b>${s.name}</b><small>No. ${s.no} &middot; ${money(PER_G * 100)} per 100 g</small></span><span class="stepper"><button type="button" data-k="${k}" data-d="-1" aria-label="Less ${s.name}">&minus;</button><output id="g-${k}" aria-live="polite">0 g</output><button type="button" data-k="${k}" data-d="1" aria-label="More ${s.name}">+</button></span></li>`).join('');
$('#pasta-rows').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (!b) return; const pasta = { ...get().pasta }, k = b.dataset.k, cur = pasta[k] || 0;
  const next = +b.dataset.d > 0 ? Math.min(MAX, Math.floor(cur / STEP) * STEP + STEP) : Math.max(0, Math.ceil(cur / STEP) * STEP - STEP); if (next) pasta[k] = next; else delete pasta[k]; set({ pasta }); });

$('#sauce-rows').innerHTML = `<label class="pick"><input type="radio" name="sauce" value=""><span class="nm"><b>No sauce</b><small>Just the pasta</small></span></label>` + SAUCES.map(s => `<label class="pick"><input type="radio" name="sauce" value="${s.id}"><span class="nm"><b>${s.name}</b><small>${s.desc} Best on ${s.best.map(b => SHAPES[b].name.toLowerCase()).join(' and ')}.</small></span><span class="mono">${money(s.price)}</span></label>`).join('');
$('#sauce-rows').addEventListener('change', e => set({ sauce: e.target.value || null }));
$('#extra-rows').innerHTML = EXTRAS.map(x => `<label class="pick"><input type="checkbox" name="extra" value="${x.id}"><span class="nm"><b>${x.name}</b><small>${x.desc}</small></span><span class="mono">${money(x.price)}</span></label>`).join('');
$('#extra-rows').addEventListener('change', () => set({ extras: [...document.querySelectorAll('[name=extra]:checked')].map(i => i.value) }));

// ----- pickup times, in shop hours, New York time -----
const now = nyNow(), days = [], DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
for (let i = 0; i < 7 && days.length < 5; i++) { const d = (now.day + i) % 7, h = SHOP[d]; if (!h) continue; const from = i === 0 ? Math.max(h[0] * 60, Math.ceil((now.mins + 30) / 15) * 15) : h[0] * 60; if (from > h[1] * 60 - 15) continue; days.push({ label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYN[d], from, to: h[1] * 60 - 15 }); }
const $day = $('#day'), $time = $('#time');
$day.innerHTML = days.map((d, i) => `<option value="${i}">${d.label}</option>`).join('');
function fillTimes() { const d = days[+$day.value] || days[0], o = []; for (let m = d.from; m <= d.to; m += 15) o.push(`<option>${hourWords(m / 60)}</option>`); $time.innerHTML = o.join(''); }
$day.addEventListener('change', fillTimes); fillTimes();

// ----- the ticket: always drawn from the one order -----
function lines(s) { const t = totals(s), out = Object.entries(s.pasta).map(([k, g]) => [`${SHAPES[k].name}, ${g} g`, money(g * PER_G)]); if (t.sauce) out.push([t.sauce.name, money(t.sauce.price)]); t.extras.forEach(x => out.push([x.name, money(x.price)])); return { t, out }; }
subscribe(s => { const { t, out } = lines(s);
  for (const k in SHAPES) { $('#g-' + k).textContent = (s.pasta[k] || 0) + ' g'; }
  document.querySelectorAll('[name=sauce]').forEach(i => { i.checked = i.value === (s.sauce || ''); });
  document.querySelectorAll('[name=extra]').forEach(i => { i.checked = s.extras.includes(i.value); });
  $('#ticket-lines').innerHTML = out.map(l => `<div class="l"><dt>${l[0]}</dt><dd>${l[1]}</dd></div>`).join('') + (out.length ? `<div class="l sum"><dt>Total</dt><dd>${money(t.total)}</dd></div>` : '');
  $('#ticket-empty').hidden = out.length > 0; $('#ticket-note').textContent = t.grams ? portionWords(t.grams) + ' of fresh pasta.' : ''; });

// ----- place the (example) order -----
const form = $('#order-form'), err = $('#order-err');
form.addEventListener('submit', e => { e.preventDefault(); const s = get(), { t, out } = lines(s), name = $('#name').value.trim(), phone = $('#phone').value.trim();
  const bad = !out.length ? 'Add some pasta or a sauce first.' : !name ? 'Add a name for the order.' : phone.replace(/\D/g, '').length < 7 ? 'Add a phone number we could text.' : '';
  err.hidden = !bad; err.textContent = bad; if (bad) { (out.length ? (name ? $('#phone') : $('#name')) : $('#pasta-rows button[data-d="1"]')).focus(); return; }
  const when = `${days[+$day.value].label} at ${$time.value}`, notes = $('#notes').value.trim();
  $('#done-title').textContent = `Thanks, ${name.split(' ')[0]}. It’ll be warm.`;
  $('#done-lines').innerHTML = out.map(l => `<div class="l"><dt>${l[0]}</dt><dd>${l[1]}</dd></div>`).join('') + `<div class="l"><dt>Pickup</dt><dd>${esc(when)}</dd></div><div class="l"><dt>Text to</dt><dd>${esc(phone)}</dd></div>${notes ? `<div class="l"><dt>Note</dt><dd>${esc(notes)}</dd></div>` : ''}<div class="l"><dt>Total, paid at pickup</dt><dd>${money(t.total)}</dd></div>`;
  $('#order-main').hidden = true; $('#order-done').hidden = false; reset(); scrollTo(0, 0); $('#done-title').focus(); });
$('#again').addEventListener('click', () => { $('#order-done').hidden = true; $('#order-main').hidden = false; form.reset(); fillTimes(); scrollTo(0, 0); });
