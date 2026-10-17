# xtxp.link

The draft specification site for **XTXP, the XML to XML Protocol**, built with [Astro Starlight](https://starlight.astro.build/) and a suite of PlantUML diagrams.

## Layout

```
diagrams/              PlantUML sources (NN-name.puml) + shared theme (_style.iuml)
public/diagrams/       Rendered SVGs: light/, dark/, and src/ (copies of the .puml)
scripts/               render-diagrams.sh
src/content/docs/      The pages (Markdown / MDX)
src/components/        Diagram.astro: picks the light or dark SVG with CSS, no JS
src/styles/custom.css  Theme tweaks
wrangler.jsonc         Cloudflare Workers static-assets config
```

## Working on it

```sh
npm install
npm run dev          # local preview at http://localhost:4321
```

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
