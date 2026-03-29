import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Agent Desk',
  description: 'Unified control center for AI coding agents',
  base: '/agent-desk/',

  srcExclude: ['**/ARCHITECTURE.md', '**/FEATURES.md', '**/SETUP.md', '**/USER-MANUAL.md'],

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/agent-desk/favicon.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
        rel: 'stylesheet',
      },
    ],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Features', link: '/features/' },
      { text: 'Reference', link: '/reference/shortcuts' },
      { text: 'Download', link: 'https://github.com/keshrath/agent-desk/releases' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Terminals', link: '/guide/terminals' },
            { text: 'Profiles', link: '/guide/profiles' },
            { text: 'Agent Monitor', link: '/guide/agent-monitor' },
            { text: 'Batch Launch & Templates', link: '/guide/batch-launch' },
            { text: 'Event Stream', link: '/guide/event-stream' },
            { text: 'Search', link: '/guide/search' },
          ],
        },
        {
          text: 'Customization',
          items: [
            { text: 'Themes', link: '/guide/themes' },
            { text: 'Settings', link: '/guide/settings' },
            { text: 'Keybindings', link: '/guide/keybindings' },
            { text: 'Workspaces', link: '/guide/workspaces' },
          ],
        },
        {
          text: 'Integration',
          items: [
            { text: 'Dashboard Services', link: '/guide/dashboards' },
            { text: 'Cost Tracking', link: '/guide/cost-tracking' },
            { text: 'Communication Graph', link: '/guide/comm-graph' },
            { text: 'Shell Integration', link: '/guide/shell-integration' },
          ],
        },
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'Overview', link: '/features/' },
            { text: 'Terminal Management', link: '/features/terminals' },
            { text: 'Agent Intelligence', link: '/features/agents' },
            { text: 'Multi-Agent Orchestration', link: '/features/orchestration' },
            { text: 'Search & Events', link: '/features/search-events' },
            { text: 'Appearance', link: '/features/appearance' },
            { text: 'Session & Persistence', link: '/features/sessions' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Keyboard Shortcuts', link: '/reference/shortcuts' },
            { text: 'Configuration', link: '/reference/configuration' },
            { text: 'Architecture', link: '/reference/architecture' },
            { text: 'Contributing', link: '/reference/contributing' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/keshrath/agent-desk' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright \u00a9 2026 Mathias Markl',
    },

    search: {
      provider: 'local',
    },
  },
});
