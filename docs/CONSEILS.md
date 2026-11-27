# Conseils pour la famille

## Conseils pré-faits

- 16 conseils d'exemple dans le seed (`packages/db/src/seed/bibliotheque.ts`), au moins un par
  pathologie. Chacun a deux blocs : **À faire** et **À éviter** (une idée par ligne), des
  étiquettes de **pathologie** et une **tranche d'âge** (en années, borne absente = pas de limite).
- ⚠ Ce sont des **exemples rédigés pour tester le logiciel, non vérifiés médicalement**. Ils sont
  tous enregistrés avec `aValider = true` et affichés « Exemple — à valider par un orthophoniste »
  (web) / « Exemple à valider » (mobile). Un conseil adapté d'un exemple **garde** l'étiquette ;
  seul un conseil écrit de zéro par l'orthophoniste ne l'a pas.

## Proposition (pas d'IA)

`conseilsProposes()` dans `packages/shared/src/conseils.ts`, fonction pure :

- un conseil est proposé si **au moins une pathologie du patient** est dans ses étiquettes
  **et** si l'**âge du patient** (années révolues) est **dans sa tranche** (bornes comprises) ;
- ordre : plus de pathologies en commun d'abord, puis par titre ;
- patient sans pathologie renseignée : aucune proposition (l'écran invite à compléter la Fiche).

Aucun service externe n'est appelé. Exemple (seed) : Léa, 7 ans, langage oral + langage écrit →
5 conseils (langage oral 3–8, 5–10, 6–11 ans ; langage écrit 5–10, 7–12 ans). Les conseils de
langage oral 2–4 ans et 12–18 ans ne sont pas proposés.

## Écran `/patients/[id]/conseils` (orthophoniste)

1. En haut : **conseils proposés pour [prénom]**, avec « Envoyer tel quel » et « Modifier avant
   envoi ». Un modèle déjà envoyé reste proposé avec l'étiquette « Déjà envoyé ».
2. **Écrire un conseil** de zéro.
3. Pour chaque envoi : **Quand ?** (maintenant / à une date choisie) et **Répétition** (une fois /
   chaque semaine).
4. **Conseils envoyés** : origine (pré-fait, pré-fait modifié, écrit par vous), dernier envoi,
   **« Lu le … par … » / « Pas lu »**, répétition en cours (« Arrêter », « Annuler l'envoi
   prévu »), et « Ré-envoyer ».
5. En bas, repliés : les autres conseils pré-faits, pour en choisir un hors proposition.

## Règles

- **Copie figée** : chaque envoi crée un conseil propre au patient (`Conseil.patientId`), copié du
  modèle (tel quel ou modifié) ou écrit. Le texte reçu par la famille ne change plus.
- **Planification** (`PlanConseil`) : `UNE_FOIS` ou `HEBDOMADAIRE`, avec `prochainEnvoi`.
  Une date choisie = 00:00 (heure de Paris) ce jour-là ; une date passée est refusée (400
  `date_passee`). Chaque semaine = même heure locale (les changements d'heure ne décalent rien).
- **Envois créés à la lecture** : il n'y a pas de tâche de fond. Quand l'orthophoniste ou la
  famille ouvre les conseils, `creerEnvoisDus()` crée les envois arrivés à échéance. Un plan
  hebdomadaire n'envoie **qu'une occurrence à la fois** (la plus récente due) : après trois semaines
  sans ouverture, la famille ne reçoit pas trois fois le même conseil. La contrainte unique
  (plan, date d'envoi) empêche les doublons si deux lectures arrivent en même temps.
- **Famille** : voit le dernier envoi de chaque conseil, ceux à lire d'abord. **« J'ai compris »**
  enregistre `luLe` et `luParId` (le parent qui a lu) sur cet envoi et sur les envois plus anciens
  du même conseil restés non lus. Un deuxième appui garde la première lecture.
- **Qui voit les conseils** : les **parents** reliés qui ont donné leur consentement. Le patient
  adolescent ou adulte ne les voit pas (CLAUDE.md : programme et messagerie seulement) : pas
  d'onglet sur le mobile, et l'API répond 404.
- Toute lecture est journalisée (`conseils`, `LECTURE`) ; envoi, arrêt et « J'ai compris » aussi
  (`MODIFICATION`). Le journal ne contient jamais le texte des conseils.

## API

| Route                                                | Qui           | Rôle                                                       |
| ---------------------------------------------------- | ------------- | ---------------------------------------------------------- |
| `GET /api/patients/:id/conseils`                     | orthophoniste | proposés, autres modèles, envoyés (lu / pas lu), parents   |
| `POST /api/patients/:id/conseils`                    | orthophoniste | `{ modeleId?, contenu?, planification }` (voir ci-dessous) |
| `POST /api/patients/:id/conseils/:conseilId/envois`  | orthophoniste | ré-envoyer `{ planification }`                             |
| `DELETE /api/patients/:id/conseils/plans/:planId`    | orthophoniste | arrêter une répétition / annuler un envoi prévu            |
| `GET /api/patients/:id/conseils/recus`               | parent        | conseils reçus (mobile)                                    |
| `POST /api/patients/:id/conseils/envois/:envoiId/lu` | parent        | « J'ai compris »                                           |

- `modeleId` seul : tel quel ; `modeleId` + `contenu` : modifié ; `contenu` seul : écrit de zéro.
  `contenu = { titre, aFaire: [...], aEviter: [...] }`, au moins une ligne en tout, 10 lignes au
  plus par bloc. `planification = { repetition: "UNE_FOIS" | "HEBDOMADAIRE", date?: "AAAA-MM-JJ" }`.
- Droits par `can()` : action `modifier` (section `conseils`) pour l'orthophoniste du cabinet,
  `lire` et `confirmerLecture` pour le parent relié et consentant. L'orthophoniste ne peut pas
  marquer « lu » à la place de la famille. Refus : **404** ; parent sans consentement : **403
  `consentement_requis`**.

## Reste à faire (hors tâche 8)

- Notification sur le téléphone à l'arrivée d'un conseil (avec l'envoi des notifications).
- Envois hebdomadaires créés par une tâche planifiée chez l'hébergeur HDS (même fonction
  `creerEnvoisDus`) si l'on veut qu'ils existent même sans ouverture de l'écran.
- Copie hors ligne des conseils sur le téléphone (aujourd'hui : message « pas de connexion »).
- Création de modèles propres au cabinet depuis le logiciel (la base le permet déjà).
