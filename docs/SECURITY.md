# Sécurité du PoC local

## Accueil géographique

Le lieu de travail choisi n'est pas une donnée de position ni une permission. Les centres/profils publics sont réservés aux enregistrements explicitement synthétiques en mode demo ; aucun annuaire global n'est renvoyé par bootstrap. La création de session et le changement de centre contrôlent compte, centre, appartenance, rôles, dates d'affectation et scope actifs. Les centres inactifs sont également exclus par `authz.in_centre`. La liste multi-centres est résolue après identification. Aucun PIN/OTP réel n'est collecté ; l'adaptateur officiel reste déconnecté.

La destination de retour est interne, limitée aux routes connues et expirante ; seules les données de contexte géographique et la route minimale sont conservées temporairement. Chaque dossier est recontrôlé au retour et par ses services. Les libellés administratifs publics du seul endpoint de catalogue sont rétablis après pseudonymisation uniquement s'ils correspondent exactement au catalogue canonique : cela évite de masquer « Ben Arous » à cause d'un prénom connu, sans exempter de récit libre ou de donnée de dossier. Voir [AUTHENTICATION_FLOW.md](AUTHENTICATION_FLOW.md).

## Pièces jointes du Forum (migration 017)

PDF texte, DOCX et TXT UTF-8 sont bornés à trois pièces / 8 Mio cumulés et analysés côté serveur avant publication atomique. Les fichiers invalides, chiffrés, archives excessives et contenus actifs usuels sont refusés. Le filtre de confidentialité existant vérifie le nom, le texte et les métadonnées inspectées ; un identifiant connu provoque un refus plutôt qu'une publication d'octets identifiants. Les scans sans texte ne sont pas acceptés. Ce contrôle ne remplace ni antivirus ni anonymisation des images et de tout texte inconnu.

Les originaux restent privés avec nom aléatoire et SHA256. Aucun chemin ou lien public n'est transmis. Chaque téléchargement exige la session et les droits Forum actuels, l'appartenance à la conversation éventuelle, une empreinte intacte et une nouvelle vérification des identifiants connus. Les réponses sont des téléchargements `no-store`, `nosniff` et sous CSP sandbox. L'audit conserve uniquement les identifiants de ressources, taille et type, sans nom ni contenu du fichier. Les pièces ne sont pas indexées ou transmises aux modèles. La sauvegarde chiffrée existante inclut désormais leurs références et empreintes.

## Confidentialité des enfants et synthèses (17 novembre 2026)

Les noms et naissances sont isolés dans `child_identities` ; `child_identity_aliases` conserve leurs anciennes valeurs pour protéger les documents historiques sans les modifier. L'identité exige une finalité `child.identity.read/write`, une capacité et un scope dédiés, une affectation et un centre actifs. Le rôle applicatif ne peut lire les alias. Les consultations sont auditées avec les identifiants de ressources uniquement. Le `child_code` permanent est unique et immuable ; il ne dérive d'aucune donnée personnelle.

Les DTO et un filtre serveur de sortie protègent les API générales, y compris les réponses de recherche, Forum et exports. La recherche instantanée utilise POST ; les saisies libres ne sont plus placées dans les URLs ou `history.state`. Les journaux d'accès HTTP masquent également chemins et requêtes libres. Les projections vérifiées des employés restent distinctes des identités d'enfants. Les modèles reçoivent des contextes autorisés puis pseudonymisés ; l'indexation applique le même principe avant embeddings. Les anciens embeddings sont invalidés par migration. Les originaux demeurent privés ; leur consultation générale restitue une vue textuelle pseudonymisée. Les scans sans texte restent sans extrait exploitable.

Les synthèses dérivées ont FORCE RLS. Chaque référence est contrôlée contre sa source actuelle, y compris la chaîne amont des événements ; perdre une source cache la version entière et ses compteurs. Une génération recontrôle la session, les sources et le contexte après l'inférence. L'historique est immuable : seule une transition unique de revue du brouillon est permise, avec auteur, motif et horodatage serveur. Une nouvelle version ne modifie aucune décision de parcours. Les exports et l'impression revérifient les droits au moment de l'action ; les données d'identité ne passent jamais par le store général ni les exports.

