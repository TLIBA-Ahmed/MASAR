# API métier

Préfixe `/api/v1`. L'API officielle est aussi décrite par `/docs` du backend local. Le frontend utilise uniquement la même origine `/api`, via proxy Vite ou Nginx. Aucune connexion directe à PostgreSQL, au répertoire privé ou à une gateway de modèle.

| Méthode et route                                   | Contrat                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET `/bootstrap`                                   | Mode, centres publics de démo et token CSRF signé ; aucun annuaire global d'employés |
| GET `/entry/governorates`                          | Catalogue public des 24 références bilingues |
| GET `/entry/governorates/{id}/centres`              | Centres actifs explicitement fictifs en mode demo ; zéro, un ou plusieurs |
| GET `/auth/demo/professionals`                     | `governorate_id`, `centre_id` ; DTO minimal synthétique filtré sur les affectations actives ; refus hors demo |
| POST `/auth/demo/login`                            | `{employee_id,governorate_id?,centre_id?}` ; paire géographique vérifiée, session HttpOnly ; aucun rôle ou scope client |
| POST `/auth/centre`                                | `{governorate_id,centre_id}` ; choix parmi les centres vérifiés après identification, CSRF et session requis |
| GET `/me`                                          | Employé, rôles, centres et capacités résolus sur le serveur                                    |
| POST `/auth/logout`                                | Révocation de session et suppression du cookie                                                 |
| GET `/workspace`                                   | Projection minimale autorisée pour les composants historiques                                  |
| GET `/cases/{id}/access`                           | Vérifie la session et le dossier à chaque ouverture ; aucune identité directe |
| GET/PATCH `/cases/{id}/identity`                   | Identité confidentielle ; finalité/capacité/scope dédiés ; consultation et modification auditées |
| POST `/cases/{id}/successor`                       | `{reason}` ; accompagnement successif après fermeture, conserve l'enfant et son code permanent |
| POST `/search`                                    | `{q,category}` ; recherche instantanée sans saisie libre dans les URLs ; filtre avant matching |
| GET `/exports/workspace`                          | Export pseudonymisé calculé avec les autorisations actuelles, audité |
| POST `/exports/cases`                             | `{case_ids}` ; minimal id/code/stade/statut ; refuse toute référence hors périmètre |
| GET `/cases/{id}/forms/{form}/access`             | Contrôle de formulaire et version avant impression/export |
| GET `/cases/{id}/journey/summaries`                | Cinq cartes, aperçu déterministe ou dernière version approuvée autorisée, fraîcheur et permissions |
| POST `/cases/{id}/journey/summaries/stages/{1..5}` | `{cycle_id?,manual?:{ar,fr}}` ; nouveau brouillon borné et sourcé, jamais une validation automatique |
| GET `/cases/{id}/journey/summaries/stages/{1..5}/history` | Versions visibles, séparées par cycle ; aucune métadonnée des versions interdites |
| GET `/cases/{id}/journey/summaries/stages/{1..5}/sources` | Sources recontrôlées ; `summary_id?` pour un snapshot ; `source_kind/source_id` pour ouverture contrôlée |
| POST `/cases/{id}/journey/summaries/{summary}/review` | `{status:approved\|rejected,reason}` ; transition explicite unique, contexte et sources recontrôlés |
| GET `/journeys/assigned?q=&group_id=`              | Liste minimale des dossiers autorisés, groupes actifs et compteurs des cinq étapes             |
| GET `/cases/{id}/journey`                          | Projection en lecture seule du parcours central, métriques, timeline et versions autorisées    |
| GET `/cases/{id}/journey/stages/{1..5}`            | Recontrôle d'accès avant détails d'étape, formulaires, documents et contributeurs              |
| GET `/cases/{id}/journey/documents/{version}/open` | Recontrôle du dossier et de la version confidentielle ; chemin interne autorisé                |
| GET `/forum`                                       | Publications du centre autorisé, favoris personnels et conversations dont l'employé est membre |
| POST `/forum/posts`                                | `{body}` général ; auteur, identifiant, date et centre imposés par le serveur                  |
| POST `/forum/posts/{id}/comments`                  | `{body}` ; commentaire ajouté sous verrou, texte narratif préservé                             |
| PUT `/forum/posts/{id}/reaction`                   | `{active}` ; état explicite idempotent de la réaction personnelle                              |
| PUT `/forum/posts/{id}/favorite`                   | `{active}` ; favori personnel, invisible aux autres profils                                    |
| POST `/forum/conversations/{id}/messages`          | `{body}` ; appartenance et affectation active recontrôlées avant l'ajout                       |
| POST `/forum/posts/attachments`                    | Multipart `body?`, `files` ; nouvelle publication avec pièces jointes privées |
| POST `/forum/posts/{id}/comments/attachments`      | Même multipart ; commentaire avec pièces jointes, publication autorisée requise |
| POST `/forum/conversations/{id}/messages/attachments` | Même multipart ; message avec pièces jointes, appartenance active requise |
| GET `/forum/attachments/{id}/download`             | Téléchargement privé après recontrôle session/Forum/centre/conversation, empreinte et contenu |
| GET `/me/assigned-groups`                          | Groupes actifs et compteurs autorisés                                                          |
| GET `/groups/{id}/children`                        | Roster vérifié à chaque lecture                                                                |
| POST `/groups/{id}/members`                        | Ajout explicite `{case_id,reason}`                                                             |
| POST `/groups/{id}/children/{case}/end`            | Fin d'appartenance motivée                                                                     |
| GET `/groups/{id}/assignments`                     | Métadonnées de gestion accessibles au gestionnaire habilité                                    |
| POST `/group-assignments/{id}/revoke`              | Révocation motivée immédiate                                                                   |
| POST `/cases`                                      | Création canonique par professionnel habilité ; identifiant alloué en base                     |
| GET `/cases/{id}`                                  | Dossier limité aux informations autorisées                                                     |
| PATCH `/cases/{id}/identity`                       | Champs canoniques explicitement autorisés ; pas de modification d'identifiants/centre          |
| POST `/cases/{id}/observations`                    | Catégorie contrôlée, auteur et date imposés par le backend                                     |
| POST `/forms`                                      | Valeurs F01–F15, brouillon/complet/validé, version allouée sous verrou                         |
| PUT `/cases/{id}/roadmap`                          | Objectifs, notes et `expected_version` ; conflit 409 si obsolète                               |
| POST `/documents/upload`                           | Multipart PDF texte/UTF-8 synthétique, 8 Mo maximum                                            |
| POST `/document-versions/{id}/approve`             | Revue motivée explicite d'un brouillon                                                         |
| GET `/document-versions/{id}/original`             | Vue textuelle pseudonymisée après recontrôle ; les octets originaux restent privés             |
| GET `/search?q=&category=`                         | Autocomplétion textuelle, 300 caractères maximum, aucun appel au SLM                           |
| GET `/browser/suggestions?q=&category=`            | Alias blueprint du même service de recherche textuelle autorisée                               |
| POST `/browser/ask`                                | Question explicite, langue, dossier/groupe facultatifs et opération prédéfinie facultative     |
| POST `/browser/search`                             | Alias blueprint de `/browser/ask`, même contrat et mêmes contrôles                             |
| GET `/cases/{id}/recommendation-templates`         | Templates autorisés pour l'employé et ce dossier                                               |
| POST `/recommendations/generate`                   | Contexte, dossier, objectifs confirmés, contraintes ; éligibilité puis modèles                 |
| POST `/recommendations`                            | Alias blueprint du même orchestrateur central                                                  |
| POST `/recommendations/{id}/feedback`              | ACCEPTED/MODIFIED/REJECTED/DEFERRED + motif ; aucune planification                             |
| POST `/cases/{id}/planned-interventions`           | Commande humaine distincte, prérequis confirmés et clé d'idempotence                           |
| POST `/records/{tasks\|appointments}`              | Champs métier contrôlés, auteur imposé                                                         |
| PUT `/sessions/{id}`                               | Mise à jour d'une séance autorisée et de ses participants existants                            |
| GET `/ai/status`                                   | Mode réel et état des modèles, sans chemin privé ni secret                                     |

