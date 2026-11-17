import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bookmark, Heart, MessageCircle, Plus, Search, Send } from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useLocale } from '../../i18n';
import { api, ApiError, csrfHeader } from '../../services/api';
import { ForumAttachmentPicker, ForumAttachments, forumFileError } from './ForumAttachments';
import './forum-attachments.css';
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Field,
  IconButton,
  Info,
  Modal,
  PageHeading,
  Panel,
  useAction,
} from '../../components/ui';
import { normalize } from '../../services/search';
export function ProfessionalNetwork() {
  const { l, b, t, date, lang } = useLocale();
  const { data, session, refresh } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'feed';
  const [saving, setSaving] = useState(false);
  const [postFiles, setPostFiles] = useState<File[]>([]),
    [commentFiles, setCommentFiles] = useState<Record<string, File[]>>({}),
    [messageFiles, setMessageFiles] = useState<File[]>([]),
    [fileError, setFileError] = useState('');
  const [query, setQuery] = useState(''),
    [composer, setComposer] = useState(false),
    [body, setBody] = useState(''),
    [comment, setComment] = useState<Record<string, string>>({}),
    [favorites, setFavorites] = useState(false),
    [conversationId, setConversationId] = useState(
      data.conversations.find((c) => c.members.includes(session!.professionalId))?.id ?? '',
    ),
    [message, setMessage] = useState('');
  const run = useAction();
  async function command(path: string, payload: unknown, method = 'POST', files: File[] = []) {
    setSaving(true);
    setFileError('');
    try {
      if (files.length) {
        const form = new FormData();
        form.append('body', (payload as { body: string }).body);
        files.forEach((file) => form.append('files', file));
        await api(`/forum${path}/attachments`, undefined, {
          method: 'POST',
          body: form,
          headers: { 'X-Masar-CSRF': csrfHeader() },
        });
      } else await api(`/forum${path}`, payload, { method });
      await refresh();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.code.startsWith('FORUM_ATTACHMENT'))
        setFileError(forumFileError(error.code, lang));
      await refresh();
      throw error;
    } finally {
      setSaving(false);
    }
  }
  const conversations = data.conversations.filter((c) =>
    c.members.includes(session!.professionalId),
  );
  const conversation = conversations.find((c) => c.id === conversationId);
  const posts = data.posts.filter(
    (p) =>
      (!favorites || p.favorite) &&
      normalize(p.body + ' ' + (p.attachments ?? []).map((file) => file.name).join(' ')).includes(
        normalize(query),
      ),
  );
  const author = (id: string) => data.professionals.find((p) => p.id === id)!;
  return (
    <>
      <PageHeading
        eyebrow={l('منتدى الفريق / تبادل الخبرات', 'FORUM / ÉCHANGES PROFESSIONNELS')}
        title={t('network')}
        description={l(
          'نتشارك الخبرة، لنعزز جودة المرافقة.',
          'Partager l’expérience pour mieux accompagner.',
        )}
        actions={
          tab === 'feed' ? (
            <Button onClick={() => setComposer(true)}>
              <Plus size={16} />
              {l('مشاركة جديدة', 'Nouvelle publication')}
            </Button>
          ) : undefined
        }
      />
      <Info>
        {l(
          'منتدى تجريبي محلي مع مهنيين اصطناعيين. تُحفظ المشاركات والرسائل في مسار دون إرسال خارجي. تبقى البيانات الفردية داخل الملفات المخصصة.',
          'Forum de démonstration local avec des professionnels fictifs. Publications et messages sont enregistrés dans MASAR, sans envoi externe. Les données individuelles restent dans les dossiers.',
        )}
      </Info>
      <div className="network-toolbar">
        <div className="segmented-control">
          <button
            className={tab === 'feed' ? 'active' : ''}
            onClick={() => setParams({ tab: 'feed' })}
          >
            {l('فضاء المعرفة', 'Fil professionnel')}
          </button>
          <button
            className={tab === 'messages' ? 'active' : ''}
            onClick={() => setParams({ tab: 'messages' })}
          >
            {l('المراسلات', 'Messagerie')}
          </button>
        </div>
        {tab === 'feed' && (
          <>
            <div className="search-input">
              <Search size={16} />
              <input
                aria-label={l('البحث في المشاركات', 'Rechercher une publication')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={l('ابحث في الموارد والنقاشات…', 'Rechercher dans les ressources…')}
              />
            </div>
            <Button variant="secondary" onClick={() => setFavorites((v) => !v)}>
              <Bookmark size={15} fill={favorites ? 'currentColor' : 'none'} />
              {l('المحفوظات', 'Enregistrés')}
            </Button>
          </>
        )}
      </div>
      {fileError && (
        <div className="forum-attachment-error" role="alert">
          <Info tone="orange">{fileError}</Info>
        </div>
      )}
      {tab === 'feed' ? (
        <div className="network-layout">
          <div>
            <Panel className="post-invite">
              <Avatar name={b(author(session!.professionalId).name)} color={1} />
              <button onClick={() => setComposer(true)}>
                {l(
                  'ما الخبرة التي تود مشاركتها مع الفريق؟',
                  'Quelle expérience souhaitez-vous partager ?',
                )}
              </button>
            </Panel>
            {posts.map((post) => (
              <Panel className="post-card" key={post.id}>
                <div className="post-author">
                  <Avatar name={b(author(post.authorId).name)} color={2} />
                  <div>
                    <strong>{b(author(post.authorId).name)}</strong>
                    <small>
                      {t(author(post.authorId).role)} · {date(post.date)}
                    </small>
                  </div>
                  <IconButton
                    label={l('حفظ المشاركة', 'Enregistrer la publication')}
                    aria-pressed={post.favorite}
                    disabled={saving}
                    onClick={() =>
                      void run(() =>
                        command(`/posts/${post.id}/favorite`, { active: !post.favorite }, 'PUT'),
                      )
                    }
                  >
                    <Bookmark size={17} fill={post.favorite ? 'currentColor' : 'none'} />
                  </IconButton>
                </div>
                <Badge tone="green">{b(post.category)}</Badge>
                <p className="post-body narrative">{post.body}</p>
                <ForumAttachments files={post.attachments} />
                <div className="post-actions">
                  <button
                    className={post.likes.includes(session!.professionalId) ? 'liked' : ''}
                    disabled={saving}
                    aria-pressed={post.likes.includes(session!.professionalId)}
                    onClick={() =>
                      void run(() =>
                        command(
                          `/posts/${post.id}/reaction`,
                          { active: !post.likes.includes(session!.professionalId) },
                          'PUT',
                        ),
                      )
                    }
                  >
                    <Heart
                      size={16}
                      fill={post.likes.includes(session!.professionalId) ? 'currentColor' : 'none'}
                    />
                    {post.likes.length} {l('تفاعل', 'réactions')}
                  </button>
                  <span>
                    <MessageCircle size={15} />
                    {post.comments.length} {l('تعليقات', 'commentaires')}
                  </span>
                </div>
                <div className="post-comments">
                  {post.comments.map((c) => (
                    <div key={c.id}>
                      <Avatar name={b(author(c.authorId).name)} size="sm" />
                      <div className="forum-comment-content">
                        <p>
                          <strong>{b(author(c.authorId).name)}</strong>
                          <span className="narrative">{c.body}</span>
                        </p>
                        <ForumAttachments files={c.attachments} />
                      </div>
                    </div>
                  ))}
                  <form
                    className="comment-composer"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (saving || (!comment[post.id]?.trim() && !commentFiles[post.id]?.length))
                        return;
                      const saved = await run(
                        () =>
                          command(
                            `/posts/${post.id}/comments`,
                            { body: comment[post.id] ?? '' },
                            'POST',
                            commentFiles[post.id] ?? [],
                          ),
                        l('حُفظ التعليق في مسار.', 'Commentaire enregistré dans MASAR.'),
                      );
                      if (saved) {
                        setComment((p) => ({ ...p, [post.id]: '' }));
                        setCommentFiles((p) => ({ ...p, [post.id]: [] }));
                      }
                    }}
                  >
                    <input
                      aria-label={l('تعليق محلي', 'Commentaire local')}
                      value={comment[post.id] ?? ''}
                      maxLength={10000}
                      disabled={saving}
                      onChange={(e) => setComment((p) => ({ ...p, [post.id]: e.target.value }))}
                      placeholder={l('أضف تعليقاً مهنياً عاماً…', 'Ajouter un commentaire général…')}
                    />
                    <IconButton
                      label={l('حفظ التعليق', 'Enregistrer le commentaire')}
                      type="submit"
                      disabled={saving}
                    >
                      <Send size={16} />
                    </IconButton>
                  </form>
                </div>
                <div className="forum-comment-files">
                  <ForumAttachmentPicker
                    files={commentFiles[post.id] ?? []}
                    disabled={saving}
                    label={l('إرفاق وثيقة بالتعليق', 'Joindre au commentaire')}
                    onChange={(files) =>
                      setCommentFiles((current) => ({ ...current, [post.id]: files }))
                    }
                  />
                </div>
              </Panel>
            ))}
            {!posts.length && <Empty title={t('noResults')} />}
          </div>
          <aside>
            <Panel className="network-guide">
              <h2>{l('مساحة آمنة للتعلّم', 'Un espace pour apprendre')}</h2>
              <p>
                {l(
                  'شارك نشاطاً، اسأل عن ممارسة أو اقترح مورداً. دون أسماء الأطفال أو تفاصيل ملفاتهم.',
                  'Partagez une activité, une question de pratique ou une ressource, sans nom d’enfant ni détail individuel.',
                )}
              </p>
              <h3>{l('فريق المركز', 'Équipe du centre')}</h3>
              {data.professionals
                .filter((p) => p.centerId === session?.centerId)
                .map((p, i) => (
                  <div className="team-person" key={p.id}>
                    <Avatar name={b(p.name)} color={i} />
                    <div>
                      <strong>{b(p.name)}</strong>
                      <small>{t(p.role)}</small>
                    </div>
                    <span className="live-dot" />
                  </div>
                ))}
            </Panel>
          </aside>
        </div>
      ) : (
        <Panel className="messaging-workspace">
          <aside>
            <h2>{l('المحادثات', 'Conversations')}</h2>
            {conversations.map((c) => (
              <button
                className={c.id === conversation?.id ? 'active' : ''}
                key={c.id}
                onClick={() => {
                  setConversationId(c.id);
                  setMessageFiles([]);
                  setFileError('');
                }}
              >
                <Avatar name={b(c.title)} />
                <div>
                  <strong>{b(c.title)}</strong>
                  <small>
                    {c.messages.at(-1)?.body ||
                      (c.messages.at(-1)?.attachments?.length
                        ? l('وثيقة مرفقة', 'Document joint')
                        : '')}
                  </small>
                </div>
              </button>
            ))}
          </aside>
          {conversation ? (
            <div className="conversation">
              <header>
                <Avatar name={b(conversation.title)} />
                <div>
                  <h3>{b(conversation.title)}</h3>
                  <p>
                    {conversation.members.length} {l('مهنيين اصطناعيين', 'professionnels fictifs')}{' '}
                    · {l('محلي فقط', 'Local uniquement')}
                  </p>
                </div>
                <Badge>{l('محاكاة', 'Simulation')}</Badge>
              </header>
              <div className="message-list">
                {conversation.messages
                  .filter((m) => !query || normalize(m.body).includes(normalize(query)))
                  .map((m) => (
                    <div
                      key={m.id}
                      className={`message ${m.authorId === session!.professionalId ? 'mine' : ''}`}
                    >
                      <small>{b(author(m.authorId).name)}</small>
                      <p className="narrative">{m.body}</p>
                      <ForumAttachments files={m.attachments} />
                      <time>
                        {new Date(m.date).toLocaleTimeString('fr-TN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/Paris',
                        })}
                      </time>
                    </div>
                  ))}
              </div>
              <form
                className="message-composer"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (saving || (!message.trim() && !messageFiles.length)) return;
                  const saved = await run(
                    () =>
                      command(
                        `/conversations/${conversation.id}/messages`,
                        { body: message },
                        'POST',
                        messageFiles,
                      ),
                    l(
                      'حُفظت الرسالة في مسار — دون إرسال خارجي.',
                      'Message enregistré dans MASAR, sans envoi externe.',
                    ),
                  );
                  if (saved) {
                    setMessage('');
                    setMessageFiles([]);
                  }
                }}
              >
                <input
                  required={!messageFiles.length}
                  value={message}
                  maxLength={10000}
                  disabled={saving}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={l(
                    'رسالة تجريبية عامة للفريق…',
                    'Message de démonstration à l’équipe…',
                  )}
                  aria-label={l('الرسالة', 'Message')}
                />
                <Button type="submit" disabled={saving}>
                  <Send size={17} />
                  {l('حفظ محلي', 'Enregistrer localement')}
                </Button>
              </form>
              <div className="forum-message-files">
                <ForumAttachmentPicker
                  files={messageFiles}
                  disabled={saving}
                  label={l('إرفاق وثيقة بالرسالة', 'Joindre au message')}
                  onChange={setMessageFiles}
                />
              </div>
            </div>
          ) : (
            <Empty title={l('لا توجد محادثة', 'Aucune conversation')} />
          )}
        </Panel>
      )}
      <Modal
        open={composer}
        onClose={() => setComposer(false)}
        title={l('مشاركة مهنية جديدة', 'Nouvelle publication professionnelle')}
        description={l(
          'شارك معرفة عامة فقط، دون بيانات تخص طفلاً أو أسرة.',
          'Partagez des connaissances générales, sans données individuelles.',
        )}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (saving || (!body.trim() && !postFiles.length)) return;
            const saved = await run(
              () => command('/posts', { body }, 'POST', postFiles),
              l('حُفظت المشاركة في المنتدى.', 'Publication enregistrée dans le Forum.'),
            );
            if (saved) {
              setBody('');
              setPostFiles([]);
              setComposer(false);
            }
          }}
        >
          <div className="dialog-body">
            <Field label={l('محتوى المشاركة', 'Votre publication')} required={!postFiles.length}>
              <textarea
                required={!postFiles.length}
                rows={6}
                maxLength={10000}
                disabled={saving}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            <ForumAttachmentPicker files={postFiles} disabled={saving} onChange={setPostFiles} />
            {fileError && (
              <div role="alert">
                <Info tone="orange">{fileError}</Info>
              </div>
            )}
          </div>
          <div className="dialog-footer">
            <Button type="button" variant="secondary" onClick={() => setComposer(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {l('مشاركة محلية', 'Publier localement')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
