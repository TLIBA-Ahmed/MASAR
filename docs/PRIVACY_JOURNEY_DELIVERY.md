# Livraison — confidentialité globale et parcours intelligent MASAR

17 novembre 2026. Implémentation intégrée dans l'application existante, en local. Les sources de dossier, les quinze formulaires, les trois espaces principaux, Forum, l'autorisation et la passerelle IA existante sont conservés. Aucun déploiement externe ni nouvelle dépendance n'est ajouté.

## 1. Fichiers créés

Les nouveaux fichiers comprennent le module `backend/privacy`, les trois services de synthèse dans `backend/journey`, les migrations 010–016 et leurs schémas, les tests backend, la rubrique `PersonalInformation`, les composants de carte/synthèses/revue/historique/preuves, le transfert de recherche temporaire, les tests frontend/E2E et la documentation. L'inventaire exact est présenté à la fin de ce rapport.

## 2. Fichiers modifiés

L'API, le seed additif, les services de dossier, groupes, documents, recherche, Browser, Recommandation et indexation sont adaptés. Les composants existants conservent leur architecture et reçoivent les projections pseudonymisées. Le store, les formulaires, l'export, l'impression et les points d'entrée du parcours sont raccordés. `AGENTS.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SECURITY.md`, `AUTHORIZATION_POLICY.md` et `IMPLEMENTATION_STATUS.md` sont mis à jour.

## 3. Migrations de base

| Migration | Effet |
| --- | --- |
| 010 | Code permanent UNIQUE et immuable ; identités et anciens alias protégés ; plusieurs dossiers successifs par enfant ; invalidation des anciens index dérivés |
| 011 | Synthèses dossier/étape/cycle/version, périodes et preuves, revue explicite, historique immuable, FORCE RLS et droits de génération/revue |
| 012 | Stabilité des identifiants techniques pendant le filtrage et protection des anciennes valeurs |
| 013 | Filtrage plus efficace des termes candidats, avec les mêmes règles de confidentialité |
| 014 | Séparation vérifiée des projections publiques d'employés et des identités d'enfants |
| 015 | Valeurs de protocole préservées ; les noms ambigus sont masqués plutôt qu'attribués arbitrairement à un enfant |
| 016 | Protection de formats alternatifs de dates connues et de coordonnées |

La base locale est à **016**. Les **40 enfants, 40 identités protégées, 40 dossiers historiques, 97 versions documentaires, 41 versions de plans et 15 définitions F01–F15** sont présents. Les vérifications d'intégrité ne trouvent aucun original privé dont le SHA256 ait changé. Les codes des nouveaux enfants sont générés par PostgreSQL à partir d'un UUID aléatoire ; les CDIS historiques restent des exemples synthétiques. Une prise en charge successive réutilise le même enfant et code, sans rapprochement automatique par nom.

## 4. Services backend

- `ChildPrivacyService`, `ChildIdentityService`, `ChildPseudonymizationService`, DTO de résumé/identité/parcours et filtre serveur de sortie.
- `StageContextBuilder`, `StageSummaryGenerator`, `JourneySummaryService` : collecte autorisée de l'étape et du cycle, pseudonymisation, contexte borné, inférence locale, références vérifiées, brouillon puis revue.
- Lecture des cartes, historique, preuves et ouverture des sources ; commandes distinctes de génération et de validation/rejet.
- Recontrôle après inférence, rejet des sources ou du contexte devenus invalides, versions append-only et audit sans texte de dossier.
- Recherche instantanée POST, éligibilité avec âge calculé côté serveur, indexation pseudonymisée avant embeddings, exports et impression autorisés à l'instant de l'action.

## 5. Frontend

`IntelligentJourneyMap`, `JourneySummaryCard`, `JourneySummaryHistory`, `JourneySummaryReviewPanel`, `StageEvidenceViewer`, `AuthorizedCaseLink` et `PersonalInformation` sont raccordés aux API. Les cinq cartes racontent les faits documentés, observations, activités réalisées, progrès explicites, objectifs et prochaines actions disponibles ; les étapes futures n'inventent aucun résultat.

Les cartes HTML restent lisibles hors de la perspective Three.js. Les connecteurs suivent la caméra ; les colonnes empêchent le chevauchement, y compris après expansion. Le mode plein écran, l'affichage/masquage, la rotation/zoom, le clavier et la carte interactive 2D fonctionnent. La Tunisie n'est jamais inversée en RTL. Les interfaces, filtres, boutons, dates et statuts sont disponibles en arabe et en français. Les textes narratifs et citations conservent leur langue de saisie.

