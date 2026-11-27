# Préparation de séance

Écran `/patients/[id]/preparation` : préparer la séance du jour en quelques minutes.
Réservé à l'orthophoniste du cabinet (les familles n'y ont jamais accès).

## Les zones de l'écran

- **En haut, le résumé avant séance** : ce qui a été fait à la maison depuis la dernière séance
  (taux de réalisation, ressentis, score moyen et dernier score par exercice), les notes de la
  dernière séance et les points à reprendre.
- **Au centre, la séance en construction** :
  1. la **séance proposée** : chaque exercice affiche la raison de la proposition, et l'orthophoniste
     l'**accepte**, le **change** (niveau, ou autre exercice) ou le **retire**. « Tout accepter » et
     « Proposer à nouveau » sont aussi disponibles ;
  2. les **exercices de la séance** (retenus), leur niveau et la durée totale ;
  3. le **matériel à préparer**, calculé automatiquement ;
  4. **Exporter la fiche (PDF)** ;
  5. les **notes de séance** (objectifs, matériel en plus, notes, points à reprendre), au clavier ou en
     dictée locale (voir plus bas), puis **Terminer la séance** ;
  6. le **programme à la maison** : lecture, niveau −/+, retrait et envoi (même programme que l'écran
     Programme, même code : `useProgramme`) ;
  7. les **séances passées**, avec « Copier dans la séance ».
- **À droite, le panneau Bibliothèque** : le composant `<BibliothequeSelecteur>` réutilisé tel quel, en
  mode sélection, filtres pré-réglés sur le patient. On choisit le niveau, puis **Ajouter à la séance**
  ou **Ajouter au programme** (option `autresAjouts` du composant).

## Séance proposée : les règles (pas d'IA)

Fonction pure `proposerSeance` (`packages/shared/src/seance.ts`), testée seule :

1. Seulement des exercices **de la pathologie du patient** (l'une de ses pathologies) **et de son âge**.
2. D'abord ceux **déjà travaillés** (dernière séance, puis programme à la maison) :
   - **niveau suivant** si les derniers résultats sont bons (sans dépasser 3) ;
   - **niveau en cours** sinon.
3. Puis des **exercices nouveaux**, au niveau 1, en alternant les pathologies du patient.
4. **4 exercices** au plus ; jamais un exercice déjà dans la séance.

**Résultats « bons »** (`resultatsBons`) : les 3 dernières réalisations à la maison depuis la dernière
séance sont toutes faites, aucune n'est ressentie « difficile », et le score moyen atteint 80 %
(sans score : au moins 2 « facile »). Moins de 3 réalisations : pas « bons » (on reste au niveau).

Les propositions sont enregistrées en attente (`retenu = false`) à la première ouverture. Seuls les
exercices **retenus** comptent pour le matériel, la durée et la fiche PDF. À la fin de la séance, les
propositions jamais acceptées sont retirées.

## Résumé de la maison

Période : du jour de la dernière séance terminée (compris) à hier (aujourd'hui exclu : les exercices
du jour ne sont peut-être pas faits). Sans séance terminée : les 14 derniers jours.
Exercices prévus : nombre de jours fixés dans la période, ou « N fois par semaine » au prorata.
Le taux ne dépasse jamais 100 %.

## Matériel à préparer

Le matériel de tous les exercices retenus, sans doublon (majuscules, accents et espaces ignorés),
trié, avec les exercices qui l'utilisent. Le « matériel en plus » écrit à la main s'ajoute sur la fiche.

## Fiche de séance (PDF)

Produite **sur notre serveur** avec `pdf-lib` (aucun service externe) : patient, date, objectifs, points
à reprendre, exercices (niveau, consigne du niveau, durée, matériel, mention « à valider »), matériel
à cocher, notes et lignes pour écrire à la main, pied de page « document confidentiel ». Métadonnées
neutres ; nom de fichier `fiche-seance-AAAA-MM-JJ.pdf` (sans le nom du patient). Export journalisé
(`EXPORT`, section `preparation`).

## Dictée vocale : uniquement sur l'ordinateur

La reconnaissance vocale de certains navigateurs (Chrome par défaut) **envoie l'audio à un service
externe** : c'est interdit pour des notes de séance. Le bouton « Dicter » n'apparaît donc que si le
navigateur propose la reconnaissance **locale** (`processLocally` de l'API Web Speech) ; au clic, il
vérifie que le français est disponible sur l'ordinateur (`SpeechRecognition.available`), sinon propose
de l'installer (téléchargement du modèle, aucun audio envoyé) ou affiche « Dictée indisponible ».
Aujourd'hui, cela concerne surtout les versions récentes de Chrome ; ailleurs, saisie au clavier.
Code : `apps/web/lib/client/dictee.ts`.

## Droits et journal

- Toutes les routes passent par `can()` : action `modifier`, section `preparation` (orthophoniste du
  cabinet). Autre cabinet, famille : **404**. Une séance d'un autre patient : **404**.
- Une séance terminée ne se modifie plus : **409 `seance_terminee`**. Exercice déjà dans la séance :
  **409 `deja_dans_seance`**.
- Ouverture de l'écran : `LECTURE` ; notes et fin de séance : `MODIFICATION` ; PDF : `EXPORT`.

## API

| Route                                                            | Rôle                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /api/patients/:id/preparation`                              | séance en préparation (créée avec la proposition), résumé, passées |
| `POST /api/patients/:id/seances/:seanceId/elements`              | ajouter `{ exerciceId, niveau }` (panneau Bibliothèque)            |
| `PATCH /api/patients/:id/seances/:seanceId/elements/:elementId`  | `{ retenu: true }`, `{ niveau }` ou `{ exerciceId }` (remplacer)   |
| `DELETE /api/patients/:id/seances/:seanceId/elements/:elementId` | retirer                                                            |
| `POST /api/patients/:id/seances/:seanceId/proposition`           | proposer à nouveau (les retenus restent)                           |
| `PATCH /api/patients/:id/seances/:seanceId`                      | `notes`, `pointsAReprendre`, `objectifs`, `materiel`               |
| `POST /api/patients/:id/seances/:seanceId/terminer`              | terminer la séance                                                 |
| `POST /api/patients/:id/seances/:seanceId/copie`                 | `{ depuisSeanceId }` : copier les exercices d'une séance passée    |
| `GET /api/patients/:id/seances/:seanceId/pdf`                    | fiche de séance (PDF)                                              |

« Ajouter au programme » utilise l'API du programme (`POST /api/patients/:id/programme/elements`).

## Reste à faire (hors tâche 9)

- Réordonner les exercices de la séance (aujourd'hui : ordre d'ajout).
- Noter un résultat par exercice pendant la séance, pour l'utiliser dans les règles de proposition
  (aujourd'hui : seuls les résultats de la maison comptent).
- Dictée sur les navigateurs sans reconnaissance locale (Safari, Firefox) : rien tant qu'ils ne la
  garantissent pas.
