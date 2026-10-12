// Generates every Doodleville illustration into public/art/*.svg.
// Each mascot is drawn in local coordinates (feet at y=0, centered on x=0)
// with seeded jitter so lines look hand-inked but stay reproducible.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art');
mkdirSync(OUT, { recursive: true });

const INK = '#111';

// ---------- randomness + path helpers ----------
let seed = 1;
function reseed(s) { seed = s; }
function rand() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (a, b) => a + rand() * (b - a);
const n1 = (v) => Math.round(v * 10) / 10;
const pt = ([x, y]) => `${n1(x)},${n1(y)}`;

function smooth(pts, closed = true) {
  const n = pts.length;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(pts[0])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d + (closed ? 'Z' : '');
}
const jit = (pts, j = 1.5) => pts.map(([x, y]) => [x + rr(-j, j), y + rr(-j, j)]);

// Wobbly ellipse.
function blob(cx, cy, rx, ry, n = 14, j = 0.035, shape = () => 1) {
  const pts = [];
  const off = rr(0, Math.PI);
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    const k = (1 + rr(-j, j)) * shape(a);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smooth(pts);
}

// Wobbly open line through points, with extra jittered midpoints.
function wl(pts, j = 1.2, sub = 2) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    for (let s = 1; s < sub; s++) {
      const t = s / sub;
      out.push([x0 + (x1 - x0) * t + rr(-j, j), y0 + (y1 - y0) * t + rr(-j, j)]);
    }
    out.push(pts[i]);
  }
  return smooth(out, false);
}

// Wobbly rounded rectangle.
function wrect(x, y, w, h, r = 10, j = 1.2) {
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (i / 3) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r + rr(-j, j), cy + Math.sin(a) * r + rr(-j, j)]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  pts.push([x + w + rr(-j, j), y + h / 2]);
  corner(x + w - r, y + h - r, 0);
  pts.push([x + w / 2, y + h + rr(-j, j)]);
  corner(x + r, y + h - r, Math.PI / 2);
  pts.push([x + rr(-j, j), y + h / 2]);
  corner(x + r, y + r, Math.PI);
  pts.push([x + w / 2, y + rr(-j, j)]);
  return smooth(pts);
}

// Wobbly polygon (sharp-ish corners via doubled points).
function wpoly(pts, j = 1.2) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    out.push([a[0] + rr(-j, j) * 0.3, a[1] + rr(-j, j) * 0.3]);
    out.push([a[0] + (b[0] - a[0]) * 0.02, a[1] + (b[1] - a[1]) * 0.02]);
    for (const t of [0.33, 0.66]) out.push([a[0] + (b[0] - a[0]) * t + rr(-j, j), a[1] + (b[1] - a[1]) * t + rr(-j, j)]);
    out.push([a[0] + (b[0] - a[0]) * 0.98, a[1] + (b[1] - a[1]) * 0.98]);
  }
  return smooth(out);
}

const P = (d, a = '') => `<path d="${d}" ${a}/>`;
const C = (x, y, r, a = '') => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" ${a}/>`;
const BLK = `fill="${INK}"`;
const NONE = 'fill="none"';
const g = (tf, inner, a = '') => `<g transform="${tf}" ${a}>${inner}</g>`;
const place = (x, y, s, inner, flip = false) => g(`translate(${n1(x)} ${n1(y)}) scale(${flip ? -s : s} ${s})`, inner);

