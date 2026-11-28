# Bilans, comptes rendus et courriers

Sous-partie `/patients/[id]/bilans` (orthophoniste du cabinet). Objectif : ne jamais partir d'une
page blanche. Pas d'IA : les parties factuelles sont remplies par des **règles**.

## Écrans

- **Liste** (`/patients/[id]/bilans`) : chaque document avec son **statut**, le nombre de parties
  remplies et son partage (Partagé / Non partagé). En dessous : **Nouveau document** (type, modèle de
  la pathologie, séance pour un compte rendu, destinataire pour un courrier, période facultative).
- **Éditeur** (`/patients/[id]/bilans/[bilanId]`) : une zone de texte par partie (une idée par ligne,
  « - » en début de ligne pour une liste), « Enregistrer », « Marquer comme relu », « Actualiser les
  chiffres », export PDF et Word, case **Partager avec la famille**, suppression.
- **Espace famille** (`/famille`) : sous chaque enfant suivi, les documents partagés (PDF).

## Statuts

Chaque partie a un statut ; le document prend celui de sa partie la plus en retard
(À écrire, puis À relire, puis Automatique, puis Rempli).

| Statut          | Partie                                                                |
| --------------- | --------------------------------------------------------------------- |
| **À écrire**    | partie à écrire, encore vide                                          |
| **À relire**    | partie à écrire qui contient un texte de départ du modèle (courriers) |
| **Automatique** | remplie depuis les données, pas encore relue                          |
| **Rempli**      | écrite ou relue par l'orthophoniste                                   |

Écrire ou corriger une partie, ou cliquer « Marquer comme relu », la passe en **Rempli**.
« Actualiser les chiffres » recalcule les parties automatiques : elles redeviennent **Automatique**.

## Modèles (exemples à valider)

Structure dans `packages/shared/src/modeles-bilans.ts`, textes dans `fr.json` (`web.bilans.modeles`).
**Leur contenu est un exemple à valider par des orthophonistes** (mention affichée à la création et dans
l'éditeur).

| Type                   | Parties automatiques                                       | Parties à écrire                                         |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| Bilan initial          | identité, prescription                                     | motif, anamnèse, tests, observations, conclusion, projet |
| Bilan d'évolution      | identité, prescription, séances, exercices, maison, scores | observations, évolution, conclusion, suite               |
| Compte rendu de séance | identité, séance (exercices), notes de séance, programme   | observations, pour la maison                             |
| Courrier au médecin    | identité, séances                                          | objet, courrier, formule (textes de départ « À relire ») |
| Courrier à l'école     | identité                                                   | objet, courrier, formule (textes de départ « À relire ») |
| Courrier à l'assurance | identité, prescription, séances                            | objet, courrier, formule (textes de départ « À relire ») |

**Par pathologie** (7 pathologies du seed) : les aides des parties « Tests et épreuves » et
« Observations cliniques » changent (ex. bégaiement : disfluences, vécu de la parole).

## Remplissage automatique (règles)

Fonctions pures dans `packages/shared/src/bilans.ts`, données réunies par `donneesBilan`
(`apps/web/lib/serveur/bilans.ts`) :

- **Identité** : prénom, nom, date de naissance, âge, pathologies ; **prescription** : médecin.
- **Séances** : nombre de séances terminées sur la période, première et dernière date.
- **Exercices travaillés** : par exercice, niveau de la première et de la dernière séance.
- **Maison** : taux de réalisation (faits / prévus) et ressentis, mêmes règles que la Préparation.
- **Scores par niveau** : score moyen (part du « sur N ») par exercice et par niveau. Le niveau est
  désormais **gardé sur chaque réalisation** au moment où elle est faite.
- **Période par défaut** : bilan d'évolution → depuis le dernier bilan (initial, d'évolution ou de
  renouvellement), sinon depuis la première séance ; courriers → depuis la première séance ;
  compte rendu → le jour de la séance. L'orthophoniste peut choisir d'autres dates.

## Export

PDF (`pdf-lib`) et Word `.docx` (`docx`), **produits sur notre serveur** : aucun service externe.
Métadonnées neutres, nom de fichier sans le nom du patient (`evolution-AAAA-MM-JJ.pdf`), pied de
page « document confidentiel ». Tant qu'une partie n'est pas relue, l'export porte la mention
**« BROUILLON — parties à relire »**. Chaque export est journalisé (`EXPORT`, section `bilans`).

## Partage avec la famille

- **Par défaut, rien n'est partagé** (`partage = false` en base).
- Partager = l'orthophoniste coche la case. Seul un document **entièrement relu** (« Rempli ») peut
  être partagé (sinon 409 `document_a_relire`).
- **Toute modification d'un document partagé retire le partage** (la famille ne voit jamais une
  version non relue) ; l'éditeur le signale.
- La famille (parent relié, ou patient adulte, **avec consentement**) ne lit que les documents
  partagés, par une partie à part, `documentsPartages`. La section `bilans` reste réservée à
  l'orthophoniste : aucune route de l'orthophoniste n'est ouverte à la famille.

## Droits et journal

- Orthophoniste du cabinet : action `modifier`, section `bilans`. Autre cabinet, famille : **404**.
- Famille : action `lire`, partie `documentsPartages` ; sans consentement : **403**.
- Chaque lecture est journalisée (`bilans`, ou `documentsPartages` pour la famille).
- Deux enregistrements rapprochés ne s'écrasent pas : la ligne du document est verrouillée pendant
  chaque modification.

## API

| Route                                                      | Rôle                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /api/patients/:id/bilans`                             | liste avec statuts, pathologies, séances                                           |
| `POST /api/patients/:id/bilans`                            | créer depuis un modèle (`type`, `pathologie`, période, `seanceId`, `destinataire`) |
| `GET`, `PATCH`, `DELETE /api/patients/:id/bilans/:bilanId` | lire ; titre, destinataire ; supprimer                                             |
| `PATCH /api/patients/:id/bilans/:bilanId/sections/:cle`    | `{ contenu }` ou `{ relu: true }`                                                  |
| `POST /api/patients/:id/bilans/:bilanId/actualiser`        | recalculer les parties automatiques                                                |
| `PUT /api/patients/:id/bilans/:bilanId/partage`            | `{ partage: true \| false }`                                                       |
| `GET /api/patients/:id/bilans/:bilanId/pdf` et `/docx`     | export                                                                             |
| `GET /api/patients/:id/bilans-partages`                    | famille : documents partagés                                                       |
| `GET /api/patients/:id/bilans-partages/:bilanId/pdf`       | famille : PDF d'un document partagé                                                |

## Reste à faire (hors tâche 10)

- Écran « Documents » dans l'application mobile (l'API est prête).
- Modèles propres au cabinet, modifiables depuis le logiciel (aujourd'hui : dans le code).
- Mise en forme plus riche dans l'éditeur (gras, titres) si les orthophonistes le demandent.
- Plus tard, en option : aide à la rédaction par IA, toujours relue par l'orthophoniste.