Les vues générales affichent les codes et des avatars neutres. Seule la rubrique Informations personnelles demande l'identité confidentielle ; son état est temporaire et séparé du store et des exports. L'ancien cache applicatif IndexedDB est invalidé.

## 6. État de l'IA

Le Qwen3 déjà installé a réellement été exécuté via la passerelle CPU privée pour les deux langues, sur **CDIS-024** : méthode **`ai`**, révision **`50968a4468ef4233ed78cd7c3de230dd1d61a56b`**, **13 sources autorisées**. Les brouillons de démonstration restent en attente de validation professionnelle ; aucun test navigateur ne les publie automatiquement comme décision officielle.

La génération locale est extractive : chaque sortie doit correspondre à une option sourcée. Les modes déterministe, démo, modèle indisponible, sortie IA invalide et rédaction manuelle sont identifiés explicitement. Les replis et la révocation pendant l'inférence sont testés. Aucun fallback cloud n'est utilisé.

## 7. Confidentialité et autorisations

L'accès au dossier n'accorde pas l'identité. Les finalités, capacités et scopes d'identité sont séparés. Les résumés et leurs historiques exigent toutes les références encore autorisées, y compris les sources amont. Une révocation empêche leur nouvelle récupération sans dépendre d'un cache ou d'un index.

Les API générales, résultats, citations, recommandations, exports et index sont pseudonymisés côté serveur. Les questions libres ne sont plus placées dans les URLs ; les journaux HTTP les masquent aussi. Les originaux restent privés et immuables ; le circuit général restitue une vue textuelle protégée. Les contraintes et tests utilisent le rôle PostgreSQL applicatif sans superutilisateur ni BYPASSRLS.

## 8. Contrôles exécutés

| Contrôle | Résultat |
| --- | --- |
| `npm run lint` | Réussi, zéro avertissement |
| `npm test` | **56 tests réussis** |
| `npm run build` | Réussi ; avertissement non bloquant sur le chunk Three.js chargé à la demande |
| `pytest backend/tests -q` | **86 tests réussis**, base PostgreSQL isolée |
| `pytest backend/tests/test_privacy.py -q` après migration 016 | **8 tests réussis**, dont formats de dates, RLS, anciens noms, sources, index, exports et logs |
| Parcours Playwright existants | **9 scénarios réussis** : dossier, Forum, recherche, 3D/2D, cycles, orientation, Browser et recommandations CPU |
| Nouveaux parcours Playwright | **3/3 réussis** : absence de chevauchement/RTL/mobile/plein écran, identité isolée, vraie génération Qwen3 et sources |
| Intégrité locale | Dossiers et formulaires conservés ; aucune modification de SHA256 des originaux privés |

Les premiers passages simultanés ont dépassé l'attente de 12 secondes sur deux chargements. Les rafraîchissements sont regroupés, le filtrage HTTP sort de la boucle asynchrone et le filtrage/indexage est optimisé. Les nouveaux tests attendent jusqu'à 30 secondes sous charge ; leur dernière exécution passe intégralement. Mesures ponctuelles à chaud : workspace 2,59 s, parcours 1,14 s, cinq synthèses 2,75 s ; ces observations ne constituent pas un SLA.

Le relevé technique est conservé dans [privacy-journey-validation.json](../benchmarks/privacy-journey-validation.json). Les **46 fichiers de référence** correspondent toujours à leurs empreintes précédentes.

## 9. Limites restantes

- Le filtre couvre les identités connues, leurs anciennes valeurs et des motifs de coordonnées. Il ne certifie pas l'anonymisation de tout identifiant inconnu dans un récit libre.
- Qwen3 sélectionne des extraits vérifiables ; aucune traduction générative libre ni validation clinique autonome n'est ajoutée. Une synthèse française intégralement reformulée peut être rédigée puis validée professionnellement. Les citations originales ne sont pas réécrites.
- Les scans sans couche texte n'ont pas d'OCR ajouté ; leurs originaux ne sont pas transmis par le circuit général.
- La matrice institutionnelle d'identité/revue, une éventuelle double validation et la conservation des données restent à confirmer dans `QUESTIONS_TO_VALIDATE.md`.
- Le workflow avancé des étapes 4/5 reste celui du PoC. Les nouvelles synthèses ne changent jamais une étape, une orientation ou une clôture. Les archives de synthèses sont limitées aux 100 versions les plus récentes par requête d'historique ; toutes les versions restent conservées en base.
- Cette démonstration synthétique locale n'est pas une homologation pour des dossiers réels.

