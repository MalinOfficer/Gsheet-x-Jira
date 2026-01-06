
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true, // This forces the new service worker to activate immediately.
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = withPWA(nextConfig);
