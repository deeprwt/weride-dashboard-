/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@uride/ui-tokens', '@uride/ui-web', '@uride/api-client', '@uride/types', '@uride/validation'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
