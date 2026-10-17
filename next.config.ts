import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silences a workspace-root warning: the home directory has an unrelated,
  // stray package-lock.json that Turbopack would otherwise consider as a
  // candidate monorepo root.
  turbopack: {
    root: __dirname,
  },
  // pdfjs-dist's legacy Node build resolves its "fake worker" script via a
  // path relative to its own file location at runtime — bundling it breaks
  // that lookup. better-sqlite3 is already externalized by Next's defaults;
  // pdfjs-dist isn't, so it needs to be added explicitly.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
