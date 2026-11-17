// One order, one place. Every page reads and writes this, so nothing goes stale between the die, the sauce and the form.
export const SHAPES = {
  rigatoni: { no: 24, name: 'Rigatoni', why: 'Ridges and a wide bore. Built to carry a ragù.' },
  fusilli: { no: 31, name: 'Fusilli', why: 'Three fins in a tight spiral. Pesto gets caught in every turn.' },
  paccheri: { no: 12, name: 'Paccheri', why: 'Big smooth tubes that fill up with sauce. Four to a forkful.' },
  tortiglioni: { no: 27, name: 'Tortiglioni', why: 'Deep ridges that wind round the tube. They hold cream and cheese.' },
};
export const SAUCES = [
  { id: 'ragu', name: 'Sunday ragù', desc: 'Beef and pork, cooked low for six hours.', price: 9, best: ['rigatoni', 'paccheri'] },
  { id: 'vodka', name: 'Vodka', desc: 'Tomato, cream and a little Calabrian chili.', price: 8, best: ['rigatoni', 'tortiglioni'] },
  { id: 'pesto', name: 'Basil pesto', desc: 'Basil, pine nuts, pecorino and good oil.', price: 8, best: ['fusilli'] },
  { id: 'pomodoro', name: 'Pomodoro', desc: 'Plum tomatoes, garlic and basil. That’s all.', price: 6, best: ['paccheri', 'fusilli'] },
  { id: 'cacio', name: 'Cacio e pepe', desc: 'Pecorino and black pepper butter. Loosen it with pasta water.', price: 7, best: ['tortiglioni', 'rigatoni'] },
  { id: 'sage', name: 'Brown butter & sage', desc: 'Nutty butter, crisp sage and lemon.', price: 7, best: ['fusilli', 'paccheri'] },
];
export const EXTRAS = [
  { id: 'parm', name: 'Parmigiano, grated', desc: '4 oz tub', price: 6 },
  { id: 'focaccia', name: 'Focaccia', desc: 'Half slab, baked this morning', price: 5 },
  { id: 'tiramisu', name: 'Tiramisù for two', desc: 'Made in the back', price: 12 },
];
export const PER_G = 0.061, PORTION = 115; // example prices: $6.10 per 100 g of fresh pasta
export const money = n => '$' + n.toFixed(2);

const KEY = 'goodshape.order.v1', blank = () => ({ pasta: {}, sauce: null, extras: [] }), subs = new Set();
let state = blank();
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') state = { ...blank(), ...s, pasta: { ...(s.pasta || {}) }, extras: [...(s.extras || [])] }; } catch (e) { /* private mode: the order just lives for this page */ }
for (const k of Object.keys(state.pasta)) if (!SHAPES[k] || !(state.pasta[k] > 0)) delete state.pasta[k];
if (state.sauce && !SAUCES.some(s => s.id === state.sauce)) state.sauce = null;

export const get = () => state;
export function set(patch) { state = { ...state, ...patch }; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* see above */ } subs.forEach(f => f(state)); }
export const subscribe = f => { subs.add(f); f(state); };
export const reset = () => set(blank());

export function totals(s = state) {
  const grams = Object.values(s.pasta).reduce((a, b) => a + b, 0), pasta = grams * PER_G;
  const sauce = SAUCES.find(x => x.id === s.sauce), extras = EXTRAS.filter(x => s.extras.includes(x.id));
  const total = pasta + (sauce ? sauce.price : 0) + extras.reduce((a, x) => a + x.price, 0);
  return { grams, pasta, sauce, extras, total, portions: grams / PORTION };
}
export function portionWords(g) { const p = g / PORTION; return g < 30 ? 'Nothing in the tray yet' : p < 0.8 ? 'A small bowl' : `About ${Math.max(1, Math.round(p))} portion${Math.round(p) > 1 ? 's' : ''}`; }
export const pastaWords = s => Object.entries(s.pasta).map(([k, g]) => `${g} g ${SHAPES[k].name.toLowerCase()}`).join(' + ');
