# Architecture technique

Le navigateur contient l’application React et le jeu synthétique. Aucun backend, compte réel ou service externe n’est nécessaire à l’exécution.

La chaîne reste : professionnels → AuthService simulé → SessionContext → AccessPolicyService (RBAC + ABAC) → périmètre autorisé → espace professionnel → dossier central. Les trois modules transversaux utilisent le même état et les mêmes identifiants. `useWorkspace` expose une projection autorisée, tandis que les mutations contrôlées s’exécutent sur le clone canonique du store.

## Modules

- `app/` : routes chargées à la demande, frontière d’erreur et initialisation.
- `features/` : écrans regroupés par fonction métier.
- `components/` : contrôles accessibles, modales, tables, formulaire dynamique et stepper.
- `config/` : identité, cinq étapes, sous-étapes, objectifs et règles configurables.
- `types/` : modèle de domaine TypeScript strict.
- `data/` : quinze définitions de formulaires et générateur de données synthétiques.
- `services/` : autorisation simulée, préremplissage, validation, mutations métier, recherche, recommandations et agrégations.
- `stores/` : état Zustand et orchestration des mutations/persistance.
- `db/` : interface Repository et implémentation IndexedDB.
- `i18n/` : traductions globales et choix RTL/LTR.

Une action métier s’exécute sur un clone de l’état. Si la validation échoue, le clone est abandonné. En cas de réussite, le store change et un snapshot est mis dans la file d’écriture. Les écritures IndexedDB s’exécutent dans l’ordre. L’interface signale les erreurs de stockage et propose une nouvelle tentative ; elle ne prétend pas que l’état est durable lorsque le stockage échoue.

Une seule instance frontend active par navigateur est prévue. Il n’existe pas de synchronisation concurrente entre onglets ni entre professionnels réels. Les collisions multi-onglets et le contrôle de concurrence doivent être traités dans un futur backend.

Les sessions e-Houwiya sont simulées dans `sessionStorage`. Langue et thème utilisent `localStorage`. Le brouillon de création de dossier utilise `localStorage` ; les dossiers et brouillons métier utilisent IndexedDB.

## Frontières futures

`AuthService`, `AccessPolicyService`, `SearchProvider` / `AuthorizedSearchBackend`, `RecommendationContextRegistry`, `CentralRecommendationEngine` et `Repository` sont les points d’extension. Le moteur central reste l’unique orchestrateur ; ses stratégies reçoivent une projection minimale, selon les sources déclarées par contexte. Une API serveur pourra remplacer le stockage local, avec PostgreSQL, politiques d’accès serveur, migrations et contrats de ressources. `pgvector`, embeddings multilingues, recherche hybride et RAG restent des extensions décrites dans [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md).

Les composants utilisent le CSS du projet ; l’ajout de nouvelles fonctions ne nécessite pas une bibliothèque d’administration complète. Le build est statique Vite. Le chargement des pages est séparé pour éviter un bundle initial contenant tous les écrans et Recharts.
