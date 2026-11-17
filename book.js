import { SEATINGS, BAR_DAYS, nyNow } from './common.js';

const $ = s => document.querySelector(s), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(2, '0'), now = nyNow(), DAYN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const $date = $('#date'), $seats = $('#seats'), $size = $('#size'), err = $('#book-err');
let size = 2, picked = [];

// the next bar night, starting today (New York date)
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`, parse = v => { const [y, m, d] = v.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
// a seating that has already started today can't be booked; after the last one, start from tomorrow
const mins = v => { const [h, m] = v.replace(' pm', '').split(':').map(Number); return (h + 12) * 60 + m; }, $seatings = [...document.querySelectorAll('[name=seating]')];
const today = iso(now.y, now.m, now.d); let first = parse(today); if (now.mins >= mins(SEATINGS[SEATINGS.length - 1])) first = new Date(first.getTime() + 864e5); while (!BAR_DAYS.includes(first.getUTCDay())) first = new Date(first.getTime() + 864e5);
$date.min = today; $date.value = first.toISOString().slice(0, 10);
const dayOf = () => ($date.value ? parse($date.value) : null), dateWords = d => `${DAYN[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
const seating = () => (document.querySelector('[name=seating]:checked') || {}).value;

// Which stools are "taken" is made up, but it is the same every time for a given night and seating.
function taken() { const key = $date.value + '|' + seating(); let h = 2166136261; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; const out = new Set(), n = 3 + (h % 4); let x = h; while (out.size < n) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; out.add(1 + (x >>> 8) % 12); } return out; }
const closedMsg = $('#closed').textContent;
function seatingsLeft() { $seatings.forEach(i => { i.disabled = $date.value === today && mins(i.value) <= now.mins; }); const c = $seatings.find(i => i.checked); if (c && c.disabled) { const f = $seatings.find(i => !i.disabled); if (f) f.checked = true; } return $seatings.some(i => !i.disabled); }
const barDay = d => d && BAR_DAYS.includes(d.getUTCDay()) && $date.value >= today, isOpen = d => barDay(d) && seatingsLeft();
function draw() { const d = dayOf(), open = isOpen(d), t = open ? taken() : new Set();
  $('#closed').textContent = barDay(d) ? 'Tonight’s seatings have started. Pick another night.' : closedMsg;
  picked = picked.filter(n => !t.has(n)).slice(0, size);
  $seats.querySelectorAll('.seat').forEach(b => { const n = +b.dataset.n; b.disabled = !open || t.has(n); b.setAttribute('aria-pressed', String(picked.includes(n))); b.setAttribute('aria-label', `Stool ${n}${t.has(n) ? ', taken' : picked.includes(n) ? ', yours' : ', free'}`); });
  $('#closed').hidden = !!open; $('#seat-help').textContent = !open ? '' : picked.length === size ? `Stool${size > 1 ? 's' : ''} ${picked.join(' and ').replace(/ and (?=.* and )/g, ', ')} held for you.` : `Pick ${size - picked.length} more stool${size - picked.length > 1 ? 's' : ''}.`;
  $size.textContent = size; $('#fewer').disabled = size <= 1; $('#more').disabled = size >= 4; }
$seats.addEventListener('click', e => { const b = e.target.closest('.seat'); if (!b || b.disabled) return; const n = +b.dataset.n; if (picked.includes(n)) picked = picked.filter(x => x !== n); else { if (picked.length >= size) picked.shift(); picked.push(n); picked.sort((a, c) => a - c); } draw(); });
$('#fewer').addEventListener('click', () => { size = Math.max(1, size - 1); draw(); }); $('#more').addEventListener('click', () => { size = Math.min(4, size + 1); draw(); });
$date.addEventListener('change', () => { picked = []; draw(); }); document.querySelectorAll('[name=seating]').forEach(i => i.addEventListener('change', () => { picked = []; draw(); }));
draw();

const form = $('#book-form');
form.addEventListener('submit', e => { e.preventDefault(); const d = dayOf(), name = $('#name').value.trim(), phone = $('#phone').value.trim(), open = isOpen(d);
  const bad = !open ? (barDay(d) ? 'Tonight’s seatings have started. Pick another night.' : 'The bar is open Tuesday to Saturday. Pick another date.') : picked.length !== size ? `Pick ${size} stool${size > 1 ? 's' : ''} on the counter.` : !name ? 'Add a name for the booking.' : phone.replace(/\D/g, '').length < 7 ? 'Add a phone number we could text.' : '';
  err.hidden = !bad; err.textContent = bad; if (bad) { (!open ? $date : picked.length !== size ? $seats.querySelector('.seat:not([disabled])') : name ? $('#phone') : $('#name')).focus(); return; }
  const when = seating(), notes = $('#notes').value.trim(), [hh, mm] = when.replace(' pm', '').split(':').map(Number), start = `${$date.value.replace(/-/g, '')}T${pad(hh + 12)}${pad(mm)}00`, endM = (hh + 12) * 60 + mm + 90, end = `${$date.value.replace(/-/g, '')}T${pad(Math.floor(endM / 60))}${pad(endM % 60)}00`;
  $('#done-title').textContent = `See you ${DAYN[d.getUTCDay()]}, ${name.split(' ')[0]}.`;
  $('#done-lines').innerHTML = [['When', `${dateWords(d)} at ${when}`], ['Party', `${size} at the bar`], ['Stools', picked.join(', ')], ['Text to', phone], ...(notes ? [['Note', notes]] : [])].map(l => `<div class="l"><dt>${l[0]}</dt><dd>${esc(l[1])}</dd></div>`).join('');
  $('#gcal').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Good Shape, the bar (example)') + `&dates=${start}/${end}&ctz=America/New_York&location=` + encodeURIComponent('418 Bloomfield Ave, Montclair, NJ') + '&details=' + encodeURIComponent('Example booking from a Local Form example site. Nothing was really booked.');
  $('#book-main').hidden = true; $('#book-done').hidden = false; scrollTo(0, 0); $('#done-title').focus(); });
$('#again').addEventListener('click', () => { $('#book-done').hidden = true; $('#book-main').hidden = false; picked = []; draw(); scrollTo(0, 0); });
