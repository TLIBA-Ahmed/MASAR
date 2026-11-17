# Suivi du parcours de l'enfant — متابعة مسار الطفل

Le module est une couche de lecture du dossier central, accessible par `/child-journey` et `/child-journey/:caseId`. Il complète les trois espaces principaux et conserve le kanban historique `/journey`. Aucun nouveau moteur IA, stockage métier parallèle ou service cartographique externe n'est ajouté.

## Données et contrôles d'accès

`backend/journey` lit les dossiers, leurs clés de sous-étapes existantes, les contributions, documents et versions, objectifs, plans versionnés, interventions, séances, présences, affectations, tâches et rendez-vous. Les règles RBAC/ABAC, centres, affectations actives, scopes et confidentialité sont celles de `AuthorizationService` et de PostgreSQL RLS, sous le rôle applicatif restreint. Les finalités contrôlées existantes `case.read` et `forms.read` sont réutilisées.

| Route GET, sous `/api/v1`                      | Projection                                                                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `/journeys/assigned?q=&group_id=`              | Dossiers minimaux autorisés, groupes actifs et cinq compteurs issus de la même liste                                                      |
| `/cases/{id}/journey`                          | Cinq checkpoints minimaux, métriques documentées, objectifs, échéances, comparaisons qualitatives, versions, cycles et timeline autorisée |
| `/cases/{id}/journey/stages/{1..5}`            | Nouveau contrôle d'accès ; sous-étapes, documents, formulaires, contributeurs, événements et résultats enregistrés                        |
| `/cases/{id}/journey/documents/{version}/open` | Recontrôle du dossier, de la version et de sa confidentialité ; retourne un chemin interne autorisé                                       |

Les réponses n'incluent ni adresse, coordonnées de l'enfant, téléphone ni données familiales. Les documents confidentiels exclus n'alimentent ni liste, ni compteur, ni comparaison. Les contrôles d'ouverture sont indépendants des index et caches. Les audits contiennent uniquement action, identifiants et numéro d'étape, sans narration.

Le store reste une projection API. Le hook du module annule les requêtes obsolètes, masque les données d'une ancienne session ou d'un ancien périmètre, se renouvelle après une mutation autorisée et interroge l'API toutes les cinq secondes lorsque l'onglet est visible. La recherche locale ne porte que sur la liste minimale déjà autorisée.

## Carte 3D et alternative 2D

Trois polygones Natural Earth du domaine public, soit 186 sommets, sont conservés localement avec provenance et empreinte. Three.js crée une véritable géométrie extrudée avec faces, profondeur, éclairage, ombres, chemin, cinq balises et retour 4 → 3 lorsqu'une prolongation est documentée. Le relief est symbolique et ne fournit pas des altitudes mesurées. Les points symboliques sont fixes pour tous les enfants ; seules les informations autorisées du parcours personnalisent leur état.

WebGL est chargé à la demande, plafonne le ratio de pixels à 1,5 et ne tourne pas en boucle à l'arrêt. Les transitions de caméra sont bornées et la préférence de réduction des animations est respectée. Géométries, matériaux, contrôles et contexte sont libérés au démontage. L'accélération du navigateur n'affecte pas la politique CPU-only des modèles IA.

Le mode SVG 2D utilise les mêmes frontières et checkpoints, avec zoom, clics, focus clavier, tooltips et panneaux. Il est sélectionnable et s'active automatiquement si WebGL échoue ou si le contexte est perdu. Le repère reste indépendant du RTL : ni silhouette ni points ne sont inversés. Le passage français/arabe conserve dossier, étape, filtres et textes narratifs.

## Sens des indicateurs

Les couleurs sont complétées par des textes et icônes. L'étape officielle vient du dossier ; la sélection ne constitue aucune mutation. Le pourcentage représente uniquement les sous-étapes documentées visibles dans le périmètre autorisé. Une activité planifiée n'est pas comptée comme réalisée. Présences et absences proviennent des séances réalisées. Un objectif confirmé n'est jamais assimilé à un objectif atteint : faute de statut professionnel explicite, l'indicateur affiche « Non documenté ».

Les comparaisons affichent les observations qualitatives des versions autorisées, avec formulaire, date et version. Les phases initiale, intermédiaire ou finale ne sont nommées que si elles sont enregistrées explicitement. Aucune échelle incompatible n'est fusionnée et aucun score global de l'enfant n'est créé. Les dates d'entrée/sortie inconnues restent « Non documenté ».

Les étapes 4 et 5 restent identifiées comme futures pour le workflow avancé du PoC ; les éléments historiques autorisés sont lisibles. Les durées indicatives viennent toujours de `workflowRules`, sans nouvelle durée institutionnelle imposée.

## Démonstration synthétique

Avec p3, ouvrir **CDIS-024** pour le scénario principal et ses versions F08 autorisées. Le sélecteur donne accès aux autres dossiers affectés et aux états historiques avancés. p2 dispose de catégories différentes ; p6 conserve ses scopes réels de démonstration, dont certaines lectures de roadmap ; p5 reste dans son autre centre.

**CDIS-014** illustre un deuxième cycle. Le bootstrap ajoute une évaluation historique synthétique, une décision de commission fictive et motivée de retour 4 → 3, puis une deuxième version du plan sans modifier la première. La préparation est idempotente et s'abstient si le plan a déjà été modifié ou prolongé. Elle ne rend pas opérationnel le workflow avancé et ne décide aucune orientation ni clôture.

Les orientations du jeu synthétique d'origine sont conservées comme événements historiques dans les tables métier existantes, avec identifiants, auteurs, dates, narrations et résultats d'origine. Cette reprise idempotente ne change ni étape ni statut d'un dossier. **CDIS-006** reste ainsi actif après son orientation documentée.

| Exemple                                        | Profil de démonstration | Dossier  |
| ---------------------------------------------- | ----------------------- | -------- |
| Enregistrement récent                          | p3                      | CDIS-011 |
| Observation                                    | p1                      | CDIS-002 |
| Réhabilitation, scénario principal             | p3                      | CDIS-024 |
| Évaluation historique, workflow futur          | p3                      | CDIS-025 |
| Orientation historique et suivi, dossier actif | p2                      | CDIS-006 |
| Deuxième cycle de réhabilitation               | p3                      | CDIS-014 |

Les durées officielles, la qualification des objectifs atteints, les échelles comparables et la gouvernance des prolongations restent à valider dans `QUESTIONS_TO_VALIDATE.md`.
