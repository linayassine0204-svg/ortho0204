# Documentation

Notes de conception et décisions d'architecture (à compléter au fil des étapes).
Lire aussi `CLAUDE.md` à la racine avant de coder.

## Décisions de départ

- Monorepo pnpm : `apps/web` (Next.js, App Router, héberge l'API REST sous `/api`), `apps/mobile` (Expo),
  `packages/db` (Prisma + PostgreSQL), `packages/shared` (schémas zod, types, textes).
- Les paquets internes exposent directement leurs sources TypeScript (pas d'étape de build).
- Textes visibles : `packages/shared/i18n/fr.json`. Le métier (« orthophoniste ») est défini une
  seule fois dans `terme.*` et réutilisé ailleurs via `{{terme.xxx}}`.