// ---------- face + limb parts ----------
function eye(x, y, r, lx = 0, ly = 0) {
  const px = x + lx * r * 0.38, py = y + ly * r * 0.38 + r * 0.08;
  return P(blob(x, y, r, r * 1.18, 10, 0.04), 'fill="#fff"') +
    C(px, py, r * 0.56, `${BLK} stroke="none"`) +
    C(px - r * 0.2, py - r * 0.22, r * 0.18, 'fill="#fff" stroke="none"');
}
function happyEye(x, y, r) {
  return P(`M${n1(x - r)},${n1(y + 2)} Q${n1(x)},${n1(y - r * 1.3)} ${n1(x + r)},${n1(y + 2)}`, NONE);
}
function smile(x, y, w, open = false, color = INK) {
  if (open) {
    return P(`M${n1(x - w / 2)},${n1(y)} Q${n1(x)},${n1(y + w * 1.05)} ${n1(x + w / 2)},${n1(y)} Q${n1(x)},${n1(y + w * 0.12)} ${n1(x - w / 2)},${n1(y)}Z`, `fill="${color}"`) +
      P(`M${n1(x - w * 0.18)},${n1(y + w * 0.42)} Q${n1(x)},${n1(y + w * 0.3)} ${n1(x + w * 0.2)},${n1(y + w * 0.42)}`, 'fill="none" stroke="#fff" stroke-width="2"');
  }
  return P(`M${n1(x - w / 2)},${n1(y)} Q${n1(x + rr(-1, 1))},${n1(y + w * 0.6)} ${n1(x + w / 2)},${n1(y)}`, `fill="none" stroke="${color}"`);
}
function worried(x, y, w, color = INK) {
  return P(wl([[x - w / 2, y + 2], [x - w / 6, y - 3], [x + w / 6, y + 3], [x + w / 2, y - 2]], 0.4, 1), `fill="none" stroke="${color}"`);
}
function blush(x, y) {
  let s = '';
  for (let i = 0; i < 3; i++) s += P(`M${n1(x - 6 + i * 5)},${n1(y + 4)} l4,-7`, 'stroke-width="2"');
  return s;
}
function arm(x1, y1, x2, y2, bend = 8, color = INK, w = 3.5) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / L) * bend, cy = my + (dx / L) * bend;
  return P(`M${n1(x1)},${n1(y1)} Q${n1(cx)},${n1(cy)} ${n1(x2)},${n1(y2)}`, `fill="none" stroke="${color}" stroke-width="${w}"`) +
    P(blob(x2, y2, 7, 6.5, 8, 0.05), 'fill="#fff"');
}
function sweat(x, y) {
  return P(`M${x},${y} C${x - 7},${y + 10} ${x - 6},${y + 18} ${x},${y + 18} C${x + 6},${y + 18} ${x + 7},${y + 10} ${x},${y}Z`, 'fill="#fff"');
}
function glasses(x, y, r, gap) {
  return C(x - gap, y, r, NONE) + C(x + gap, y, r, NONE) +
    P(`M${n1(x - gap + r)},${n1(y - 2)} Q${n1(x)},${n1(y - 7)} ${n1(x + gap - r)},${n1(y - 2)}`, NONE);
}
function bow(x, y, s = 1) {
  return g(`translate(${x} ${y}) scale(${s})`,
    P('M0,0 L-18,-11 Q-22,0 -18,11Z', BLK) + P('M0,0 L18,-11 Q22,0 18,11Z', BLK) + C(0, 0, 5, 'fill="#fff"'));
}
function sparkle(x, y, r) {
  const k = r * 0.22;
  return P(`M${x},${y - r} Q${x + k},${y - k} ${x + r},${y} Q${x + k},${y + k} ${x},${y + r} Q${x - k},${y + k} ${x - r},${y} Q${x - k},${y - k} ${x},${y - r}Z`, 'fill="#fff"');
}
function heartPath(x, y, s) {
  return `M${x},${y + 30 * s} C${x - 8 * s},${y + 22 * s} ${x - 44 * s},${y - 2 * s} ${x - 42 * s},${y - 24 * s} C${x - 40 * s},${y - 46 * s} ${x - 12 * s},${y - 50 * s} ${x},${y - 28 * s} C${x + 12 * s},${y - 50 * s} ${x + 40 * s},${y - 46 * s} ${x + 42 * s},${y - 24 * s} C${x + 44 * s},${y - 2 * s} ${x + 8 * s},${y + 22 * s} ${x},${y + 30 * s}Z`;
}
function leaf(x1, y1, x2, y2, w, a = 'fill="#fff"', rib = true) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  const px = (-dy / L) * w, py = (dx / L) * w;
  let s = P(`M${n1(x1)},${n1(y1)} Q${n1(mx + px)},${n1(my + py)} ${n1(x2)},${n1(y2)} Q${n1(mx - px)},${n1(my - py)} ${n1(x1)},${n1(y1)}Z`, a);
  if (rib) s += P(`M${n1(x1)},${n1(y1)} Q${n1(mx + px * 0.15)},${n1(my + py * 0.15)} ${n1(x2 - dx * 0.15)},${n1(y2 - dy * 0.15)}`, 'fill="none" stroke-width="2"');
  return s;
}
// Double-stroked tube: outline in ink, body in white.
function tube(d, w) {
  return P(d, `fill="none" stroke="${INK}" stroke-width="${w + 7}"`) + P(d, `fill="none" stroke="#fff" stroke-width="${w}"`);
}
function shadow(x, y, rx) {
  return P(blob(x, y, rx, rx * 0.16, 12, 0.03), 'fill="url(#hatch)" stroke="none"');
}

// ---------- the Scribbles ----------
// Each returns { s: svg markup, face: [x,y] (portrait center), top: height }.

function blot(o = {}) {
  let s = '';
  s += P(blob(-22, -9, 16, 8, 10, 0.05), 'fill="#fff"') + P(blob(22, -9, 16, 8, 10, 0.05), 'fill="#fff"');
  const body = jit([[0, -184], [13, -160], [33, -134], [52, -108], [63, -80], [61, -48], [47, -24], [23, -13], [0, -11],
    [-23, -13], [-47, -24], [-61, -48], [-63, -80], [-52, -108], [-33, -134], [-13, -160]], 1.3);
  // arms behind for waving pose
  const armL = o.wave === 'left' ? arm(-55, -78, -92, -126, -10, INK, 6) : arm(-58, -56, -84, -32, 6, INK, 6);
  const armR = o.wave === 'right' ? arm(55, -78, 92, -126, 10, INK, 6) : (o.hold ? arm(56, -60, ...o.hold, -6, INK, 6) : arm(58, -56, 84, -32, -6, INK, 6));
  s += armL + armR;
  s += P(smooth(body), BLK);
  s += P('M-44,-96 Q-50,-66 -36,-42', 'fill="none" stroke="#fff" stroke-width="5"') + C(-40, -112, 3.5, 'fill="#fff" stroke="none"');
  const lx = o.look ? o.look[0] : 0, ly = o.look ? o.look[1] : 0;
  s += eye(-21, -84, 16, lx, ly) + eye(22, -84, 16, lx, ly);
  if (o.mood === 'worried') {
    s += worried(1, -52, 22, '#fff') + sweat(-56, -128);
    s += P('M-34,-106 L-12,-112', 'stroke="#fff" stroke-width="3"') + P('M12,-112 L34,-106', 'stroke="#fff" stroke-width="3"');
  } else s += smile(1, -56, 26, false, '#fff');
  if (o.glasses) s += g('', glasses(1, -84, 19, 22), 'stroke="#fff"');
  return { s, face: [0, -86], top: 184 };
}

