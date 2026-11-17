# Modèle courant PostgreSQL — 17 novembre 2026

PostgreSQL fait autorité. `AppData` est une projection pseudonymisée de compatibilité, sans naissance ni noms d'enfants. Le navigateur n'utilise plus IndexedDB pour les dossiers ; son ancien cache applicatif est invalidé. Les données historiques décrites plus bas appartiennent au prototype frontend archivé.

| Entité | Champs et relations courants |
| --- | --- |
| `governorates` / entrée | **018–020** : 24 codes ISO et libellés bilingues ; FK obligatoire `centres.governorate_id`, `centres.active/is_demo`, `employees.is_demo_identity`, `sessions.selected_centre_id`. Classification synthétique explicite, identifiants de référence vérifiés et aucune duplication des employés ou affectations. Le centre choisi ne crée pas de permission. |
| `children` | `id` technique, `child_code` permanent UNIQUE, `payload` public contenant seulement id/code et alias de libellé pseudonyme. Trigger d'immuabilité du code. |
| `child_identities` | `child_id` PK/FK, `first_name`, `last_name` bilingues, `birth_date`, `personal_information`, `version`, `updated_at`. FORCE RLS et finalité spécifique. Les noms complets hérités sont conservés sans découpe inventée. |
| `child_identity_aliases` | Historique privé des anciennes valeurs d'identification, employé uniquement dans le filtre serveur. Aucune politique de lecture applicative. |
| `cases` | Identifiant d'accompagnement, FK enfant, centre, état/version. L'ancienne unicité sur `child_id` est remplacée par un index d'historique ; plusieurs prises en charge successives conservent le même enfant et code. |
| Dossier central | Profils, observations, évaluations, notes, décisions, interventions, échéances, formulaires et versions restent dans leurs tables et relations existantes. Les originaux validés ne sont pas réécrits. |
| Roadmaps | `roadmaps`, `roadmap_versions`, `roadmap_objectives` restent l'autorité des projets et objectifs. Une confirmation ne signifie pas un objectif atteint. Les cycles de prolongation conservent les anciennes versions. |
| `journey_stage_summaries` | `id`, `case_id`, `stage_id`, `cycle_id`, `summary_ar/fr`, `sections`, `period`, `source_references`, `context_fingerprint`, `generated_at`, `generation_method`, `model_version`, `validation_status`, `validated_by/at`, `review_reason`, `version`, `created_by`, `created_at`, `updated_at`. UNIQUE dossier/étape/cycle/version, index historique, FORCE RLS et trigger d'immutabilité. |
| `document_chunks` | Texte pseudonymisé et embeddings dérivés des sources autorisées. Les embeddings antérieurs sont invalidés ; l'outbox reconstruit des projections sans modifier les originaux ni leurs empreintes. |
| `forum_attachments` | Migration **017** : `id`, FK `post_id` ou `conversation_id`, `entry_id`, `kind` (post/comment/message), `centre_id`, `author_id`, `filename`, `media_type`, `byte_size`, `storage_reference` UNIQUE, `sha256`, `created_at`. Index parent/entrée, contraintes de format/taille et FORCE RLS. L'entrée existe dans le parent ; les commentaires/messages conservent la représentation JSON existante. Le rôle applicatif dispose uniquement de SELECT/INSERT. |

Une référence de synthèse contient type/id technique, titre, date/version, extrait pseudonymisé et empreinte. Le contenu historique est conservé, mais sa lecture exige toujours l'autorisation actuelle de toutes les sources. Les versions antérieures ne sont pas remplacées. Seules les colonnes de revue d'un brouillon peuvent évoluer une fois vers approuvé/rejeté, avec auteur et horodatage serveur.

Les DTO `ChildSummaryDTO`, `ChildIdentityDTO`, `ChildJourneyDTO` séparent représentation générale, identité protégée et parcours. Le workspace émet un seul enfant par identité permanente, même s'il possède plusieurs dossiers ; les indicateurs et projets restent attachés au dossier et au cycle. Les champs éducatifs de compatibilité de l'enfant privilégient le dossier actif ; les sources historiques restent dans le dossier correspondant.

