import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // for Docker / AKS deployment
};

export default nextConfig;
