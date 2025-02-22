/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static exports
  output: 'standalone',
  
  // Strict mode for better development
  reactStrictMode: true,
  
  // Disable server-side image optimization since we're using local images
  images: {
    unoptimized: true,
  },

  // Allow CORS for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

module.exports = nextConfig; 