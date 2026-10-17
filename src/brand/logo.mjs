// The XTXP logo: geometry, animation timeline and standalone SVG builders.
// Everything here is generated into CSS/SVG by scripts/render-logo.mjs. Change the timeline here, then run `npm run logo`.
//
// The mark is x + x p, where the + is a t with no tail. The animation builds it up, holds the full logo, then plays
// the same build in reverse back to a lone + and starts again.
//
//   build:   + in the middle; two copies slide out (+++); the outer two turn 45 degrees (left clockwise, right
//            counter-clockwise) and grow into x's; the x's lose their outer legs (<+>) and regrow them; the p draws on.
//   hold:    full logo
//   reverse: the build, backwards

export const TF = 9.8; // end of the build, in seconds
export const HOLD = 6; // full logo held for this long
export const REST = 1.2; // pause on the lone + before the loop restarts
export const R0 = TF + HOLD; // when the reverse starts
export const TOTAL = R0 + TF + REST;
export const EASE = 'cubic-bezier(.65,0,.35,1)';
export const VIEWBOX = '-20 -20 148 60';
export const RED = '#ff5436';

// Playing from the full-logo hold: reverse, rest on the +, build again, end on the full logo. Used for the hover
// animation on the site title, at double speed.
export const RUN_SPEED = 2;
export const RUN_COUNT = +((TOTAL + TF) / TOTAL).toFixed(5);

// Forward timeline per part: [seconds, properties changed at that time]. Anything not named carries over.
const SMALL = 'scale(.606)'; // a + is an x scaled to 0.606 and turned 45 degrees
const TIMELINE = {
  l: [
    [0, { opacity: 0, stroke: 'var(--xl-t)', 'stroke-width': 9.9, transform: `translate(32px,0) rotate(-45deg) ${SMALL}` }],
    [0.84, {}],
    [0.85, { opacity: 1 }],
    [2.4, { transform: `translate(0,0) rotate(-45deg) ${SMALL}` }],
    [3.24, {}],
    [4.8, { stroke: 'var(--xl-x)', 'stroke-width': 6, transform: 'translate(0,0) rotate(0deg) scale(1)' }],
    [TF, {}],
  ],
  r: [
    [0, { opacity: 0, stroke: 'var(--xl-t)', 'stroke-width': 9.9, transform: `translate(32px,0) rotate(45deg) ${SMALL}` }],
    [0.84, {}],
    [0.85, { opacity: 1 }],
    [2.4, { transform: `translate(64px,0) rotate(45deg) ${SMALL}` }],
    [3.24, {}],
    [4.8, { stroke: 'var(--xl-x)', 'stroke-width': 6, transform: 'translate(64px,0) rotate(0deg) scale(1)' }],
    [TF, {}],
  ],
  ol: [
    [0, { 'stroke-dashoffset': 0 }],
    [5.4, {}],
    [6.24, { 'stroke-dashoffset': 1 }],
    [7.44, {}],
    [8.28, { 'stroke-dashoffset': 0 }],
    [TF, {}],
  ],
  p: [
    [0, { 'stroke-dashoffset': 1, opacity: 0 }],
    [8.5, {}],
    [8.58, { opacity: 1 }],
    [9.72, { 'stroke-dashoffset': 0 }],
    [TF, {}],
  ],
};

const pct = (t) => `${+((t / TOTAL) * 100).toFixed(4)}%`;
const decl = (s) => Object.entries(s).map(([k, v]) => `${k}:${v}`).join(';');

function expand(points) {
  let state = {};
  return points.map(([t, d]) => [t, (state = { ...state, ...d })]);
}

function keyframes(name, points) {
  const f = expand(points);
  const stops = f.map(([t, s]) => [t, s]);
  stops.push([R0, f[f.length - 1][1]]);
  for (let i = f.length - 2; i >= 0; i--) stops.push([R0 + TF - f[i][0], f[i][1]]);
  stops.push([TOTAL, f[0][1]]);
  return `@keyframes xl-${name}{${stops.map(([t, s]) => `${pct(t)}{${decl(s)}}`).join('')}}`;
}

// Selector for each part, and the keyframes it follows.
const PARTS = [['xl-l', 'l'], ['xl-r', 'r'], ['xl-ol', 'ol'], ['xl-p', 'p']];

/** CSS shared by the page and the standalone files. `root` is the svg class. */
export function logoCss(root = '.xtxp-logo', { animate = true } = {}) {
  const base =
    `${root} .xl-l,${root} .xl-r{stroke:var(--xl-x)}${root} .xl-c{stroke:var(--xl-t)}${root} .xl-p{stroke:var(--xl-p)}` +
    `${root} .xl-ol,${root} .xl-p{stroke-dasharray:1 2}`;
  if (!animate) return base;
  const frames = Object.entries(TIMELINE).map(([n, pts]) => keyframes(n, pts)).join('');
  const loop = PARTS.map(([c, n]) => `${root}--loop .${c}{animation:xl-${n} ${TOTAL}s ${EASE} infinite both}`).join('');
  const run = PARTS.map(
    ([c, n]) =>
      `${root}--run .${c}{animation:xl-${n} ${+(TOTAL / RUN_SPEED).toFixed(3)}s ${EASE} ${-(R0 / RUN_SPEED).toFixed(3)}s ${RUN_COUNT} both}`
  ).join('');
  const still = `@media (prefers-reduced-motion:reduce){${root} *{animation:none!important}}`;
  return base + frames + loop + run + still;
}

/** The glyphs. Origin is the centre of the first x; the + sits at x=32, the second x at 64, the p at 94. */
export function glyphs({ withP = true } = {}) {
  return (
    '<g fill="none" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path class="xl-c" d="M-12 0H12M0 -12V12" transform="translate(32 0)"/>' +
    '<g class="xl-l"><path d="M14 -14L0 0L14 14"/><path class="xl-ol" pathLength="1" d="M0 0L-14 -14"/><path class="xl-ol" pathLength="1" d="M0 0L-14 14"/></g>' +
    '<g class="xl-r" transform="translate(64 0)"><path d="M-14 -14L0 0L-14 14"/><path class="xl-ol" pathLength="1" d="M0 0L14 -14"/><path class="xl-ol" pathLength="1" d="M0 0L14 14"/></g>' +
    (withP ? '<path class="xl-p" pathLength="1" d="M0 34V-14M0 0A14 14 0 1 1 28 0A14 14 0 1 1 0 0" transform="translate(94 0)"/>' : '') +
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

/** The favicon: the <+> state, cropped to the edges. White chevrons, red +. */
export function favicon() {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">' +
    '<g fill="none" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M18 15L1.2 31.8L18 48.6M46 15L62.8 31.8L46 48.6" stroke="#fff"/>' +
    `<path d="M18 32H46M32 18V46" stroke="${RED}"/></g></svg>\n`
  );
}
