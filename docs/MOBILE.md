# Application mobile (Expo)

Code : `apps/mobile/src/`. Textes : bloc `mobile` de `packages/shared/i18n/fr.json`.

## Parcours

1. **Accueil** : « J'ai reçu une invitation » ou « J'ai déjà un compte ».
2. **Invitation** : on colle le lien reçu de l'orthophoniste (`https://…/invitation#JETON`), ou on
   ouvre l'application par le lien `suivipatients://invitation#JETON`. On choisit son mot de passe
   (`POST /api/invitations/accepter`), puis on se connecte. Un parent déjà inscrit saisit son mot de
   passe actuel pour relier un nouvel enfant.
3. **Connexion** : e-mail + mot de passe (`POST /api/auth/mobile/connexion`).
4. **Après la connexion** (`session/profils.ts`) :
   - parent : écran **« Qui fait les exercices ? »** (un gros bouton par enfant, même s'il n'y en a
     qu'un : c'est aussi l'entrée du futur mode enfant). Un enfant sans consentement est affiché
     sans bouton, avec une explication ;
   - patient adulte : directement son programme ;
   - compte orthophoniste : refusé (application réservée aux familles).
5. **Espace du patient** : onglets en bas **Aujourd'hui**, **Conseils** (vide pour l'instant) et
   **Messages** seulement si la messagerie est activée pour ce patient.

## Écran « Aujourd'hui »

Exercices prévus ce jour (heure de Paris), puis « À placer dans la semaine » (exercices sans jour
fixé). Chaque carte montre l'aperçu (image en `https`, sinon un symbole de la catégorie), le titre,
**Niv. 1/2/3**, la durée, la consigne courte, le matériel et **le mot de l'orthophoniste**. Tirer vers
le bas recharge. Toucher un exercice l'ouvre : voir [REALISATIONS.md](./REALISATIONS.md).

**Mode enfant** (enfant de moins de 15 ans, compte du parent) : un seul exercice à l'écran
(« Exercice 1 sur 2 »), très gros bouton « C'est parti ! », étoiles à la fin.

## Onglet Messages

`ongletsVisibles()` (`navigation/onglets.ts`) : l'onglet n'existe que si `messagerieActivee` est vrai.
Cette valeur est calculée **par le serveur** (réglage du patient, sinon du cabinet) et renvoyée dans
`GET /api/patients` pour les comptes famille. Désactivée : l'onglet est absent (pas grisé) et l'API
refuse la messagerie (`can()`). L'écran Messages est un emplacement vide, rempli en tâche 11.

## Sécurité

- **Jetons** (accès 15 min + renouvellement 30 jours) : uniquement dans le coffre-fort du téléphone
  (`expo-secure-store` : Keychain / Keystore, option `WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Jamais dans
  AsyncStorage, jamais dans les journaux.
- **Renouvellement** : automatique (avant expiration, ou après un 401). Un seul à la fois, partagé
  par les requêtes simultanées : le serveur révoque toute la session si un jeton de renouvellement
  déjà utilisé revient. Refusé → jetons effacés, retour à l'accueil.
- **Déconnexion** : révocation côté serveur (`POST /api/auth/deconnexion`), puis effacement des
  jetons **et** du cache hors ligne.
- Pas d'outil de mesure d'audience, pas de service externe, pas de police téléchargée.
- Android : `allowBackup: false` (rien n'est copié dans les sauvegardes du téléphone).

## Hors ligne

Le programme est une donnée de santé : la copie locale est **chiffrée** (AES-256-GCM,
`@noble/ciphers`). La clé, aléatoire et propre au téléphone, est dans le coffre-fort ; le contenu
chiffré est dans AsyncStorage (`donnees/cache.ts`).

- À chaque chargement réussi, le programme envoyé et la liste des profils sont enregistrés.
- Sans réseau, l'application démarre quand même (session et profils en cache) et affiche le
  programme enregistré, avec un bandeau « Hors connexion. Programme enregistré le … ».
- Seul le programme est gardé : le plan du jour est **recalculé sur le téléphone** avec les mêmes
  fonctions que le serveur (`planJour`, `@app/shared`). Il reste donc juste toute la semaine sans
  réseau.
- Accès retiré (404) ou consentement retiré (403) : la copie de ce patient est effacée.
- La copie ne contient que le nécessaire (pas de date de naissance, pas de nom de famille).

## Lancer sur un téléphone

L'API tourne sur l'ordinateur (`pnpm dev:web`). Le téléphone ne connaît pas `localhost` : indiquer
l'adresse de l'ordinateur sur le réseau local dans `apps/mobile/.env` (Expo lit le `.env` du dossier
de l'application) :

```bash
echo "EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api" > apps/mobile/.env
```

```bash
pnpm dev:mobile
```

Compte fictif du seed : `parent.lea@exemple.test` (mot de passe : `SEED_PASSWORD`), puis choisir Léa.
Patient adulte : `paul@exemple.test` (messagerie désactivée : pas d'onglet Messages).

## Tests

`pnpm test` (projet vitest **mobile**) : les composants React Native sont rendus avec
`react-native-web` dans jsdom ; les modules natifs Expo sont remplacés (`apps/mobile/test/setup.ts`).
Un faux serveur (`apps/mobile/test/fixtures.ts`) permet de tester le parcours complet : connexion,
choix de Léa, exercices du jour, redémarrage sans réseau, déconnexion.
