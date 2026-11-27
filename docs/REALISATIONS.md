# Réalisations : faire un exercice et en garder la trace

## Dans l'application

1. **Aujourd'hui** → toucher un exercice (vue adulte) ou « C'est parti ! » (mode enfant).
2. **Écran de l'exercice** : consigne **du niveau choisi**, aperçu, matériel, mot de l'orthophoniste,
   enregistrement de la voix (facultatif), bouton **« C'est fait ! »**. La barre d'onglets est
   masquée : un seul exercice à l'écran.
3. **Ressenti** en trois choix avec visages (facile 😄, moyen 🙂, difficile 😮‍💨 : jamais un visage
   triste), et **score** seulement si l'exercice en prévoit un (`scoreMax`, ex. « 7 sur 10 ») :
   pastilles 0 à N (ou − / + au-delà de 10). Le score est facultatif, le ressenti obligatoire.
4. **Fin** :
   - **mode enfant** (moins de 15 ans, compte du parent) : **3 étoiles, toujours**, quels que soient
     le ressenti et le score (`session/etoiles.ts`, testé), message encourageant, puis enchaînement
     direct sur l'exercice suivant. Quand tout est fait : « Bravo, tout est fait pour aujourd'hui ! ».
     Aucun classement, aucune comparaison avec d'autres enfants ;
   - **vue adulte** (patient avec son compte, ou enfant de 15 ans et plus) : mêmes données, message
     sobre « Réalisation enregistrée », et si elle est partie ou en attente de réseau.

Le mode est calculé sur le téléphone à partir de la date de naissance (`estModeEnfant`) ; seule la
valeur oui/non est gardée en cache, pas la date.

## Hors ligne et synchronisation (`apps/mobile/src/donnees/realisations.ts`)

- Chaque réalisation est **d'abord rangée sur le téléphone** (cache chiffré AES-GCM), avec un
  identifiant aléatoire créé par le téléphone (`idClient`, UUID), puis envoyée.
- Synchronisation : tout de suite, **au retour du réseau** (NetInfo), au retour dans l'application,
  et toutes les minutes tant qu'il reste quelque chose. Une seule synchronisation à la fois.
- **Sans doublon** : le serveur garantit l'unicité de (`exercice du programme`, `idClient`) en base.
  Renvoyer la même réalisation (réponse perdue, double synchro) renvoie celle qui existe (200).
- Erreur réseau, serveur indisponible, session expirée : on garde et on réessaie plus tard.
  Refus définitif (accès ou consentement retiré, exercice inconnu) : la réalisation est abandonnée
  et sa voix locale supprimée.
- La voix part **après** la réalisation ; si seule la voix échoue (coupure), seule la voix est
  renvoyée ensuite. Voix refusée (accord retiré) : la réalisation reste enregistrée.
- Le téléphone note aussi ce qui a été fait cette semaine (« Fait aujourd'hui ✓ », « Encore 2 fois
  cette semaine », file du mode enfant). C'est propre à ce téléphone : un autre parent, sur un autre
  téléphone, ne le voit pas encore (le Suivi viendra avec la tâche de suivi).
- Déconnexion : dernière tentative d'envoi, puis tout est effacé (jetons, cache, voix). Sans réseau
  à ce moment-là, les réalisations non envoyées sont perdues.

## Enregistrement de la voix

- **Accord facultatif** du compte (type `ENREGISTREMENT_AUDIO`, texte versionné
  `consentement.enregistrementAudio`, même règle que le consentement données de santé : changer le
  texte impose une nouvelle version, un test le vérifie). Demandé la première fois qu'on veut
  enregistrer ; retrait : `DELETE /api/patients/:id/consentement/audio`.
- Micro (`expo-audio`, AAC .m4a), 10 minutes au plus, uniquement appli ouverte (pas d'arrière-plan).
- Le fichier reste dans le **dossier privé de l'application** jusqu'à l'envoi, puis il est supprimé.
  Il n'est pas chiffré par l'application (protection du système : bac à sable, chiffrement du
  téléphone, `allowBackup: false`) ; il ne reste que le temps de l'envoi.
- Envoi : **uniquement à notre API**, en multipart. En production, l'adresse de l'API doit être en
  `https` (l'application refuse de démarrer sinon). Côté serveur : format vérifié sur le contenu
  (boîte `ftyp`), 20 Mo au plus, une voix par réalisation, rangée dans le stockage
  (`lib/serveur/stockage.ts`, à brancher sur l'hébergeur HDS en production).

## API

| Route                                                     | Rôle                                               |
| --------------------------------------------------------- | -------------------------------------------------- |
| `POST /api/patients/:id/realisations`                     | `{ idClient, elementId, faitLe, ressenti, score }` |
| `POST /api/patients/:id/realisations/:rid/enregistrement` | multipart `audio` (.m4a) + `dureeSecondes`         |
| `POST`, `DELETE /api/patients/:id/consentement/audio`     | donner / retirer l'accord pour la voix             |

Droits : action **`realiser`** de `can()` : parent relié ou patient lui-même, **avec son
consentement**, section programme. L'orthophoniste, un autre parent, un autre cabinet : **404**.
Sans consentement : **403 `consentement_requis`**. Voix sans accord : **403
`consentement_audio_requis`**. L'exercice doit appartenir au programme de ce patient ; la voix ne
peut être ajoutée qu'à une réalisation saisie par le même compte. Date : pas dans le futur (10 min
de tolérance), pas plus de 30 jours en arrière. Score : seulement si l'exercice en prévoit un, et
au plus `scoreMax` (aussi garanti par la base). Chaque enregistrement est journalisé
(`MODIFICATION`), sans contenu.
