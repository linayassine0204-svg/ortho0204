# Bibliothèque d'exercices

Partie à part du logiciel (`/bibliotheque`), **hors dossier patient**. On y parcourt, crée et gère
les exercices. La même bibliothèque s'affichera dans Préparation (tâche 5) et Programme (tâche 9).

## Un seul composant : `<BibliothequeSelecteur>`

Fichier : `apps/web/components/bibliotheque/BibliothequeSelecteur.tsx`. Mêmes recherche, filtres et
aperçu partout, en deux modes :

```tsx
// Mode complet : la page /bibliotheque (pas de patient, pas de bouton « Ajouter »)
<BibliothequeSelecteur mode="complet" exercices={exercices} categories={categories} onFavori={…} />

// Mode sélection : un panneau dans une autre page
<BibliothequeSelecteur
  mode="selection"
  patient={{ id, prenom, age, pathologies: ["articulation"] }} // filtres pré-réglés
  exercices={exercices}
  categories={categories}
  onAjouter={(exercice, niveau) => { /* ajouter à la séance ou au programme */ }}
/>
```

- La page serveur charge `listerExercices()` (avec vérification des droits) et `listerCategories()`,
  puis passe les données au composant. La recherche et les filtres sont instantanés, dans le navigateur.
- La logique de recherche et de filtres est dans `packages/shared/src/bibliotheque.ts` (fonctions pures).
  **L'API `GET /api/exercices` utilise exactement les mêmes fonctions.**
- Démonstration du mode sélection : `/bibliotheque/demo-selection`, avec un patient fictif qui n'est
  pas en base. **Cette page n'existe pas en production.**

## Recherche et filtres

| Filtre        | Effet                                                                                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recherche     | Chaque mot doit être trouvé, en début de mot, sans tenir compte des accents ni des majuscules. Elle porte sur le titre, la description, la consigne courte, le matériel, la pathologie et les consignes des niveaux. |
| Pathologie    | Catégorie de l'exercice                                                                                                                                                                                              |
| Âge           | L'exercice convient à cet âge (âge min ≤ âge ≤ âge max)                                                                                                                                                              |
| Niveau        | Chaque exercice a ses 3 niveaux, donc **aucun n'est retiré**. La liste et l'aperçu montrent la consigne de ce niveau, et la recherche porte sur elle.                                                                |
| Durée         | Durée maximale                                                                                                                                                                                                       |
| Mes exercices | Exercices créés par le cabinet                                                                                                                                                                                       |
| Favoris       | Favoris de l'orthophoniste connecté                                                                                                                                                                                  |

En mode sélection, les filtres partent de la **première pathologie** et de l'**âge** du patient.
L'orthophoniste peut les changer.

## Aperçu

Visible sans ouvrir l'exercice : image (ou icône de la pathologie), titre, description, consigne
courte, matériel, durée, âge conseillé, et les 3 niveaux (Niv. 1, 2, 3) avec leur consigne. En mode
sélection : on choisit le niveau, puis **Ajouter**.

## Exercices d'exemple : « à valider par un orthophoniste »

Les 21 exercices du seed sont des **exemples rédigés pour tester le logiciel**. Leur contenu médical
n'a **pas** été vérifié. Chacun porte l'étiquette interne `aValider = true`, toujours affichée dans la
liste et dans l'aperçu. Un test vérifie que tous les exemples la portent, et la base refuse cette
étiquette sur un exercice de cabinet.

## Droits (`can()`)

| Exercice                       | Orthophoniste du cabinet  | Autre cabinet | Familles |
| ------------------------------ | ------------------------- | ------------- | -------- |
| Commun (dont les exemples)     | lire                      | lire          | —        |
| Du cabinet (« Mes exercices ») | lire, modifier, supprimer | —             | —        |

Un exercice utilisé dans un programme ne peut pas être supprimé (409). Les favoris sont personnels.
Les familles verront les exercices à travers le programme du patient (tâche 9).

## API

| Route                                                                               | Rôle                                                  |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `GET /api/exercices?q=&pathologie=&age=&niveau=&dureeMax=&mesExercices=1&favoris=1` | liste filtrée                                         |
| `POST /api/exercices`                                                               | créer un exercice du cabinet (3 niveaux obligatoires) |
| `GET`, `PUT`, `DELETE /api/exercices/:id`                                           | lire, modifier, supprimer (exercices du cabinet)      |
| `PUT`, `DELETE /api/exercices/:id/favori`                                           | marquer, retirer un favori                            |
