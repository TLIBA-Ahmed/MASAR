# Lancement et opérations locales

Aucun déploiement externe n'a été réalisé. Deux configurations locales ont été exécutées : PostgreSQL/pgvector dans Docker avec services Python/Vite sur Windows, et le profil Docker complet Linux. Les caches, poids et données du projet restent sur D: ; le stockage interne de Docker Desktop conserve son emplacement utilisateur existant.

L'incrément d'accueil géographique ajoute `config/governorates.json` aux images API et frontend. Les deux images ont été reconstruites et leur catalogue/GeoJSON vérifiés dans des conteneurs éphémères sans réseau. Aucun nouveau service en ligne ni déploiement externe n'a été lancé. Appliquer `python -m backend.bootstrap` avant le nouveau frontend (migrations 018–020) ; conserver le registre existant et compléter explicitement le gouvernorat d'un centre inconnu si la migration le refuse.

## Préparer

```powershell
npm ci
powershell -ExecutionPolicy Bypass -File scripts/setup-local.ps1
```

`.env` est privé et ignoré. Ne pas afficher sa valeur ni l'inclure dans un livrable. Le setup crée les secrets, démarre la base, exporte les définitions synthétiques existantes, applique Alembic et initialise sans réinitialisation destructive. `POSTGRES_USER` est réservé aux migrations/opérations. L'API n'utilise que `POSTGRES_APP_PASSWORD`, l'indexer `POSTGRES_WORKER_PASSWORD`.

## Commandes séparées

```powershell
docker compose up -d --wait db
.venv\Scripts\python.exe -m backend.bootstrap
.venv\Scripts\python.exe -m uvicorn backend.api.app:app --host 127.0.0.1 --port 8000 --no-access-log
.venv\Scripts\python.exe -m uvicorn backend.model_gateway.app:app --host 127.0.0.1 --port 8001 --workers 1 --no-access-log
.venv\Scripts\python.exe -m backend.workers.indexer
npm run dev
```

Exécuter API, gateway, worker et Vite dans des terminaux distincts, ou utiliser `scripts/start-local.ps1`. Fermer leurs terminaux arrête les commandes de premier plan. Le script de lancement masqué enregistre les PID et leurs heures de démarrage dans `.tmp/services` ; ne pas arrêter un PID sans vérifier qu'il correspond encore au processus MASAR lancé.

Les commandes séparées ci-dessus montrent le port API par défaut 8000. Si `MASAR_API_PORT` est défini dans `.env`, utiliser cette même valeur dans `uvicorn --port` ; Vite et `start-local.ps1` la lisent automatiquement. L'instance actualisée de cette machine utilise 8003, afin de conserver les services déjà ouverts ; l'interface reste sur 5173. Le profil Docker conserve son port API interne 8000.

Installer/vérifier les modèles : `scripts/install-models.ps1`. Le mode par défaut de `.env.example` est `AI_MODE=demo`, explicitement déterministe. Sur cette machine, `.env` a été réglé sur `local` après les tests. Changer une variable de mode nécessite un redémarrage de l'API/worker. `python -m backend.workers.reembed` reconstruit les vecteurs absents après passage au mode local.

Si la génération de recommandations indique que les modèles locaux sont indisponibles, exécuter `.venv\Scripts\python.exe scripts/status-local.py` : `api.status=ok` ne garantit pas que `cpu_gateway` est disponible. Le 17 novembre 2026, une interface et une API actives avec le service IA arrêté ont reproduit ce cas. Le lancement complet `scripts/start-local.ps1 -AiMode local` démarre aussi la gateway CPU privée sur 8001 et le worker ; lancer seulement Vite et l'API ne les démarre pas. Après rétablissement, relancer explicitement la génération. Un manque d'objectifs confirmés ou de ressources compatibles reste une abstention distincte ; ne pas désactiver les contrôles d'éligibilité pour obtenir des résultats.

## Compose complet testé

```powershell
docker compose --profile fullstack config --quiet
docker compose --profile fullstack build api
docker compose --profile fullstack build worker
docker compose --profile fullstack build frontend
docker compose --profile fullstack build model-gateway
docker compose --profile fullstack up -d
```

Les quatre images ont été construites et les cinq services démarrés sur Docker Desktop Linux. Le bootstrap, une session, le workspace autorisé et l'état des modèles ont été vérifiés via Nginx ; les trois modèles ont aussi exécuté des inférences en français et en arabe dans le conteneur privé. Les résultats sont dans `benchmarks/docker-cpu-smoke.json`. Le build séquentiel évite le problème de snapshots rencontré lors d'un export parallèle sur cet hôte.

Le frontend/Nginx écoute sur `127.0.0.1:5180` (`MASAR_HTTP_PORT` configurable ; 8080 est réservé sur cette machine). L'API, la gateway et le worker n'ont aucun port hôte. Le réseau development permet l'accès loopback PostgreSQL nécessaire au mode natif ; les réseaux data, inference et web sont privés. Le build IA Linux compile llama.cpp CPU b12444 et utilise les poids épinglés montés en lecture seule. Aucun GPU requis. Ne pas exécuter deux stacks d'inférence simultanément sur cette machine limitée en RAM.

Après les essais Docker, les services applicatifs de ce profil peuvent être arrêtés avec `docker compose --profile fullstack stop frontend api worker model-gateway` ; la base et les services Windows restent disponibles. `docker compose stop db` arrête la base sans supprimer son volume. Ne pas utiliser de commande de purge pour arrêter la démonstration.

Pour un environnement cible, retirer l'accès DB de développement, terminer TLS au proxy, prévoir mTLS/identités de service, réseau opérateur, secrets externes et volumes/sauvegardes autorisés. Ces étapes ne sont pas activées comme une fausse configuration de production.

## Vérifier et sauvegarder

`scripts/test-backend.ps1`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`. Les tests E2E ont besoin des services locaux et des modèles pour les parcours local-AI.

```powershell
.venv\Scripts\python.exe scripts/backup_demo.py --restore-test
```

Saisir une phrase de chiffrement d'au moins 16 caractères, conservée séparément. Le fichier chiffré est dans `.local-data/backups`. Le test restaure le dump dans un nom temporaire généré, vérifie effectifs et empreintes puis supprime uniquement cette base de test. Il ne remplace jamais la base de démonstration. La stratégie institutionnelle de rotation, rétention, conservation des clés et restauration complète d'hôte reste à valider.