function nib(o = {}) {
  let s = '';
  // backpack behind
  if (o.backpack) {
    s += P(wrect(-62, -150, 52, 96, 16), 'fill="#fff"') + P(wrect(-66, -110, 30, 40, 8), 'fill="url(#hatch)"') +
      P('M-60,-150 Q-52,-170 -36,-150', NONE);
  }
  s += P(wl([[-14, -36], [-15, -8]], 0.6), NONE) + P(wl([[14, -36], [16, -8]], 0.6), NONE);
  s += P(blob(-21, -8, 15, 8, 10, 0.05), BLK) + P(blob(23, -8, 15, 8, 10, 0.05), BLK);
  const armR = o.wave ? arm(32, -120, 66, -168, 12) : (o.hold ? arm(32, -116, ...o.hold, -8) : arm(32, -116, 54, -82, -6));
  s += P(wrect(-33, -198, 66, 164, 10), 'fill="#fff"');
  s += P(wl([[-11, -44], [-11, -168]], 0.8), 'fill="none" stroke-width="2.5"') + P(wl([[11, -44], [11, -168]], 0.8), 'fill="none" stroke-width="2.5"');
  s += P(wrect(-35, -186, 70, 22, 4), 'fill="url(#hatch)"') +
    P('M-34,-179 L34,-179', 'stroke-width="2"') + P('M-34,-172 L34,-172', 'stroke-width="2"');
  // cap
  s += P('M-37,-190 C-38,-238 38,-240 37,-190 Z', BLK) +
    P('M30,-194 C52,-202 76,-200 82,-190 C66,-183 44,-186 30,-188 Z', BLK) + C(0, -230, 4, 'fill="#fff"');
  s += P('M-18,-222 Q-12,-232 0,-234', 'fill="none" stroke="#fff" stroke-width="3"');
  if (o.backpack) s += P(wl([[-30, -160], [-8, -120], [-2, -60]], 0.8), 'fill="none" stroke-width="7"') + P(wl([[-30, -160], [-8, -120], [-2, -60]], 0.8), 'fill="none" stroke="#fff" stroke-width="2"');
  s += eye(-12, -138, 11, o.look?.[0] || 0, o.look?.[1] || 0) + eye(15, -138, 11, o.look?.[0] || 0, o.look?.[1] || 0);
  s += o.mood === 'focus' ? P('M-6,-112 L10,-112', NONE) : smile(2, -116, 18, !!o.open);
  s += blush(-24, -118) + blush(26, -118);
  s += arm(-32, -116, -54, -82, 6) + armR;
  return { s, face: [0, -150], top: 240 };
}

function smudge(o = {}) {
  let s = '';
  s += P(blob(-26, -9, 16, 8, 10, 0.05), 'fill="#fff"') + P(blob(26, -9, 16, 8, 10, 0.05), 'fill="#fff"');
  // puffy cloud body with outward bumps
  const cx = 0, cy = -84, R = 64, n = 11;
  const off = rr(0, 1);
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    const r = R * (1 + rr(-0.03, 0.03));
    const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92];
    if (i === 0) d += `M${pt(p)}`;
    else {
      const am = off + ((i - 0.5) / n) * Math.PI * 2;
      const rc = R * rr(1.26, 1.34);
      d += `Q${pt([cx + Math.cos(am) * rc, cy + Math.sin(am) * rc * 0.92])} ${pt(p)}`;
    }
  }
  s += P(d + 'Z', 'fill="#fff"');
  // inner fluff curls
  s += P('M-48,-120 Q-40,-128 -30,-124', 'fill="none" stroke-width="2.5"') + P('M36,-40 Q46,-42 50,-52', 'fill="none" stroke-width="2.5"');
  s += o.happy ? happyEye(-18, -92, 11) + happyEye(19, -92, 11) : eye(-18, -94, 11, o.look?.[0] || 0, o.look?.[1] || 0) + eye(19, -94, 11, o.look?.[0] || 0, o.look?.[1] || 0);
  if (o.glasses) s += glasses(0, -94, 17, 19);
  s += smile(1, -70, 20, true) + blush(-38, -76) + blush(38, -76);
  const hl = o.armUp === 'left' ? [-62, -124] : [-76, -66];
  const hr = o.armUp === 'right' ? [64, -128] : [76, -66];
  s += P(blob(hl[0], hl[1], 13, 11, 9, 0.06), 'fill="#fff"') + P(blob(hr[0], hr[1], 13, 11, 9, 0.06), 'fill="#fff"');
  // smudge trail
  s += P('M-80,-24 Q-66,-30 -54,-24', 'fill="none" stroke-width="2.5"') + P('M-92,-36 Q-80,-42 -70,-38', 'fill="none" stroke-width="2.5"');
  return { s, face: [0, -88], top: 170 };
}

