# Projet : logiciel pour orthophonistes + application mobile

## But
Un logiciel web pour les orthophonistes et une application mobile (iPhone et Android) pour les parents et les patients.
Le logiciel a deux grandes entrées dans le menu : Patients et Bibliothèque.
- Patients : tout part du dossier patient. Fiche, Préparation, Bilans, Programme, Conseils, Messagerie et Suivi sont des sous-parties de la page d’un patient (/patients/[id]/[section]).
- Bibliothèque : une partie à part (/bibliotheque), hors dossier patient, pour parcourir et gérer les exercices.
- La bibliothèque s’affiche aussi dans Préparation et dans Programme (même composant), pour choisir les exercices et construire la séance ou le programme du patient.

## Les acteurs
- Orthophoniste : utilise le logiciel web (un cabinet peut en compter plusieurs).
- Parent : application mobile ; voit le programme, les conseils, la messagerie (si activée) et la progression de son enfant.
- Patient adolescent ou adulte : application mobile ; voit le programme, et la messagerie si elle est activée.
- Enfant de moins de 15 ans : pas de compte propre ; il utilise l’application avec le compte du parent (mode enfant : un exercice à l’écran, gros boutons, étoiles).

## Règles de produit
- Chaque exercice a 3 niveaux (1 à 3) et un aperçu (image, consigne, matériel) visible sans ouvrir la fiche.
- Conseils : des conseils pré-faits sont proposés selon la pathologie et l’âge (règles simples, pas d’IA). L’orthophoniste peut les adapter.
- Messagerie : optionnelle. Un interrupteur par cabinet et par patient. Désactivée, elle disparaît de l’interface et l’API la refuse.
- Pas d’IA dans la version 1.
- Tous les textes visibles sont en français, dans un fichier de traduction (pour pouvoir remplacer « orthophoniste » par « logopédiste »).

## Règles de sécurité (non négociables)
- Aucune vraie donnée de santé en développement : données fictives seulement.
- Aucun service externe ne reçoit de données de santé (pas d’outil d’analyse, pas de journaux contenant des noms ou du contenu de messages).
- Chaque requête vérifie les droits côté serveur. Un parent ne voit que les patients liés à son compte.
- Chaque lecture d’un dossier patient est écrite dans un journal d’accès.
- Hébergement final : prestataire certifié HDS, en France. Ne rien coder qui dépende d’un service non certifié pour stocker des données.
- Les secrets sont dans des variables d’environnement, jamais dans le code.

## Façon de travailler
- TypeScript strict. Des tests pour chaque règle de droits et chaque règle métier.
- Petits commits clairs, un par étape.
- Avant de coder : lire ce fichier et le dossier docs/, puis proposer un plan court.
- Après avoir codé : lancer les tests, le lint et la vérification des types, puis résumer ce qui est fait et ce qui reste.
- Si une règle de ce fichier est en conflit avec la demande, le dire et poser la question.
- Interface : vert #2E7D6B, jaune #E0A33A, bleu nuit #1B2A41 ; textes d’au moins 16 px sur mobile ; contrastes suffisants.
