// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeGalaxy from 'starlight-theme-galaxy';

export default defineConfig({
  site: 'https://xtxp.link',
  integrations: [
    starlight({
      plugins: [starlightThemeGalaxy()],
      title: 'XTXP',
      description:
        'XTXP, the XML to XML Protocol: a draft specification for collaborative, branchable editing of XML documents, from Inkscape to a browser with no JavaScript.',
      customCss: ['./src/styles/custom.css'],
      lastUpdated: false,
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'What is XTXP?', slug: 'overview/what-is-xtxp' },
            { label: 'North star: the web without JS', slug: 'overview/north-star' },
            { label: 'Architecture', slug: 'overview/architecture' },
            { label: 'Glossary', slug: 'overview/glossary' },
          ],
        },
        {
          label: 'Specification',
          badge: { text: 'Draft', variant: 'caution' },
          items: [
            { label: 'The Math', slug: 'spec/math' },
            { label: 'The Wire', slug: 'spec/wire' },
            { label: 'Branches and history', slug: 'spec/branches' },
            { label: 'Views: onion skin and redline', slug: 'spec/views' },
            { label: 'Addressing and the gateway', slug: 'spec/addressing' },
            { label: 'Live web branching', slug: 'spec/web-overlay' },
          ],
        },
        {
          label: 'Building it',
          items: [
            { label: 'Verification', slug: 'build/verification' },
            { label: 'Milestones', slug: 'build/milestones' },
            { label: 'Team model', slug: 'build/team' },
            { label: 'The Inkscape fork', slug: 'build/inkscape-fork' },
          ],
        },
        {
          label: 'Discussion',
          items: [
            { label: 'Decision log', slug: 'discussion/decisions' },
            { label: 'Open questions', slug: 'discussion/open-questions' },
            { label: 'Prior art', slug: 'discussion/prior-art' },
            { label: 'Diagram index', slug: 'discussion/diagrams' },
          ],
        },
      ],
    }),
  ],
});
