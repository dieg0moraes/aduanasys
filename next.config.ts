import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

// Increase max header size for Supabase auth cookies
if (process.env.NODE_ENV === "development") {
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ""} --max-http-header-size=32768`;
}

export default nextConfig;
