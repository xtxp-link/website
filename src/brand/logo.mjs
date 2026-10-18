// The XTXP logo: geometry, animation timeline and standalone SVG builders.
// Everything here is generated into CSS/SVG by scripts/render-logo.mjs. Change the timeline here, then run `npm run logo`.
//
// The mark is x + x p, where the + is a t with no tail. The animation starts and ends on a lone white x.
//
//   build:   the x turns 45 degrees and becomes a red + (a t with no tail); two copies branch out to either side
//            (+++); the outer two turn 45 degrees (left clockwise, right counter-clockwise) and grow into x's;
//            the x's lose their outer legs (<+>); the legs regrow, and the p draws on at the same moment.
//   hold:    full logo
//   reverse: the build, backwards, back to the lone x

// Pacing: the loop rests briefly on each key pose, and moves between them quickly with a slow-fast-slow curve.
//   x -> + -> +++ -> x+x -> <+> -> xtxp
const r = (n) => +n.toFixed(3);
const REST_POSE = 0.25; // rest on each key pose
const MOVE = 0.225; // time to move between poses
const LEGS = 0.175; // the legs pulling in is a little quicker
export const T = {
  turn0: REST_POSE, // x starts turning into +
  plus: r(REST_POSE + MOVE), // + reached
  branch0: r(REST_POSE * 2 + MOVE), // + branches
  trio: r(REST_POSE * 2 + MOVE * 2), // +++ reached
  grow0: r(REST_POSE * 3 + MOVE * 2), // outer two turn into x's
  xx: r(REST_POSE * 3 + MOVE * 3), // x + x reached
  pull0: r(REST_POSE * 4 + MOVE * 3), // legs pull in
  chev: r(REST_POSE * 4 + MOVE * 3 + LEGS), // <+> reached
  regrow0: r(REST_POSE * 5 + MOVE * 3 + LEGS), // legs regrow and the p draws, together
  full: r(REST_POSE * 5 + MOVE * 4 + LEGS), // xtxp reached
};
export const TF = T.full; // end of the build, in seconds
export const HOLD = 2.5; // full logo held for this long
export const REST = 0.15; // extra pause on the lone x before the loop restarts
export const R0 = r(TF + HOLD); // when the reverse starts
export const TOTAL = r(R0 + TF + REST);
export const EASE = 'cubic-bezier(.65,0,.35,1)'; // slow, fast, slow
const OVERSHOOT = 'cubic-bezier(.3,1.35,.6,1)'; // arrives a touch past its mark and settles; mirrored in reverse, it anticipates
const COLOUR_EASE = 'cubic-bezier(.5,0,.75,0)'; // colour changes happen early in a move, so nothing is muddy mid-turn
const COLOUR_SHARE = 0.4; // ...within the first 40% of it

export const VIEWBOX = '-20 -20 148 54';
// For the hero: the same height, widened so the middle + (x=32) is the horizontal centre of the box.
export const HERO_VIEWBOX = '-64 -20 192 54';
export const RED = '#ff5436';
export const HERO_DELAY = 0.35; // the hero fades in over this long before the loop starts

// Playing from the full-logo hold: reverse, rest on the +, build again, end on the full logo. Used for the hover
// animation on the site title.
export const RUN_SPEED = 1.6;
export const RUN_COUNT = +((TOTAL + TF) / TOTAL).toFixed(5);

// Forward timeline per part: [seconds, properties changed at that time]. Anything not named carries over.
const SMALL = 'scale(.606)'; // a + is an x scaled to 0.606 and turned 45 degrees
const TIMELINE = {
  // The middle glyph: a white x that turns into the red +.
  c: [
    [0, { stroke: 'var(--xl-x)', 'stroke-width': 6, transform: 'translate(32px,0) rotate(0deg) scale(1)' }],
    [T.turn0, {}],
    [T.plus, { stroke: 'var(--xl-t)', 'stroke-width': 9.9, transform: `translate(32px,0) rotate(45deg) ${SMALL}` }],
    [TF, {}],
  ],
  // The copies that branch off the + and become the outer x's.
  l: [
    [0, { opacity: 0, stroke: 'var(--xl-t)', 'stroke-width': 9.9, transform: `translate(32px,0) rotate(-45deg) ${SMALL}` }],
    [T.branch0, {}],
    [r(T.branch0 + 0.005), { opacity: 1 }, OVERSHOOT],
    [T.trio, { transform: `translate(0,0) rotate(-45deg) ${SMALL}` }],
    [T.grow0, {}],
    [T.xx, { stroke: 'var(--xl-x)', 'stroke-width': 6, transform: 'translate(0,0) rotate(0deg) scale(1)' }],
    [TF, {}],
  ],
  r: [
    [0, { opacity: 0, stroke: 'var(--xl-t)', 'stroke-width': 9.9, transform: `translate(32px,0) rotate(45deg) ${SMALL}` }],
    [T.branch0, {}],
    [r(T.branch0 + 0.005), { opacity: 1 }, OVERSHOOT],
    [T.trio, { transform: `translate(64px,0) rotate(45deg) ${SMALL}` }],
    [T.grow0, {}],
    [T.xx, { stroke: 'var(--xl-x)', 'stroke-width': 6, transform: 'translate(64px,0) rotate(0deg) scale(1)' }],
    [TF, {}],
  ],
  // Outer legs of the x's: pull in to make <+>, then regrow.
  ol: [
    [0, { 'stroke-dashoffset': 0 }],
    [T.pull0, {}],
    [T.chev, { 'stroke-dashoffset': 1 }],
    [T.regrow0, {}],
    [TF, { 'stroke-dashoffset': 0 }],
  ],
  // The p draws on over exactly the same moment as the legs regrow, so the eye is on the legs.
  p: [
    [0, { 'stroke-dashoffset': 1, opacity: 0 }],
    [T.regrow0, {}],
    [r(T.regrow0 + 0.005), { opacity: 1 }],
    [TF, { 'stroke-dashoffset': 0 }],
  ],
};

