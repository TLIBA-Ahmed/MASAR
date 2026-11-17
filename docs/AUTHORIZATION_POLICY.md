# Autorisation centrale

`backend/authorization/AuthorizationService` et les fonctions `authz` constituent la politique commune aux trois espaces. Refus par défaut. Le navigateur fournit une demande, jamais une preuve de rôle, d'attribut ou de finalité.

Une lecture métier nécessite une session valide, un employé actif, un rôle autorisant l'action, un centre actif, une affectation individuelle ou de groupe active aux dates courantes, le scope de catégorie et une sensibilité compatible. Les appartenances de groupe ont aussi des dates/statuts. Les grants exceptionnels sont limités à un enregistrement et peuvent expirer ou être révoqués.

Les finalités proviennent des routes métier : `case.read`, `forms.write`, `group.manage`, `browser.read`, `recommendation.generate`, etc. Aucun champ `purpose` libre ni en-tête `X-Role` n'élargit les permissions. Les schémas Pydantic refusent les champs supplémentaires des commandes.

| Profil fictif | Exemple d'accès effectif |
| --- | --- |
| p3, éducateur | Groupe A ; informations générales, éducatives, évaluations et objectifs selon scopes ; pas de notes psychologiques |
| p2, psychologue | Groupes A et B ; données psychologiques avec scope confidentiel ; pas de suivi social détaillé sans grant |
| p1, travailleur social | Groupe C et dossiers individuels 024/025 ; données sociales autorisées |
| p4, administration | Affectations administratives explicites ; métadonnées documentaires ; pas de notes psychologiques/sociales détaillées |
| p5, autre centre | Groupe D à Gabès ; aucun dossier de Siliana |
| p6, éducateur limité | Même groupe A, scopes réduits ; pas de templates éducatifs nécessitant `educational.read` |

Cette matrice est un exemple configurable dans les tables de permissions et de scopes. Un rôle seul n'accorde jamais un dossier.

Les pièces jointes du Forum héritent du périmètre de leur publication ou conversation. Lecture : session active, capacité `forum.read`, centre et affectation actifs avec `general.read` ; conversation réservée à ses membres. Écriture : capacité `forum.write` supplémentaire, auteur imposé et entrée créée dans la même transaction. FORCE RLS vérifie parent, centre, entrée et appartenance. Les téléchargements recontrôlent ces conditions après analyse du fichier ; une révocation ne dépend pas du cache de l'interface. Aucun accès au dossier d'un enfant n'est transféré au Forum.

## Identité et synthèses du parcours

L'accès au dossier n'accorde pas l'identité. Les finalités `child.identity.read` et `child.identity.write` sont fixées par les seules routes dédiées. Elles exigent `general.read`, le centre et l'affectation actifs, plus la capacité **et** le scope `child.identity.read/write`. La politique de démonstration accorde la lecture à social/administration dans leurs seuls dossiers affectés, et l'écriture au social. Éducateur, psychologue et profil limité n'ont pas de droit implicite d'identité. Ces choix restent configurables et à valider institutionnellement.

La lecture des synthèses exige le dossier et **toutes** les preuves autorisées, avec la confidentialité et les sources amont. Aucune lecture ou génération ne récupère de catégorie privée non permise. `journey.summary.generate` et `journey.summary.review` exigent chacun finalité, capacité et scope explicites. Les affectations ayant `roadmap.write` reçoivent ces scopes dans la migration initiale ; le profil limité conserve sa consultation sans génération/revue. Le bootstrap ne recrée pas les scopes révoqués.

Une synthèse approuvée n'est pas une décision institutionnelle. Une revue peut être faite par l'auteur dans la démo ; une règle de double validation doit être confirmée avant un usage institutionnel. La table interdit toute réécriture d'une version, tout changement d'auteur/source et toute seconde validation. Les références sont réévaluées à la lecture, dans l'historique, à l'ouverture d'une preuve, et avant validation. Les comptes et versions inaccessibles ne sont pas transmis à l'interface.

Les exports généraux utilisent la même portée que la lecture ; une liste explicitement demandée contenant un dossier interdit est refusée. Les originaux identifiants ne sont jamais exportés par ce circuit. Les consultations d'identité et les exports sont audités sans valeurs personnelles.

Le compte `masar_app` n'est ni propriétaire des tables, ni superutilisateur, ni BYPASSRLS. `FORCE ROW LEVEL SECURITY` complète les contrôles applicatifs. Chaque transaction fixe son identité et sa finalité avec `set_config(..., true)` ; le commit/rollback efface le contexte même avec pooling. Le compte de migration ne sert pas l'API. `masar_indexer` est un principal machine limité à la file et aux sources/index dérivés.

La révocation s'applique aux tables sources immédiatement, sans attendre l'indexation. Les résultats, métadonnées, compteurs, citations et originaux sont contrôlés. Il n'existe aucun cache métier de recherche partagé ; HTTP utilise `no-store`. L'interface recharge le périmètre toutes les cinq secondes et au retour au premier plan. Toute requête d'accès direct vérifie à nouveau la politique ; l'intervalle UI n'est pas une permission résiduelle.

Les tests PostgreSQL sont exécutés sous le véritable compte restreint et dans une base temporaire distincte. Cela ne constitue pas un audit de production.
