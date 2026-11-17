# Accueil géographique et authentification MASAR

## Parcours livré

1. **`/`** : accueil institutionnel bilingue, carte des 24 gouvernorats, recherche et liste synchronisées, confirmation, centres configurés et continuation.
2. **`/login`** : login existant à deux colonnes, slogans et cinq cartes conservés. Affichage du gouvernorat et du centre, retour au choix et sélection directe dans la liste des seuls profils fictifs associés, sans champ de recherche nom/fonction.
3. **Bouton e-Houwiya** : utilise exclusivement `DemoIdentityProvider`. Le formulaire annonce la simulation locale ; aucun PIN, OTP ou identifiant national n'est demandé.
4. **Validation serveur** : profil synthétique connu et actif, centre actif et lié au gouvernorat, appartenance active au centre, rôle avec lecture générale et affectation de groupe/dossier datée avec scope actif. Un contexte contradictoire renvoie `WORKPLACE_MISMATCH`, sans créer de session ni ajouter de droits.
5. **Multi-centres** : après identification, `/select-centre` présente uniquement les centres autorisés renvoyés par `/me`. La sélection est revérifiée par `POST /auth/centre`. Une action « Changer de centre » reste disponible dans la sidebar pour ces professionnels.
6. **Espace autorisé** : retour interne conservé ou Assigned Children. Les routes `/dashboard`, `/assigned-children`, `/child-journey/:caseId` et les autres modules conservent leurs services et permissions.

Le centre courant décrit le contexte d'affichage ; les droits demeurent calculés à partir de toutes les affectations actives. Le choix géographique ne crée aucun rôle, scope, appartenance ou affectation. L'interface n'est jamais l'autorité des permissions.

## Registres et migrations

- **018** : `governorates(id,name)`, FK obligatoire `centres.governorate_id`, statut actif et indicateur `is_demo`, index par gouvernorat, `employees.is_demo_identity`, `sessions.selected_centre_id` et fonctions de vérification.
- **019** : classification explicite des profils/centres du jeu synthétique existant, avec correspondance exacte du nom bilingue et de l'identifiant de seed. Les seules clés historiques ne suffisent pas à classer un employé comme fictif.
- **020** : préservation des clés techniques de centre/gouvernorat dans les DTO uniquement lorsqu'elles existent dans le registre. Une valeur de récit arbitraire sous ces clés reste soumise à pseudonymisation.
- Les trois centres synthétiques existants (Siliana, Gabès et Kairouan) sont conservés. Ils ne constituent pas un registre officiel. Un gouvernorat peut avoir zéro, un ou plusieurs centres ; aucun centre ou employé supplémentaire n'est inventé. Un centre sans professionnel actif affiche un état vide au login.
- Les migrations sont additives ; dossiers, identités permanentes d'enfants, sources, formulaires et affectations existantes sont conservés. Si un centre existant ne peut être relié à un gouvernorat connu, la migration échoue atomiquement plutôt que d'inventer son territoire.

## API

Toutes les routes sont sous `/api/v1`, via le proxy de même origine.

| Route | Contrat |
| --- | --- |
| `GET /entry/governorates` | 24 références bilingues `id/name`, sans professionnel ni dossier. |
| `GET /entry/governorates/{id}/centres` | Centres actifs explicitement de démonstration en mode demo ; aucun employé. État vide pour un territoire non configuré. |
| `GET /auth/demo/professionals?governorate_id=…&centre_id=…` | DTO minimal fictif `id/name/role/specialty/centerId`, filtré par appartenance et affectation actives ; aucun email ni détail d'affectation. Refus hors mode demo. |
| `POST /auth/demo/login` | `employee_id`, `governorate_id`, `centre_id` ; le frontend transmet toujours les trois. Pour compatibilité avec le sélecteur de profils déjà authentifié et les clients demo historiques, l'absence des deux champs géographiques résout un centre effectivement autorisé. Fournir un seul des deux champs est refusé. |
| `GET /me` | Identité résolue, rôles/capacités et liste des centres autorisés avec gouvernorat, centre courant. Session requise. |
| `POST /auth/centre` | `governorate_id`, `centre_id` ; session, CSRF et affectation actuels requis, ressource choisie auditée. |

