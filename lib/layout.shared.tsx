import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      // JSX supported
      title: appName,
    },
    links: [
      {
        text: 'RUN',
        url: '/run',
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