function quill(o = {}) {
  let s = '';
  for (const x of [-14, 14]) {
    s += P(wl([[x, -22], [x + 1, -4]], 0.4), NONE);
    s += P(`M${x + 1},-4 l-9,4 M${x + 1},-4 l1,6 M${x + 1},-4 l10,3`, NONE);
  }
  s += leaf(-46, -64, -92, -90, 11) + leaf(-48, -54, -96, -56, 10, BLK, false);
  s += leaf(-2, -134, -24, -184, 9) + leaf(2, -136, 6, -200, 10, BLK, false) + leaf(6, -134, 30, -180, 9);
  s += P(blob(0, -80, 56, 62, 16, 0.025), 'fill="#fff"');
  s += P(blob(10, -58, 30, 32, 12, 0.04), 'fill="#fff"');
  for (const [x, y] of [[0, -62], [16, -62], [8, -48], [-4, -46], [22, -46]]) s += P(`M${x - 5},${y} q5,6 10,0`, 'fill="none" stroke-width="2"');
  // wing
  s += o.flap
    ? leaf(-40, -86, -96, -132, 16) + P('M-56,-104 l-12,4 M-68,-114 l-12,4', 'stroke-width="2"')
    : leaf(-34, -92, -48, -38, 15) + P('M-46,-70 l10,-4 M-46,-58 l10,-4', 'stroke-width="2"');
  s += eye(-6, -102, 13, 0.4, 0) + eye(24, -102, 13, 0.4, 0);
  s += P('M44,-96 Q60,-94 72,-86 Q58,-82 44,-82Z', 'fill="#fff"') + P('M44,-89 L66,-87', 'stroke-width="2"');
  s += blush(-20, -82) + blush(40, -74);
  if (o.carry) {
    // plank held overhead
    s += P(wrect(-90, -230, 180, 22, 4), 'fill="#fff"') + P('M-60,-224 q14,6 28,0 M20,-220 q14,6 28,0', 'fill="none" stroke-width="2"');
    s += arm(-40, -110, -50, -206, -6) + arm(40, -110, 50, -206, 6);
  }
  return { s, face: [6, -92], top: 200 };
}

function loop(o = {}) {
  let s = '';
  for (const [x1, x2] of [[-56, -60], [-32, -30], [8, 6], [32, 36]]) s += tube(wl([[x1, -40], [x2, -4]], 0.6), 9);
  s += tube('M-66,-52 C-98,-62 -112,-104 -92,-116 C-72,-128 -64,-98 -80,-94 C-98,-90 -110,-124 -98,-150 C-94,-158 -88,-160 -84,-158', 10);
  s += tube('M58,-112 C62,-72 42,-44 2,-44 C-30,-44 -56,-44 -66,-50', 26);
  s += P('M-22,-56 L-24,-32', 'stroke-width="3"') + P('M10,-56 L8,-32', 'stroke-width="3"') + P('M-50,-56 L-54,-34', 'stroke-width="3"');
    s += P('M36,-146 L36,-184 L62,-158Z', 'fill="#fff"') + P('M66,-160 L94,-182 L94,-146Z', 'fill="#fff"');
  s += P('M41,-160 L41,-174 L51,-162Z', BLK) + P('M77,-163 L89,-172 L89,-157Z', BLK);
  s += P(blob(64, -128, 38, 32, 14, 0.03), 'fill="#fff"');
  s += o.happy ? happyEye(51, -132, 9) + happyEye(78, -132, 9) : eye(51, -132, 10) + eye(78, -132, 10);
  if (o.glasses) s += glasses(64, -132, 14, 14);
  s += P('M60,-118 L68,-118 L64,-113Z', BLK);
  s += P('M56,-109 Q60,-103 64,-110 Q68,-103 72,-109', NONE);
  s += P('M30,-120 L14,-124 M30,-114 L14,-112 M98,-120 L114,-124 M98,-114 L114,-112', 'stroke-width="2"');
  return { s, face: [62, -128], top: 184 };
}

function dot(o = {}) {
  let s = '';
  s += P(blob(-12, -5, 10, 5, 8, 0.05), BLK) + P(blob(13, -5, 10, 5, 8, 0.05), BLK);
  s += P(wl([[-10, -84], [-18, -108], [-28, -126]], 0.8), NONE) + P(wl([[10, -84], [16, -110], [26, -128]], 0.8), NONE);
  s += C(-29, -128, 7, BLK) + C(27, -130, 7, BLK);
  const hl = o.armsUp ? [-44, -78] : [-44, -34];
  const hr = o.armsUp ? [44, -78] : [44, -34];
  s += arm(-32, -48, ...hl, 4) + arm(32, -48, ...hr, -4);
  s += P(blob(0, -46, 38, 44, 16, 0.025, (a) => 1 - 0.1 * Math.max(0, Math.cos(a)) ** 6), 'fill="#fff"');
  s += P('M-26,-70 Q-30,-56 -26,-44', 'fill="none" stroke-width="2"');
  s += eye(-12, -54, 10) + eye(13, -54, 10);
  s += smile(1, -36, 14, !!o.open) + blush(-24, -38) + blush(26, -38);
  if (o.bow) s += bow(-2, -92, 0.9);
  return { s, face: [0, -60], top: 136 };
}

