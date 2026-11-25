import { resolve } from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// Le fichier .env (non versionné) est à la racine du monorepo, pas dans apps/web :
// Next.js ne le lirait pas tout seul. Les variables déjà définies (CI, hébergeur)
// ne sont jamais écrasées.
config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  // Les paquets internes exposent leurs sources TypeScript.
  transpilePackages: ["@app/shared", "@app/db"],
  // Pas de télémétrie, pas d'en-tête révélant la technologie.
  poweredByHeader: false,
};

export default nextConfig;
