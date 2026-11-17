> Historique du prototype frontend. Pour le PoC Full Stack du 16 novembre 2026, consulter [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [ARCHITECTURE.md](ARCHITECTURE.md) et [AUTHORIZATION_POLICY.md](AUTHORIZATION_POLICY.md). Les anciennes descriptions de stockage et permissions navigateur ne décrivent plus le fonctionnement courant.

# Exigences et correspondance avec le code

| Exigence                                     | Implémentation                                          |
| -------------------------------------------- | ------------------------------------------------------- |
| Point d’entrée commun e-Houwiya simulé       | `services/auth.ts`, `features/authentication`           |
| Centre, profession, affectation et périmètre | `SessionContext`, `authorizedCases`, `requireCase`      |
| Dossier central et historique                | `AppData`, `CaseDetail`, `JourneyEvent`                 |
| Cinq étapes et sous-étapes                   | `config/workflow.ts`, `components/workflow`             |
| Décisions humaines et prolongation           | `services/actions.ts`, `DecisionModal`                  |
| F01–F15 et préremplissage                    | `data/form-definitions`, `services/forms.ts`            |
| Documents et évaluations distincts           | `FormSubmission.version`, snapshots conservés           |
| Bibliothèque connectée au moteur             | `data/seed/activities.ts`, `Library`, `Recommendations` |
| Recherche locale explicable                  | `LocalSearchProvider`                                   |
| Recommandations déterministes                | `LocalRecommendationProvider`                           |
| Réseau professionnel et messagerie simulés   | `features/professional-network`                         |
| Programmation et suivi des séances           | `scheduleRecommendation`, `completeSession`             |
| Agrégats sans identité                       | `aggregateNational`, `NationalDashboard`                |
| Langues sans perte de saisie                 | i18next + états React stables                           |
| Persistance après rechargement               | Repository IndexedDB, écriture ordonnée                 |
| Interface réutilisable                       | `components/ui`, CSS à tokens, Radix Dialog             |

Les schémas n’inventent aucune lecture officielle des libellés ambigus. Les champs incertains sont explicitement marqués. L’observation d’un mois, l’association formulaires/étapes et les règles de supervision sont des propositions configurables, à confirmer avec les CDIS.
