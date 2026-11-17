# Moteur central de recommandations

Un seul point d'entrée : `backend/recommendations/CentralRecommendationEngine`. Les anciens calculs frontend sont conservés comme références de régression, pas comme moteur actif de la plateforme. La page et les liens contextuels convergent vers l'API centrale.

Les treize exemples de templates sont importés dans `recommendation_templates`, avec rôles associés, scopes, statuts de dossier, schémas d'entrée/sortie, stratégie, versions de prompt et configuration System One. Le registre serveur retourne uniquement les options autorisées pour l'employé et le dossier. La génération vérifie de nouveau ces conditions. La présence d'une option dans le navigateur n'accorde aucun droit.

Le formulaire varie selon le template : dossier, projet/atelier pertinent, objectifs confirmés, durée, format, participants, matériel et précisions facultatives. Le changement de profil, dossier, contexte, version du plan ou périmètre efface les propositions obsolètes.

Pipeline : politique → template → objectifs autorisés confirmés par un professionnel → contexte minimal → catalogue autorisé → éligibilité déterministe → au plus huit candidats → pertinence System One → sélection d'un extrait explicatif Qwen → validation exacte extrait/source → recontrôle → revue humaine.

L'éligibilité précède toujours les modèles : activité active, approbation réelle ou de démonstration, tranche d'âge, compétences liées aux objectifs, format, effectif, durée et matériel disponible. Une ressource inactive, non autorisée ou non éligible ne peut pas être réintroduite par un score. Les ateliers sélectionnent des activités ; d'autres stratégies sélectionnent les ressources correspondant au domaine. Sans objectifs fiables ou candidats admissibles, le moteur s'abstient.

Le contexte des modèles ne contient ni nom, ni date de naissance, ni récit social ou psychologique : uniquement objectifs nécessaires et métadonnées des ressources déjà autorisées. Les scores concernent la pertinence d'une ressource. Le score ordinal attendu de Laya sur cinq niveaux est ramené de 0–4 à 0–100 ; il n'est pas une probabilité calibrée. La pondération expérimentale conserve la priorité des correspondances déterministes.

La petite variante Qwen 0.6B a produit un ajout factuel non sourcé pendant les essais. Sa sortie est donc limitée par une grammaire à un extrait exact d'une ressource candidate autorisée, dans la langue demandée. L'extrait n'est attaché qu'à la ressource effectivement citée ; les autres cartes conservent leur description et leurs justifications déterministes. Le prompt versionné et les révisions des modèles sont associés à l'exécution. Cette sélection vérifiable ne prétend pas fournir une synthèse générative libre validée.

`AI_MODE=demo` fournit une correspondance déterministe explicitement indiquée. `AI_MODE=local` exige les modèles ; une indisponibilité est affichée et ne déclenche aucun fallback cloud ou déterministe silencieux.

ACCEPTED, MODIFIED, REJECTED et DEFERRED créent seulement `recommendation_feedback` et une trace. Aucun objectif, document, plan ou séance n'est modifié par ce feedback. La commande indépendante de planification exige droits, objectifs confirmés compatibles, prérequis attestés, date, motif et clé d'idempotence ; elle crée une intervention et une nouvelle version du plan. Une proposition obsolète ou révoquée ne peut pas être validée.

Aucun diagnostic, risque social/judiciaire, classement d'enfant, décision de prestation, orientation ou clôture n'est produit par ce moteur. Les règles et poids sont expérimentaux et à valider avec les professionnels.