const pct = (t) => `${+((t / TOTAL) * 100).toFixed(4)}%`;
const decl = (s, ease) =>
  Object.entries(s).map(([k, v]) => `${k}:${v}`).join(';') + (ease ? `;animation-timing-function:${ease}` : '');

// Timing function for the same motion played backwards.
const mirror = (e) =>
  e && e.replace(/cubic-bezier\(([^)]+)\)/, (_, a) => {
    const [x1, y1, x2, y2] = a.split(',').map(Number);
    const f = (n) => +n.toFixed(3);
    return `cubic-bezier(${f(1 - x2)},${f(1 - y2)},${f(1 - x1)},${f(1 - y1)})`;
  });

// [t, props, ease?] -> [t, full state, ease?]
function expand(points) {
  let state = {};
  return points.map(([t, d, e]) => [t, (state = { ...state, ...d }), e]);
}

// Colour gets its own keyframes so it can change early in a move while the transform eases over all of it.
function split(points) {
  const f = expand(points);
  const main = f.map(([t, s, e]) => {
    const { stroke, ...rest } = s;
    return [t, rest, e];
  });
  if (!f[0][1].stroke) return { main, colour: null };
  const colour = [[f[0][0], { stroke: f[0][1].stroke }]];
  for (let i = 1; i < f.length; i++) {
    const [ta, sa] = f[i - 1];
    const [tb, sb] = f[i];
    if (sa.stroke !== sb.stroke) {
      colour[colour.length - 1][2] = COLOUR_EASE;
      colour.push([r(ta + (tb - ta) * COLOUR_SHARE), { stroke: sb.stroke }]);
    }
    colour.push([tb, { stroke: sb.stroke }]);
  }
  return { main, colour };
}

// Forward stops, a hold, then the same stops mirrored in time (with mirrored easing) back to the start.
function keyframes(name, f) {
  const stops = f.map(([t, s, e]) => [t, s, e]);
  const last = f.length - 1;
  stops.push([R0, f[last][1], mirror(f[last - 1]?.[2])]);
  for (let i = last - 1; i >= 0; i--) stops.push([r(R0 + TF - f[i][0]), f[i][1], i > 0 ? mirror(f[i - 1][2]) : undefined]);
  stops.push([TOTAL, f[0][1]]);
  return `@keyframes xl-${name}{${stops.map(([t, s, e]) => `${pct(t)}{${decl(s, e)}}`).join('')}}`;
}

// Per part: the main keyframes, and colour keyframes if it changes colour.
const PARTS = [['xl-c', 'c'], ['xl-l', 'l'], ['xl-r', 'r'], ['xl-ol', 'ol'], ['xl-p', 'p']].map(([cls, n]) => {
  const { main, colour } = split(TIMELINE[n]);
  return { cls, n, main: expand(main.map(([t, s, e]) => [t, s, e])), colour: colour && expand(colour) };
});

/** CSS shared by the page and the standalone files. `root` is the svg class. */
export function logoCss(root = '.xtxp-logo', { animate = true } = {}) {
  const base =
    `${root} .xl-l,${root} .xl-r{stroke:var(--xl-x)}${root} .xl-c{stroke:var(--xl-t)}${root} .xl-p{stroke:var(--xl-p)}` +
    `${root} .xl-ol,${root} .xl-p{stroke-dasharray:1 2}`;
  if (!animate) return base;
  const frames = PARTS.map((p) => keyframes(p.n, p.main) + (p.colour ? keyframes(`${p.n}-c`, p.colour) : '')).join('');
  const anim = (p, dur, delay, count) =>
    [`xl-${p.n}`, p.colour && `xl-${p.n}-c`]
      .filter(Boolean)
      .map((k) => `${k} ${dur}s ${EASE} ${delay}${count} both`)
      .join(',');
  const loop = PARTS.map((p) => `${root}--loop .${p.cls}{animation:${anim(p, TOTAL, '', 'infinite')}}`).join('');
  const run = PARTS.map(
    (p) =>
      `${root}--run .${p.cls}{animation:${anim(p, +(TOTAL / RUN_SPEED).toFixed(3), `${-(R0 / RUN_SPEED).toFixed(3)}s `, RUN_COUNT)}}`
  ).join('');
  const still = `@media (prefers-reduced-motion:reduce){${root} *{animation:none!important}}`;
  return base + frames + loop + run + still;
}

