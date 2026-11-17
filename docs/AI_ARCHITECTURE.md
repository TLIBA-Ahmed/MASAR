> Historique du prototype frontend. Pour le PoC Full Stack du 16 novembre 2026, consulter [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [ARCHITECTURE.md](ARCHITECTURE.md) et [AUTHORIZATION_POLICY.md](AUTHORIZATION_POLICY.md). Les anciennes descriptions de stockage et permissions navigateur ne décrivent plus le fonctionnement courant.

# Trois composants intelligents transversaux

Mise à jour locale du 16 novembre 2026. Les cinq étapes, le dossier canonique, les quinze formulaires et le réseau professionnel sont conservés. Aucun appel externe ne transporte des dossiers.

## Politique d’accès commune

`AccessPolicyService` (`src/services/accessPolicy.ts`) est partagé par les modules et la projection `useWorkspace`. Le contexte contient `userId`, `professionalRole`, `cdisId`, `assignedCaseIds`, `permissions`, `attributes` et les alias compatibles avec les modules initiaux. Un rôle ne suffit jamais : identité cohérente et active, permission de lecture, centre, affectation réellement présente, attributs et politique de la ressource doivent être compatibles. L’accès administratif au centre demande une permission et un attribut de périmètre explicites.

Les politiques sont configurables dans `src/config/access.ts`. Les ressources peuvent préciser métiers, permissions et conditions d’attributs supplémentaires. Les documents psychologiques et leurs événements sources exigent la permission et l’attribut associés. Un atelier avec un participant inaccessible est exclu en entier. Les tâches et rendez-vous sans dossier sont réservés à leur propriétaire. Voir [ACCESS_POLICY.md](ACCESS_POLICY.md).

**Cette simulation frontend n’est pas une protection pour des données réelles.** Le jeu synthétique reste dans IndexedDB. Une future version doit appliquer la politique sur le serveur, avant de récupérer les ressources, leurs aperçus et leurs compteurs.

## 1. Intelligent Browser — المتصفح الذكي

Un seul `searchProvider` / `LocalSearchProvider` et un seul hook `useIntelligentSearch` servent la Topbar et la page dédiée. Pipeline :

`Requête → AccessPolicyService → périmètre autorisé → documents autorisés → AuthorizedSearchBackend → classement textuel → résultats autorisés → interface`.

Le backend ne reçoit que des `SearchDocument` déjà filtrés, jamais `AppData`. Il couvre dossiers, modèles de formulaires, versions documentaires, observations, évaluations, projets, activités, ateliers, interventions, ressources professionnelles, rendez-vous, tâches et structures partenaires. Les projets et évaluations utilisent les projections du modèle existant ; aucune identité parallèle n’est créée.

La recherche locale combine normalisation Unicode, accents français, ligatures, diacritiques et variantes de lettres arabes, termes multiples et classement par identifiant, titre, contenu, date puis identifiant stable. Le surlignage conserve les caractères originaux et passe par React, sans injection HTML. Chaque résultat ouvre sa source : version documentaire, séance, rendez-vous, ressource, tâche ou événement du dossier.

La frappe lance le moteur après **300 ms** d’inactivité. La fenêtre sous la Topbar regroupe les suggestions par catégorie. Échap ferme la fenêtre, Ctrl/Cmd K active le champ et la flèche bas atteint le premier résultat. Ctrl/Cmd Shift K conserve la palette de navigation initiale. Les changements de requête, de données et d’accès retirent immédiatement les anciens résultats ; les timers précédents sont annulés.

Les cinq intentions métier initiales restent disponibles : absence de F08 validé, évaluations programmées dans le mois, projets non validés, activités réalisées cette semaine, dernières interventions. Leurs calculs utilisent le même périmètre autorisé, sans déduire l’absence d’un document dont la lecture est interdite.

Il n’existe pas de cache global de résultats ou d’index. L’état temporaire du hook est identifié par la clé du contexte d’accès, la révision, la requête et le filtre. L’historique persistant `searchHistories` est isolé par la clé complète : version de politique, utilisateur, métier, centre, affectations, permissions, attributs et dossiers effectivement accessibles. L’ancien historique partagé est conservé dans les données historiques mais n’est plus affiché.

### Extension hybride, embeddings, pgvector et RAG

`AuthorizedSearchBackend` est le contrat d’extension pour un futur backend hybride. Il devra combiner candidats textuels et vecteurs multilingues **après** application des ACL serveur et vérifier à nouveau l’autorisation des sources avant restitution. Les métadonnées d’ACL devront accompagner documents, fragments et vecteurs dans PostgreSQL/pgvector. Aucun passage à un LLM ou à un service d’embeddings ne devra précéder ce filtrage. Le RAG ne pourra citer que des sources récupérées et encore autorisées.

Une future clé de cache devra inclure l’identité, le tenant/centre, les permissions, les attributs, la version des ACL et du corpus. Révocation, changement d’affectation ou modification des ACL devront invalider les entrées. Ces mécanismes serveur, la recherche sémantique, les embeddings et le RAG sont des extensions documentées, pas des fonctionnalités revendiquées par ce MVP.

## 2. Central Recommendation Engine — المحرك المركزي للتوصيات

`CentralRecommendationEngine` est l’unique point d’entrée : `availableContexts`, `generate` et `validateProposal`. Il n’existe pas de moteur par métier ou par module. `RecommendationContextRegistry` reçoit une configuration extensible et applique la politique commune avant de proposer les contextes.

Chaque configuration contient `contextId`, `labelAr`, `labelFr`, `description` bilingue, `icon`, `allowedRoles`, `requiredPermissions`, `attributeConditions`, `requiredInputs`, `optionalInputs`, `authorizedDataSources`, `recommendationStrategy` et `outputSchema`. Les exemples sont définis dans `src/config/recommendationContexts.ts` et restent provisoires.

Les treize contextes couvrent ateliers, projet éducatif, projet de formation, ressources éducatives, intervention sociale, famille, coordination sociale, préparation de l’intégration, ressources professionnelles, soutien préalablement validé, suivi documentaire, échéances et coordination administrative. Leur disponibilité croise métier, attributs et permissions. Le profil p6, du même métier que p3, n’a accès qu’aux ressources éducatives et à un dossier affecté.

Pipeline :

`Profil fictif → politique RBAC + ABAC → contextes disponibles → sélection → collecte dynamique → projection minimale autorisée → stratégie interne → propositions justifiées et sourcées → validation humaine motivée → service métier → store → Repository → dossier central`.

Les champs sont déterminés par la configuration : dossier, groupe actif ou atelier, version existante F13/F14, objectifs confirmés, compétences, durée, matériel, format, effectif et compléments facultatifs. Les contrôles de cible sont pilotés par les champs déclarés, sans dépendre du nom du contexte. Les groupes correspondent aux participants des séances planifiées/en cours, sans inférer une composition à partir de l’historique. Les paramètres structurés filtrent réellement les activités ; les compléments libres sont conservés pour la revue humaine et ne sont pas interprétés comme de nouveaux objectifs. Une sélection de contexte ou de profil remonte une interface neuve. Un contexte non autorisé reste désélectionné et aucun ancien résultat ou dialogue n’est conservé.

La stratégie ne reçoit ni diagnostic, ni classification, ni valeurs narratives d’évaluation. La projection comprend uniquement les objectifs avec auteur et confirmation, l’âge nécessaire à la compatibilité d’activité, les métadonnées de catalogue, les références de projet, les activités déjà réalisées et, selon le contexte, les échéances autorisées. Les sources non déclarées dans `authorizedDataSources` ne sont pas utilisées par la stratégie.

Les activités sont rapprochées des compétences des objectifs confirmés, après contrôle de l’âge, de la durée, du matériel, du format et de l’effectif. Chaque participant d’un groupe doit avoir un objectif confirmé couvert. La répétition documentée réduit la pertinence de la ressource. Les activités de soutien exigent en plus une validation professionnelle préalable simulée. Les ressources sont rapprochées par domaine et compétences ; le projet peut préparer une trame à examiner. Les suivis administratifs reposent sur les documents, tâches et rendez-vous existants, sans inventer des obligations institutionnelles.

Le pourcentage décrit la correspondance **ressource/objectifs**, jamais un score d’enfant. Le moteur ne produit aucun diagnostic, classement de dangerosité, classification sociale ou judiciaire, décision d’orientation ou clôture. Le contexte d’intégration propose une préparation de réunion et des sources, sans créer d’orientation.

### Revue humaine et dossier central

Les actions accepter, adapter, refuser et reporter exigent un motif et enregistrent auteur, date, contexte, sources et choix. Les propositions sont régénérées et comparées avant écriture ; changement de profil, retrait d’accès, objectif révoqué ou proposition altérée bloque l’opération. Une activité acceptée passe par `scheduleRecommendation`, conserve les conditions de supervision et de participation et crée une seule séance. Une ressource ou une trame retenue passe par `reviewRecommendation` et ajoute un événement `recommendation` au dossier. Cet événement distinct évite de comptabiliser une simple revue comme une intervention réalisée.

Les versions validées F13/F14 ne sont pas modifiées par une recommandation. Le parcours, les décisions de commission et les prolongations restent humains et indépendants. Les liens contextuels de la bibliothèque, des ateliers, des projets, des interventions et de l’intégration passent tous par le même moteur et ne présélectionnent qu’un contexte autorisé.

## 3. Forum — المنتدى

Le réseau professionnel est réactivé sous le nom Forum à la demande du 16 novembre 2026. Publications générales, commentaires, réactions, favoris personnels et conversations locales sont conservés en PostgreSQL via l'API autorisée. Les finalités `forum.read` et `forum.write`, les rôles, centres et affectations actives sont contrôlés côté serveur, avec RLS forcée sous le rôle applicatif restreint. Les interlocuteurs sont fictifs ; aucun message n’est envoyé à un tiers. Ce module n’est pas une messagerie temps réel et n’utilise pas de modèle IA. Les conversations sont limitées à leurs membres ; leurs membres et auteurs ne sont jamais choisis par le navigateur.

La bibliothèque reste une source du moteur central, pas un quatrième composant intelligent.
