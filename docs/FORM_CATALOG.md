# Catalogue des formulaires

Les quinze formulaires sont des définitions `FormDefinition` dans `src/data/form-definitions/index.ts`. Ils partagent le même moteur et ne constituent pas quinze implémentations indépendantes. La liste `reference` conserve les noms des photographies associées pour faciliter les futures vérifications ; cette association ne certifie pas une transcription exhaustive des détails peu lisibles.

| ID  | Libellé arabe                           | Français                               | Étapes proposées |
| --- | --------------------------------------- | -------------------------------------- | ---------------- |
| F01 | دليل المحادثة الفردية                   | Guide de l’entretien individuel        | 1, 2             |
| F02 | التدخل التربوي التأهيلي                 | Intervention éducative et réadaptation | 2, 3, 4          |
| F03 | استدعاء                                 | Convocation                            | 1                |
| F04 | بطاقة اتصال                             | Fiche de contact psychologique         | 2                |
| F05 | بطاقة متابعة تربوية                     | Fiche de suivi éducatif                | 3                |
| F06 | كراس النشاط اليومي الخاص بالمربي المختص | Registre quotidien de l’éducateur      | 3                |
| F07 | بطاقة دخول                              | Entrée après absence ou retard         | 3                |
| F08 | بطاقة التقييم الأولي                    | Évaluation initiale pluridisciplinaire | 2                |
| F09 | جدول التقييم النهائي                    | Tableau d’évaluation finale            | 4                |
| F10 | سجل الهدايا والجوائز                    | Registre des cadeaux et récompenses    | 3                |
| F11 | بطاقة إحالة                             | Orientation interne                    | 2                |
| F12 | جذاذة التقييم النفسي                    | Fiche d’évaluation psychologique       | 2, 4             |
| F13 | المشروع التربوي الإفرادي                | Projet éducatif individualisé          | 3, 4             |
| F14 | المشروع التكويني الإفرادي               | Projet individuel de formation         | 3                |
| F15 | ملف حالة اجتماعية                       | Dossier de situation sociale           | 1, 2, 5          |

F01 comporte identité, parents, parcours scolaire, formation conditionnelle, loisirs, environnement, attentes et observations. F02 propose observations et aptitudes, avec colonnes initiale/deuxième/finale distinctes, sans score global. F08 dispose d’une matrice de 11 critères × 3 dimensions (éducative, psychologique, sociale) avec oui/non/parfois. F12 contient dimensions émotionnelle, cognitive, sociale et synthèse professionnelle. F13 et F14 comprennent des programmes d’intervention répétables. F15 est organisé en quatorze sections A–N et utilise des champs conditionnels pour la classification professionnelle manuelle.

Les types disponibles sont texte, texte long, nombre, date, heure, radio, case à cocher, liste, choix multiples, tableau répétable et matrice. Les champs partagés sont résolus depuis le dossier au démarrage d’un nouveau document. Ils sont vérifiables et restent modifiables dans la copie de travail. La validation d’un document synchronise les champs d’identité explicitement partagés, sans modifier les versions précédentes.

Une seule copie en brouillon est maintenue par formulaire et dossier. Un document complété ou validé devient une version conservée ; le bouton « Nouvelle version » repart des données actuelles. Les nouvelles évaluations ne remplacent pas les précédentes. Les notes ne sont pas traduites automatiquement.

F05 et F06 sont aussi des projections des interventions et séances. Après une réalisation, ouvrir une nouvelle copie de F05/F06 pour constater les informations réutilisées. Une ancienne version validée ne doit jamais être réécrite par une séance ultérieure.

F03 récupère date et heure du premier rendez-vous ouvert associé au dossier. En cas de plusieurs rendez-vous, le professionnel doit vérifier la sélection ; un sélecteur explicite de rendez-vous constitue une amélioration prévue.

Les documents imprimables partagent un papier à en-tête MASAR, le centre, l’identifiant du dossier, la version et la mention de démonstration. Le rendu est un document HTML paginé par le navigateur ; l’export PDF passe par « Imprimer / Enregistrer en PDF ».

Voir `QUESTIONS_TO_VALIDATE.md` pour les libellés incertains et les adaptations du formulaire social aux enfants.
