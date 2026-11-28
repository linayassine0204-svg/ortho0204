# Messagerie sécurisée

Optionnelle : chaque cabinet l'active ou non, avec une exception possible patient par patient.
Aucun service de messagerie externe (ni WhatsApp, ni SMS…) : messages et pièces jointes ne vont qu'à
notre serveur. Aucune notification ni aucun e-mail ne contient le contenu d'un message (il n'y a
d'ailleurs pas encore de notification).

## Réglages

- **Cabinet** : `/reglages` (lien « Réglages du cabinet » en bas du menu) : case « Messagerie activée
  pour le cabinet », **horaires de réponse** affichés aux familles (ex. « Je réponds sous 48 h »),
  **réponses rapides** (modèles de messages partagés par le cabinet).
- **Patient** : dans la Fiche, « Messagerie de ce patient » : _Comme le cabinet_, _Activée_ ou
  _Désactivée_. L'exception l'emporte sur le cabinet (`messagerieEffective`).

## Désactivée = vraiment coupée

- Web : la sous-partie **Messages disparaît du menu** du dossier ; l'adresse directe donne une page 404.
- Mobile : l'**onglet Messages disparaît** (la liste des patients renvoie `messagerieActivee: false`).
- **API : toute lecture ou écriture est refusée** : `403 messagerie_desactivee`
  (« La messagerie est désactivée pour ce patient. »), y compris les pièces jointes. Ce refus n'est
  donné qu'à quelqu'un qui aurait accès sinon ; les autres reçoivent 404 (rien n'est révélé).
- L'**historique est gardé** au dossier : réactiver la messagerie le fait réapparaître.

## Conversation

- **Une conversation par patient** (garanti par la base), avec ses parents, ou avec lui s'il a son
  propre compte (adolescent ou adulte). Créée au premier message.
- Messages : texte (5000 caractères au plus) et/ou **une pièce jointe** :
  - **photo** JPEG ou PNG, 10 Mo au plus ;
  - **message vocal** M4A (téléphone, Safari), WebM ou Ogg (navigateurs), 10 Mo et 5 minutes au plus.
- Le **type réel** du fichier est lu dans ses premiers octets (`detecterTypePieceJointe`) : le nom et
  le type annoncés ne comptent pas. Le nom d'origine n'est pas gardé.
- Envoi par connexion chiffrée (HTTPS en production) ; fichiers dans le stockage du serveur
  (hébergeur HDS en production, dossier local en développement).
- « Lu » : un message est marqué lu quand l'autre côté ouvre le fil.
- Web : vocal enregistré par le navigateur (MediaRecorder) ; mobile : micro du téléphone (même
  enregistreur que les exercices) et photo choisie dans la galerie (sélecteur du système). Le fichier
  vocal est supprimé du téléphone après l'envoi.

## Droits et journal

- `can()`, section `messagerie` : **lire** et **écrire** pour l'orthophoniste du cabinet, le parent
  relié et le patient lui-même, **avec consentement** (sinon 403 `consentement_requis`). Tout autre
  compte : 404.
- **Chaque lecture du fil est inscrite au journal d'accès** (`LECTURE`, section `messagerie`), ainsi que
  chaque pièce jointe ouverte ; chaque envoi (`MODIFICATION`). Le journal ne contient jamais le texte.
- Réglages et réponses rapides : orthophonistes du cabinet seulement.

## API

| Route                                                      | Rôle                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `GET /api/patients/:id/messagerie`                         | fil (messages, horaires de réponse)                                    |
| `POST /api/patients/:id/messagerie/messages`               | JSON `{ contenu }`, ou multipart `contenu`, `fichier`, `dureeSecondes` |
| `GET /api/patients/:id/messagerie/pieces-jointes/:pieceId` | photo ou message vocal                                                 |
| `PUT /api/patients/:id/reglages/messagerie`                | exception : `{ messagerieActivee: true \| false \| null }`             |
| `GET`, `PUT /api/cabinet/reglages`                         | messagerie du cabinet, horaires de réponse                             |
| `GET`, `POST /api/cabinet/reponses-rapides`                | réponses rapides                                                       |
| `PATCH`, `DELETE /api/cabinet/reponses-rapides/:reponseId` | modifier, supprimer                                                    |

## Reste à faire (hors tâche 11)

- Notification sur le téléphone à l'arrivée d'un message (sans son contenu).
- Messagerie dans l'espace famille du web (aujourd'hui : application mobile).
- Arrivée des nouveaux messages sans « Actualiser » (aujourd'hui : bouton, ou tirer vers le bas
  sur le mobile).
