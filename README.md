# xtxp.link

The draft specification site for **XTXP, XML to XML Protocol**, built with [Astro Starlight](https://starlight.astro.build/) and a suite of PlantUML diagrams.

## Layout

```
diagrams/              PlantUML sources (NN-name.puml) + shared theme (_style.iuml)
public/diagrams/       Rendered SVGs: light/, dark/, and src/ (copies of the .puml)
scripts/               render-diagrams.sh
src/content/docs/      The pages (Markdown / MDX)
src/components/        Diagram.astro: picks the light or dark SVG with CSS, no JS
src/styles/custom.css  Theme tweaks
src/brand/logo.mjs     The logo: geometry, animation timeline, standalone SVG builders
src/components/        Logo.astro, Hero.astro (logo as the H1), SiteTitle.astro (small logo, plays on hover)
public/brand/          Logo files: still and animated, light / dark / auto / on blue, plus favicon
wrangler.jsonc         Cloudflare Workers static-assets config
```

## Working on it

```sh
npm install
npm run dev          # local preview at http://localhost:4321
```

### Logo

The logo is generated from `src/brand/logo.mjs`. To change the shape, colours or animation timing, edit it and run:

```sh
npm run logo         # rewrites public/favicon.svg, public/brand/*.svg and src/styles/logo.generated.css
```

Commit the output. The mark is x + x p, where the + is a t with no tail. The animation starts and ends on a lone white x. The x turns into a red +, which branches into `+++`; the outer two turn into x's, lose their outer legs (`<+>`), and regrow them while the p draws on at the same moment. It holds the full logo, then plays the build in reverse back to the x.

- `public/brand/logo.svg`, `logo-animated.svg`: follow the viewer's light/dark setting.
- `logo-light.svg`, `logo-dark.svg` (and `-animated-` variants): fixed colours for a known background.
- `logo-on-blue.svg`, `logo-animated-on-blue.svg`: white on the brand blue.
- On the site the logo is inline and uses Starlight's theme colours, so light and dark mode need no extra files. The hero shows it as the H1 and loops. The header copy sits still and plays once on hover or focus; moving away lets it finish on the full logo. With reduced motion, or no JavaScript, it stays still.

### Diagrams

Edit a file in `diagrams/`, then re-render:

```sh
npm run diagrams     # needs Java 11+; downloads plantuml.jar into .cache/ on first run
```

Commit the regenerated SVGs in `public/diagrams/`. The Cloudflare build only runs `astro build`, so it never needs Java.

To add a diagram, create `diagrams/NN-name.puml` starting with `@startuml NN-name` and `!include _style.iuml`, render, then use it in a page:

```mdx
import Diagram from '../../../components/Diagram.astro';

<Diagram name="NN-name" alt="What the diagram shows, in one sentence." />
```

## Deploying to Cloudflare

**Option A, Workers (wrangler):**

```sh
npx wrangler login
npm run deploy
```

`wrangler.jsonc` attaches the `xtxp.link` custom domain, which needs the zone on the same Cloudflare account. Remove the `routes` block to deploy to a `*.workers.dev` URL first.

**Option B, Git integration:** connect the repository in the Cloudflare dashboard (Workers & Pages → Create → import a repository). Build command `npm run build`, output directory `dist`.
