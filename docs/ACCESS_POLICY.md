> Historique du prototype frontend. Pour le PoC Full Stack du 16 novembre 2026, consulter [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [ARCHITECTURE.md](ARCHITECTURE.md) et [AUTHORIZATION_POLICY.md](AUTHORIZATION_POLICY.md). Les anciennes descriptions de stockage et permissions navigateur ne décrivent plus le fonctionnement courant.

# Politiques d’accès simulées

Les règles ci-dessous sont des exemples configurables, à confirmer avec les CDIS. Elles ne constituent aucune habilitation institutionnelle.

## Profils de démonstration

| Profil            | Métier         | Portée dossier                                            | Contextes proposés par défaut                                                       |
| ----------------- | -------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| p1 — Amina        | Social         | Affectations à Siliana                                    | Intervention, famille, coordination, préparation d’intégration, projet de formation |
| p2 — Nadia        | Psychologie    | Affectations à Siliana                                    | Ressources professionnelles, soutien préalablement validé                           |
| p3 — Khaled       | Éducation      | Affectations à Siliana                                    | Ateliers, projet éducatif, formation, ressources éducatives                         |
| p4 — Sana         | Administration | Siliana, avec permission de centre et attribut explicites | Documents, échéances, coordination administrative                                   |
| p5 — Sami         | Éducation      | Affectations à Gabès                                      | Contextes éducatifs autorisés, dans les dossiers de Gabès                           |
| p6 — accès limité | Éducation      | CDIS-024 uniquement                                       | Ressources éducatives ; pas d’ateliers, d’évaluation ou de planification            |

Le sélecteur de Topbar sert uniquement à la démonstration. La page des professionnels et la connexion fictive restent disponibles. Aucune administration complexe des rôles ni authentification e-Houwiya réelle n’a été ajoutée.

## Évaluation

1. Vérifier la cohérence des identifiants canoniques et des alias existants avec le professionnel fictif, ainsi que l’attribut `active`.
2. Exiger la permission de la catégorie de ressource.
3. Exiger le même CDIS et une affectation présente à la fois dans le contexte et dans le Repository ; le mode administratif de centre exige séparément métier, permission et attribut.
4. Appliquer les métiers autorisés, permissions additionnelles, conditions d’attributs et sensibilité portés par la ressource.
5. Exiger l’autorisation de tous les participants pour les ressources collectives, sans exposer un extrait partiel du groupe.
6. Pour les contextes de recommandations, croiser ces conditions avec le registre et ses sources déclarées.

Les documents psychologiques demandent `psychology.read` et `psychologyAuthorized = true`. Les événements héritent des restrictions de leur source. Les revues de recommandations utilisent la catégorie de leur source pour rester consultables par le professionnel habilité, y compris le profil limité pour sa ressource éducative. Les métadonnées et compteurs de recherche proviennent uniquement de la projection autorisée.

Les agrégats nationaux synthétiques existants sont conservés sous la permission distincte `aggregate.read` et le contrôle d’attribut correspondant. Ils ne transmettent ni noms ni identifiants individuels. Un profil sans ce droit obtient des agrégats de son périmètre de dossiers ; les règles de petits effectifs restent à valider avant toute version réelle.

## Cycle de vie

Le store conserve la session et met à jour les affectations après une mutation métier. Changement de profil ou de contexte d’accès : remontage des vues, fermeture des dialogues, suppression des résultats temporaires et annulation du debounce. Les écritures réévaluent l’accès au moment de la validation, y compris pour une proposition déjà affichée. Les historiques de recherche ne sont jamais partagés entre deux clés d’accès.

La migration est additive : ressources professionnelles, répertoire de partenaires, profil limité et historiques cloisonnés. Les identités, narrations, documents, évaluations et décisions existants sont préservés. L’ancien historique partagé n’est pas réaffiché.

## Limite de sécurité

**React, les profils fictifs, sessionStorage et IndexedDB ne protègent pas des dossiers réels.** Les données synthétiques sont présentes dans le navigateur et modifiables par son utilisateur. Toute future utilisation réelle doit imposer ces contrôles sur le serveur avant les requêtes SQL, les fichiers, les recherches, fragments, vecteurs, caches, exports et réponses. Les permissions de la simulation ne doivent pas être considérées comme des justificatifs signés ou comme une authentification.
