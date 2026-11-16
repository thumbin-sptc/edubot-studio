import type { NextConfig } from "next";
import { siteBasePath } from "./src/lib/site-path.ts";

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  output: "export",
  basePath: siteBasePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