Les mutations exigent `X-Masar-CSRF`, égal au token signé obtenu par bootstrap/login. Les cookies sont HttpOnly, SameSite Strict ; CORS est limité aux origines locales déclarées. La démo HTTP locale n'est pas une configuration de transport institutionnelle.

Les pièces jointes du Forum acceptent PDF avec texte, DOCX et TXT UTF-8, au maximum trois fichiers et 8 Mio cumulés par envoi. Le texte `body` est facultatif si des documents sont fournis. Les entrées renvoyées par `/forum` et `/workspace` portent `attachments: [{id,name,mediaType,size}]`, sans chemin privé ni octets. Un format non pris en charge ou un document invalide renvoie 422 ; `FORUM_ATTACHMENT_PRIVACY` refuse un identifiant connu détecté. Le téléchargement renvoie `Content-Disposition: attachment`, `Cache-Control: no-store` et `X-Content-Type-Options: nosniff`. Les routes JSON existantes restent disponibles.

401 indique une session manquante/expirée, 404 une ressource indisponible (sans distinguer existence/interdiction), 409 un conflit ou une opération refusée par la base, 422 une commande invalide. Les demandes sont bornées et limitées en fréquence. Aucun endpoint n'accepte un snapshot complet du store, du SQL ou une autorité choisie par le navigateur.
