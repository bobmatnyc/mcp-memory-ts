/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  webpack: (config, { isServer }) => {
    // Allow Next.js to resolve TypeScript files from parent directory
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };

    // Add fallback extensions for module resolution
    config.resolve.extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', ...config.resolve.extensions];

    // Add parent directory to module resolution paths
    config.resolve.modules = [...(config.resolve.modules || []), '../src'];

    // Exclude native modules and other non-JS files from webpack processing
    if (isServer) {
      config.externals.push({
        '@libsql/darwin-arm64': 'commonjs @libsql/darwin-arm64',
        '@libsql/linux-x64-gnu': 'commonjs @libsql/linux-x64-gnu',
        '@libsql/linux-arm64-gnu': 'commonjs @libsql/linux-arm64-gnu',
        'libsql': 'commonjs libsql',
      });
    }

    // Ignore non-JavaScript files in dependencies
    config.module.rules.push({
      test: /\.(md|node|LICENSE)$/,
      type: 'asset/resource',
      generator: {
        emit: false,
      },
    });

    return config;
  },
};

export default nextConfig;
