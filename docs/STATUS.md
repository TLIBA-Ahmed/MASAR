> Historique du prototype frontend. Pour le PoC Full Stack du 16 novembre 2026, consulter [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [ARCHITECTURE.md](ARCHITECTURE.md) et [AUTHORIZATION_POLICY.md](AUTHORIZATION_POLICY.md). Les anciennes descriptions de stockage et permissions navigateur ne décrivent plus le fonctionnement courant.

# État des fonctionnalités

## Réalisé dans le MVP

- Application locale React/TypeScript, navigation modulaire, chargement des pages à la demande et thème clair/sombre.
- Arabe initial, français, dispositions RTL/LTR et polices locales.
- Identités fictives, affectations et filtrage du centre/dossier dans l’interface.
- Dataset déterministe de 40 dossiers, 30 activités, centres, familles, professionnels, évaluations, événements, séances et échanges.
- Dashboard calculé depuis les dossiers et séances, liste interactive et création guidée avec brouillon.
- Dossier 360°, quinze onglets, cinq étapes cliquables, sous-états, timeline et décisions humaines.
- Prolongation en nouveau cycle avec conservation des évaluations et événements ; orientation distincte de la clôture.
- Quinze schémas de formulaires, champs conditionnels, tableaux/grilles, préremplissage, versions et brouillons persistants.
- Aperçu d’impression arabe/français et impression vers PDF par le navigateur.
- Bibliothèque en cartes/liste, filtres, favoris, fiches détaillées et ajout de ressource fictive.
- Recommandations locales déterministes, contraintes, objectifs confirmés, justifications, feedback et acceptation idempotente.
- Programmation de séances, présences, participation et progrès qualitatifs ; projections F05/F06/F13 reliées.
- Recherche globale arabe/française partagée entre Topbar et Intelligent Browser, debounce de 300 ms, treize catégories, suggestions groupées, surlignage, intentions métier conservées et historique cloisonné.
- Politique RBAC + ABAC partagée, restrictions par ressource, projection autorisée des modules et six profils fictifs dont un éducateur à accès limité.
- Moteur central unique, treize contextes configurables, collecte dynamique, références de projet, objectifs confirmés, activités/ressources/échéances sourcées et revues humaines motivées dans le dossier.
- Publications, commentaires, réactions, favoris et messages locaux.
- Calendrier mois/semaine, rendez-vous créables/modifiables, tâches avec état d’achèvement.
- Supervision, profils modifiables et changement de professionnel fictif.
- Agrégats nationaux filtrables, CSV agrégé, export JSON synthétique et remise à zéro confirmée.
- Liens familiaux explicites et demande/confirmation de transfert simulé entre centres.
- Tests métier, de persistance, d’internationalisation et parcours Chrome automatisés.

## Simulations assumées

e-Houwiya, permissions, visa électronique, commission, décisions et transferts institutionnels. Le réseau est local, sans livraison à de vrais interlocuteurs. Les activités sont créées pour la démonstration et restent à valider. Le moteur n’est ni un LLM ni un système entraîné.

## Restant pour aller au-delà du MVP

- Valider la transcription complète, les règles métier et les habilitations documentaires fines.
- Importer les référentiels officiels autorisés et construire un vrai circuit de validation des ressources.
- Authentification et stockage serveur, sécurité, audit, sauvegardes et concurrence.
- Normaliser les groupes, partenaires, familles et plusieurs concepts métier en ressources backend dédiées.
- Ajouter un circuit complet de modification/report/annulation des séances, au-delà de la programmation et de la réalisation actuellement démontrées.
- Développer une véritable collaboration multi-utilisateur et temps réel.
- Créer l’administration des référentiels et un import documentaire maîtrisé.
- Améliorer la recherche sémantique et la prise en compte des préférences, sans interprétation automatisée de données sensibles.
- Audit d’accessibilité formel, tests multi-navigateurs et mesures de performance de production.

Les statuts prévus dans les types ne signifient pas qu’un circuit institutionnel complet de gestion existe. Le périmètre est prioritairement un scénario local fonctionnel de bout en bout, extensible.
