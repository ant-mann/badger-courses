import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: fileURLToPath(new URL('../', import.meta.url)),
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@madgrades/schedule': fileURLToPath(new URL('../src/schedule/engine.mjs', import.meta.url)),
      '@madgrades/db-helpers': fileURLToPath(new URL('../src/db/schedule-helpers.mjs', import.meta.url)),
    };

    return config;
  },
};

export default nextConfig;