function rubb(o = {}) {
  let s = '';
  s += P(wl([[-18, -26], [-20, -8]], 0.5), NONE) + P(wl([[18, -26], [20, -8]], 0.5), NONE);
  s += P(blob(-25, -8, 15, 8, 10, 0.05), BLK) + P(blob(26, -8, 15, 8, 10, 0.05), BLK);
  s += P(wrect(-46, -176, 92, 152, 20), 'fill="#fff"');
  s += P('M22,-172 L42,-152 M30,-174 L44,-160', 'stroke-width="2"');
  s += P(wrect(-48, -92, 96, 36, 6), BLK);
  s += P('M-30,-74 q8,-8 16,0 t16,0 t16,0 t16,0', 'fill="none" stroke="#fff" stroke-width="2.5"');
  s += eye(-17, -136, 12, o.look?.[0] || 0, 0) + eye(18, -136, 12, o.look?.[0] || 0, 0);
  s += smile(1, -112, 20, true) + blush(-32, -114) + blush(34, -114);
  s += arm(-46, -84, -70, -58, 6) + arm(46, -84, 70, -58, -6);
  // eraser crumbs
  s += P('M-64,-6 q3,-4 6,0 M60,-4 q3,-4 6,0 M72,-12 q2,-3 4,0', 'fill="none" stroke-width="2.5"');
  return { s, face: [0, -130], top: 176 };
}

function tuft(o = {}) {
  let s = '';
  s += P(blob(-20, -8, 15, 8, 10, 0.05), 'fill="#fff"') + P(blob(20, -8, 15, 8, 10, 0.05), 'fill="#fff"');
  s += arm(-44, -72, -66, -44, 6) + arm(44, -72, 66, -44, -6);
  s += P(blob(0, -92, 50, 82, 18, 0.02), 'fill="#fff"');
  // scarf
  s += P(wl([[-46, -64], [0, -54], [46, -64]], 0.6), 'fill="none" stroke-width="12"') + P('M24,-60 L30,-30 L42,-34 L34,-60Z', BLK);
  s += P(smooth(jit([[-54, -120], [-56, -150], [-42, -176], [-30, -170], [-20, -192], [-4, -178], [10, -198], [20, -176],
    [38, -186], [40, -164], [56, -150], [52, -120], [34, -130], [14, -118], [-8, -130], [-30, -118]], 1)), BLK);
  s += eye(-16, -100, 13, o.look?.[0] || 0, 0) + eye(17, -100, 13, o.look?.[0] || 0, 0);
  s += smile(1, -78, 16, !!o.open) + blush(-32, -82) + blush(34, -82);
  return { s, face: [0, -110], top: 196 };
}

const CAST = { blot, nib, smudge, quill, loop, dot, rubb, tuft };

// ---------- scenery ----------
function ground(x1, x2, y, tufts = 6) {
  let s = P(wl([[x1, y], [(x1 + x2) / 2, y + rr(-3, 3)], [x2, y]], 2.2, 6), NONE);
  for (let i = 0; i < tufts; i++) {
    const x = x1 + ((i + 0.5) / tufts) * (x2 - x1) + rr(-20, 20);
    s += P(`M${n1(x)},${y + 8} l-4,-10 M${n1(x + 5)},${y + 8} l1,-13 M${n1(x + 10)},${y + 8} l5,-10`, 'stroke-width="2.5"');
  }
  return s;
}
function cloud(x, y, w) {
  const h = w * 0.42;
  return P(`M${x},${y} q${-w * 0.08},${-h * 0.9} ${w * 0.22},${-h * 0.8} q${w * 0.1},${-h * 0.7} ${w * 0.36},${-h * 0.4} q${w * 0.3},${-h * 0.3} ${w * 0.36},${h * 0.5} q${w * 0.14},${h * 0.6} ${-w * 0.06},${h * 0.7}Z`, 'fill="#fff"');
}
function tree(x, y, h, o = {}) {
  let s = P(wl([[x - 8, y], [x - 6, y - h * 0.5]], 0.8), NONE) + P(wl([[x + 8, y], [x + 7, y - h * 0.5]], 0.8), NONE);
  s += P(`M${x - 2},${y - h * 0.2} l4,-10`, 'stroke-width="2"');
  s += P(blob(x, y - h * 0.68, h * 0.34, h * 0.32, 13, 0.08), o.dashed ? 'fill="#fff" stroke-dasharray="6 7"' : 'fill="#fff"');
  if (!o.dashed) s += P(`M${n1(x - h * 0.15)},${n1(y - h * 0.7)} q6,-8 12,0 M${n1(x + h * 0.05)},${n1(y - h * 0.82)} q6,-8 12,0`, 'fill="none" stroke-width="2.5"');
  return s;
}
function bird(x, y, s = 1) {
  return P(`M${x - 12 * s},${y} q${6 * s},${-8 * s} ${12 * s},0 q${6 * s},${-8 * s} ${12 * s},0`, 'fill="none" stroke-width="2.5"');
}
function flower(x, y) {
  let s = P(`M${x},${y} l0,-22`, NONE);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    s += C(x + Math.cos(a) * 6, y - 28 + Math.sin(a) * 6, 5, 'fill="#fff" stroke-width="2"');
  }
  return s + C(x, y - 28, 3.5, BLK);
}
function bunting(x1, y1, x2, y2, n, sag = 30) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + sag;
  const at = (t) => [(1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t * t * y2];
  let s = P(`M${x1},${y1} Q${mx},${my} ${x2},${y2}`, NONE);
  for (let i = 0; i < n; i++) {
    const a = at((i + 0.2) / n), b = at((i + 0.8) / n);
    const c = [(a[0] + b[0]) / 2 + rr(-2, 2), (a[1] + b[1]) / 2 + 30];
    s += P(`M${pt(a)} L${pt(b)} L${pt(c)}Z`, i % 2 ? BLK : 'fill="#fff"');
  }
  return s;
}

