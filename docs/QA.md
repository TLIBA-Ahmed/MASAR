> Historique du prototype frontend. Pour le PoC Full Stack du 16 novembre 2026, consulter [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [ARCHITECTURE.md](ARCHITECTURE.md) et [AUTHORIZATION_POLICY.md](AUTHORIZATION_POLICY.md). Les anciennes descriptions de stockage et permissions navigateur ne décrivent plus le fonctionnement courant.

# Vérification

Vérification locale du **16 novembre 2026** : **lint et build réussis, 50 tests métier/composants et 9 parcours Chrome réussis**. Les captures arabe de la recherche globale et des recommandations ont été inspectées. Les parcours contrôlent aussi français LTR, arabe RTL, thème sombre, mobile et impression. Le build conserve des avertissements non bloquants d’annotation Zod et de taille du chunk initial ; aucune erreur de compilation.

Les commandes reproductibles sont `npm run lint`, `npm test`, `npm run test:e2e` et `npm run build`.

Les tests métier vérifient le dataset, les affectations, les familles explicites, l’agrégation sans identifiants, la création par un travailleur social, le préremplissage, les versions historiques, les brouillons, les validations fictives, les décisions motivées, la prolongation et la clôture séparée. Ils contrôlent également les contraintes et le déterminisme des recommandations, l’absence d’utilisation des classifications sensibles, l’idempotence de programmation, les projections F05/F06/F13, les intentions de recherche et la file d’écriture IndexedDB.

Le test de composant internationalisé vérifie une saisie narrative conservée lors du passage de l’arabe RTL au français LTR.

Les tests de la mise à jour RBAC + ABAC vérifient l’identité cohérente, le centre, les affectations, les permissions, les attributs et les politiques portées par les ressources. Un backend espion prouve que les textes interdits ne sont pas transmis à l’index, y compris les événements issus d’un document ou d’un atelier interdit. Les treize catégories de recherche sont couvertes ; les suggestions, extraits, compteurs et historiques restent cloisonnés. Le debounce est vérifié à 299/300 ms après la dernière frappe et le même moteur sert la Topbar et Intelligent Browser.

Les tests du moteur unique couvrent la disponibilité dynamique des contextes, les champs pilotés par le registre y compris un contexte ajouté par configuration, les objectifs confirmés, les stratégies par contexte, les groupes intégralement autorisés et la validation préalable des activités de soutien. Les propositions altérées ou devenues obsolètes sont refusées. Les changements de profil effacent résultats et dialogues ; une révocation de ressource retire aussi un détail ou une revue déjà ouverts. Acceptation, adaptation, refus et report sont motivés et historisés, sans modifier les étapes ni les versions validées. Les données anciennes sont conservées par migration additive.

Les neuf parcours Playwright contrôlent dans Chrome : connexion, données du dashboard, création et versions de documents, bascule de langue en cours de saisie, activité acceptée/réalisée, recherche dans le périmètre, publication locale persistante, agrégats sans nom, prolongation avec conservation, navigation des modules, thèmes et responsive. Les deux parcours ajoutés vérifient la Topbar instantanée et ses sources directes, le changement de périmètre, les contextes métier, la conservation d’une saisie arabe en français, le profil limité, l’adaptation d’une ressource et sa présence persistante dans la timeline du dossier.

Les captures locales et traces d’échec éventuelles se trouvent dans `.tmp/`. Elles ne sont pas incluses dans le build de production. Les tests utilisent un contexte de navigateur distinct ; ils ne modifient pas les dossiers réels de l’utilisateur.

Ces vérifications ne constituent ni une certification de sécurité, ni un audit juridique ou WCAG, ni une validation institutionnelle des règles métier. Les écrans manipulant des données sensibles doivent être revus dans une architecture serveur avant un usage réel.