## 10. Prochaine étape recommandée

Faire relire les brouillons de **CDIS-024** et les scénarios de prolongation par les professionnels CDIS, puis confirmer la matrice des droits, les traductions métier et le circuit de validation. Ces décisions humaines précèdent toute extension institutionnelle.

## Inventaire des fichiers

Inventaire calculé contre la sauvegarde des sources réalisée avant cet incrément ; il exclut les caches, builds, poids de modèles, captures et originaux privés.

### Fichiers source/documentation

29 nouveaux fichiers ; 41 fichiers modifiés. Aucun fichier source supprimé.

**Créés**

- `backend/journey/summary_evidence.py`
- `backend/journey/summary_generator.py`
- `backend/journey/summary_service.py`
- `backend/privacy/__init__.py`
- `backend/tests/test_journey_summaries.py`
- `backend/tests/test_privacy.py`
- `database/migrations/versions/010_child_privacy.py`
- `database/migrations/versions/011_journey_summaries.py`
- `database/migrations/versions/012_privacy_projection_hardening.py`
- `database/migrations/versions/013_privacy_projection_performance.py`
- `database/migrations/versions/014_staff_projection_boundary.py`
- `database/migrations/versions/015_privacy_semantic_boundaries.py`
- `database/migrations/versions/016_identity_format_variants.py`
- `database/schema/005_child_privacy.sql`
- `database/schema/006_journey_summaries.sql`
- `docs/PRIVACY_JOURNEY_DELIVERY.md`
- `docs/PRIVACY_JOURNEY_IMPLEMENTATION.md`
- `src/features/cases/PersonalInformation.tsx`
- `src/features/child-journey/AuthorizedCaseLink.tsx`
- `src/features/child-journey/IntelligentJourneyMap.tsx`
- `src/features/child-journey/JourneySummaryCard.tsx`
- `src/features/child-journey/JourneySummaryHistory.tsx`
- `src/features/child-journey/JourneySummaryReviewPanel.tsx`
- `src/features/child-journey/StageEvidenceViewer.tsx`
- `src/features/child-journey/summaries.css`
- `src/features/child-journey/summaryTypes.ts`
- `src/services/searchDraft.ts`
- `tests/e2e/privacy-journey.spec.ts`
- `tests/journey-summary-cards.test.tsx`

**Modifiés**

- `AGENTS.md`
- `backend/api/app.py`
- `backend/browser/__init__.py`
- `backend/case_management/__init__.py`
- `backend/documents/__init__.py`
- `backend/group_management/__init__.py`
- `backend/journey/__init__.py`
- `backend/recommendations/__init__.py`
- `backend/retrieval/__init__.py`
- `backend/seed.py`
- `backend/tests/test_business_and_retrieval.py`
- `backend/workers/indexer.py`
- `docs/API_CONTRACTS.md`
- `docs/ARCHITECTURE.md`
- `docs/AUTHORIZATION_POLICY.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/DATA_MODEL.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/QUESTIONS_TO_VALIDATE.md`
- `docs/SECURITY.md`
- `src/components/layout/Shell.tsx`
- `src/components/search/GlobalSearch.tsx`
- `src/components/tables/CaseTable.tsx`
- `src/components/ui/index.tsx`
- `src/features/assigned-children/AssignedChildren.tsx`
- `src/features/cases/CaseDetail.tsx`
- `src/features/cases/CaseList.tsx`
- `src/features/child-journey/AssignedChildrenJourneyOverview.tsx`
- `src/features/child-journey/ChildJourneyPage.tsx`
- `src/features/child-journey/TunisiaMap3D.tsx`
- `src/features/child-journey/types.ts`
- `src/features/documents/Documents.tsx`
- `src/features/intelligent-browser/Search.tsx`
- `src/features/settings/Settings.tsx`
- `src/hooks/useIntelligentSearch.ts`
- `src/i18n/index.ts`
- `src/services/forms.ts`
- `src/stores/app.ts`
- `src/types/index.ts`
- `tests/e2e/child-journey.spec.ts`
- `tests/intelligence-ui.test.tsx`