Le cookie de session reste opaque, HttpOnly, SameSite Strict et révocable ; son hash reste en PostgreSQL. Les droits sont relus sous rôle applicatif restreint, sans BYPASSRLS. Les consultations publiques n'exposent aucun nom d'employé non explicitement fictif ; le bootstrap ne contient plus d'annuaire professionnel. Hors mode demo, les listes publiques de centres/profils sont vides ou refusées. `EHouwiyaIdentityProvider` reste au statut **non configuré (501)** : aucune connexion gouvernementale active ni callback officiel n'est revendiqué.

## Retour après connexion

Une ouverture non authentifiée d'une route métier redirige vers `/` en conservant une destination interne validée. Le contexte temporaire utilise uniquement codes de gouvernorat/centre et route interne, dans `sessionStorage`, avec expiration de **30 minutes**. Les URLs externes, chemins encodés, caractères de contrôle, backslashes et routes non reconnues sont refusés. Les paramètres libres et fragments sont éliminés ; seuls `stage=1..5` sur une roadmap et les onglets prédéfinis du dossier/Forum peuvent être conservés.

La destination n'accorde aucun droit. Une garde appelle `GET /cases/{id}/access` avant de monter un dossier ou une roadmap ; les services métier contrôlent ensuite leurs propres ressources. Un retour vers un dossier interdit affiche **Accès refusé / الوصول مرفوض**, sans carte ni contenu privé. La langue peut changer sans effacer le choix, le dossier ou l'étape demandés.

Le changement de profil fictif déjà proposé dans l'espace ERP conserve la route et ses paramètres pendant l'identification. L'ancien contenu privé est démonté ; un écran de vérification s'affiche jusqu'au retour des nouvelles projections autorisées. Une identification échouée retourne au parcours public. Le bouton de reprise de l'accueil recharge également le bootstrap et le token CSRF si le backend était initialement indisponible.

## Carte et accessibilité

`public/geography/tunisia-governorates.geojson` contient les 24 géométries de geoBoundaries **TUN-ADM1-13205935**, frontières représentées en **2017**, révision source **9469f09**. Les coordonnées sont inchangées ; seul le JSON est minifié et enrichi de sa provenance. SHA256 du fichier source : `c8961d7e933079295bdec215c4783c93774696f0600419a2f11779d81f8fb885`.

Attribution : [geoBoundaries](https://www.geoboundaries.org/), © [contributeurs OpenStreetMap](https://www.openstreetmap.org/copyright) / Wambacher. La source indique **ODbL 1.0** pour les frontières et geoBoundaries demande son attribution sous **CC BY 4.0**. Le GeoJSON livré reste téléchargeable avec ses informations de licence ; voir [notice géographique locale](../public/geography/README.md). `scripts/prepare-governorates-geometry.py` permet une reconstruction depuis la source épinglée, sans lire de données métier.

La carte est un SVG interactif local : focus, Entrée/Espace, flèches, Home/End, survol bilingue et zoom modéré. La recherche/liste reste utilisable si le GeoJSON est indisponible. Le repère cartographique demeure LTR dans les deux langues et n'est jamais inversé. Le navigateur ne demande pas de GPS. Le relief reste discret ; aucune dépendance cartographique n'est ajoutée et la roadmap 3D existante reste distincte.

## Scénarios de vérification

- Siliana → centre de démonstration → profil fictif p3 → identification simulée → seul groupe autorisé → CDIS-024 et roadmap.
- Même retour avec `stage=3` conservé ; p5 à Gabès voit un refus sur CDIS-024.
- Requête falsifiée p3/Gabès : refus sans session, possibilité de changer de territoire.
- Compte, centre, appartenance, affectation ou scope révoqués : profils retirés et création/changement de session refusés.
- Multi-centres configurés dans la base temporaire : deux centres proposés après identification, choix permis puis refus immédiat après révocation.
- RTL/LTR, clavier, recherche sans accents, mobile, état vide et erreur de registre.

Les tests backend utilisent une base et un stockage temporaires. La connexion officielle, le registre national des CDIS et les règles ministérielles de rattachement restent des intégrations futures ; les politiques de cette démonstration ne constituent pas une homologation institutionnelle.

Validation finale : **117 tests backend**, **65 tests frontend**, lint, build et images Docker API/frontend réussis. **18 scénarios navigateur distincts** ont été validés, avec reprises ciblées après correction de l'état d'identification et de la fixture persistante des messages joints. La vérification de conservation relève 40 enfants/dossiers, 15 formulaires et 97 versions documentaires. Voir [le relevé de validation](../benchmarks/governorate-entry-validation.json).
