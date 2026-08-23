import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the scraper run route to run up to 300 seconds on Vercel Pro/Teams.
  // This covers the BrightData collector poll (up to 90s) + Web Unlocker + self-healing.
  serverExternalPackages: [],
  experimental: {},
};

export default nextConfig;
