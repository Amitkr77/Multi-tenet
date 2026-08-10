import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle under .next/standalone that carries
  // only the node_modules it actually imports — cuts the production image
  // from ~1 GB (full node_modules) to ~200 MB. The runner stage copies
  // standalone/ + static assets; nothing else is needed at runtime.
  output: "standalone",
};

export default nextConfig;
