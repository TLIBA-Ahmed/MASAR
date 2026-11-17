# Pièces jointes du Forum

Dans une nouvelle publication, un commentaire ou une conversation, utiliser **Joindre un document** / **إرفاق وثيقة**, sélectionner les fichiers puis publier/envoyer. Les fichiers sélectionnés peuvent être retirés avant envoi. Les pièces publiées affichent leur nom, format, taille et un bouton de téléchargement. Les textes et boutons suivent la langue de l'interface.

Formats : **PDF avec texte, Word DOCX, TXT UTF-8**. Limites : **trois fichiers et 8 Mio cumulés par envoi**. Un document seul suffit ; aucun texte de message n'est obligatoire. Les erreurs de format, taille et confidentialité sont affichées dans les deux langues.

## Intégration

- `backend/forum/attachments.py` vérifie les droits, analyse les contenus, crée l'entrée et les métadonnées en transaction et range les octets dans le stockage privé. Un échec de publication retire uniquement les nouveaux fichiers de cette transaction.
- La migration **017** et `database/schema/007_forum_attachments.sql` ajoutent les métadonnées, contraintes, index et politiques FORCE RLS sans réécrire les échanges existants.
- Les nouvelles routes multipart réutilisent les services Forum ; les routes JSON restent compatibles. Les snapshots joignent seulement `id`, `name`, `mediaType`, `size` aux publications/commentaires/messages autorisés.
- `ForumAttachments.tsx` et son CSS fournissent sélection, retrait avant envoi, métadonnées et téléchargement. `Network.tsx` les intègre aux trois types d'échanges.
- `scripts/backup_demo.py` ajoute les pièces et leurs SHA256 à l'archive chiffrée existante, ainsi que leur comptage au contrôle de restauration.

## Accès et limites

Le dépôt et chaque téléchargement contrôlent les habilitations Forum, le centre, l'affectation active et les membres de la conversation. Les fichiers ne possèdent pas d'URL publique ; le téléchargement est audité, vérifie l'empreinte, relit les permissions après analyse et refuse les identifiants connus détectés selon le dictionnaire actuel. Le frontend reçoit des métadonnées minimales, sans chemins privés ni SHA256.

Les ressources générales du Forum restent distinctes des documents individuels du dossier central. Aucun index, OCR, moteur IA, antivirus ou nouveau service externe n'est ajouté. Les PDF chiffrés ou sans texte et les contenus actifs usuels sont refusés. L'inspection du texte et de métadonnées courantes ne détecte pas toute identité inconnue ou présente dans une image. Les originaux acceptés sont conservés sans modification.

## Vérification

`backend/tests/test_forum_attachments.py` couvre persistance, octets téléchargés, formats, limites, confidentialité, métadonnées, CSRF, RLS, changement d'identité connue, révocation pendant l'analyse, conversations privées, rollback et contenu de sauvegarde. `tests/forum-attachments.test.tsx` vérifie la sélection, les limites et le téléchargement. `tests/e2e/forum-attachments.spec.ts` exerce publication, commentaire et message avec pièces, rechargement, téléchargement et arabe RTL dans le navigateur.

La suite complète a passé **96 tests backend** ; les **15 tests ciblés de pièces jointes** ont ensuite été exécutés avec les contrôles complémentaires. **59 tests frontend**, lint, build et le parcours navigateur ont réussi. Le contrôle de contenu d'archive est automatisé ; aucun nouveau cycle complet sauvegarde/restauration n'est revendiqué pour cet incrément.
