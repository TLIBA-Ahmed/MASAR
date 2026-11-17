# Socle relationnel PostgreSQL

PostgreSQL 18 avec extensions `vector` et `unaccent`. Les migrations Alembic sont dans `database/migrations/versions`, le socle SQL dans `database/schema`. La version courante est donnée par `alembic_version`, pas par un snapshot navigateur.

| Domaine | Tables principales |
| --- | --- |
| Organisation | centres, employees, roles, employee_roles, employee_centres, role_permissions, sessions |
| Identité et dossiers | children (child_code UNIQUE immuable), child_identities, child_identity_aliases, cases, case_profiles, families, case_family_links, case_status_history, case_transfers |
| Groupes | child_groups, child_group_memberships, group_assignments, group_assignment_scopes |
| Affectations individuelles | case_assignments, assignment_scopes, record_grants |
| Contributions | observations, initial_assessments, assessment_items, professional_notes |
| Plan | roadmaps, roadmap_versions, roadmap_objectives, planned_interventions, intervention_events |
| Synthèses dérivées | journey_stage_summaries (dossier/étape/cycle/version UNIQUE, sources, modes, revue et périodes) |
| Formulaires et fichiers | form_definitions, documents, document_versions, protected_originals |
| Connaissances | institutional_sources, knowledge_items, document_chunks, interventions, partner_structures |
| Activités | activity_sessions, session_participants, appointments, tasks |
| Recommandation | recommendation_templates, template_roles, recommendation_runs, recommendation_candidates, recommendation_feedback |
| Gouvernance | audit_events, access_review_events, outbox_events, model_versions, prompt_versions |

L'enfant possède une identité canonique, distincte du dossier opérationnel. Les informations sociales et éducatives sont dans des enregistrements catégorisés. L'API ne renvoie pas un dossier complet pour le cacher ensuite en CSS.

Les familles et liens explicites de l'ancien dataset sont conservés, y compris leurs récits. Un lien familial n'accorde pas les dossiers des autres membres. Le partage de la fiche familiale exige l'accès social à tous les dossiers qui y sont explicitement reliés ; sinon ses détails restent masqués.

Les quinze définitions F01–F15 et les identifiants historiques sont importés depuis l'existant par `scripts/export-seed.mjs`. Les 40 dossiers ne sont pas renumérotés. Les créations ultérieures utilisent une séquence PostgreSQL. Le seed est additif et ne réinitialise pas une base existante.

Clés étrangères, dates d'effet, statuts, versions, auteurs, sources, catégories et niveaux de confidentialité structurent les relations. Des triggers empêchent l'écriture/suppression d'une version validée et vérifient la cohérence document/version/chunk et le centre des appartenances. Les changements du plan créent de nouvelles versions ; les évaluations successives restent distinctes.

Les colonnes JSONB conservent les valeurs des formulaires et les récits d'origine, sans traduction automatique ni normalisation destructive. Les relations d'autorité restent relationnelles ; l'API n'accepte pas de modification libre de ces JSONB.

Les chunks sont reconstruisibles, avec vecteurs normalisés de dimension 384 et index GIN full-text. La petite collection autorisée utilise une comparaison vectorielle exacte. Aucun benchmark ANN avec filtrage restrictif n'est revendiqué.
