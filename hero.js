// Good Shape: the pasta die. Everything on screen is built in code: no models, no photos.
// Units are centimetres. The die face sits at y = 0 and pasta comes out downwards.
import * as THREE from './vendor/three.module.min.js';

// R = outer radius, gcm = grams of fresh pasta per centimetre, twist = radians per centimetre
export const SHAPES = {
  rigatoni: { no: 24, name: 'Rigatoni', holes: 8, ring: 3.85, R: 0.78, wall: 0.13, ridges: 30, depth: 0.034, twist: 0, gcm: 0.72 },
  fusilli: { no: 31, name: 'Fusilli', holes: 10, ring: 4.1, R: 0.6, lobes: 3, twist: 3.4, gcm: 0.44 },
  paccheri: { no: 12, name: 'Paccheri', holes: 5, ring: 3.55, R: 1.26, wall: 0.15, ridges: 0, depth: 0, twist: 0, gcm: 1.18 },
  tortiglioni: { no: 27, name: 'Tortiglioni', holes: 8, ring: 3.85, R: 0.72, wall: 0.13, ridges: 16, depth: 0.055, twist: 0.42, gcm: 0.66 },
};

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { srgb = false, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } t.anisotropy = aniso; return t;
}
const ease = t => t * t * (3 - 2 * t), clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- pasta cross-sections ----------
function profile(sh) { // radius and its slope at angle t
  if (sh.lobes) { const core = sh.R * 0.3, fin = sh.R - core, n = sh.lobes, e = 2.8; return t => { const c = 0.5 + 0.5 * Math.cos(n * t); return [core + fin * Math.pow(c, e), fin * e * Math.pow(c, e - 1) * -0.5 * n * Math.sin(n * t)]; }; }
  if (sh.ridges) return t => [sh.R + sh.depth * Math.cos(sh.ridges * t), -sh.depth * sh.ridges * Math.sin(sh.ridges * t)];
  return () => [sh.R, 0];
}
// Unit length along Y (-0.5..0.5); scale Y to set the length. Twist is added in the shader so its pitch never stretches.
function pastaGeometry(sh, hi) {
  const prof = profile(sh), N = sh.lobes ? (hi ? 96 : 60) : sh.ridges ? sh.ridges * (hi ? 8 : 4) : (hi ? 72 : 44), M = hi ? 56 : 32;
  const K = sh.twist ? (hi ? 110 : 44) : (hi ? 10 : 2), pos = [], nor = [], uv = [], col = [], slope = [], idx = [];
  const wob = (t, y) => (hi && !sh.twist ? 1 + 0.011 * Math.sin(3 * t + y * 7.3) + 0.007 * Math.sin(5 * t - y * 12.1 + 1.7) : 1);
  const ring = y => { const s0 = pos.length / 3; for (let i = 0; i <= N; i++) { const t = i / N * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), [r0, d] = prof(t), rr = r0 * wob(t, y), l = Math.hypot(rr, d);
    pos.push(rr * c, y, rr * s); nor.push((rr * c + d * s) / l, 0, (rr * s - d * c) / l); uv.push(i / N * 6, y * 2); slope.push(rr * d / l);
    const sd = sh.lobes ? 0.8 + 0.2 * (rr - sh.R * 0.3) / (sh.R * 0.7) : sh.ridges ? 0.86 + 0.14 * (rr - (sh.R - sh.depth)) / (2 * sh.depth) : 1; col.push(sd, sd, sd); } return s0; };
  const band = (a, b, n, flip) => { for (let i = 0; i < n; i++) { const p = a + i, q = b + i; flip ? idx.push(p, p + 1, q, q, p + 1, q + 1) : idx.push(p, q, p + 1, q, q + 1, p + 1); } };
  let prev = ring(-0.5); for (let k = 1; k <= K; k++) { const cur = ring(-0.5 + k / K); band(prev, cur, N, false); prev = cur; }
  const ri = sh.wall ? sh.R - sh.wall : 0;
  if (ri) { const s0 = pos.length / 3; for (const y of [-0.5, 0.5]) for (let i = 0; i <= M; i++) { const t = i / M * Math.PI * 2; pos.push(ri * Math.cos(t), y, ri * Math.sin(t)); nor.push(-Math.cos(t), 0, -Math.sin(t)); uv.push(i / M * 4, y * 2); col.push(0.56, 0.47, 0.3); slope.push(0); } band(s0, s0 + M + 1, M, true); }
  for (const y of [-0.5, 0.5]) { const s0 = pos.length / 3, ny = Math.sign(y); // cut faces
    for (let i = 0; i <= N; i++) { const t = i / N * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), ro = prof(t)[0] * wob(t, y); pos.push(ro * c, y, ro * s, ri * c, y, ri * s); nor.push(0, ny, 0, 0, ny, 0); uv.push(c * 2, s * 2, c * 1.6, s * 1.6); const e = ri ? 0.78 : 0.9; col.push(1, 1, 1, e, e * 0.94, e * 0.8); slope.push(0, 0); }
    for (let i = 0; i < N; i++) { const a = s0 + i * 2; ny > 0 ? idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3) : idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); } }
  const g = new THREE.BufferGeometry(), f = (a, n) => new THREE.Float32BufferAttribute(a, n);
  g.setAttribute('position', f(pos, 3)); g.setAttribute('normal', f(nor, 3)); g.setAttribute('uv', f(uv, 2)); g.setAttribute('color', f(col, 3)); g.setAttribute('aSlope', f(slope, 1)); g.setIndex(idx); return g;
}
const TWIST_HEAD = `uniform float uTwist;\nattribute float aSlope;\nfloat twSy() { float s = length(modelMatrix[1].xyz);\n#ifdef USE_INSTANCING\n s *= length(instanceMatrix[1].xyz);\n#endif\n return s; }\n`;
function addTwist(mat, twist, withNormals) {
  mat.onBeforeCompile = sh => { sh.uniforms.uTwist = { value: twist };
    sh.vertexShader = TWIST_HEAD + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float a = uTwist * twSy() * position.y; float c = cos(a), s = sin(a); transformed.xz = mat2(c, s, -s, c) * transformed.xz; }');
    if (withNormals) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n{ float k = uTwist * twSy(); float a = k * position.y; float c = cos(a), s = sin(a); objectNormal = normalize(objectNormal + vec3(0.0, k * aSlope, 0.0)); objectNormal.xz = mat2(c, s, -s, c) * objectNormal.xz; }'); };
  mat.customProgramCacheKey = () => 'twist' + (withNormals ? 'N' : 'D');
}

