# Pseudonymisation et synthèses du parcours — 17 novembre 2026

## Audit et plan fondés sur l'existant

Stack conservée : React 19, TypeScript strict, FastAPI, PostgreSQL avec FORCE RLS et rôles `masar_app` / `masar_indexer`, passerelle CPU privée, Three.js avec géométrie locale Natural Earth. Pas de nouvelle application, dépendance graphique, base métier ou moteur IA. Les quinze formulaires, les trois espaces principaux, Forum et les routes de la carte sont conservés.

L'audit a identifié les noms dans `children.payload`, les profils, les formulaires historiques, les projections workspace/rosters, le corpus et les originaux indexés. `cases.child_id UNIQUE` empêchait les accompagnements successifs. Les modifications d'identité étaient couplées aux formulaires et à `general.write`. La roadmap existante exposait des étapes autorisées mais aucune synthèse persistante.

Plan suivi :

1. Migration additive de l'identité et génération de codes permanents.
2. Projections API, autorisations d'identité distinctes, protection des interfaces et des flux de recherche/indexation/IA.
3. Synthèses dérivées par étape et cycle, versions immuables, preuve des sources et revue explicite.
4. Cartes HTML lisibles reliées aux points Three.js, panneaux, sources, historique, plein écran et alternative 2D.
5. Tests PostgreSQL, API, IA et navigateur ; documentation de l'implémentation réelle et de ses limites.

## Identités et DTO

`children.id` est technique. `children.child_code` est permanent, unique et protégé par trigger. Les références CDIS historiques restent des exemples synthétiques ; les créations serveur utilisent `CH-` suivi de 24 caractères hexadécimaux issus d'un UUID aléatoire généré par PostgreSQL. Aucun renseignement de l'enfant ou du centre n'intervient dans le calcul. `cases.id` identifie l'accompagnement, `cycle_id` sa période de réhabilitation. Une nouvelle prise en charge peut réutiliser le même enfant après fermeture de l'ancienne, avec contrôle de portée et autorisation de création.

`child_identities` isole prénom/nom structurés, naissance et informations personnelles. Les noms composés historiques sont conservés intégralement dans `personal_information.name` ; aucune séparation arbitraire n'est inventée. Les anciens noms et valeurs d'identification sont conservés dans `child_identity_aliases` pour protéger aussi les récits historiques après un changement d'identité.

`ChildSummaryDTO` est la représentation pseudonyme ; le workspace conserve des champs de compatibilité vides et `name={ar:child_code,fr:child_code}` pour les composants existants. Il ne contient aucune identité directe. `ChildIdentityDTO` est réservé à la rubrique Informations personnelles ; `ChildJourneyDTO` représente le parcours sans identité directe. Le navigateur conserve les identités uniquement dans l'état temporaire de cette rubrique, effacé à la fermeture/changement de session ou au masquage de l'onglet. L'ancien cache applicatif IndexedDB est invalidé au démarrage ; il ne fait jamais autorité.

## Filtrage et sources

Le filtre PostgreSQL `privacy.project` assemble son dictionnaire dans une fonction definer ; aucun dictionnaire d'identités n'est accordé au rôle applicatif ou à l'indexeur. Il remplace les références aux enfants autorisés par leur code, les références hors périmètre et les coordonnées par un marqueur neutre. Les identifiants techniques et chemins produits par le serveur restent stables. Les projections d'employés sont reconnues uniquement par comparaison avec le registre serveur ; un objet arbitraire portant un rôle ne contourne pas le filtre. Les récits originaux, documents validés et empreintes ne sont pas réécrits.

La recherche filtre avant comparaison ; une requête contenant un nom connu ne recherche pas les enfants par leur nom. Les saisies utilisent POST et un transfert temporaire en mémoire entre la recherche globale et Browser, sans URL ni `history.state`. Les anciens liens `?q=` ne reprennent que des codes de dossier/enfant valides et sont nettoyés. Les journaux HTTP masquent les URLs libres. Browser et Recommandation filtrent avant les embeddings, System One et Qwen3. L'âge nécessaire à l'éligibilité est calculé côté serveur par une fonction à finalité limitée, sans communiquer la naissance au modèle ou à la projection générale. L'indexeur pseudonymise avant tout embedding. La migration invalide les anciens embeddings et remet l'outbox documentaire en attente de réindexation.

