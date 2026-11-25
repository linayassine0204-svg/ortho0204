# Logiciel pour orthophonistes + application mobile

Monorepo pnpm :

| Dossier           | Contenu                                                         |
| ----------------- | --------------------------------------------------------------- |
| `apps/web`        | Site du professionnel (Next.js, App Router) + API REST (`/api`) |
| `apps/mobile`     | Application parents / patients (Expo React Native)              |
| `packages/db`     | Base PostgreSQL via Prisma                                      |
| `packages/shared` | Schémas zod, types et textes (`i18n/fr.json`)                   |

Règles de produit et de sécurité : voir [`CLAUDE.md`](./CLAUDE.md). **Données fictives uniquement.**

## Prérequis

Node 22+, pnpm 10 (`corepack enable`), Docker.

## Installer

```bash
pnpm install
```

```bash
cp .env.example .env
```

## Lancer la base de données

```bash
pnpm db:up
```

(équivaut à `docker compose up -d` ; `pnpm db:down` pour l'arrêter.)

Puis créer les tables et les données fictives :

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

Détail des tables : [`docs/BASE_DE_DONNEES.md`](./docs/BASE_DE_DONNEES.md).
Connexion et droits d'accès : [`docs/AUTHENTIFICATION.md`](./docs/AUTHENTIFICATION.md).

## Lancer le web

```bash
pnpm dev:web
```

Puis ouvrir http://localhost:3000 (API : http://localhost:3000/api/health).

Comptes fictifs du seed : `ortho@exemple.test` (web), `parent.lea@exemple.test` (mobile), mot de passe
= `SEED_PASSWORD` du fichier `.env`.

## Voir l'API

Deux façons, une fois `pnpm dev:web` lancé :

- **Dans le navigateur** : se connecter sur http://localhost:3000/connexion, puis ouvrir par exemple
  http://localhost:3000/api/patients ou http://localhost:3000/api/auth/moi : la réponse JSON s'affiche.
- **Toutes les requêtes, pas à pas** : ouvrir [`api.http`](./api.http) dans VS Code avec l'extension
  « REST Client » (proposée automatiquement) et cliquer sur « Send Request » au-dessus de chaque
  requête, dans l'ordre. Le fichier montre la connexion, les refus d'accès, l'invitation, les jetons
  mobiles et la limitation des essais.

## Lancer le mobile

```bash
pnpm dev:mobile
```

Scanner le QR code avec l'application Expo Go, ou appuyer sur `a` (Android) / `i` (iOS).

## Vérifications

```bash
pnpm lint
```

```bash
pnpm typecheck
```

```bash
pnpm test
```

(`pnpm test` a besoin de la base démarrée : il utilise une base séparée `ortho_dev_test`.)

```bash
pnpm test:e2e
```

## Textes

Tous les textes visibles sont dans `packages/shared/i18n/fr.json` et s'affichent avec `t("clé")`.
Pour remplacer « orthophoniste » par « logopédiste », modifier uniquement le bloc `terme`.
