# Sécurité et limites responsables

Ce projet est une démonstration locale à données synthétiques. **Il ne doit recevoir aucune donnée réelle de mineur.**

L’application n’intègre aucun SDK d’analytics, appel à un LLM externe, authentification gouvernementale, mot de passe ou secret. Les polices et visuels sont locaux. Le serveur de développement écoute `127.0.0.1`. Le bundle de production ne contient pas les photographies du dossier de référence.

`AccessPolicyService` centralise le contrôle RBAC + ABAC simulé. `authorizedCases`, `requireCase`, les projections des modules, la recherche et les recommandations réutilisent cette politique. Le rôle seul ne donne jamais accès à un dossier : centre, affectations, permissions, attributs et caractéristiques des ressources sont croisés. Un utilisateur ayant accès au navigateur peut modifier le JavaScript et la base locale : ces contrôles **ne sont pas une sécurité de production**. La totalité du jeu synthétique existe dans le navigateur pour alimenter les agrégats autorisés. Les profils, validations et décisions simulés n’ont aucune valeur officielle.

La recherche construit son index temporaire après filtrage et n’envoie aucun dossier à un fournisseur externe. Suggestions, extraits et compteurs restent dans le périmètre. L’historique de recherche est cloisonné par contexte d’accès. Le moteur central vérifie le contexte et les sources avant génération et revalide une proposition avant décision humaine. Une révocation retire immédiatement résultats et dialogues. Les détails des politiques sont documentés dans [ACCESS_POLICY.md](ACCESS_POLICY.md).

Le texte est rendu par React sans injection de HTML fourni par l’utilisateur. Aucun téléversement documentaire ou import JSON arbitraire n’est proposé. Les identifiants nationaux des modèles sont remplacés par des champs explicitement fictifs `DEMO-`. Les profils utilisent des adresses en `.test`. Les données de classification manuelle ne sont pas utilisées par les recommandations.

## Avant tout usage réel

- Accords institutionnels, évaluation juridique et protection des données applicables, rôles et responsabilités formalisés.
- Authentification officielle et sessions serveur, expiration, révocation et gestion des incidents.
- Autorisation serveur par centre, dossier, profession et type de document ; filtrage avant recherche et export.
- Cloisonnement des données et contrôle d’accès à toute ressource stockée, y compris les fichiers et les index.
- Chiffrement en transit et au repos, gestion des clés, sauvegardes, restauration et secrets hors du code.
- Journal d’audit fiable, contrôle de concurrence, versions serveur, traçabilité des lectures et décisions.
- Politique de conservation, purge, archivage, rectification, minimisation et gestion des transferts.
- Audit de sécurité, tests d’intrusion, revue d’accessibilité et validation métier avec les professionnels.
- Agrégats protégés contre la réidentification : suppression ou regroupement des faibles effectifs.

Les exigences juridiques précises et leur validation relèvent d’une phase de cadrage compétente ; ce document ne les invente pas. IndexedDB, le JSON exporté et les permissions simulées ne doivent pas être réutilisés tels quels pour des dossiers réels.
