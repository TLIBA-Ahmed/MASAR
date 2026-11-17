# Intelligent Browser et retrieval partagé

`AuthorizedRetrievalService` est l'unique service de récupération pour Topbar, Browser et sources contextuelles. Le corpus de recherche n'est construit qu'à partir des lignes autorisées par la politique et RLS. Noms, aperçus, titres, compteurs et références interdits ne sont pas envoyés au matcher ou aux modèles.

La Topbar et la page Browser appellent le même `/search`. Debounce 300 ms, annulation AbortController, regroupement et surlignage français/arabe. La normalisation retire accents, diacritiques et tatweel et harmonise certaines lettres arabes, sans modifier les récits stockés. Aucune génération à chaque frappe et aucun cache partagé de résultat.

La soumission explicite d'une question suit : identité → politique → scope → route contrôlée → preuves → contexte minimal → gateway CPU → validation de sortie/citations → recontrôle des sources et de la session → affichage. Les réponses portent statut, langue, références versionnées, limites et date.

Les calculs utilisent exclusivement des opérations prédéfinies : effectif visible d'un groupe, objectifs à confirmer, évaluations et interventions planifiées. Les requêtes sont paramétrées et exécutées sous RLS. Aucun SQL fourni par un modèle ou par un champ texte.

Les documents utilisent full-text PostgreSQL et, en mode local, une distance cosinus exacte pgvector sur la petite collection autorisée. Le classement hybride associe correspondances textuelles et similarité. Le seuil sémantique conservateur reste expérimental ; une absence de preuve entraîne une abstention. Il n'existe ni index ANN déclaré validé, ni reranker obligatoire.

Au plus quatre passages et un contexte limité sont transmis. Des alias S1–S4 réduisent le coût des identifiants longs ; le backend les rattache aux véritables sources. Qwen reçoit uniquement ces références et une tâche de lecture. La version `grounded-extractive-v2` impose une sélection extractive : la grammaire JSON n'autorise que les couples extrait exact / source fournis. Le fournisseur, la gateway et le service vérifient ce couple ; une citation valide ne suffit pas à rendre un fait inventé acceptable. Les accès sont revérifiés après l'inférence ; une source révoquée fait rejeter toute la réponse.

Cette restriction fait suite à un essai Linux où le modèle 0.6B avait ajouté « entre les pays » à une source qui disait seulement « Communication et coopération ». Le rapport initial est conservé dans `benchmarks/docker-cpu-smoke-initial.json`. Le modèle réalise toujours une inférence CPU, mais ne reformule plus librement les faits. Les descriptions bilingues du catalogue peuvent être sélectionnées dans la langue de l'interface ; les récits libres ne sont jamais traduits automatiquement. La synthèse générative libre reste à évaluer avec un modèle et un protocole de qualité adaptés.

Les documents sont des données, jamais des instructions. Le PoC comprend des filtres d'instructions malveillantes, des limites de contexte et une absence totale d'outils d'écriture dans le Browser. Ces défenses ne constituent pas une preuve générale d'immunité à toute prompt injection ou hallucination. L'interface invite à examiner les sources ; les tests couvrent des attaques synthétiques identifiées.
