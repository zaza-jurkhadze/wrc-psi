import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // This folder is the app root (parent dir also has a package-lock.json)
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
