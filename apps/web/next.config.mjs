/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile local monorepo packages consumed as raw TS source
  transpilePackages: ["@decagon/ui"],
  // Allow cross-origin requests to the API
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/:path*',
      },
    ];
  },
};

export default nextConfig;
