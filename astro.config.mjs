// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeGalaxy from 'starlight-theme-galaxy';

export default defineConfig({
  site: 'https://xtxp.link',
  redirects: { '/spec/branches/': '/spec/sessions/' },
  integrations: [
    starlight({
      plugins: [starlightThemeGalaxy()],
      title: 'XTXP',
      description:
        'XTXP, the XML to XML Protocol: a draft specification for collaborative, branchable editing of XML documents, from Inkscape to a browser with no JavaScript.',
      favicon: '/favicon.svg',
      head: [
        { tag: 'link', attrs: { rel: 'alternate icon', href: '/favicon.ico', sizes: '32x32' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
      ],
      components: {
        Hero: './src/components/Hero.astro',
        SiteTitle: './src/components/SiteTitle.astro',
        Pagination: './src/components/Pagination.astro',
      },
      customCss: ['./src/styles/theme.css', './src/styles/logo.generated.css', './src/styles/custom.css'],
      lastUpdated: false,
      head: [{ tag: 'script', attrs: { type: 'module', src: '/scripts/sidebar-reveal.js' } }],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'What is XTXP?', slug: 'overview/what-is-xtxp' },
            { label: 'Use cases', slug: 'overview/use-cases' },
            { label: 'North star: XTXP in the browser', slug: 'overview/north-star' },
            { label: 'Architecture', slug: 'overview/architecture' },
            { label: 'Glossary', slug: 'overview/glossary' },
          ],
        },
        {
          label: 'Specification',
          badge: { text: 'Draft', variant: 'default' },
          items: [
            { label: 'The Math', slug: 'spec/math' },
            { label: 'The Wire', slug: 'spec/wire' },
            { label: 'Identity and access', slug: 'spec/identity' },
            { label: 'Sessions and history', slug: 'spec/sessions' },
            { label: 'Views: onion skin and redline', slug: 'spec/views' },
            { label: 'Addressing and discovery', slug: 'spec/addressing' },
            { label: 'The muppet disco', slug: 'spec/disco' },
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
          label: 'Contribute',
          items: [{ label: 'Repositories', slug: 'contribute/repositories' }],
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
