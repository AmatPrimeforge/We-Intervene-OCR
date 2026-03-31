/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable server actions for form handling
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Configure webpack for Tesseract.js compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize tesseract.js for server-side to avoid worker issues
      config.externals = config.externals || [];
      config.externals.push({
        'tesseract.js': 'commonjs tesseract.js',
      });
    }
    return config;
  },
};

export default nextConfig;
