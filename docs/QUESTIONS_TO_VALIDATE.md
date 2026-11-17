# Points à confirmer avec les CDIS

## Transcription

- F02 : troisième modalité de la grille initiale, lue « هجين » dans le brief ; libellé affiché avec mention « à confirmer » et échelle configurable.
- F02 : sixième critère « له أخطاء ذهنية (في بعدها المفهومي) » et dixième critère « مستفز » à vérifier sur les originaux avec un professionnel.
- F12 : sens exact du critère « المشكلات ». Aucune interprétation psychologique ajoutée.
- Vérifier les traductions françaises, les en-têtes et la correspondance exacte de toutes les photographies F01–F15 ; un contrôle visuel partiel ne remplace pas cette validation.
- Certains termes historiques des formulaires ont été conservés comme libellés de référence ; leur présentation et leur éventuelle révision doivent être discutées avec les professionnels.

## Parcours

- Conditions, auteurs habilités et documents requis pour chaque transition.
- Validations de classification pluridisciplinaire et de feuille de route commune.
- Périmètre exact de la supervision administrative avant intervention.
- Définition de l’observation d’un mois, exceptions et dates de référence.
- Durée d’un cycle de réhabilitation, évaluations intermédiaires, prolongations et commission.
- Conditions de clôture et informations d’orientation/intégration nécessaires ou non applicables.
- Validité et conséquences de l’archivage ; aucune règle institutionnelle définitive n’est imposée par la simulation.

## Population et coordination

- F15 couvre aussi des adultes dans le document original. Le prototype impose moins de 18 ans ; confirmer la borne et les situations à la majorité.
- Autorisations par métier pour les informations psychologiques, sociales et familiales. La politique serveur dans les tables de rôles/scopes et les fonctions `authz` croise centre, affectations, permissions et sensibilité ; elle ne remplace pas une matrice institutionnelle validée. Les anciens exemples frontend de `config/access.ts` restent historiques.
- Liens familiaux à établir explicitement, règles de confidentialité entre dossiers d’une famille.
- Qui demande, accepte et confirme un transfert de centre, et quelles données suivent le dossier ?
- Répertoire des centres et partenaires réellement autorisé à utiliser. Les centres et partenaires de démonstration ne constituent pas un référentiel officiel.

## Activités et intelligence

- Fournir le Kit ADO et les référentiels autorisés, licences, catégories, critères de validation et consignes de sécurité.
- Valider les tranches d’âge, formats, matériels et conditions des activités ; les valeurs actuelles sont des exemples.
- Confirmer la liste des compétences, la formulation des objectifs et les critères de rapprochement.
- Définir les indicateurs nationaux et les seuils de confidentialité pour les petits effectifs.
- Confirmer les treize contextes provisoires, leurs métiers autorisés, permissions, attributs, champs requis et sources dans `config/recommendationContexts.ts` ; les exemples de métiers ne constituent pas des règles définitives.
- Confirmer les conditions de qualification éducative, de formation et d’habilitation psychologique, le périmètre administratif de centre et les restrictions de ressources.
- Définir le circuit professionnel de validation préalable des activités de soutien et ressources. Les validations de catalogue livrées sont entièrement simulées.
- Confirmer les responsables de création et de validation des groupes persistants, désormais relationnels et historisés. Leur politique de répartition ne doit pas être inventée par un modèle.
- Confirmer la portée institutionnelle d’un feedback de ressource et sa restitution. Le nouveau PoC enregistre uniquement un feedback ; une action distincte est nécessaire pour planifier et versionner la roadmap. Aucun document validé n’est modifié.
- Valider institutionnellement le contrat d’ACL des fragments, embeddings multilingues et index pgvector implémentés, ainsi que celui de futurs caches ; confirmer leur révocation et la conservation éventuelle des requêtes.

Les durées, affectations de formulaires et conditions du prototype sont modifiables dans la configuration et les services. Aucune zone illisible n’a été convertie en règle officielle supposée.

## Gouvernance Full Stack à confirmer

