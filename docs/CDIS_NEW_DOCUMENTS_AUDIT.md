# Nouveaux documents CDIS — audit d'intégration incrémentale (26/11/2026)

Source : archive « dossier de la prise en charge des enfants — défi 3.zip » (23 fichiers, principalement CDIS de Siliana).

## Règle de migration

Ne pas recréer les formulaires F01 à F15. Conserver leurs identifiants et versions, leurs soumissions précédentes, le moteur de saisie, la pseudonymisation, les politiques RBAC/ABAC et la carte de parcours. Les ajouts F16 à F22 sont des **supports professionnels**, non des diagnostics automatiques. Le plan d'intervention et les décisions restent sous contrôle humain.

| Pièce | Contenu | Décision |
| --- | --- | --- |
| 01 Guide des procédures | Préparation de cycle, prospection, admission, équipes pluridisciplinaires, observation, plan, activités et intégration | **Référence métier** : rapprocher du workflow existant ; pas un nouveau formulaire |
| 02 Schéma des étapes | Organisation locale du CDIS | Référence de comparaison ; conserver les **5 étapes du défi officiel** visibles dans MASAR |
| 03 Convocation et contact | Convocation et liaison | Déjà F03 / F04 |
| 04 Dossier social | Données d'environnement et de famille | Déjà F15 ; contrôler champ par champ |
| 05 Projet éducatif individualisé | Objectifs, interventions et moyens | Déjà F13 |
| 06 Projet individuel de formation | Objectifs et programmes formatifs | Déjà F14 |
| 07 Intervention éducative | Observations et suivi | Déjà F02 |
| 08 Guide de l'entretien | Entretien individuel | Déjà F01 |
| 09 Registre d'activités | Activités de groupe/éducateur | Déjà F06 et séances ; vérifier les feuilles par équipe |
| 10 Fiche de suivi | Entrées éducatives datées | Déjà F05 |
| 11 Dossier pédagogique de l'enfant | Historique éducatif et évaluations | Dossier central, F02/F08/F13 : **vue agrégée**, éviter doublon |
| 12 Projet de vie | Expression des souhaits, acquis, choix d'avenir et avis professionnels | **Nouveau F16**, contenu à vérifier visuellement page par page |
| 13 Feuille de présence | Présences quotidiennes du groupe | Réutiliser le module séances/présences ; impression dédiée à prévoir |
| 14 Tableaux de suivi | Suivi de groupes/activités | Réutiliser les vues de sessions et les exports ; vérifier les colonnes |
| 15 Emploi du temps | Planning des activités | Calendrier existant ; prévoir impression |
| 16 Grille d'observation | Observation longitudinale | **Nouveau F17**, grille éditable |
| 17 Fiche d'évaluation psychologique | Évaluation initiale et synthèse | Déjà F12 |
| 18 Dossier psychologique | Anamnèse, observations cliniques, évaluations et synthèse | **Nouveau F18**, réservé à un professionnel autorisé ; transcription structurée simplifiée et à vérifier |
| 19 Situation psychologique | Dimensions comportementale, affective et relationnelle | **Nouveau F19** |
| 20 Projet individuel psychologique | Objectifs, méthode, durée et obstacles | **Nouveau F20** |
| 21 Programme individuel psychologique | Programmation des interventions | **Nouveau F21** |
| 22 Plan d'accompagnement psychologique et de modification du comportement | ABC, objectifs, observations longitudinales et bilan | **Nouveau F22**, saisie professionnelle et historique ; pas de risque calculé |
| 23 Invitation au concours | Annonce d'événement | Hors du dossier individuel ; **référence**, pas un formulaire enfant |

### Détails métier nouveaux (source 01)

Le guide de Siliana décrit notamment :
- des réunions de préparation après le cycle précédent, des actions de mobilisation/repérage en lien avec les partenaires, et une continuité de recrutement au cours de l'année ;
- un accueil après rendez-vous, un entretien individuel avec la commission, et des décisions humaines pouvant porter sur l'admission, un retour scolaire, une orientation en formation ou une consultation médicale ;
- l'ouverture des dossiers sociaux et psychologiques pour les enfants admis, avec présentation du règlement du centre ;
- une observation pluridisciplinaire dans les ateliers et les entretiens, le regroupement initial et sa révision selon les observations ;
- la construction de projets individuels complémentaires : éducatif, formatif, psychologique et social ;
- le suivi des activités et des évaluations du cycle puis les décisions d'orientation et d'intégration.

Ce découpage local n'impose pas une nouvelle numérotation globale des étapes officielles de MASAR. Des documents complémentaires de cycle, d'accueil et de commission pourront être ajoutés comme événements ou vues, sans imposer un passage obligatoire tant qu'il n'est pas validé pour les autres CDIS.

## Contrôles indispensables avant démo

1. **Autorisation backend** : F18–F22 doivent être catégorisés `psychological` dans le registre PostgreSQL ; la restriction frontend n'est pas une frontière de sécurité.
2. **Identité** : noms uniquement dans le dossier protégé ; les listes, historiques et cartes restent au code enfant.
3. **Provenance** : conserver les documents originaux inchangés et associer chaque modèle à son origine.
4. **Versioning** : les évaluations et projets ne doivent jamais effacer les versions validées.
5. **Validation humaine** : aucune inférence clinique, décision sur le mineur ou scoring comportemental automatique.
6. **Import seed** : exécuter `node scripts/export-seed.mjs` pour générer les 22 définitions de formulaires, puis synchroniser le registre de la base selon la procédure locale. Ne jamais réinitialiser les dossiers réels ou les données non synthétiques.
7. **État réel** : absence de vérification de l'application locale dans cette intervention ; exécuter lint, tests, build et tests backend sur une base isolée.

## À compléter après validation terrain

- Comparaison champ-à-champ des PDF scannés avec F01–F15 et les nouveaux F16–F22 (plusieurs PDF sont des images).
- Confirmation des libellés et tableaux internes du dossier psychologique long F18 ; le modèle actuel reprend les grandes sections, pas toutes les centaines d'options du document.
- Grilles exactes de présence, de programme horaire et de suivi collectif : privilégier une vue métier puis une impression, plutôt qu'un doublon de stockage.
- Répartition des tâches par fonction et droits de lecture réels sur dossiers psychologiques.
- Intégration éventuelle du projet de vie dans les recommandations *uniquement à partir de souhaits exprimés et d'objectifs validés*.

Ce document correspond à une analyse des sources et du dépôt GitHub à une date donnée. Il ne garantit pas que le workspace local VS Code possède le même commit.
