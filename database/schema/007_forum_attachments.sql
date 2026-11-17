CREATE TABLE forum_attachments (
 id text PRIMARY KEY,
 post_id text REFERENCES forum_posts(id),
 conversation_id text REFERENCES forum_conversations(id),
 entry_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('post','comment','message')),
 centre_id text NOT NULL REFERENCES centres(id),
 author_id text NOT NULL REFERENCES employees(id),
 filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 150),
 media_type text NOT NULL CHECK(media_type IN ('application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 8388608),
 storage_reference text NOT NULL UNIQUE,
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind IN ('post','comment') AND post_id IS NOT NULL AND conversation_id IS NULL)
    OR (kind='message' AND conversation_id IS NOT NULL AND post_id IS NULL)),
 CHECK(kind<>'post' OR entry_id=post_id)
);
CREATE INDEX forum_attachments_post ON forum_attachments(post_id,entry_id);
CREATE INDEX forum_attachments_conversation ON forum_attachments(conversation_id,entry_id);
ALTER TABLE forum_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_attachments FORCE ROW LEVEL SECURITY;
CREATE POLICY forum_attachment_read ON forum_attachments FOR SELECT USING(
 authz.forum_allowed(centre_id) AND (
  EXISTS(SELECT 1 FROM forum_posts p WHERE p.id=post_id AND p.centre_id=forum_attachments.centre_id
    AND (kind='post' OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.payload->'comments') item WHERE item->>'id'=entry_id)))
  OR EXISTS(SELECT 1 FROM forum_conversations c WHERE c.id=conversation_id AND c.centre_id=forum_attachments.centre_id
    AND authz.employee_id()=ANY(c.members)
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(c.payload->'messages') item WHERE item->>'id'=entry_id))
 ));
CREATE POLICY forum_attachment_create ON forum_attachments FOR INSERT WITH CHECK(
 author_id=authz.employee_id() AND authz.forum_allowed(centre_id,'write') AND (
  EXISTS(SELECT 1 FROM forum_posts p WHERE p.id=post_id AND p.centre_id=forum_attachments.centre_id
   AND ((kind='post' AND p.author_id=authz.employee_id()) OR
     (kind='comment' AND EXISTS(SELECT 1 FROM jsonb_array_elements(p.payload->'comments') item WHERE item->>'id'=entry_id AND item->>'authorId'=authz.employee_id()))))
  OR EXISTS(SELECT 1 FROM forum_conversations c WHERE c.id=conversation_id AND c.centre_id=forum_attachments.centre_id
   AND authz.employee_id()=ANY(c.members) AND kind='message'
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(c.payload->'messages') item WHERE item->>'id'=entry_id AND item->>'authorId'=authz.employee_id()))
 ));
GRANT SELECT,INSERT ON forum_attachments TO masar_app;
