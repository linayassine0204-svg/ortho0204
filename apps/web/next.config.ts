import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les paquets internes exposent leurs sources TypeScript.
  transpilePackages: ["@app/shared", "@app/db"],
  // Pas de télémétrie, pas d'en-tête révélant la technologie.
  poweredByHeader: false,
};

export default nextConfig;
