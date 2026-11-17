# Migration du PoC MASAR - 16 novembre 2026

Référence analysée intégralement : `C:/Users/Tliba/Downloads/CDIS_AI_Platform_Blueprint_CPU_Bilingual_POC.pdf`, 15 pages, SHA256 `9c9029ed2a8dba0df78107f03d24cc1f8bf6ef80f646a1c82e55731c8f725b1b`.

## Audit initial

Le workspace contient React 19 / TypeScript strict / Vite, un store Zustand, des services métier, quinze définitions de formulaire, les cinq étapes et un Repository IndexedDB. Aucun backend ni schéma SQL n'existe. L'authentification, les affectations et les politiques d'accès sont simulées dans le navigateur. Recherche et rapprochement des activités sont déterministes ; aucun modèle n'est chargé. Les conversations restent locales. L'acceptation d'une activité programme actuellement une séance : ce comportement est remplacé par un feedback sans effet sur la roadmap.

Le workspace n'est pas un dépôt Git initialisé. Avant modification, les sources, tests, documentation, scripts et assets ont été archivés dans `.tmp/before-fullstack-upgrade-20261116.zip`. Un manifeste SHA256 des références est conservé dans `.tmp/reference-files-before-upgrade.json`. Le répertoire de référence ne sera pas modifié.

Matériel constaté : i5-12500H, 12 cœurs / 16 threads, 15,6 Gio RAM, environ 3 Gio disponibles. D: dispose de plus de 500 Gio libres ; C: d'environ 3 Gio. Docker Desktop a été démarré et son moteur Linux répond. Python 3.14, 3.13 et 3.11 sont disponibles ; FastAPI, SQLAlchemy et les runtimes IA sont installés. Alembic et le pilote PostgreSQL restent à installer dans l'environnement du projet sur D:.

## Incréments et critères de passage

1. Audit, sauvegarde et documentation des écarts.
2. PostgreSQL / pgvector, migrations relationnelles, identifiants stables et initialisation synthétique depuis le catalogue existant. Vérifier intégrité, historiques et immutabilité des versions validées.
3. Sessions serveur, registre des employés et politique centrale RBAC + ABAC + affectations. Tester avec le compte applicatif restreint, y compris RLS, expiration, révocation et réutilisation des connexions. Aucun modèle avant ces tests.
4. Assigned Children et dossier central alimentés par API. Les contrôles du frontend sont uniquement ergonomiques. La base locale historique reste conservée, sans devenir un fallback silencieux du serveur.
5. Documents privés, versions, connaissances, recherche textuelle et outbox transactionnelle idempotente. Révocations synchrones, index dérivés asynchrones.
6. Gateway CPU privée, fournisseurs et registre d'artefacts vérifiés. Tester les modèles réellement disponibles ; `AI_MODE=demo` reste explicitement déterministe, `AI_MODE=local` échoue clairement si un modèle manque. Aucun cloud fallback.
7. Browser en lecture seule : autocomplétion textuelle légère et question explicitement soumise, retrieval structuré / hybride / RAG autorisé et citations validées.
8. Moteur central : templates serveur, éligibilité obligatoire, candidats bornés, pertinence de ressources et explications, feedback indépendant de toute planification officielle.
9. Intégration, tests backend/frontend, parcours bilingues, mesures CPU réelles et documentation de lancement. Déploiement externe exclu.

Les ressources réseau fournies dans le blueprint sont vérifiées auprès de leurs auteurs. Les licences et benchmarks publiés ne remplacent pas des mesures locales. La mémoire disponible impose une concurrence et un chargement conservateurs.

## Clôture de l'intégration locale

Les neuf incréments ont été réalisés dans le workspace existant. L'état courant et les preuves de tests sont dans IMPLEMENTATION_STATUS.md ; les sections d'audit ci-dessus décrivent la situation initiale. Les modèles n'ont été intégrés qu'après les tests de sécurité. Les images Linux ont ensuite été construites et exécutées lorsque l'espace système disponible l'a permis, sans suppression de fichiers utilisateur. Une hallucination factuelle observée a conduit à restreindre Qwen à une sélection extractive vérifiable, documentée dans RAG_ARCHITECTURE.md. Les fonctions reportées restent conservées et identifiées.
