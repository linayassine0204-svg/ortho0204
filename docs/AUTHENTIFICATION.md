# Connexion et droits d'accès

Code : `apps/web/lib/serveur/` (serveur) et `packages/shared/src/schemas/auth.ts` (formats partagés).

## Qui se connecte où

Tous les comptes (orthophoniste, parent, patient de 15 ans et plus) peuvent se connecter **au web et
au mobile**. Ce que chacun voit est décidé par `can()`, identique sur les deux.

| Canal              | Comment                                                                 | Après connexion web                      |
| ------------------ | ----------------------------------------------------------------------- | ---------------------------------------- |
| Logiciel web       | Cookie de session `HttpOnly`, `SameSite=Strict`, `Secure` en production | ORTHO → `/patients`, autres → `/famille` |
| Application mobile | Jeton d'accès (15 min) + jeton de renouvellement (30 jours)             | —                                        |

L'enfant de moins de 15 ans n'a pas de compte propre : il utilise celui de son parent.

## Sessions et jetons

- Tous les jetons sont aléatoires (256 bits). La base ne garde que leur **empreinte SHA-256** (table
  `session`) : une copie de la base ne permet pas de se connecter.
- **Web** : session de 12 h. En production, le cookie s'appelle `__Host-session` (impose `Secure`,
  `Path=/`, aucun domaine). La déconnexion révoque la session en base.
- **Mobile** : le jeton d'accès s'envoie dans `Authorization: Bearer …`. Le jeton de renouvellement
  (`POST /api/auth/mobile/renouvellement`) ne sert qu'**une fois** : il est remplacé par une nouvelle
  paire. Si un ancien jeton revient (signe de vol), toute la session mobile est révoquée.
- Le rôle et le cabinet sont **relus en base à chaque requête** : un lien parent retiré coupe l'accès
  immédiatement.
- Requêtes qui modifient : un en-tête `Origin` d'un autre site est refusé (en plus de `SameSite`).

### Double authentification (TOTP) : prévue, pas codée

La colonne `session.deuxiemeFacteurLe` est réservée. Le branchement se fera dans
`app/api/auth/connexion/route.ts`, juste après `verifierIdentifiants()` : créer la session « en
attente », demander le code, puis remplir `deuxiemeFacteurLe`. Il faudra aussi stocker un secret
TOTP chiffré par compte (nouvelle migration).

## La fonction `can(user, action, ressource)`

Fichier `lib/serveur/droits.ts`. Pure (sans base de données), **refus par défaut**.

| Rôle          | Patients visibles                    | Actions                            | Sections du dossier                    |
| ------------- | ------------------------------------ | ---------------------------------- | -------------------------------------- |
| ORTHO         | ceux de **son cabinet**              | lire, modifier, supprimer, inviter | toutes                                 |
| PARENT        | **ses enfants** (table `LienTuteur`) | lire                               | programme, conseils, messagerie, suivi |
| PATIENT_ADULT | **son propre dossier**               | lire                               | programme, messagerie                  |

Pour tous : jamais un patient d'un autre cabinet ; messagerie refusée si elle est désactivée pour le
patient (réglage du patient, sinon du cabinet).

Les routes appellent `patientAutorise()` (`lib/serveur/patients.ts`), qui charge le patient, appelle
`can()` et répond **404** si le patient n'existe pas **ou** si l'accès est refusé (même réponse :
on ne révèle pas qu'un dossier existe). La liste des patients est filtrée en base puis revérifiée
avec `can()` ligne par ligne.

## Toute route passe par une enveloppe

Chaque route de `app/api` est créée avec `routeProtegee()` (utilisateur connecté obligatoire, puis
`can()`) ou `routePublique()`. Le test `lib/serveur/couverture-routes.test.ts` échoue si une route
n'utilise aucune des deux, ou si une route publique n'est pas dans sa liste justifiée :

| Route publique                         | Pourquoi                                 |
| -------------------------------------- | ---------------------------------------- |
| `GET /api/health`                      | état technique, aucune donnée            |
| `POST /api/auth/inscription`           | création de compte                       |
| `POST /api/auth/connexion`             | connexion web                            |
| `POST /api/auth/mobile/connexion`      | connexion mobile                         |
| `POST /api/auth/mobile/renouvellement` | le jeton de renouvellement est la preuve |
| `POST /api/invitations/accepter`       | le jeton d'invitation est la preuve      |

## Journal d'accès

Chaque lecture autorisée d'un dossier patient écrit une ligne dans `journal_acces` (qui, quel
patient, quelle section, quand). Aucun contenu médical. Les refus n'écrivent pas de lecture.

## Inscription

`POST /api/auth/inscription` crée le cabinet et le compte orthophoniste. La réponse est **la même**
que l'adresse soit libre ou déjà utilisée (on ne révèle pas qu'un e-mail existe) ; le mot de passe est
haché dans les deux cas pour que la durée soit la même.

## Invitations

1. L'orthophoniste invite un parent ou le patient (`POST /api/patients/:id/invitations`).
2. Le lien `APP_URL/invitation#jeton` est valable **72 h** et ne sert **qu'une fois**. Le jeton est
   après `#` : le navigateur ne l'envoie jamais au serveur dans l'URL (ni journaux, ni `Referer`).
3. La personne choisit son mot de passe sur la page `/invitation`, puis se connecte dans l'application.

Règles : un patient ne reçoit son propre compte qu'à partir de **15 ans**, et s'il n'en a pas déjà un.
Un parent déjà inscrit dans le même cabinet relie un nouvel enfant avec son mot de passe actuel.
Impossible de rattacher un compte d'un autre cabinet ou un compte orthophoniste.

**Envoi par e-mail : pas encore branché.** Le lien s'affiche à l'orthophoniste, qui le transmet. Le
futur prestataire d'e-mail (interface `lib/serveur/email.ts`) devra être hébergé en France et ne
recevoir que l'adresse et le lien, jamais le prénom du patient.

## Limitation des essais

Comptée en base (table `tentative_connexion`), avec des clés HMAC (`AUTH_SECRET`) : ni e-mail ni
adresse IP en clair.

| Quoi                            | Limite             |
| ------------------------------- | ------------------ |
| Connexion, par e-mail           | 5 échecs / 15 min  |
| Connexion, par adresse IP       | 50 échecs / 15 min |
| Inscription, par IP             | 10 / heure         |
| Activation d'invitation, par IP | 20 / heure         |

Le blocage s'applique aussi à un e-mail inconnu (pas de différence visible). En production, le
proxy de l'hébergeur doit écrire `X-Forwarded-For` en écrasant la valeur envoyée par le client.

## Variables d'environnement

| Variable      | Rôle                                                                |
| ------------- | ------------------------------------------------------------------- |
| `AUTH_SECRET` | Secret serveur (≥ 32 caractères) pour les empreintes des tentatives |
| `APP_URL`     | Adresse publique du web : liens d'invitation, contrôle de l'origine |
