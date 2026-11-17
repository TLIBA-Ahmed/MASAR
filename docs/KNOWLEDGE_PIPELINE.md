# Documents, connaissances et indexation

Trois catégories restent distinctes : connaissances institutionnelles, ressources/interventions et informations propres aux dossiers. Les tables sont présentes ; le contenu institutionnel officiel et le Kit ADO n'ont pas été inventés. Le catalogue de démonstration est étiqueté `DEMO_APPROVED`, distinct de `APPROVED`.

Un formulaire conserve ses valeurs, auteur, version de définition, statut et date. Un fichier externe est enregistré comme brouillon avec catégorie, centre, dossier, langue et confidentialité. L'original est hors des répertoires publics, avec identifiant de stockage aléatoire et SHA256. Les chemins fournis par l'utilisateur ne sont jamais utilisés comme chemins de fichiers.

L'import accepte seulement PDF textuel ou UTF-8, 8 Mo maximum. Il exige une catégorie autorisée et une revue professionnelle explicite avant indexation. OCR, antivirus institutionnel et traitement de fichiers complexes sont hors PoC. Les uploads doivent être synthétiques.

La mutation métier et l'événement d'outbox sont dans la même transaction. Le worker consomme avec `FOR UPDATE SKIP LOCKED`, extrait le texte localement, conserve la page/section/version, découpe aux frontières de paragraphes sous une taille bornée, calcule les embeddings E5 et écrit les chunks. Les anciens formulaires synthétiques reçoivent un original JSON fidèle à leur snapshot historique ; ce n'est pas un scan papier reconstitué.

Les identifiants des chunks sont déterministes par source/version/langue/ordre. Un retraitement n'ajoute pas de doublons. Les échecs de modèle sont explicites et réessayés, sans cloud. `python -m backend.workers.reembed` reconstruit uniquement les vecteurs absents. Ni source ni permissions ne sont déduites d'un embedding.

Chaque lecture de chunk vérifie la politique de sa véritable source. Une version de connaissance obsolète ne devient pas une citation de la version courante. Les triggers imposent une seule origine et la cohérence des relations document/version/dossier/centre/sensibilité.

Le stockage privé n'est jamais servi statiquement. Le téléchargement passe par une route authentifiée et auditée qui réévalue la source. Les index sont dérivés et peuvent être reconstruits ; la révocation d'accès ne dépend jamais de leur mise à jour.