Le point d'accès historique `/document-versions/{id}/original` restitue désormais une **vue textuelle pseudonymisée** du document autorisé, pas ses octets privés potentiellement identifiants. Les originaux et SHA sont conservés. Les valeurs d'identification des formulaires généraux sont remplacées et ne mettent plus à jour l'identité canonique.

## Synthèses et modèle local

`StageContextBuilder` réutilise la collecte et la projection de `backend/journey`. Les références sont limitées aux sources autorisées de l'étape ; les étapes d'admission restent au cycle initial, les étapes ultérieures distinguent les prolongations. Les résultats proviennent uniquement de champs de résultats ou progrès effectivement renseignés ; planification, confirmation d'un objectif et réalisation sont distinctes.

Les aperçus déterministes ne sont pas des synthèses approuvées et ne créent aucune version à la simple lecture. Les informations actualisées proposent un contenu récent ; une commande explicite enregistre sa nouvelle version. Une ancienne synthèse approuvée reste affichée avec un indicateur de données plus récentes jusqu'à la revue suivante.

La commande de génération libère la transaction avant l'inférence puis recontrôle session, portée, références, cycle et empreinte avant l'insertion. Le Qwen3 existant effectue une sélection extractive bornée de preuves, pour chaque langue, via la passerelle locale. La réponse doit correspondre exactement à une option sourcée. Les méthodes sont `ai`, `deterministic_demo`, `deterministic_unavailable`, `deterministic_invalid_output`, `deterministic` ou `manual`. Aucune inférence cloud n'est introduite. Les textes narratifs dans leur langue de saisie restent des citations ; aucune traduction générative libre ni diagnostic n'est présenté comme un fait.

`journey_stage_summaries` conserve texte bilingue, sections, période, références et empreintes, mode/modèle, auteur, version, cycle et revue. Les versions sont append-only ; seule la transition unique du brouillon vers approuvé/rejeté modifie les colonnes de revue. Une approbation exige un motif, des sources encore autorisées et un contexte inchangé. Elle ne modifie ni stade officiel, ni projet, ni planification, ni clôture.

## Carte et accès

Les cartes restent dans des colonnes HTML distinctes de la perspective Three.js. Leur flux empêche le chevauchement même après expansion ; les courbes SVG suivent la projection des checkpoints à chaque mouvement de caméra et redimensionnement. Sur les petites largeurs, elles passent sous la carte. La silhouette garde une direction LTR indépendante du texte RTL. Le plein écran et l'affichage/masquage des synthèses conservent la sélection. Sources et détails quittent le plein écran natif avant d'ouvrir leurs dialogues accessibles. Le fallback 2D conserve les interactions, les sources et les cartes.

## Limites explicites

- Démonstration locale synthétique : pas de certification juridique, clinique ou de protection de dossiers réels.
- Le filtre déterministe couvre les identités connues, leurs anciens alias et des motifs de coordonnées. Il ne constitue pas un anonymiseur universel de tout identifiant inconnu dans un récit libre ou dans un scan sans texte. Un PDF sans couche texte produit une vue sans contenu exploitable ; l'original n'est pas envoyé au navigateur ni à un modèle.
- Les autorisations institutionnelles initiales d'identité et de revue sont configurées en base et restent à confirmer. Le bootstrap ne rétablit pas les scopes révoqués.
- Qwen3 reste extractif et soumis à revue ; une sélection n'est pas une validation sémantique autonome. La rédaction manuelle reste sous responsabilité du professionnel et exige aussi une revue.
- Le workflow avancé des étapes 4/5 et les décisions de prolongation restent ceux du PoC existant ; aucune commande nouvelle n'automatise ces décisions.
- Les versions historiques dont une source n'est plus autorisée sont entièrement cachées, y compris leurs compteurs. La révocation empêche immédiatement toute nouvelle requête ; les projections déjà rendues sont retirées lors de la revalidation périodique et des changements de session/portée.

Les résultats définitifs et l'inventaire figurent dans `IMPLEMENTATION_STATUS.md`, `PRIVACY_JOURNEY_DELIVERY.md` et `benchmarks/privacy-journey-validation.json`.
