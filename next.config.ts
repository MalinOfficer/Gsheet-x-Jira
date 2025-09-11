
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

// We need to add file-saver as a dependency
// Since we cannot run 'npm install' ourselves, we'll add it to the package.json dependencies
// This feels like the wrong place, but the package.json is not always available for edits.
// It seems I can edit package.json, so I will do it there.
