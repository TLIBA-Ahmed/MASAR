# Groupes et affectations

Les groupes sont des entités persistantes, distinctes des libellés d'ateliers. `child_group_memberships` conserve l'enfant, le groupe, le statut ACTIVE/ENDED/TRANSFERRED, les dates d'effet et les auteurs d'ajout/retrait. Une contrainte interdit une appartenance active identique en double et un trigger interdit un mélange de centres.

Les professionnels ont des `group_assignments` et/ou des `case_assignments`. Chaque affectation possède son rôle existant dans `employee_roles`, ses dates, un statut ACTIVE/EXPIRED/REVOKED et des scopes séparés, eux-mêmes révocables. Une affectation de groupe ne partage pas toutes les catégories de notes.

Le seed contient quatre groupes, plusieurs professionnels communs au groupe A, une affectation expirée, une révoquée et une ancienne appartenance transférée. Les compteurs des cartes et du roster ne comprennent que les membres visibles selon RLS.

Assigned Children propose cartes/tableau, recherche, tri et filtres de roster. Un retrait révoque l'accès lié à cette appartenance. Une affectation individuelle valide est évaluée séparément ; p1 conserve ainsi 024 si ce dossier sort du groupe A.

La démonstration d'administration permet d'ajouter une appartenance, d'y mettre fin et de révoquer une affectation, avec motif historisé. Ce n'est pas un module général d'administration des rôles. L'enrôlement est une opération backend contrôlée : gestionnaire habilité, affectation au groupe, centre commun et dossier actif. Il n'expose pas les notes d'un dossier non attribué au gestionnaire.

La création institutionnelle des groupes, la validation des répartitions, les transferts inter-centres et les accès exceptionnels restent à confirmer. La révocation de démonstration est persistante : effectuer les essais destructifs d'accès dans les bases temporaires des tests ou sauvegarder la démonstration avant de retirer une affectation utile.
