# MASAR | مسار

Plateforme locale de démonstration pour le suivi des parcours de prise en charge au sein des CDIS. Arabe RTL par défaut, français LTR. **Prototype — Social Tech Challenge. Données exclusivement synthétiques.**

Le scénario central fonctionne : ouvrir un dossier → renseigner les formulaires → confirmer des objectifs éducatifs → comprendre une recommandation → programmer une activité → renseigner sa réalisation → retrouver les observations dans le dossier et les projections F05/F06.

## Lancer

Node.js **22.12+** ou 24 LTS, npm, navigateur moderne.

```bash
npm install
npm run dev
```

Ouvrir **http://127.0.0.1:5173/**. Choisir une identité fictive puis « الدخول عبر الهوية الرقمية ». Aucun identifiant, mot de passe ou code e-Houwiya réel n’est demandé. L’espace initial est le CDIS de Siliana.

Les scripts placent automatiquement les fichiers temporaires dans `.tmp/` et le cache npm dans `.cache/npm/`, dans le projet. Ce choix permet notamment de travailler lorsque le disque système Windows est plein. Aucun nettoyage de fichiers personnels n’est effectué.

```bash
npm run lint
npm test
npm run build
npm run preview
npm run test:e2e
npm run format
```

Les tests navigateur utilisent Chrome ou Edge déjà installé sous Windows. Sur une autre machine, `npx playwright install chromium`, ou définir `MASAR_BROWSER_PATH` avec le chemin d’un navigateur Chromium existant. Les tests démarrent un serveur isolé sur le port **5174** et enregistrent leurs captures dans `.tmp/`. Le build statique est dans `dist/` ; aucun déploiement n’est effectué.

## Parcourir la démonstration

Le dossier principal **CDIS-024 — Adam Ben Salem / آدم بن سالم** contient un parcours antérieur fictif, des évaluations distinctes et des objectifs confirmés. La date de référence du jeu de démonstration est **le 15 novembre 2026**, configurable dans `src/config/brand.ts`. Les horodatages des nouvelles actions utilisent l’heure réelle ; les dates métier sont choisies dans les formulaires.

Le dataset comprend **40 dossiers**, dont **32 dans le périmètre de Siliana**, trois centres de démonstration, six professionnels fictifs, **30 activités**, cinq ressources professionnelles et deux structures partenaires fictives. Le profil d’éducateur à accès limité illustre un accès différent au sein d’un même métier. Les deux autres centres servent à illustrer les agrégats et le cloisonnement simulé ; ils ne constituent pas une liste officielle des CDIS.

- **Dossiers** : recherche, filtres, tri, pagination, création guidée, identité centrale, lien familial explicite, quinze onglets, étapes et sous-étapes, décisions et timeline.
- **Formulaires F01–F15** : moteur partagé, sections, champs conditionnels, grilles, lignes répétables, préremplissage, brouillons automatiques, versions conservées, validation simulée, aperçu et impression vers PDF.
- **Bibliothèque et recommandations** : moteur central unique, treize contextes configurables selon rôle/permissions/attributs, formulaires dynamiques, objectifs confirmés, sources, contraintes matérielles, trames consultatives et décisions humaines motivées inscrites au dossier.
- **Séances** : acceptation sans doublon, programmation, participants, présence, participation et progrès qualitatifs. Les données alimentent le calendrier, le dossier et les nouvelles projections F05/F06/F13 ; les documents historiques restent intacts.
- **Intelligent Browser et Topbar** : même recherche globale arabe/française sur treize catégories, frappe automatique après 300 ms, suggestions groupées, surlignage, cinq intentions métier conservées, accès direct aux sources et historique isolé par contexte d’accès.
- **Réseau professionnel** : publications, commentaires, réactions, favoris et messages enregistrés localement, avec interlocuteurs fictifs.
- **Pilotage** : indicateurs calculés, calendrier mensuel et hebdomadaire, tâches, supervision, profils, agrégats nationaux filtrables et export CSV.
- **Préférences** : arabe/français instantané, thèmes clair/sombre, menu rétractable, palette `Ctrl+K`, export JSON synthétique, réinitialisation confirmée et simulation de transfert entre centres.

## Ce qui est simulé

L’authentification, les accès, la supervision, les signatures, les décisions institutionnelles, le réseau, les interlocuteurs et les transferts sont des simulations. La recherche et les recommandations sont **réellement exécutées localement**, avec des règles déterministes ; aucun LLM, embedding, entraînement, RAG ou service externe n’est intégré.

Les activités **ne proviennent pas du Kit ADO**. Les logos officiels ne sont pas reproduits ; le signe MASAR est original et le logo institutionnel reste configurable. La palette du brief est provisoire : le site ministériel n’a pas pu être consulté. Les photographies originales dans `document de referrence/` restent inchangées et ne sont pas incluses dans le build.

## Limites à respecter

Ne saisir aucune donnée réelle. IndexedDB et les permissions côté navigateur ne conviennent pas aux dossiers réels de mineurs. Aucun appel réseau applicatif ne transmet les dossiers ; les polices sont fournies localement. La messagerie n’est ni une messagerie sécurisée de production ni un service temps réel.

L’impression utilise la boîte de dialogue du navigateur : choisir **Enregistrer au format PDF**. Aucun fichier PDF n’est généré automatiquement par un serveur. Les notes narratives restent dans leur langue d’origine. Les libellés de l’interface et du catalogue de démonstration sont bilingues.

Les échéances d’un mois et de six mois sont des paramètres du scénario, sans portée juridique. Les transitions ne vérifient pas une durée légale et ne remplacent aucune commission. Les conditions institutionnelles de validation et les exceptions sont à confirmer.

## Architecture et documentation

React 19, TypeScript strict, Vite, React Router, Zustand, i18next, IndexedDB via `idb`, Zod, Radix Dialog, Lucide, Recharts, Vitest et Playwright. CSS à tokens et composants réutilisables ; aucune dépendance Tailwind ou shadcn inutile n’est ajoutée.

| Document                                               | Contenu                              |
| ------------------------------------------------------ | ------------------------------------ |
| [ARCHITECTURE](docs/ARCHITECTURE.md)                   | Modules, services et stockage        |
| [WORKFLOW](docs/WORKFLOW.md)                           | Étapes, décisions et prolongations   |
| [FORM_CATALOG](docs/FORM_CATALOG.md)                   | Les quinze formulaires et références |
| [DATA_MODEL](docs/DATA_MODEL.md)                       | Entités et projections partagées     |
| [AI_ARCHITECTURE](docs/AI_ARCHITECTURE.md)             | Les trois composants intelligents    |
| [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md)                 | Tokens, RTL/LTR et polices           |
| [SECURITY](docs/SECURITY.md)                           | Limites et prérequis de production   |
| [DEMO_SCENARIO](docs/DEMO_SCENARIO.md)                 | Démonstration pour le jury           |
| [QUESTIONS_TO_VALIDATE](docs/QUESTIONS_TO_VALIDATE.md) | Incertitudes métier et transcription |
| [STATUS](docs/STATUS.md)                               | Implémenté, simulé et restant        |
| [ROADMAP](docs/ROADMAP.md)                             | Évolutions proposées                 |

Les règles permanentes de contribution figurent dans [AGENTS.md](AGENTS.md).