/** The glyphs. Origin is the centre of the first x; the + sits at x=32, the second x at 64, the p at 92. */
export function glyphs({ withP = true } = {}) {
  return (
    '<g fill="none" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path class="xl-c" d="M-14 -14L14 14M14 -14L-14 14" stroke-width="9.9" transform="translate(32 0) rotate(45) scale(.606)"/>' +
    '<g class="xl-l"><path d="M14 -14L0 0L14 14"/><path class="xl-ol" pathLength="1" d="M0 0L-14 -14"/><path class="xl-ol" pathLength="1" d="M0 0L-14 14"/></g>' +
    '<g class="xl-r" transform="translate(64 0)"><path d="M-14 -14L0 0L-14 14"/><path class="xl-ol" pathLength="1" d="M0 0L14 -14"/><path class="xl-ol" pathLength="1" d="M0 0L14 14"/></g>' +
    (withP ? '<path class="xl-p" pathLength="1" d="M0 -14V28M0 0A14 14 0 1 1 28 0A14 14 0 1 1 0 0" transform="translate(92 0)"/>' : '') +
    '</g>'
  );
}

const PALETTES = {
  light: { x: '#11151f', t: RED, p: '#8a91a3' },
  dark: { x: '#eceff7', t: '#ff7a5e', p: '#7c8396' },
  blue: { x: '#ffffff', t: RED, p: '#a3aac4', bg: '#3347ff' },
};
const vars = (p) => `--xl-x:${p.x};--xl-t:${p.t};--xl-p:${p.p}`;

/**
 * A standalone logo file.
 *   mode:  'loop' (animated) or 'still' (the full logo)
 *   theme: 'auto' (follows prefers-color-scheme), 'light', 'dark' or 'blue' (white on the brand blue)
 */
export function standalone({ mode = 'loop', theme = 'auto' } = {}) {
  const root = '.xtxp-logo';
  const colors =
    theme === 'auto'
      ? `${root}{${vars(PALETTES.light)}}@media (prefers-color-scheme:dark){${root}{${vars(PALETTES.dark)}}}`
      : `${root}{${vars(PALETTES[theme])}}`;
  const pad = theme === 'blue' ? 28 : 0;
  const [x, y, w, h] = VIEWBOX.split(' ').map(Number);
  const vb = `${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const bg = theme === 'blue' ? `<rect x="${x - pad}" y="${y - pad}" width="${w + 2 * pad}" height="${h + 2 * pad}" fill="${PALETTES.blue.bg}"/>` : '';
  const cls = mode === 'loop' ? 'xtxp-logo xtxp-logo--loop' : 'xtxp-logo';
  const css = logoCss(root, { animate: mode === 'loop' });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="${vb}" role="img" aria-label="XTXP">` +
    `<style>${colors}${css}</style>${bg}${glyphs()}</svg>\n`
  );
}

/**
 * The favicon: the <+> state, cropped to the edges. Chevrons are white on dark tab strips and near-black on light
 * ones (the SVG follows prefers-color-scheme); the + is red. `scheme` fixes the colour for raster exports.
 */
export function favicon({ scheme = 'auto', size = 64, tile = null } = {}) {
  const ink = { light: '#11151f', dark: '#ffffff' };
  const style =
    scheme === 'auto'
      ? `<style>.c{stroke:${ink.light}}@media (prefers-color-scheme:dark){.c{stroke:${ink.dark}}}</style>`
      : '';
  const stroke = scheme === 'auto' ? '' : ` stroke="${ink[scheme]}"`;
  const glyph =
    `<g fill="none" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">` +
    `<path class="c"${stroke} d="M18 15L1.2 31.8L18 48.6M46 15L62.8 31.8L46 48.6"/>` +
    `<path d="M18 32H46M32 18V46" stroke="${RED}"/></g>`;
  if (tile) {
    // Opaque tile (apple-touch-icon): the glyph is scaled down and centred so the rounded mask never clips it.
    const k = (size * 0.6) / 64;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" fill="${tile}"/>` +
      `<g transform="translate(${size / 2} ${size / 2}) scale(${k}) translate(-32 -32)">${glyph}</g></svg>\n`
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${style}${glyph}</svg>\n`;
}