Ce filtrage est une pseudonymisation des identifiants connus et de motifs de coordonnées, pas une preuve d'anonymisation de tout texte libre inconnu. Voir les limites et le flux réel dans [PRIVACY_JOURNEY_IMPLEMENTATION.md](PRIVACY_JOURNEY_IMPLEMENTATION.md).

Les contrôles backend sont réellement implémentés ; les identités, données et politiques métier restent de démonstration. Ce PoC n'est pas déclaré homologué, conforme à un régime réglementaire ou adapté à de vrais dossiers de mineurs.

Le backend vérifie identité active, rôle/capacité, centre, affectation datée, scope, sensibilité et finalité contrôlée. Les commandes sont bornées par Pydantic et ne reçoivent pas de rôles ni de permissions faisant autorité. Une interdiction renvoie une ressource indisponible plutôt que son existence ou son contenu.

RLS est complémentaire, pas substitutive. Les transactions utilisent SET LOCAL et les tests vérifient commit, rollback et pooling. L'API utilise `masar_app` sans superuser/BYPASSRLS, distinct du propriétaire de migration. L'indexer dispose d'un compte machine distinct. Les fonctions SECURITY DEFINER ont un search_path fixe, pas de SQL dynamique utilisateur et leurs droits PUBLIC sont retirés.

Les cookies sont HttpOnly et SameSite Strict. Les mutations exigent un token CSRF signé ; CORS autorise seulement les origines locales déclarées. Les tailles, chaînes, listes, contextes et nombres de candidats sont bornés. La limitation de fréquence est locale au processus et ne constitue pas une défense distribuée. Les réponses métier sont `no-store`.

Les originaux privés restent hors du frontend. Les noms de stockage sont générés, les chemins résolus sont vérifiés et les SHA256 sont conservés. Les versions validées sont immuables. Un modèle ou un chunk ne peut attribuer de droits ; une révocation source prend effet immédiatement, même si l'index est ancien.

La gateway n'a pas de base de données ni de store de documents à interroger. Son endpoint exige un secret serveur et n'est pas proxifié au navigateur. Les workers CPU reçoivent seulement le contexte borné ; l'environnement transmis exclut identifiants DB et secrets de session. Hugging Face est en mode offline à l'inférence ; aucune implémentation de fallback cloud n'existe et le client refuse une URL de gateway non locale/non interne.

Le Browser n'a pas d'outils de mutation. Les IDs des sources et candidats sont vérifiés ; les accès sont relus après l'inférence. Qwen est limité à la sélection d'extraits exacts par une grammaire JSON et des validations indépendantes du couple extrait/source. Une citation connue avec un texte inventé est rejetée. Cela ne certifie ni la vérité de la source ni sa pertinence métier. Les filtres de contenu et de prompt injection sont une défense de PoC, pas une preuve d'absence universelle d'attaque. Aucun score de risque, diagnostic, décision d'orientation, prestation ou clôture n'est une tâche supportée.

Audit : identités vérifiées, action, ressource, date, statut et métadonnées minimales ; pas de prompts, récits ou extraits bruts dans les logs. La gateway journalise uniquement le modèle, sa révision, la version de prompt, le statut et la durée d'inférence. Les décisions humaines et changements d'affectation ont leurs motifs conservés dans leurs enregistrements métier. Les tests s'exécutent dans des bases et répertoires privés temporaires distincts.

Le transport HTTP local sert uniquement la démonstration. Avant environnement institutionnel : identité officielle et MFA selon politique, HTTPS/mTLS entre services, gestionnaire de secrets, accès opérateurs, audit centralisé intègre, antivirus/OCR isolé, politique de conservation, revue de dépendances, tests de charge et audit de sécurité indépendant. Le réseau local ou on-premise seul ne remplace pas ces contrôles.

Le script de sauvegarde chiffre dump PostgreSQL et originaux référencés par AES-256-GCM avec dérivation PBKDF2. Un essai de restauration dans une base temporaire a été exécuté ; le rapport est `benchmarks/restore-drill.json`. La sauvegarde de test a une phrase aléatoire non conservée ; utiliser sa propre phrase conservée séparément pour une sauvegarde opérateur récupérable.
