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
      {
        source: '/leaderboard',
        destination: '/',
        permanent: true,
      },
      {
        source: '/leaderboard/:path*',
        destination: '/',
        permanent: true,
      },
      {
        source: '/benchmarks',
        destination: '/',
        permanent: true,
      },
      {
        source: '/benchmarks/:path*',
        destination: '/',
        permanent: true,
      },
      {
        source: '/registry',
        destination: '/',
        permanent: true,
      },
      {
        source: '/registry/:path*',
        destination: '/',
        permanent: true,
      },
      {
        source: '/tasks',
        destination: '/',
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
