/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Cloudflare Pages
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Environment variables exposed to browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
  },
};

module.exports = nextConfig;