const DEFS = `<defs><pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#fff"/><line x1="0" y1="0" x2="0" y2="7" stroke="${INK}" stroke-width="2.2"/></pattern></defs>`;
function svg(name, vb, body, title) {
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${title}">${DEFS}` +
    `<g fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`;
  writeFileSync(join(OUT, name), out);
}
function put(fn, x, y, s, o = {}, flip = false) {
  return place(x, y, s, fn(o).s, flip);
}

// ---------- files ----------
reseed(7);
svg('logo.svg', '0 0 64 64',
  P('M32,4 C38,16 52,26 52,40 C52,52 43,60 32,60 C21,60 12,52 12,40 C12,26 26,16 32,4Z', BLK) +
  C(25, 37, 3.6, 'fill="#fff" stroke="none"') + C(39, 37, 3.6, 'fill="#fff" stroke="none"') +
  P('M23,46 Q32,54 41,46', 'fill="none" stroke="#fff" stroke-width="3.5"') +
  P('M19,32 Q18,24 23,19', 'fill="none" stroke="#fff" stroke-width="2.5"'),
  'Doodleville logo');

reseed(11);
{
  let b = '';
  b += sparkle(90, 220, 16) + sparkle(1320, 190, 20) + sparkle(1210, 300, 10) + sparkle(250, 140, 10) + sparkle(760, 150, 12);
  const row = [[quill, 170, 1.15, {}], [nib, 380, 1.2, { wave: true }], [blot, 620, 1.45, { open: true }],
    [smudge, 860, 1.2, { happy: true, armUp: 'right' }], [loop, 1070, 1.15, {}], [dot, 1255, 1.3, { open: true, armsUp: true }]];
  for (const [fn, x, sc] of row) b += shadow(x, 452, 70 * sc);
  for (const [fn, x, sc, o] of row) b += put(fn, x, 446, sc, o);
  svg('hero-cast.svg', '0 100 1400 380', b, 'The Scribbles standing together');
}

reseed(23);
{
  let b = '';
  b += cloud(80, 120, 150) + cloud(720, 80, 120) + cloud(860, 150, 90);
  b += bird(300, 90) + bird(340, 110, 0.7) + bird(560, 60, 0.8);
  // floating island top surface
  const top = [[380, 262], [460, 246], [560, 252], [660, 242], [760, 250], [860, 262]];
  b += P(wl([[384, 268], [470, 330], [540, 400], [610, 470], [660, 400], [730, 340], [800, 300], [856, 268]], 3, 2) + 'Z', 'fill="url(#hatch)"');
  b += P(wl(top, 2, 3), NONE);
  // erased right flank of the island
  b += P(wl([[760, 250], [800, 252], [856, 266], [800, 300], [730, 340]], 2), 'fill="#fff" stroke-dasharray="7 9"');
  // cracks
  b += P('M520,250 l12,30 l-14,24 l16,30 l-8,40', 'fill="none" stroke-width="4"');
  b += P('M640,246 l-8,26 l14,22 l-10,28', 'fill="none" stroke-width="4"');
  b += P('M532,280 l20,8 M518,304 l-18,6', 'fill="none" stroke-width="2.5"');
  // falling chunks
  b += P(wpoly([[600, 500], [622, 494], [618, 516], [602, 520]]), 'fill="#fff"') + P(wpoly([[646, 530], [660, 524], [662, 540]]), BLK) + P(wpoly([[572, 540], [586, 536], [584, 552], [574, 550]]), 'fill="#fff"');
  b += tree(440, 252, 110) + tree(700, 246, 90) + tree(810, 254, 96, { dashed: true });
  // little house
  b += P(wpoly([[560, 250], [620, 250], [620, 200], [560, 200]]), 'fill="#fff"') + P(wpoly([[550, 204], [590, 168], [630, 204]]), BLK) + P(wrect(582, 222, 16, 28, 3), 'fill="#fff"');
  // eraser + smudge streaks over the island
  b += g('translate(810 150) rotate(-24)', P(wrect(-50, -22, 100, 44, 10), 'fill="#fff"') + P(wrect(-12, -24, 36, 48, 4), BLK));
  for (let i = 0; i < 5; i++) b += P(wl([[730 + i * 16, 190 + i * 6], [790 + i * 14, 220 + i * 10]], 2), 'fill="none" stroke-width="2" stroke-dasharray="3 6"');
  b += P('M870,190 q4,-6 8,0 M886,206 q4,-6 8,0 M860,214 q3,-5 6,0', 'fill="none" stroke-width="2.5"');
  // foreground cliff with Blot
  b += P(wl([[0, 470], [140, 466], [270, 474], [300, 520], [300, 560]], 2, 2) + 'L0,560Z', 'fill="#fff"');
  b += P('M280,500 l-14,10 M290,530 l-18,4', 'fill="none" stroke-width="2.5"');
  b += ground(10, 250, 470, 4);
  b += put(blot, 170, 468, 1.15, { mood: 'worried', look: [1, -0.4] });
  svg('danger.svg', '0 0 1000 560', b, 'Blot staring at a cracked, half-erased island');
}

