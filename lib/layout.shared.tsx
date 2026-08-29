import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // Never let the wordmark wrap to two lines.
      title: <span className="whitespace-nowrap">{appName}</span>,
    },
    links: [
      {
        text: 'RUN',
        url: '/run',
      },
      {
        text: 'BENCHMARKS',
        url: '/benchmarks',
        active: 'nested-url',
      },
      {
        text: 'BLOG',
        url: '/news',
        active: 'nested-url',
      },
      {
        text: 'COMMUNITY',
        url: 'https://discord.gg/ZvcWupVXjz',
        external: true,
      },
      {
        text: 'CONTRIBUTORS',
        url: '/contributors',
        active: 'nested-url',
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    searchToggle: {
      enabled: false,
    },
    themeSwitch: {
      mode: 'light-dark-system',
    },
  };
}
