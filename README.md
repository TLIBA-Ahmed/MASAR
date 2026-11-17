# MASAR | مسار

PoC Full Stack local pour les CDIS : **Assigned Children**, **Intelligent Browser**, **Recommandation**, complétés par le **Forum** professionnel et le **Suivi du parcours de l'enfant** sur une carte interactive de la Tunisie. React/TypeScript existant conservé, arabe RTL par défaut et français LTR, cinq étapes visibles, quinze formulaires F01–F15. Données exclusivement synthétiques. Aucun déploiement externe ni intégration e-Houwiya opérationnelle.

PostgreSQL/pgvector fait autorité. FastAPI résout les sessions, affectations, scopes et permissions ; RLS complète l'autorisation métier. Le navigateur conserve les préférences d'interface. L'ancienne base IndexedDB reste préservée et n'est pas un fallback du backend.

## Démarrage sur Windows

Prévoir Node.js 22.12+, Python 3.13/3.14, `uv` et Docker Desktop en mode Linux. Les caches et fichiers temporaires sont placés dans le projet sur D:. Ne pas supprimer de fichiers personnels si C: est plein.

```powershell
npm ci
powershell -ExecutionPolicy Bypass -File scripts/setup-local.ps1
```

Ce script génère les secrets locaux sans les afficher, démarre PostgreSQL, applique les migrations et initialise le dataset sans réinitialiser les données existantes.

Les modèles ont été installés et testés sur cette machine. Pour une nouvelle installation :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-models.ps1
```

Le script vérifie d'abord les tests d'autorisation, télécharge seulement les artefacts publics épinglés puis effectue les essais CPU bilingues. Il ne transmet aucune donnée métier. Pour lancer les services locaux :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1 -AiMode local
```

Ouvrir **http://127.0.0.1:5173/**. Les processus sont masqués ; les journaux et PID lancés sont dans `.tmp/services`. Un service déjà présent sur un port n'est pas arrêté. Les commandes séparées sont dans [DEPLOYMENT.md](docs/DEPLOYMENT.md).

Le port API natif est configurable avec `MASAR_API_PORT` dans `.env` (8000 par défaut), partagé par le proxy Vite et `start-local.ps1`. Sur cette machine, l'instance actualisée utilise 8003 et le frontend conserve 5173.

`-AiMode demo` active un moteur déterministe clairement identifié. `-AiMode local` exige les modèles locaux ; une indisponibilité est signalée, sans relais cloud. Le mode et l'état des modèles sont visibles dans Paramètres.

## Essayer

Choisir **Khaled Jebali / p3** : groupe A et six enfants autorisés. Ouvrir **CDIS-024** pour les objectifs confirmés, le plan et les documents. p2, psychologue, voit les groupes A/B et les documents psychologiques autorisés ; p6, éducateur limité, n'a pas les mêmes scopes ; p5 ne voit que son autre centre. Les identités sont fictives et accessibles uniquement en démonstration.

La Topbar recherche après 300 ms. Le Browser répond à une question explicitement soumise ou à un calcul prédéfini. Recommandation propose uniquement des ressources éligibles liées aux objectifs. Qwen sélectionne des extraits exacts et cités ; la reformulation libre a été restreinte après un ajout factuel observé pendant les essais. **Accepter/adapter conserve un avis ; planifier est une commande humaine séparée dans le dossier.**

Le réseau professionnel est réaffiché sous **Forum / المنتدى** dans le menu principal, à la demande du 16 novembre 2026. Publications générales, commentaires, réactions, favoris personnels et conversations existantes sont conservés en PostgreSQL via des commandes API autorisées. Les échanges restent synthétiques et locaux ; ce module n'utilise pas l'IA. Les fonctions avancées de fin de parcours restent désactivées. Les règles de partage sont des exemples configurables en base, pas une politique officielle.

## Suivi du parcours de l'enfant

Ouvrir **http://127.0.0.1:5173/child-journey** ou le nouvel élément de menu **متابعة مسار الطفل / Suivi du parcours de l'enfant**. Les accès depuis Assigned Children, un groupe affecté, le dossier central, le dashboard et les résultats autorisés du Browser sont raccordés.

La vue collective filtre les seuls dossiers autorisés. Sélectionner un enfant ouvre sa carte 3D avec cinq checkpoints, rotation, zoom, transitions de caméra, sous-étapes, documents, indicateurs documentés, comparaisons qualitatives, cycles et timeline filtrable. Le mode 2D reste interactif et se déclenche automatiquement si WebGL est indisponible. Les contours tunisiens sont locaux ; aucun emplacement d'enfant n'est représenté.

Commencer avec p3 et **CDIS-024**. **CDIS-014** illustre une prolongation historique synthétique avec deux versions conservées du plan. Avec p2, **CDIS-006** montre une orientation historique sans clôture automatique ; les étapes avancées restent identifiées comme futures dans ce PoC. [Fonctionnement et scénarios détaillés](docs/CHILD_JOURNEY.md).

## Vérification

```powershell
npm run lint
npm test
npm run build
powershell -ExecutionPolicy Bypass -File scripts/test-backend.ps1
npm run test:e2e
.venv\Scripts\python.exe -X utf8 scripts/benchmark_cpu.py
.venv\Scripts\python.exe -X utf8 scripts/benchmark_pipelines.py
```

Les tests backend créent une base temporaire séparée et utilisent le compte PostgreSQL restreint. Les tests navigateur utilisent Chrome/Edge local et le port 5174 ; ils exigent l'API et, pour les parcours IA, la gateway CPU. Les références de `document de referrence/` ne sont pas modifiées.

Consulter [l'état réel](docs/IMPLEMENTATION_STATUS.md), [l'architecture](docs/ARCHITECTURE.md), [la politique d'accès](docs/AUTHORIZATION_POLICY.md), [le scénario de démonstration](docs/DEMO_SCENARIO.md) et [les mesures CPU](docs/CPU_BENCHMARK.md). Le PoC n'est pas une homologation pour des dossiers réels. Les anciennes documentations frontend sont archivées dans `docs/history/` ou identifiées comme historiques.
