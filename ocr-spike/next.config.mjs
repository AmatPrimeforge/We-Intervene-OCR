/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable server actions for form handling
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Configure webpack for Tesseract.js and PDF compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize packages that have issues with webpack bundling
      config.externals = config.externals || [];
      config.externals.push({
        'tesseract.js': 'commonjs tesseract.js',
        'pdf-to-img': 'commonjs pdf-to-img',
        'pdfjs-dist': 'commonjs pdfjs-dist',
        'pdfjs-dist/legacy/build/pdf.mjs': 'commonjs pdfjs-dist/legacy/build/pdf.mjs',
      });
    }
    return config;
  },
};

export default nextConfig;
