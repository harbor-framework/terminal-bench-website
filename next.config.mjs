import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'github.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/blog',
        destination: '/news',
        permanent: true,
      },
      {
        source: '/blog/:slug',
        destination: '/news/:slug',
        permanent: true,
      },
      // Legacy tbench.ai per-task pages -> Hub task pages.
      {
        source: '/benchmarks/terminal-bench-2/:task',
        destination: 'https://hub.harborframework.com/tasks/terminal-bench/:task',
        permanent: true,
      },
      // Legacy per-benchmark pages -> the benchmarks index.
      {
        source: '/benchmarks/:slug',
        destination: '/benchmarks',
        permanent: true,
      },
      // Hub-backed leaderboards render on the homepage via ?benchmark=.
      {
        source: '/leaderboard/terminal-bench/2.0',
        destination: '/?version=2.0',
        permanent: true,
      },
      {
        source: '/leaderboard/terminal-bench/3.0',
        destination: '/?version=3.0',
        permanent: true,
      },
      {
        source: '/leaderboard/terminal-bench/2.1',
        destination: '/?version=2.1',
        permanent: true,
      },
      {
        source: '/leaderboard/terminal-bench-science/:path*',
        destination:
          'https://hub.harborframework.com/datasets/terminal-bench-science/terminal-bench-science/10?tab=leaderboard&leaderboard=v0-1-eval',
        permanent: true,
      },
      {
        source: '/leaderboard',
        destination: '/',
        permanent: true,
      },
      // TB 1.0 and the challenge leaderboards have no Hub data -> homepage.
      {
        source: '/leaderboard/:path*',
        destination: '/',
        permanent: true,
      },
      // The registry's successor is the Harbor Hub.
      {
        source: '/registry/:dataset/:version/:task',
        destination: 'https://hub.harborframework.com/tasks/terminal-bench/:task',
        permanent: true,
      },
      {
        source: '/registry/:path*',
        destination: 'https://hub.harborframework.com/datasets',
        permanent: true,
      },
      {
        source: '/registry',
        destination: 'https://hub.harborframework.com/datasets',
        permanent: true,
      },
      {
        source: '/tasks',
        destination:
          'https://hub.harborframework.com/datasets/terminal-bench/terminal-bench/4',
        permanent: true,
      },
      // Legacy docs run pages -> the run page; /docs is placeholder for now.
      {
        source: '/docs/:slug(run-.+)',
        destination: '/run',
        permanent: true,
      },
      {
        source: '/docs',
        destination: '/run',
        permanent: false,
      },
      // Contributor releases not on this site.
      {
        source: '/contributors/terminal-bench-science',
        destination: 'https://www.terminal-bench-science.ai/contributors',
        permanent: true,
      },
      {
        source: '/contributors/terminal-bench-3',
        destination: '/contributors',
        permanent: true,
      },
      {
        source: '/contributors/terminal-bench-challenges',
        destination: '/contributors',
        permanent: true,
      },
      {
        source: '/harbor-index',
        destination: '/news/harbor-index',
        permanent: true,
      },
      {
        source: '/harbor-index/:path*',
        destination: '/news/harbor-index',
        permanent: true,
      },
    ];
  },
};

export default withMDX(config);