- Accueil géographique : fournir le registre officiel des CDIS et leurs rattachements ; valider les frontières de référence pour l'usage institutionnel (la carte locale provient du jeu geoBoundaries représentant 2017). Les trois centres conservés sont synthétiques et signalés comme tels. Confirmer le parcours e-Houwiya officiel, le circuit multi-centres et la matrice d'affectations avant toute intégration réelle.

- Identité : confirmer la matrice `child.identity.read/write`, la séparation prénom/nom des héritages sans découpe arbitraire, la conservation des alias et le rapprochement humain entre prises en charge successives. Aucun rapprochement par nom, famille ou adresse n'est automatisé.
- Synthèses : confirmer les métiers/auteurs de revue, l'éventuelle règle de double validation, la périodicité de revue, la conservation des versions et les modalités de traduction professionnelle des récits. La démo autorise la revue par l'auteur, conserve les citations dans leur langue de saisie et ne certifie pas une synthèse clinique.
- Documents : confirmer les modalités d'une éventuelle consultation d'originaux identifiants, limitée à une rubrique et une finalité dédiées. Le circuit général livré ne fournit que des vues textuelles pseudonymisées ; l'OCR de scans n'est pas ajouté.

- Suivi cartographique du parcours : confirmer la correspondance officielle entre sous-étapes et pièces justificatives, la portée de la complétude documentaire, les échelles d'évaluation réellement comparables, les statuts d'objectifs atteints et leurs auteurs habilités. Les versions sans phase explicite ne sont pas reclassées automatiquement en évaluations initiale/intermédiaire/finale. La boucle de prolongation reste une représentation de décisions humaines enregistrées, pas un déclencheur métier.
- Forum : valider les habilitations, la modération, la conservation des échanges généraux et l'appartenance aux conversations. La démo réutilise uniquement des interlocuteurs fictifs ; les permissions `forum.read`/`forum.write` sont configurables en base. L'accès livré exige un centre actif et une affectation active disposant du scope `general.read` ; cette règle provisoire ne constitue pas une politique institutionnelle. Aucune information individuelle ne doit être publiée dans ce Forum général.
- Pièces jointes du Forum : confirmer les formats et limites de dépôt, la conservation/modération, ainsi que le futur circuit antivirus et contrôle des images. L'incrément local accepte seulement PDF texte, DOCX et TXT ; il ne fournit ni OCR ni garantie d'anonymisation de documents arbitraires.
- Matrice officielle de scopes par profession/catégorie/sensibilité et partage de métadonnées administratives, notamment titres de documents confidentiels.
- Autorité de création des groupes, gestion des affectations temporaires et circuit de revue/révocation. Accès individuel résiduel après retrait d'un groupe.
- Autorisations nationales et de supervision, transferts inter-centres et historique des appartenances aux centres. Aucun agrégat national opérationnel n'est revendiqué.
- Accès exceptionnel à un enregistrement : qui accorde, durée maximale, finalité et contrôle a posteriori ?
- Validation institutionnelle des documents, visibilité des brouillons entre professionnels, signatures et durée de validité des sources.
- Publication/approbation du catalogue d'interventions et des templates, critères de prérequis, restrictions et ressources réellement disponibles.
- Paramètres temporels de l'observation et des évaluations, pièces exigées et auteurs habilités pour chaque décision humaine.
- Conservation, droit de rectification, suppression, archives, purge des index dérivés et anciennes copies navigateur. Aucun ancien snapshot n'est importé silencieusement.
- Habilitations opérateurs, rotation des secrets, sauvegardes chiffrées, conservation des clés et objectifs de restauration.
- Identité e-Houwiya officielle, protocole et environnement d'homologation à fournir ; aucune intégration gouvernementale n'est simulée comme opérationnelle.
- Matériel CPU/RAM final, concurrence attendue, latence acceptable, tests de qualité arabe/français et gouvernance des versions de modèles. Les poids/thresholds actuels sont expérimentaux.
- Qualité de réponse : évaluer un corpus bilingue de questions et objectifs confirmés avant d'autoriser la reformulation libre. Le modèle 0.6B livré sélectionne uniquement des extraits exacts après un ajout factuel observé pendant les essais ; cela ne valide pas la qualité pédagogique des sources.
