# Parcours et décisions

> État Full Stack du PoC : les cinq étapes et leurs documents sont conservés. Les transitions avancées, prolongations, transferts et clôtures décrits ci-dessous appartiennent au prototype historique et sont désactivés dans l'interface du PoC. Les opérations actives sont l'enregistrement, les observations/évaluations, les affectations, les objectifs et la planification professionnelle distincte. Voir [POC_SCOPE.md](POC_SCOPE.md). Aucun événement temporel ou modèle ne décide du parcours.

| Étape                         | Opérations intégrées                                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Enregistrement             | Identité, dossier central, informations administratives, source d’orientation, entretien social, dossier social et convocation éventuelle                                                                             |
| 2. Diagnostic et inscription  | Inscription, analyse sociale, observation d’un mois, évaluations sociale/psychologique/éducative, évaluation pluridisciplinaire, classification humaine et service d’accompagnement                                   |
| 3. Réhabilitation             | Feuille de route commune, contributions des métiers, projet éducatif, formation si applicable, supervision avant interventions, objectifs confirmés, activités, ateliers, participation et évaluations intermédiaires |
| 4. Évaluation du parcours     | Synthèses, comparaison, évaluation finale, préparation et commission, décision de poursuite                                                                                                                           |
| 5. Orientation et intégration | Partenaires, deuxième chance, intégration familiale/scolaire/formation/apprentissage/professionnelle si applicable, suivi, résultats et éventuelle clôture                                                            |

Les six états des sous-étapes sont non commencé, en cours, complété, en attente de validation, validé et non applicable. Les formulaires ont leurs propres états : brouillon, complété et validé de manière simulée ; l’absence de document est « non commencé ».

Chaque décision enregistre un identifiant, le type, l’étape d’origine et de destination, la date, le professionnel, le motif et le cycle. Aucun déclencheur temporel ne décide à la place d’un professionnel.

La prolongation est autorisée depuis l’étape 4 et revient à l’étape 3. Elle incrémente le cycle, remet la supervision et les sous-étapes de réhabilitation en attente, sans supprimer les événements, décisions ou documents antérieurs. Les évaluations restent distinctes.

La clôture est une action séparée, depuis l’étape 5. Dans la configuration de démonstration, il faut un résultat d’intégration renseigné ou un motif contenant `[N/A]` et une justification professionnelle. **Ce mécanisme n’est pas présenté comme une règle institutionnelle définitive.**

Les décisions de supervision, de prolongation et de clôture sont proposées au profil Administration. L’ouverture du dossier est réservée au profil Travailleur social. Les droits restent côté navigateur et sont simulés.

Une orientation est enregistrée sans changer le statut du dossier. Un transfert commence par une demande, puis une confirmation administrative modifie le centre ; les données et l’historique conservent leurs identifiants. Les autorisations du centre d’origine sont alors filtrées par le contexte local.

La configuration de référence est `src/config/workflow.ts`. Les durées d’un mois et de six mois n’ont aucune portée juridique générale. Le prototype permet les transitions explicites pour la démonstration, sans prétendre que des mois se sont écoulés entre deux clics.
