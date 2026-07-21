/** @type {import('next').NextConfig} */
const backendUrl = (process.env.BACKEND_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const nextConfig = {
  images: {
    domains: ['localhost'],
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;