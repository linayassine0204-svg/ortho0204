# Programme à la maison

C'est le **seul endroit** où l'on ajoute des exercices pour la maison (la Préparation ne prépare que
la séance au cabinet).

## Écran `/patients/[id]/programme`

- **À gauche, le programme actuel** : pour chaque exercice, le niveau (boutons − et + : « baisser
  d'un niveau », « passer au niveau supérieur »), le rythme (fois par semaine, jours) et un mot pour
  la famille. On peut aussi réordonner (↑ ↓) et retirer.
- **À droite, le panneau Bibliothèque** : c'est le composant `<BibliothequeSelecteur>` de la tâche 4,
  **réutilisé tel quel** en mode sélection. Ses filtres sont pré-réglés sur la pathologie et l'âge du
  patient, et le bouton s'appelle « Ajouter au programme » (seule option ajoutée : `libelleAjouter`).
- En haut : l'état de l'envoi (jamais envoyé, envoyé, modifications non envoyées), les personnes qui
  verront le programme (seulement les comptes famille qui ont donné leur consentement), et le bouton
  **Envoyer**.

## Règles

- **Un programme actif par patient** (garanti par la base). Il est créé au premier ajout.
- **Rythme** : si des jours sont cochés, le nombre de fois par semaine est égal au nombre de jours.
  Sans jour coché, l'exercice est « à placer librement » N fois dans la semaine.
- **Niveaux** de 1 à 3 : impossible de monter au-delà de 3 ou de descendre sous 1 (409).
- **Retirer** un exercice ne l'efface pas de la base : il est marqué retiré, pour garder l'historique
  de ce que la famille a déjà fait.
- **Envoyer** crée une **version figée** (`VersionProgramme`, numérotée 1, 2, 3…) qui contient tout ce
  que la famille doit voir : titre, aperçu, matériel, durée, niveau, consigne du niveau, jours, mot,
  étiquette « à valider ». Le programme reste modifiable. **La famille voit la dernière version
  envoyée** ; les changements apparaissent après un nouvel envoi. Un programme vide ne s'envoie pas.
- L'envoi est journalisé (`MODIFICATION`, section `programme`).

## API pour le mobile (version envoyée)

| Route                                           | Contenu                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /api/patients/:id/programme/semaine?date=` | programme envoyé + plan du lundi au dimanche (exercices par jour, et ceux sans jour fixé) |
| `GET /api/patients/:id/programme/jour?date=`    | exercices du jour (aperçu, niveau, consigne) + ceux à placer dans la semaine              |

- `date` (AAAA-MM-JJ) est facultative : par défaut, c'est aujourd'hui, **heure de Paris**.
- Droits vérifiés par `can()` (section `programme`) : parent relié, patient lui-même, ou
  orthophoniste du cabinet. Un autre compte reçoit **404**. **Sans consentement : 403
  `consentement_requis`**. Chaque lecture est journalisée.
- Rien n'a encore été envoyé : `{ "programme": null }`.
- Le calcul du jour et de la semaine est dans `packages/shared/src/programme.ts` (fonctions pures,
  réutilisables par l'application mobile).

## API de composition (orthophoniste du cabinet)

| Route                                                          | Rôle                                            |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `GET /api/patients/:id/programme`                              | brouillon, dernier envoi, destinataires         |
| `POST /api/patients/:id/programme/elements`                    | ajouter `{ exerciceId, niveau }`                |
| `PATCH /api/patients/:id/programme/elements/:elementId`        | niveau, `foisParSemaine`, `jours`, `motFamille` |
| `POST /api/patients/:id/programme/elements/:elementId/ajuster` | `{ sens: "monter" \| "baisser" }`               |
| `DELETE /api/patients/:id/programme/elements/:elementId`       | retirer                                         |
| `PUT /api/patients/:id/programme/ordre`                        | `{ elementIds: [...] }` (tous, dans l'ordre)    |
| `POST /api/patients/:id/programme/envoi`                       | envoyer (nouvelle version)                      |

La famille n'a jamais accès au brouillon (404).