export function boot({ canvas, hero, stage, shape = 'rigatoni', grams = {}, transparent = false, face = false, camera: camFix = null, bare = false, onChange = () => {}, onView = () => {}, onFull = () => {}, onShape = () => {} }) {
  const small = Math.min(innerWidth, innerHeight) < 600, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: transparent, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); if (!transparent) scene.background = new THREE.Color('#1f43ad');
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
  const SM = small ? 1024 : 2048, TS = small ? 1024 : 2048;

  // ----- environment: a dark blue room with softboxes, built here -----
  { const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: new THREE.Color(0.012, 0.03, 0.13) })));
    const panel = (dir, w, h, rgb, roll = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide })); m.position.copy(new THREE.Vector3(...dir).normalize().multiplyScalar(60)); m.lookAt(0, 0, 0); m.rotateZ(roll); env.add(m); };
    panel([-1, 0.75, 0.9], 56, 44, [9, 8.3, 7.2]);              // warm key, upper left
    panel([1, 0.2, -0.45], 9, 90, [9, 9.6, 11]);                // cool rim strip, right
    panel([0, 1, 0.1], 70, 10, [4, 4, 4]);                      // top strip
    panel([0, -1, -0.35], 150, 110, [0.62, 0.56, 0.47]);        // the floury bench below: what the bronze face mirrors
    panel([-0.3, -0.82, -0.5], 130, 15, [8.5, 7.9, 6.8], 0.3);  // one long tube across the bench, for the sheen on the lathe marks
    panel([0.5, -0.7, 0.5], 40, 30, [2.2, 2.3, 2.8]);           // soft cool fill, low front right
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, 0.03).texture; pm.dispose(); }

  const key = new THREE.DirectionalLight(0xfff1dc, 2.1); key.position.set(-9, 34, 13); key.target.position.set(0, -10, 0);
  key.castShadow = true; key.shadow.mapSize.set(SM, SM); Object.assign(key.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 5, far: 90 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.05;
  const faceL = new THREE.SpotLight(0xffe9c8, 2.4, 0, 0.7, 1, 0); faceL.position.set(-9, -22, 20); faceL.target.position.set(0, 0, 0);
  faceL.castShadow = !small; faceL.shadow.mapSize.set(SM, SM); faceL.shadow.camera.near = 8; faceL.shadow.camera.far = 60; faceL.shadow.bias = -0.0006; faceL.shadow.normalBias = 0.03;
  scene.add(key, key.target, faceL, faceL.target, new THREE.HemisphereLight(0x9db4ff, 0x1a2f7a, 0.22));

  // ----- floor: only catches shadows, so the page stays flat blue -----
  const TRAY = { w: innerWidth / innerHeight < 0.8 ? 17 : 25, d: 17.5, top: -13.4, rim: 0.85, lip: 0.8, base: 1.3 };
  const FLOOR_Y = TRAY.top - TRAY.base;
  if (!face) { const m = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ color: 0x06123f, opacity: 0.36 })); m.rotation.x = -Math.PI / 2; m.position.y = FLOOR_Y; m.receiveShadow = true; scene.add(m); }

  // ----- the die -----
  const DIE_R = 6.4, dieGroup = new THREE.Group(), faceGroup = new THREE.Group(); scene.add(dieGroup); dieGroup.add(faceGroup);
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xaeb4bd, metalness: 1, roughness: 0.2, envMapIntensity: 1.15 });
  const bronze = new THREE.MeshPhysicalMaterial({ color: 0xb3854a, metalness: 1, roughness: 0.34 });
  const darkIn = new THREE.MeshStandardMaterial({ color: 0x3a2610, metalness: 0.6, roughness: 0.7, side: THREE.BackSide });
  const lathe = pts => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 160);
  let knife;
  { const CI = DIE_R - 0.34, CO = DIE_R + 0.86;
    const lip = new THREE.Mesh(lathe([[CI, 0.02], [CI, -0.16], [CI + 0.22, -0.4], [CI + 0.62, -0.46], [CO - 0.3, -0.4], [CO, -0.12], [CO, 0.12]]), steel);
    const FL = 36, gp = [], gn = [], gi = [], NS = FL * 10; // fluted grip, cut as real geometry so it never shimmers
    for (let i = 0; i <= NS; i++) { const t = i / NS * Math.PI * 2, cs = 0.5 + 0.5 * Math.cos(FL * t), rr = CO - 0.17 * Math.pow(cs, 2.2), d = 0.17 * 2.2 * Math.pow(cs, 1.2) * 0.5 * Math.sin(FL * t) * FL, c = Math.cos(t), sn = Math.sin(t), nx = rr * c + d * sn, nz = rr * sn - d * c, l = Math.hypot(nx, nz); gp.push(rr * c, 0.12, rr * sn, rr * c, 2.6, rr * sn); gn.push(nx / l, 0, nz / l, nx / l, 0, nz / l); }
    for (let i = 0; i < NS; i++) { const a = i * 2; gi.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gg.setAttribute('normal', new THREE.Float32BufferAttribute(gn, 3)); gg.setIndex(gi);
    const brushed = steel.clone(); brushed.roughness = 0.4; brushed.color.set(0xc3c8cf);
    const grip = new THREE.Mesh(gg, brushed);
    const shoulder = new THREE.Mesh(lathe([[CO - 0.17, 2.6], [CO - 0.3, 2.8], [DIE_R + 0.5, 2.9], [DIE_R + 0.5, 3.5], [DIE_R + 0.3, 3.62], [DIE_R + 0.3, 70]]), steel);
    const hub = new THREE.Mesh(lathe([[0, -0.74], [0.5, -0.74], [0.58, -0.66], [0.58, -0.5], [1.02, -0.46], [1.1, -0.38], [1.1, 0.0]]), steel);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 6), new THREE.MeshPhysicalMaterial({ color: 0x8d9299, metalness: 1, roughness: 0.42 })); bolt.position.y = -0.8;
    for (const m of [lip, grip, shoulder, hub]) { m.castShadow = true; m.receiveShadow = true; }
    dieGroup.add(lip, grip, shoulder, hub, bolt);
    const bs = new THREE.Shape(); bs.moveTo(0.7, -0.2); bs.lineTo(5.1, -0.24); bs.quadraticCurveTo(5.5, -0.02, 5.0, 0.16); bs.lineTo(0.7, 0.2); bs.closePath();
    const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.06, bevelSegments: 2, curveSegments: 12 }); bg.rotateX(Math.PI / 2); bg.rotateX(-0.2);
    const blade = new THREE.Mesh(bg, new THREE.MeshPhysicalMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.18, envMapIntensity: 1.4 })); blade.position.y = -0.1; blade.castShadow = true;
    knife = new THREE.Group(); knife.add(blade); dieGroup.add(knife); }

  const holeAt = (sh, k) => { const a = k / sh.holes * Math.PI * 2; return [Math.cos(a) * sh.ring, Math.sin(a) * sh.ring, a]; };
  function dieTextures(sh) {
    const S = TS, r = rng(7 + sh.no), [cb, b] = makeCanvas(S, S), [ca, a] = makeCanvas(S, S), [co, o] = makeCanvas(S, S), px = v => v / (DIE_R * 2) * S, cx = S / 2, u = S / 2048;
    a.fillStyle = '#b3854a'; a.fillRect(0, 0, S, S); b.fillStyle = 'rgb(128,128,128)'; b.fillRect(0, 0, S, S);
    for (let rad = 3 * u; rad < S * 0.52; rad += (1.1 + r() * 1.7) * u) { const v = 128 + (r() - 0.5) * 46; b.strokeStyle = `rgb(${v},${v},${v})`; b.lineWidth = (0.8 + r() * 1.4) * u; b.beginPath(); b.arc(cx, cx, rad, 0, 7); b.stroke();
      if (r() < 0.22) { a.strokeStyle = `rgba(${r() < 0.5 ? '255,226,170' : '96,62,24'},${0.05 + r() * 0.08})`; a.lineWidth = (1 + r() * 3) * u; a.beginPath(); a.arc(cx, cx, rad, 0, 7); a.stroke(); } }
    o.fillStyle = 'rgb(0,84,255)'; o.fillRect(0, 0, S, S); // G = roughness, B = metalness
    for (let i = 0; i < 2600; i++) { const an = r() * 7, r0 = r() * S * 0.5, len = (20 + r() * 120) * u, g = 60 + r() * 60; o.strokeStyle = `rgba(0,${g},255,0.25)`; o.lineWidth = (1 + r() * 2) * u; o.beginPath(); o.arc(cx, cx, r0, an, an + len / Math.max(40 * u, r0)); o.stroke(); }
    const hr = sh.R + 0.12, ir = sh.R + 0.46;
    for (let k = 0; k < sh.holes; k++) { const [hx, hz] = holeAt(sh, k), X = cx + px(hx), Y = cx + px(hz); // each insert: a pressed-in ring, and shade where pasta meets metal
      b.strokeStyle = 'rgb(58,58,58)'; b.lineWidth = px(0.07); b.beginPath(); b.arc(X, Y, px(ir), 0, 7); b.stroke(); b.strokeStyle = 'rgb(168,168,168)'; b.lineWidth = px(0.03); b.beginPath(); b.arc(X, Y, px(ir + 0.05), 0, 7); b.stroke();
      a.strokeStyle = 'rgba(70,44,16,0.55)'; a.lineWidth = px(0.07); a.beginPath(); a.arc(X, Y, px(ir), 0, 7); a.stroke();
      const gr = a.createRadialGradient(X, Y, px(hr * 0.96), X, Y, px(hr + 0.8)); gr.addColorStop(0, 'rgba(38,20,4,0.78)'); gr.addColorStop(0.16, 'rgba(60,34,8,0.34)'); gr.addColorStop(0.4, 'rgba(255,226,150,0.16)'); gr.addColorStop(1, 'rgba(255,226,150,0)'); a.fillStyle = gr; a.beginPath(); a.arc(X, Y, px(hr + 0.8), 0, 7); a.fill(); }
    const text = `GOOD SHAPE  ·  ${sh.name.toUpperCase()}  Nº ${sh.no}  ·  TRAFILA IN BRONZO  ·  MONTCLAIR NJ  ·  `, tr = px(5.56), fs = px(0.38);
    for (const [ctx, fill] of [[b, 'rgb(40,40,40)'], [a, 'rgba(58,36,12,0.78)']]) { ctx.save(); ctx.translate(cx, cx); ctx.font = `700 ${fs}px "Hanken", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fill; const step = Math.PI * 2 / text.length;
      for (let i = 0; i < text.length; i++) { ctx.save(); ctx.rotate(i * step - Math.PI / 2 + 0.4); ctx.translate(0, -tr); ctx.fillText(text[i], 0, 0); ctx.restore(); } ctx.restore(); }
    for (const sx of [-1, 1]) { const X = cx + sx * px(2.05); b.fillStyle = 'rgb(20,20,20)'; b.beginPath(); b.arc(X, cx, px(0.2), 0, 7); b.fill(); a.fillStyle = '#2b1a08'; a.beginPath(); a.arc(X, cx, px(0.2), 0, 7); a.fill(); }
    const dust = (X, Y, rad, al) => { const g1 = a.createRadialGradient(X, Y, 0, X, Y, rad); g1.addColorStop(0, `rgba(250,236,196,${al})`); g1.addColorStop(1, 'rgba(250,236,196,0)'); a.fillStyle = g1; a.beginPath(); a.arc(X, Y, rad, 0, 7); a.fill();
      const g2 = o.createRadialGradient(X, Y, 0, X, Y, rad); g2.addColorStop(0, `rgba(0,235,40,${al * 1.5})`); g2.addColorStop(1, 'rgba(0,235,40,0)'); o.fillStyle = g2; o.beginPath(); o.arc(X, Y, rad, 0, 7); o.fill(); };
    for (let i = 0; i < 520; i++) { const k = (r() * sh.holes) | 0, [hx, hz] = holeAt(sh, k), an = r() * 7, d = px(hr + 0.05 + r() * r() * 1.5); dust(cx + px(hx) + Math.cos(an) * d, cx + px(hz) + Math.sin(an) * d, (4 + r() * 26) * u, 0.05 + r() * 0.14); }
    for (let i = 0; i < 1400; i++) dust(r() * S, r() * S, (1 + r() * 3.5) * u, 0.25 + r() * 0.5);
    const AS = 256, [cn, n] = makeCanvas(AS, AS), im = n.createImageData(AS, AS); // direction map: highlights stretch across the lathe marks
    for (let j = 0; j < AS; j++) for (let i = 0; i < AS; i++) { const dx = i - AS / 2 + 0.5, dy = j - AS / 2 + 0.5, l = Math.hypot(dx, dy) || 1, q = (j * AS + i) * 4; im.data[q] = 127.5 + 127.5 * dx / l; im.data[q + 1] = 127.5 + 127.5 * dy / l; im.data[q + 2] = 255; im.data[q + 3] = 255; }
    n.putImageData(im, 0, 0);
    return { map: tex(ca, { srgb: true, aniso: 16 }), bump: tex(cb, { aniso: 16 }), orm: tex(co, { aniso: 16 }), dir: tex(cn) };
  }
  function buildFace(sh) {
    faceGroup.traverse(m => { if (m.isMesh) { m.geometry.dispose(); if (m.material.map) { for (const k of ['map', 'bumpMap', 'roughnessMap', 'anisotropyMap']) m.material[k] && m.material[k].dispose(); m.material.dispose(); } } }); faceGroup.clear();
    const T = dieTextures(sh), mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: T.map, metalness: 1, roughness: 1, metalnessMap: T.orm, roughnessMap: T.orm, bumpMap: T.bump, bumpScale: 2.0, anisotropy: 0.8, anisotropyMap: T.dir, envMapIntensity: 1.2 });
    const shape = new THREE.Shape(); shape.absarc(0, 0, DIE_R, 0, Math.PI * 2, false); const hr = sh.R + 0.12, prof = profile(sh);
    for (let k = 0; k < sh.holes; k++) { const [hx, hz] = holeAt(sh, k), h = new THREE.Path();
      if (sh.lobes) { const n = 72; for (let i = n; i >= 0; i--) { const t = i / n * Math.PI * 2, rr = prof(t)[0] * 1.08 + 0.06, X = hx + Math.cos(t) * rr, Y = hz + Math.sin(t) * rr; i === n ? h.moveTo(X, Y) : h.lineTo(X, Y); } } else h.absarc(hx, hz, hr, 0, Math.PI * 2, true);
      shape.holes.push(h); }
    const fg = new THREE.ShapeGeometry(shape, 96), uv = fg.attributes.uv, pos = fg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / (DIE_R * 2) + 0.5, 0.5 + pos.getY(i) / (DIE_R * 2)); fg.rotateX(Math.PI / 2);
    const fm = new THREE.Mesh(fg, mat); fm.receiveShadow = true; faceGroup.add(fm);
    const wallG = new THREE.CylinderGeometry(hr, hr, 1.8, 48, 1, true), lipG = sh.lobes ? null : new THREE.TorusGeometry(hr, 0.035, 10, 64), pinG = sh.wall ? new THREE.CylinderGeometry(sh.R - sh.wall - 0.065, sh.R - sh.wall - 0.065, 1.8, 40) : null;
    for (let k = 0; k < sh.holes; k++) { const [hx, hz] = holeAt(sh, k); const w = new THREE.Mesh(wallG, darkIn); w.position.set(hx, 0.92, hz); faceGroup.add(w);
      if (lipG) { const l = new THREE.Mesh(lipG, bronze); l.rotation.x = Math.PI / 2; l.position.set(hx, 0, hz); faceGroup.add(l); }
      if (pinG) { const p = new THREE.Mesh(pinG, bronze); p.position.set(hx, 0.92, hz); faceGroup.add(p); } }
  }

  // ----- pasta materials: one per shape so each can carry its own twist -----
  const skin = (() => { const S = 512, r = rng(21), [cb, b] = makeCanvas(S, S), [ca, a] = makeCanvas(S, S);
    const id = b.createImageData(S, S); for (let i = 0; i < S * S; i++) { const v = 128 + (r() - 0.5) * 120; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; } b.putImageData(id, 0, 0);
    b.globalAlpha = 0.5; b.filter = 'blur(1.2px)'; b.drawImage(cb, 0, 0); b.filter = 'none'; b.globalAlpha = 1; a.fillStyle = '#f1d68d'; a.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { const x = r() * S, y = r() * S, rad = 3 + r() * 22, g = a.createRadialGradient(x, y, 0, x, y, rad), c = r() < 0.5 ? '255,244,212' : '228,188,104'; g.addColorStop(0, `rgba(${c},${0.05 + r() * 0.12})`); g.addColorStop(1, `rgba(${c},0)`); a.fillStyle = g; a.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    return { map: tex(ca, { srgb: true, repeat: [1, 1] }), bump: tex(cb, { repeat: [2, 2] }) }; })();
  const kit = {};
  function kitFor(key) { if (kit[key]) return kit[key]; const sh = SHAPES[key];
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, map: skin.map, bumpMap: skin.bump, bumpScale: 2.4, roughness: 0.88, metalness: 0, sheen: 0.55, sheenRoughness: 0.5, sheenColor: new THREE.Color(1, 0.86, 0.55), envMapIntensity: 0.55 });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    if (sh.twist) { addTwist(mat, sh.twist, true); addTwist(depth, sh.twist, false); }
    const lo = pastaGeometry(sh, false), pile = new THREE.InstancedMesh(lo, mat, MAXP); pile.castShadow = true; pile.receiveShadow = true; pile.count = 0; pile.frustumCulled = false; if (sh.twist) pile.customDepthMaterial = depth; scene.add(pile);
    return (kit[key] = { sh, mat, depth, hi: pastaGeometry(sh, true), pile }); }

  // ----- the tray the pasta lands in -----
  if (!face) { const W = 1536, H = 1075, r = rng(3), [c, x] = makeCanvas(W, H), strips = 6, sh = H / strips, tones = ['#5d3a24', '#4f301d', '#684229', '#4a2c1a', '#5f3b25', '#553421'];
    for (let s = 0; s < strips; s++) { x.fillStyle = tones[s]; x.fillRect(0, s * sh, W, sh + 1);
      for (let i = 0; i < 520; i++) { const y0 = s * sh + r() * sh, amp = 2 + r() * 7, f = 0.002 + r() * 0.004, ph = r() * 7; x.strokeStyle = `rgba(${r() < 0.55 ? '30,16,6' : '168,112,66'},${0.05 + r() * 0.13})`; x.lineWidth = 0.6 + r() * 1.6; x.beginPath(); for (let X = 0; X <= W; X += 24) { const Y = clamp(y0 + Math.sin(X * f + ph) * amp, s * sh + 1, (s + 1) * sh - 1); X ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); }
      x.fillStyle = 'rgba(20,10,4,0.5)'; x.fillRect(0, s * sh, W, 1.5); }
    for (let i = 0; i < 2600; i++) { const an = r() * 7, d = Math.pow(r(), 0.6) * H * 0.55, X = W / 2 + Math.cos(an) * d * 1.25, Y = H / 2 + Math.sin(an) * d, rad = 2 + r() * 30, g = x.createRadialGradient(X, Y, 0, X, Y, rad); g.addColorStop(0, `rgba(250,240,214,${0.03 + r() * 0.09})`); g.addColorStop(1, 'rgba(250,240,214,0)'); x.fillStyle = g; x.fillRect(X - rad, Y - rad, rad * 2, rad * 2); } // flour
    const rr = (w, d, rad, s = new THREE.Shape()) => { s.moveTo(-w + rad, -d); s.lineTo(w - rad, -d); s.quadraticCurveTo(w, -d, w, -d + rad); s.lineTo(w, d - rad); s.quadraticCurveTo(w, d, w - rad, d); s.lineTo(-w + rad, d); s.quadraticCurveTo(-w, d, -w, d - rad); s.lineTo(-w, -d + rad); s.quadraticCurveTo(-w, -d, -w + rad, -d); return s; };
    const w = TRAY.w / 2, d = TRAY.d / 2, base = new THREE.ExtrudeGeometry(rr(w, d, 1.6), { depth: TRAY.base - 0.3, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 3, curveSegments: 14 });
    const uv = base.attributes.uv, p = base.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / TRAY.w + 0.5, p.getY(i) / TRAY.d + 0.5);
    base.rotateX(-Math.PI / 2); base.translate(0, TRAY.top - TRAY.base + 0.15, 0);
    const wood = new THREE.MeshStandardMaterial({ map: tex(c, { srgb: true, aniso: 16 }), roughness: 0.7, envMapIntensity: 0.45 }), side = new THREE.MeshStandardMaterial({ color: 0x4d2e1b, roughness: 0.74, envMapIntensity: 0.4 });
    const ring = rr(w, d, 1.6); ring.holes.push(rr(w - TRAY.lip, d - TRAY.lip, 1.0, new THREE.Path()));
    const rim = new THREE.ExtrudeGeometry(ring, { depth: TRAY.rim - 0.24, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 3, curveSegments: 14 }); rim.rotateX(-Math.PI / 2); rim.translate(0, TRAY.top + 0.12, 0);
    for (const m of [new THREE.Mesh(base, [wood, side]), new THREE.Mesh(rim, side)]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); } }

  // ----- the pile: a small particle solver, so it stays smooth on phones -----
  // Each piece is a stiff row of spheres. These shapes are round, so the row's direction is the whole pose.
  const MAXP = small ? 130 : 200, pieces = [], parts = [], grid = new Map(), CELL = 2.6; let awake = 0;
  function spawnPiece(keyName, cx, cy, cz, len, kick) {
    const sh = SHAPES[keyName], pr = sh.R + 0.02, n = Math.max(2, Math.round(len / (pr * 1.3))), span = Math.max(0.2, len - pr * 2), pc = { key: keyName, len, r: pr, ps: [], rest: span / (n - 1), still: 0, asleep: false };
    const tilt = [(Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05];
    for (let i = 0; i < n; i++) { const t = i / (n - 1) - 0.5, y = cy + t * span, x = cx + tilt[0] * t * span, z = cz + tilt[1] * t * span, w = i / (n - 1); const p = { x, y, z, px: x - kick[0] * w, py: y + 0.02, pz: z - kick[1] * w, pc, k: 0 }; pc.ps.push(p); parts.push(p); }
    pieces.push(pc); return pc;
  }
  function stepPile(dt) {
    const g = -980 * dt * dt, ix = TRAY.w / 2 - TRAY.lip, iz = TRAY.d / 2 - TRAY.lip; awake = 0;
    for (const p of parts) { if (p.pc.asleep) continue; const vx = (p.x - p.px) * 0.996, vy = (p.y - p.py) * 0.996, vz = (p.z - p.pz) * 0.996; p.px = p.x; p.py = p.y; p.pz = p.z; p.x += vx; p.y += vy + g; p.z += vz; }
    for (let it = 0; it < 3; it++) {
      for (const pc of pieces) { if (pc.asleep) continue; const ps = pc.ps; for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const a = ps[i], b = ps[j], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-6, k = (d - pc.rest * (j - i)) / d * 0.5; a.x += dx * k; a.y += dy * k; a.z += dz * k; b.x -= dx * k; b.y -= dy * k; b.z -= dz * k; } }
      grid.clear(); for (const p of parts) { const key = ((p.x / CELL + 512) | 0) + ((p.y / CELL + 512) | 0) * 1024 + ((p.z / CELL + 512) | 0) * 1048576; let c = grid.get(key); if (!c) grid.set(key, c = []); c.push(p); p.k = key; }
      for (const a of parts) { if (a.pc.asleep) continue; const r = a.pc.r, inside = Math.abs(a.x) < TRAY.w / 2 && Math.abs(a.z) < TRAY.d / 2, gy = (inside ? TRAY.top : FLOOR_Y) + r;
        if (a.y < gy) { a.y = gy; a.px += (a.x - a.px) * 0.42; a.pz += (a.z - a.pz) * 0.42; if (a.py < a.y) a.py += (a.y - a.py) * 0.75; }
        if (inside && a.y < TRAY.top + TRAY.rim + r * 0.4) { if (Math.abs(a.x) > ix - r && Math.abs(a.x) < ix + 0.5) a.x = Math.sign(a.x) * (ix - r); if (Math.abs(a.z) > iz - r && Math.abs(a.z) < iz + 0.5) a.z = Math.sign(a.z) * (iz - r); } // the tray's rim
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) { const c = grid.get(a.k + ox + oy * 1024 + oz * 1048576); if (!c) continue;
          for (const b of c) { if (b.pc === a.pc) continue; const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d2 = dx * dx + dy * dy + dz * dz, R2 = r + b.pc.r; if (d2 >= R2 * R2 || d2 < 1e-9) continue;
            const d = Math.sqrt(d2), pen = (R2 - d) / d, share = b.pc.asleep ? 1 : 0.5; a.x -= dx * pen * share; a.y -= dy * pen * share; a.z -= dz * pen * share; if (!b.pc.asleep) { b.x += dx * pen * 0.5; b.y += dy * pen * 0.5; b.z += dz * pen * 0.5; }
            a.px += (a.x - a.px) * 0.12; a.py += (a.y - a.py) * 0.06; a.pz += (a.z - a.pz) * 0.12; } } }
    }
    for (const pc of pieces) { if (pc.asleep) continue; let m = 0; for (const p of pc.ps) m = Math.max(m, Math.abs(p.x - p.px) + Math.abs(p.y - p.py) + Math.abs(p.z - p.pz)); pc.still = m < 0.004 ? pc.still + 1 : 0; if (pc.still > 50 || pc.ps[0].y < FLOOR_Y - 5) { pc.asleep = true; for (const p of pc.ps) { p.px = p.x; p.py = p.y; p.pz = p.z; } } else awake++; }
  }
  const UP = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Vector3();
  function syncPile() { for (const k in kit) kit[k].pile.count = 0;
    for (const pc of pieces) { const K = kitFor(pc.key), i = K.pile.count++, a = pc.ps[0], b = pc.ps[pc.ps.length - 1]; _v.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize(); _q.setFromUnitVectors(UP, _v); _c.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); _s.set(1, pc.len, 1); K.pile.setMatrixAt(i, _m.compose(_c, _q, _s)); }
    for (const k in kit) kit[k].pile.instanceMatrix.needsUpdate = true; }
  let lastSig = '';
  function weigh() { const out = {}; for (const pc of pieces) if (pc.ps[0].y > TRAY.top - 0.5) out[pc.key] = (out[pc.key] || 0) + pc.len * SHAPES[pc.key].gcm; // only what stayed in the tray
    for (const k in out) out[k] = Math.round(out[k]); const sig = JSON.stringify(out); if (sig !== lastSig) { lastSig = sig; onChange(out); } return out; }

  // ----- strands hanging from the die -----
  let cur = null, strands = [];
  function loadShape(keyName) { cur = keyName; const K = kitFor(keyName), sh = K.sh; for (const s of strands) scene.remove(s.m); strands = []; buildFace(sh);
    for (let k = 0; k < sh.holes; k++) { const [hx, hz, a] = holeAt(sh, k), m = new THREE.Mesh(K.hi, K.mat); m.castShadow = true; m.receiveShadow = true; if (sh.twist) m.customDepthMaterial = K.depth; scene.add(m);
      strands.push({ m, hx, hz, a, ext: 0, base: k * 1.7, rate: 0.93 + 0.14 * ((k * 0.618) % 1), tx: (((k * 7) % 5) - 2) * 0.006, tz: (((k * 3) % 5) - 2) * 0.006 }); } onShape(keyName); }
  function syncStrands() { const tw = SHAPES[cur].twist; for (const s of strands) { const L = s.ext + 0.5; s.m.scale.set(1, L, 1); s.m.position.set(s.hx + s.tx * s.ext, 0.5 - L / 2, s.hz + s.tz * s.ext); s.m.rotation.set(s.tz, s.base + tw * L / 2, -s.tx); } }
  const maxExt = () => 11;

  // ----- cutting -----
  let sweep = null, knifeAngle = Math.PI * 1.125, feed = 0, view = 0, viewT = 0, swap = null, needs = 4;
  const full = () => pieces.length + strands.length > MAXP;
  function cut() { if (sweep || swap) return; if (full()) { onFull(); return; } sweep = { t: 0, from: knifeAngle, done: new Set() }; }
  function runSweep(dt) { if (!sweep) return; sweep.t = Math.min(1, sweep.t + dt / 0.34); const e = sweep.t < 0.5 ? 2 * sweep.t * sweep.t : 1 - Math.pow(-2 * sweep.t + 2, 2) / 2, ang = sweep.from + e * Math.PI * 2;
    for (const s of strands) { if (sweep.done.has(s)) continue; let d = (s.a - sweep.from) % (Math.PI * 2); if (d < 0) d += Math.PI * 2; if (ang - sweep.from >= d) { sweep.done.add(s);
      if (s.ext > 0.7) { const len = s.ext - 0.06; spawnPiece(cur, s.hx, -0.12 - len / 2, s.hz, len, [-Math.sin(s.a) * 0.05, Math.cos(s.a) * 0.05]); s.base += SHAPES[cur].twist * len; s.ext = 0.04; goWork(); } } }
    knife.rotation.y = -ang; if (sweep.t >= 1) { knife.rotation.y = -knifeAngle; sweep = null; } }
  function extrude(amount) { if (swap) return; for (const s of strands) s.ext = Math.min(maxExt(), s.ext + amount * s.rate); if (strands[0].ext > 2.4) goWork(); if (strands.some(s => s.ext >= maxExt())) cut(); }
  function goWork() { if (!view) { view = 1; onView(1); } }

  // ----- changing the die: pasta pulls back, the collar spins, the new face is there when it stops -----
  function setShape(keyName) { if (!SHAPES[keyName] || keyName === cur || swap) return; if (reduce) { loadShape(keyName); for (const s of strands) s.ext = 1.5 * s.rate; needs = 3; return; } swap = { t: 0, to: keyName, done: false, from: strands.map(s => s.ext) }; }
  function runSwap(dt) { if (!swap) return; swap.t += dt / 1.05; const t = swap.t;
    if (t < 0.2) strands.forEach((s, i) => { s.ext = swap.from[i] * (1 - ease(t / 0.2)); });
    else if (t < 0.78) { const u = (t - 0.2) / 0.58; dieGroup.rotation.y = -ease(u) * Math.PI * 2; if (u > 0.5 && !swap.done) { swap.done = true; loadShape(swap.to); } }
    else { dieGroup.rotation.y = 0; const u = Math.min(1, (t - 0.78) / 0.22); for (const s of strands) s.ext = 1.5 * s.rate * ease(u); if (t >= 1) swap = null; } }

  // ----- camera: a close look up at the die first, then the whole bench -----
  const cam = { pos: new THREE.Vector3(), tgt: new THREE.Vector3() }; let W = 1, H = 1;
  function frameCamera() { const asp = W / H, wide = asp > 1.05, e = ease(viewT);
    let A, B;
    if (camFix) A = B = camFix; else if (face) { A = B = { p: [0, -30, 0.01], t: [0, 0, 0], fov: 27.5, ox: 0, oy: 0 }; }
    else { A = wide ? { p: [4.6, -11.2, 13.2], t: [0.2, 0, 0], fov: 40, ox: -0.215, oy: -0.05 } : { p: [2.4, -11.6, 14.2], t: [0, 0, 0], fov: 54, ox: 0, oy: 0.19 };
      const free = clamp((H - 244) / H, 0.45, 0.8); // on phones the scale card covers the bottom, so the bench sits in what is left
      B = wide ? { p: [0, 1.5, 46], t: [0, -7.6, 0], fov: 26, ox: -0.15, oy: 0 } : { p: [0, 7, 70 * clamp(0.56 / free, 1, 1.3)], t: [0, -6.9, 0], fov: 30, ox: 0, oy: 0.5 - free / 2 - 0.015 }; }
    cam.pos.set(...A.p).lerp(_v.set(...B.p), e); cam.tgt.set(...A.t).lerp(_v.set(...B.t), e); camera.fov = A.fov + (B.fov - A.fov) * e; camera.aspect = asp; camera.position.copy(cam.pos); camera.lookAt(cam.tgt);
    camera.setViewOffset(W, H, W * (A.ox + (B.ox - A.ox) * e), H * (A.oy + (B.oy - A.oy) * e), W, H); camera.updateProjectionMatrix(); }

  // ----- input: drag down to extrude, tap to cut -----
  let drag = null; const target = stage || canvas;
  target.addEventListener('pointerdown', e => { if (e.button) return; drag = { y: e.clientY, x: e.clientX, moved: 0, t: performance.now() }; try { target.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ } });
  target.addEventListener('pointermove', e => { if (!drag) return; const dy = e.clientY - drag.y; drag.moved += Math.abs(dy) + Math.abs(e.clientX - drag.x); drag.y = e.clientY; drag.x = e.clientX; if (dy > 0 && !full()) feed += dy * 0.03; });
  const up = () => { if (!drag) return; if (drag.moved < 8 && performance.now() - drag.t < 400) cut(); drag = null; };
  target.addEventListener('pointerup', up); target.addEventListener('pointercancel', up);

  // ----- size, visibility and the loop: nothing is drawn unless something changed -----
  let dpr = Math.min(devicePixelRatio || 1, 2), seen = true, slow = 0;
  function resize() { W = hero.clientWidth || innerWidth; H = hero.clientHeight || innerHeight; renderer.setPixelRatio(dpr); renderer.setSize(W, H, false); needs = 3; }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero); else addEventListener('resize', resize);
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { seen = es[0].isIntersecting; if (seen) needs = 2; }).observe(hero);
  document.addEventListener('visibilitychange', () => { needs = 2; });

  function prefill(g) { let made = 0; for (const k in g) { if (!SHAPES[k]) continue; const sh = SHAPES[k]; let left = g[k] / sh.gcm; while (left > 1.5 && pieces.length < MAXP - sh.holes) { for (let h = 0; h < sh.holes && left > 1.5; h++) { const len = Math.min(left, 3.6 + Math.random() * 1.4), [hx, hz, a] = holeAt(sh, h); spawnPiece(k, hx, -0.2 - len / 2, hz, len, [-Math.sin(a) * 0.05, Math.cos(a) * 0.05]); left -= len; made++; } for (let i = 0; i < 80; i++) stepPile(1 / 120); } }
    if (made) { for (let i = 0; i < 1200 && (i < 200 || awake); i++) stepPile(1 / 120); view = viewT = 1; onView(1); } }

  loadShape(SHAPES[shape] ? shape : 'rigatoni'); for (const s of strands) s.ext = (face ? 0.9 : 1.7) * s.rate; knife.rotation.y = -knifeAngle;
  if (!face) prefill(grams); if (bare) { dieGroup.visible = false; strands.forEach(s => { s.m.visible = false; }); } resize(); weigh();
  let last = performance.now(), frames = 0;
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.033, (now - last) / 1000), raw = now - last; last = now;
    const active = feed > 0.0005 || sweep || swap || Math.abs(view - viewT) > 0.0004 || awake > 0 || needs > 0;
    if (!seen || document.hidden || !active) return;
    if (raw > 26 && raw < 200) { if (++slow > 40 && dpr > 1.25) { dpr = Math.max(1.25, dpr - 0.25); slow = 0; faceL.castShadow = false; resize(); } } else if (slow > 0) slow--; // ease off on slow phones
    if (feed > 0.0005) { const d = feed * Math.min(1, dt * 14); feed -= d; extrude(d); }
    runSweep(dt); runSwap(dt); if (awake || pieces.length !== frames) { stepPile(dt / 2); stepPile(dt / 2); frames = pieces.length; }
    viewT = reduce ? view : viewT + (view - viewT) * Math.min(1, dt * 2.6);
    syncStrands(); syncPile(); weigh(); frameCamera(); renderer.render(scene, camera); if (needs > 0) needs--;
    if (!window.__ready) window.__ready = true;
  });

  return { setShape, cut, push: v => { if (!full()) feed += v; }, shape: () => cur, pieces, isFull: full,
    clear() { pieces.length = 0; parts.length = 0; awake = 0; needs = 3; weigh(); }, toDie() { view = 0; onView(0); needs = 2; } };
}