reseed(31);
{
  let b = '';
  b += sparkle(520, 100, 14) + sparkle(80, 200, 10);
  b += P(wpoly([[150, 212], [450, 212], [474, 96], [126, 96]]), 'fill="#fff"');
  b += P(wrect(250, 124, 100, 18, 9), 'fill="#fff"') + P(wrect(266, 108, 68, 18, 8), NONE);
  b += P(wpoly([[150, 212], [450, 212], [492, 252], [108, 252]]), 'fill="url(#hatch)"');
  // sandwich
  b += P(wpoly([[170, 250], [300, 250], [214, 130]]), 'fill="#fff"') + P(wl([[184, 236], [282, 236], [218, 146]], 1), NONE);
  b += P(wl([[176, 246], [190, 238], [204, 246], [218, 238], [232, 246], [246, 238], [260, 246], [274, 238], [290, 246]], 0.4, 1), 'fill="none" stroke-width="2.5"');
  // rolled map
  b += g('translate(360 180) rotate(-28)', P(wrect(-26, -70, 52, 140, 8), 'fill="#fff"') + P(blob(0, -70, 26, 8, 10), 'fill="#fff"') +
    P('M-14,-40 q8,10 0,22 q-8,12 4,24 M-6,20 l10,10 M4,20 l-10,10', 'fill="none" stroke-width="2.5" stroke-dasharray="4 5"') +
    P('M-6,20 l10,10 M4,20 l-10,10', 'stroke-width="3"'));
  // pencil
  b += g('translate(440 150) rotate(30)', P(wrect(-11, -110, 22, 160, 3), 'fill="#fff"') + P('M-11,-110 L0,-140 L11,-110Z', 'fill="#fff"') +
    P('M-4,-128 L0,-140 L4,-128Z', BLK) + P(wrect(-12, 30, 24, 16, 2), 'fill="url(#hatch)"') + P('M0,-106 L0,28', 'stroke-width="2"'));
  // front face
  b += P(wpoly([[108, 252], [492, 252], [470, 400], [130, 400]]), 'fill="#fff"');
  b += P(wrect(276, 244, 48, 28, 6), BLK) + C(300, 258, 5, 'fill="#fff"');
  b += P(heartPath(170, 320, 0.45), BLK) + sparkle(420, 330, 16) + P('M200,370 L400,370', 'stroke-width="2.5" stroke-dasharray="2 10"');
  b += P(wl([[100, 420], [300, 424], [500, 420]], 2, 4), NONE);
  svg('lunchbox.svg', '0 60 600 380', b, 'An open lunchbox packed with a sandwich, a map and a pencil');
}

// avatars
const AV = [
  [blot, { open: true }], [nib, {}], [smudge, { glasses: true }], [quill, {}],
  [loop, { happy: true }], [dot, { bow: true, open: true }], [rubb, {}], [tuft, { open: true }],
];
AV.forEach(([fn, o], i) => {
  reseed(100 + i);
  const m = fn(o);
  const sc = fn === dot ? 1.75 : fn === loop ? 1.45 : 1.25;
  const [fx, fy] = m.face;
  const tx = 100 - fx * sc, ty = 108 - fy * sc;
  const body = `<clipPath id="c${i}"><circle cx="100" cy="100" r="94"/></clipPath>` +
    C(100, 100, 94, 'fill="#fff" stroke="none"') +
    `<g clip-path="url(#c${i})">${place(tx, ty, sc, m.s)}</g>`;
  svg(`avatar-${i + 1}.svg`, '0 0 200 200', body, `Scribble portrait ${i + 1}`);
});

reseed(41);
{
  let b = '';
  b += ground(40, 560, 512, 5) + flower(80, 512) + flower(520, 512) + flower(110, 512);
  b += P('M298,232 C290,300 250,360 266,452', NONE) + P('M302,232 C320,300 360,380 372,470', NONE);
  b += P(heartPath(300, 150, 2.1), 'fill="#fff"') + P('M232,102 Q234,82 254,76', 'fill="none" stroke-width="5"');
  b += P('M296,214 l4,10 l4,-10Z', 'fill="#fff"');
  b += P(heartPath(470, 110, 0.35), BLK) + P(heartPath(130, 160, 0.28), 'fill="#fff"') + P(heartPath(500, 210, 0.22), 'fill="#fff"');
  b += sparkle(110, 70, 12) + sparkle(520, 330, 10);
  b += shadow(190, 516, 80) + shadow(410, 516, 56);
  b += put(smudge, 190, 512, 1.1, { happy: true, armUp: 'right' }) + put(dot, 410, 512, 1.35, { open: true, armsUp: true, bow: true });
  svg('kindness.svg', '0 20 600 520', b, 'Smudge and Dot sharing a heart-shaped balloon');
}

reseed(53);
{
  let b = ground(10, 1590, 312, 10);
  const row = [[nib, 1.0, {}], [dot, 1.3, {}], [blot, 1.1, {}], [tuft, 1.0, {}], [smudge, 1.1, {}], [rubb, 1.05, {}], [quill, 1.05, {}], [loop, 0.95, {}]];
  row.forEach(([fn, sc, o], i) => { b += put(fn, 110 + i * 196, 306, sc, o); });
  b += sparkle(1540, 80, 14) + sparkle(60, 90, 10) + sparkle(800, 60, 10);
  svg('lineup.svg', '0 20 1600 310', b, 'All eight Scribbles lined up side by side');
}