Migrations : **010** isolation de l'identité, codes et relations successives ; **011** synthèses versionnées et politiques de sources ; **012** stabilité des identifiants techniques et anciens alias ; **013** optimisation du filtrage ; **014** distinction vérifiée des projections publiques d'employés ; **015** valeurs de protocole et noms ambigus ; **016** formats alternatifs des dates connues et coordonnées. Toutes sont additives pour les sources métier. Voir [PRIVACY_JOURNEY_IMPLEMENTATION.md](PRIVACY_JOURNEY_IMPLEMENTATION.md).

---

## Archive — prototype frontend, non normative

> Les descriptions de stockage et permissions navigateur suivantes ne décrivent plus le fonctionnement courant.

# Modèle de données

Le contrat principal est `AppData` dans `src/types/index.ts`. Les identifiants stables permettent de relier les modules sans recréer les profils d’enfants.

| Groupe                   | Entités implémentées                                         | Relations                                                                        |
| ------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Central                  | Child, Family, Center, Professional, Case, CaseAssignment    | Case → Child, Center, référent ; Child → Family ; affectations explicites        |
| Parcours                 | Stage configurable, sous-états, Decision, JourneyEvent       | Décisions, cycles et événements → Case                                           |
| Évaluations et documents | FormDefinition, FormSection, FieldDefinition, FormSubmission | Soumission → Case + FormDefinition, auteur et version                            |
| Projet                   | EducationalGoal, notes du projet, programmes F13/F14         | Objectifs intégrés au Case, confirmés par un professionnel                       |
| Activités                | ActivityTemplate, ActivitySession, ActivityParticipation     | Séance → activité ; participations → Case ; objectifs et recommandation associés |
| Intelligence             | Recommendation, motifs, statut et feedback, SearchHistory    | Recommandation → Case + ActivityTemplate + objectifs                             |
| Collaboration            | ProfessionalPost, Comment, Conversation, Message             | Auteurs et membres → Professional                                                |
| Organisation             | Appointment, Task, IntegrationRecord, CaseTransfer           | Ressources associées au Case et à un professionnel                               |

Plusieurs concepts de l’architecture cible sont intentionnellement représentés par des projections plutôt que par des tables distinctes : les entretiens et les évaluations sont des versions F01/F02/F08/F12 ; les projets sont F13/F14 plus les objectifs structurés ; les interventions sont des `JourneyEvent` ; la présence est une `ActivityParticipation` ; les groupes sont des libellés de séance. Les membres familiaux sont intégrés à `Family` et les compositions détaillées restent dans les versions F15.

La mise à jour du 16 novembre 2026 ajoute `ProfessionalResource`, `PartnerStructure` et `searchHistories` sans changer les identifiants ni les versions existantes. Les ressources et dossiers peuvent porter une `ResourcePolicy`. `SessionContext` contient identité, métier, CDIS, affectations, permissions et attributs ; les alias initiaux restent cohérents pour les modules existants. `Recommendation` conserve le contexte, les entrées, objectifs, sources, destinataires, choix humain, motif, auteur et date. Le type d’événement `recommendation` distingue une revue humaine d’une activité effectivement réalisée. La migration locale est additive et conserve les narrations.

Cela évite des doublons artificiels dans le MVP. La migration serveur pourra normaliser ces objets en tables dédiées sans modifier leur signification métier. Le prototype ne prétend pas disposer d’un schéma SQL complet de production.

## État actuel, brouillon, historique

`Child` porte l’identité courante. Un préremplissage copie les données disponibles au début d’une nouvelle saisie. Les valeurs de `FormSubmission` sont des snapshots : modifier le profil actuel ne modifie pas un document conservé. Les brouillons peuvent être remplacés ; les versions complétées/validées sont ajoutées. Les décisions et événements sont ajoutés au journal.

Chaque activité acceptée conserve un identifiant de recommandation déterministe. Une seconde acceptation renvoie la séance déjà créée au lieu d’en créer une autre. La réalisation génère un événement par participant, puis alimente les projections éducatives à partir des mêmes données.

## Persistance

IndexedDB `masar-demo-v1`, object store `state`, clé `app`. Le snapshot possède `schemaVersion: 1`. Le Repository vérifie le format général et sérialise les écritures. Il ne fournit ni chiffrement, ni sauvegarde distante, ni contrôle d’accès réel, ni gestion multi-onglets. La suppression des données du navigateur efface la démonstration ; l’export JSON permet de conserver une copie synthétique, sans fonction d’import arbitraire dans ce MVP.
