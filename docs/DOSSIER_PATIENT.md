# Dossier patient

## Navigation

- **Menu principal à gauche** : _Patients_ et _Bibliothèque_. La Bibliothèque est une partie à part
  (`/bibliotheque`), hors dossier patient. Elle affiche « bientôt disponible » jusqu'à la tâche 4.
- **Dossier** `/patients/[id]/[section]` : sous le nom du patient, dans l'entrée _Patients_ du menu,
  on trouve les 7 sous-parties.

| Menu        | Adresse        | État                                                           |
| ----------- | -------------- | -------------------------------------------------------------- |
| Fiche       | `/fiche`       | faite                                                          |
| Préparation | `/preparation` | fait (voir PREPARATION.md) : la prochaine séance seulement     |
| Bilans      | `/bilans`      | fait (voir BILANS.md)                                          |
| Programme   | `/programme`   | fait (voir PROGRAMME.md)                                       |
| Conseils    | `/conseils`    | fait (voir CONSEILS.md)                                        |
| Messages    | `/messagerie`  | bientôt disponible, **masqué si la messagerie est désactivée** |
| Progrès     | `/suivi`       | bientôt disponible                                             |

Les adresses suivent les noms de CLAUDE.md (Messagerie, Suivi) ; les libellés viennent de `fr.json`.

**Chaque ouverture d'une sous-partie écrit une ligne dans le journal d'accès** (section consultée).

## Liste des patients

`/patients` : recherche par prénom ou nom (sans tenir compte des majuscules ; les accents doivent
être tapés), filtre par pathologie, bouton **Nouveau patient** (`/patients/nouveau`). Le patient est
toujours créé dans le cabinet de l'orthophoniste connecté, quoi que le navigateur envoie.

## Fiche

Identité (prénom, nom, date de naissance), pathologies, contacts (parents ou compte du patient, avec
l'état de leur consentement, et les invitations en attente), médecin prescripteur, documents, notes,
et la zone **Séances** : les séances passées (lecture, export PDF, « Réutiliser cette séance »), voir
PREPARATION.md.
Chaque modification est journalisée (`MODIFICATION`).

### Documents

- Types acceptés : PDF, PNG, JPEG ; **10 Mo** au maximum. Le type est vérifié sur le contenu du
  fichier (ses premiers octets), pas sur son nom.
- Le fichier est stocké sous une clé aléatoire. La base ne garde que le nom affiché et la clé.
- Le téléchargement est toujours proposé en pièce jointe et journalisé comme une sortie de données
  (`EXPORT`).
- Stockage : interface `apps/web/lib/serveur/stockage.ts`. En développement, il utilise un dossier
  local (`STOCKAGE_DOSSIER`, jamais versionné). **En production, il faudra le brancher sur le
  stockage de l'hébergeur HDS.**

## Consentement

| Patient                        | Qui consent                        |
| ------------------------------ | ---------------------------------- |
| Enfant de moins de 15 ans      | chaque parent relié, pour lui-même |
| 15 ans et plus avec son compte | le patient lui-même                |

- Le texte est dans `fr.json` (`consentement.donneesSante`). Sa version (`CONSENTEMENT_DONNEES_SANTE`,
  dans `packages/shared`) est enregistrée avec la date. **Si on modifie le texte sans changer la
  version, un test échoue.**
- **Sans consentement actif, l'API n'envoie aucune donnée du patient à ce compte** : la liste ne
  contient que le prénom (pour afficher la demande), et le dossier répond `403 consentement_requis`.
  Cette règle est dans `can()` : elle vaut pour le mobile comme pour l'espace famille du web.
- Le consentement d'un parent ne vaut pas pour l'autre parent. L'orthophoniste ne peut pas consentir
  à la place de la famille.
- Retrait : `DELETE /api/patients/:id/consentement`. La preuve est gardée, marquée retirée avec sa date.
- L'orthophoniste voit l'état du consentement de chaque contact dans la Fiche.

## API

| Route                                           | Qui                 | Rôle                               |
| ----------------------------------------------- | ------------------- | ---------------------------------- |
| `GET /api/patients?q=&pathologie=`              | tous                | liste (filtrée par `can()`)        |
| `POST /api/patients`                            | orthophoniste       | création                           |
| `GET /api/patients/:id`                         | tous (selon droits) | résumé (journalisé)                |
| `GET`, `PATCH /api/patients/:id/fiche`          | orthophoniste       | Fiche complète, modification       |
| `POST /api/patients/:id/documents`              | orthophoniste       | ajout (multipart, champ `fichier`) |
| `GET`, `DELETE /api/patients/:id/documents/:d`  | orthophoniste       | téléchargement, suppression        |
| `POST`, `DELETE /api/patients/:id/consentement` | parent, patient     | donner, retirer                    |