reseed(67);
{
  let b = '';
  b += cloud(60, 120, 140) + cloud(820, 110, 120) + bird(200, 60) + bird(240, 84, 0.7);
  // canopy
  b += P(blob(560, 200, 300, 150, 18, 0.07), 'fill="#fff"');
  for (const [x, y] of [[360, 160], [420, 100], [700, 90], [780, 180], [640, 70], [300, 240], [820, 260]]) b += P(`M${x},${y} q8,-10 16,0 q8,-10 16,0`, 'fill="none" stroke-width="2.5"');
  // trunk + branches
  b += P(wl([[520, 720], [530, 560], [520, 400]], 2) + 'L610,400' + wl([[610, 400], [600, 560], [620, 720]], 2).replace(/^M[^C]+/, '') + 'Z', 'fill="#fff"');
  b += P('M540,620 q10,-20 0,-40 M590,500 q-8,-20 4,-36 M560,680 l10,-14', 'fill="none" stroke-width="2.5"');
  b += P('M500,720 q10,-20 24,-24 M640,720 q-10,-20 -24,-26', NONE);
  b += P(wl([[540, 330], [400, 270], [230, 260]], 1.5), 'fill="none" stroke-width="12"') + P(wl([[540, 330], [400, 270], [230, 260]], 1.5), 'fill="none" stroke="#fff" stroke-width="5"');
  b += P(wl([[600, 330], [760, 240], [900, 230]], 1.5), 'fill="none" stroke-width="12"') + P(wl([[600, 330], [760, 240], [900, 230]], 1.5), 'fill="none" stroke="#fff" stroke-width="5"');
  b += bunting(240, 262, 420, 280, 6, 40) + bunting(700, 270, 890, 232, 6, 40);
  // platform supports
  b += P('M380,404 L520,520 M780,404 L610,520', 'fill="none" stroke-width="10"') + P('M380,404 L520,520 M780,404 L610,520', 'fill="none" stroke="#fff" stroke-width="4"');
  // house
  b += P(wpoly([[420, 384], [700, 384], [700, 250], [420, 250]]), 'fill="#fff"');
  for (const y of [282, 314, 346]) b += P(wl([[424, y], [696, y]], 1, 4), 'fill="none" stroke-width="2"');
  b += P(wpoly([[396, 256], [560, 150], [724, 256]]), BLK) + P('M470,226 l40,0 M530,190 l40,0 M600,226 l40,0 M520,212 l30,0', 'stroke="#fff" stroke-width="2.5"');
  b += C(620, 304, 26, 'fill="#fff"') + P('M594,304 L646,304 M620,278 L620,330', NONE);
  b += P(wrect(470, 300, 54, 84, 6), 'fill="url(#hatch)"') + C(512, 344, 4, BLK);
  // sign
  b += P('M300,384 l0,-60', NONE) + P(wrect(250, 300, 100, 40, 6), 'fill="#fff"') + g('translate(300 320)', P('M-22,6 L14,-6 M10,-14 l12,6 l-6,12 l-12,-6Z', 'fill="#fff" stroke-width="3"'));
  // platform deck + railing
  b += P(wrect(330, 384, 470, 24, 4), 'fill="#fff"');
  for (const x of [400, 480, 560, 640, 720]) b += P(`M${x},388 l0,16`, 'stroke-width="2"');
  // ladder
  b += P(wl([[300, 720], [360, 402]], 1), 'fill="none" stroke-width="5"') + P(wl([[348, 720], [404, 402]], 1), 'fill="none" stroke-width="5"');
  for (let i = 1; i < 9; i++) { const t = i / 9; b += P(`M${n1(300 + 60 * t)},${n1(720 - 318 * t)} L${n1(348 + 56 * t)},${n1(720 - 318 * t)}`, 'stroke-width="4"'); }
  // ground + props
  b += ground(10, 990, 722, 9);
  b += P(wpoly([[690, 722], [690, 690], [760, 690], [760, 722]]), 'fill="#fff"') + P('M708,690 q17,-22 34,0', NONE) + P('M690,702 L760,702', 'stroke-width="2"');
  b += P(wpoly([[860, 722], [852, 668], [906, 668], [898, 722]]), 'fill="#fff"') + P(blob(879, 668, 27, 7), BLK) + P('M860,680 q4,16 0,24', 'fill="none" stroke-width="5"');
  b += P(wrect(40, 700, 150, 14, 3), 'fill="#fff"') + P(wrect(52, 686, 130, 14, 3), 'fill="#fff"');
  // the crew
  b += put(nib, 470, 386, 0.8, { hold: [60, -170], mood: 'focus', look: [1, 0] });
  b += g('translate(520 248) rotate(-30)', P(wrect(-4, -6, 8, 40, 2), 'fill="#fff"') + P(wrect(-14, -14, 28, 12, 3), BLK));
  b += put(loop, 760, 386, 0.62, { happy: true });
  b += put(blot, 336, 600, 0.75, { wave: 'left', open: true });
  b += put(quill, 140, 720, 0.85, { carry: true });
  b += put(smudge, 830, 720, 0.85, { happy: true, armUp: 'left' });
  b += put(dot, 940, 720, 0.9, { open: true, bow: true });
  b += sparkle(950, 330, 12) + sparkle(110, 300, 10);
  svg('scene.svg', '0 20 1000 730', b, 'The Scribbles building a treehouse workshop together');
}

reseed(79);
{
  let b = '';
  b += P('M30,394 Q180,380 330,394', 'fill="none" stroke-dasharray="10 12"');
  b += shadow(180, 394, 76) + put(nib, 180, 388, 1.35, { wave: true, backpack: true, open: true });
  b += sparkle(320, 70, 14) + sparkle(40, 120, 10);
  svg('adventure.svg', '0 20 360 390', b, 'Nib waving, ready for an adventure');
}

console.log('art written to', OUT);
