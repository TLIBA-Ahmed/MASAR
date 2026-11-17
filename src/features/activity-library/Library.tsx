import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Check, Clock3, Grid2X2, Heart, List, Plus, Search, Users } from 'lucide-react';
import type { ActivityTemplate, ProfessionalResource } from '../../types';
import { RecommendationLink } from '../../components/recommendations/RecommendationLink';
import { bi } from '../../types';
import { skills, materialLabels } from '../../config/workflow';
import { useLocale } from '../../i18n';
import { useWorkspace } from '../../hooks/useWorkspace';
import { normalize } from '../../services/search';
import { uid } from '../../utils/date';
import {
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
export function ActivityDetails({
  activity: selectedActivity,
  onClose,
}: {
  activity: ActivityTemplate | null;
  onClose: () => void;
}) {
  const { l, b, t } = useLocale();
  const { data } = useWorkspace();
  const activity = data.activities.find((a) => a.id === selectedActivity?.id) ?? null;
  return (
    <Modal
      wide
      open={Boolean(activity)}
      onClose={onClose}
      title={activity ? b(activity.title) : ''}
      description={activity ? `${activity.id} · ${b(activity.source)}` : ''}
    >
      {activity && (
        <>
          <div className="dialog-body">
            <div className="activity-detail-meta">
              <Badge tone="green">{b(skills[activity.category as keyof typeof skills])}</Badge>
              <span>
                <Clock3 size={15} />
                {activity.duration} {t('minute')}
              </span>
              <span>
                <Users size={15} />
                {activity.minParticipants}–{activity.maxParticipants}
              </span>
              <span>
                {activity.minAge}–{activity.maxAge} {l('سنة', 'ans')}
              </span>
            </div>
            <p className="activity-description">{b(activity.description)}</p>
            <h3>{l('المهارات المستهدفة', 'Compétences travaillées')}</h3>
            <div className="skill-tags">
              {activity.skills.map((skill) => (
                <Badge key={skill}>{b(skills[skill as keyof typeof skills])}</Badge>
              ))}
            </div>
            <div className="activity-detail-columns">
              <div>
                <h3>{l('مراحل التنفيذ', 'Étapes de réalisation')}</h3>
                <ol>
                  {activity.instructions.map((text, i) => (
                    <li key={i}>{b(text)}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h3>{l('المعدات', 'Matériel')}</h3>
                <p>{activity.materials.map((m) => b(materialLabels[m] ?? bi(m, m))).join('، ')}</p>
                <h3>{l('الشروط والملاءمة', 'Conditions de réalisation')}</h3>
                <p>{b(activity.conditions)}</p>
                <h3>{l('التكييفات الممكنة', 'Adaptations possibles')}</h3>
                <p>{b(activity.adaptations)}</p>
                <h3>{l('التقييم', 'Évaluation')}</h3>
                <p>{b(activity.evaluation)}</p>
              </div>
            </div>
            <Info tone="orange">
              {l(
                'مثال تربوي يحتاج إلى مراجعة مهنية. لا ينتسب إلى Kit ADO أو إلى مرجع رسمي.',
                'Exemple pédagogique à examiner par un professionnel. Il ne provient pas du Kit ADO ni d’un référentiel officiel.',
              )}
            </Info>
            {activity.professionalValidation && (
              <Info tone="green">
                {l('مراجعة مهنية محاكية سابقة', 'Revue professionnelle préalable simulée')} ·{' '}
                {b(
                  data.professionals.find(
                    (p) => p.id === activity.professionalValidation?.professionalId,
                  )?.name ??
                    bi(
                      activity.professionalValidation.professionalId,
                      activity.professionalValidation.professionalId,
                    ),
                )}{' '}
                · {activity.professionalValidation.date}
              </Info>
            )}
          </div>
          <div className="dialog-footer">
            <Button variant="secondary" onClick={onClose}>
              {t('close')}
            </Button>
            <RecommendationLink
              contexts={['workshops', 'support-activities']}
              activityId={activity.id}
            >
              {l('ربط بمشروع وبرمجة', 'Associer au projet et programmer')}
            </RecommendationLink>
          </div>
        </>
      )}
    </Modal>
  );
}
export function ResourceDetails({
  resource: selectedResource,
  onClose,
}: {
  resource: ProfessionalResource | null;
  onClose: () => void;
}) {
  const { b, l, t } = useLocale();
  const { data } = useWorkspace();
  const resource = data.resources.find((r) => r.id === selectedResource?.id) ?? null;
  return (
    <Modal
      wide
      open={Boolean(resource)}
      onClose={onClose}
      title={resource ? b(resource.title) : ''}
      description={resource ? `${resource.id} · ${b(resource.source)}` : undefined}
    >
      {resource && (
        <>
          <div className="dialog-body">
            <Info tone="orange">
              {l(
                'مورد اصطناعي بمراجعة مهنية محاكية، يُراجع قبل أي استعمال.',
                'Ressource synthétique avec validation professionnelle simulée, à examiner avant utilisation.',
              )}
            </Info>
            <p>{b(resource.description)}</p>
            <ol>
              {resource.content.map((step, i) => (
                <li key={i}>{b(step)}</li>
              ))}
            </ol>
            <p>
              {l('المصدر', 'Source')} : {b(resource.source)} · {resource.validatedAt}
            </p>
          </div>
          <div className="dialog-footer">
            <Button variant="secondary" onClick={onClose}>
              {t('close')}
            </Button>
            <RecommendationLink
              contexts={[
                'educational-resources',
                'professional-resources',
                'social-intervention',
                'administrative-followup',
              ]}
            >
              {t('recommendations')}
            </RecommendationLink>
          </div>
        </>
      )}
    </Modal>
  );
}
export function Library() {
  const { l, b, t } = useLocale();
  const { data, mutate, session } = useWorkspace();
  const favoriteKey=`masar.ui.catalogue-favorites.${session?.userId}`;
  const [favoriteIds,setFavoriteIds]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem(favoriteKey)??'[]') as string[];}catch{return [];}});
  const [params, setParams] = useSearchParams();
  const run = useAction();
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState(''),
    [format, setFormat] = useState(''),
    [favorites, setFavorites] = useState(false),
    [view, setView] = useState('grid'),
    [detail, setDetail] = useState<ActivityTemplate | null>(null),
    [create, setCreate] = useState(false);
  const [draft, setDraft] = useState({
    ar: '',
    fr: '',
    category: 'communication',
    duration: 30,
    minAge: 8,
    maxAge: 17,
    format: 'individual',
    instructions: '',
  });
  const visible = data.activities.filter(
    (a) =>
      (!category || a.category === category) &&
      (!format || a.format === format) &&
      (!favorites || favoriteIds.includes(a.id)) &&
      normalize(`${a.id} ${b(a.title)} ${b(a.description)}`).includes(normalize(query)),
  );
  const linkedActivity = data.activities.find((a) => a.id === params.get('activity')) ?? null;
  const linkedResource = data.resources.find((r) => r.id === params.get('resource')) ?? null;
  const closeLinked = () => setParams({});
  const save = () => {
    const result = run(() => {
      mutate((d) => {
        if (
          !draft.ar.trim() ||
          !draft.fr.trim() ||
          draft.duration < 5 ||
          draft.maxAge < draft.minAge
        )
          throw Error('VALIDATION');
        const base = d.activities[0];
        d.activities.push({
          ...structuredClone(base),
          id: uid('ACT'),
          title: bi(draft.ar, draft.fr),
          description: bi(draft.ar, draft.fr),
          category: draft.category,
          skills: [draft.category],
          duration: draft.duration,
          minAge: draft.minAge,
          maxAge: draft.maxAge,
          format: draft.format as ActivityTemplate['format'],
          minParticipants: draft.format === 'group' ? 3 : 1,
          maxParticipants: draft.format === 'group' ? 8 : 1,
          materials: ['none'],
          instructions: [bi(draft.instructions, draft.instructions)],
          favorite: false,
          createdAt: d.demoDate,
        });
      });
      return true;
    });
    if (result) {
      setCreate(false);
      setDraft({
        ar: '',
        fr: '',
        category: 'communication',
        duration: 30,
        minAge: 8,
        maxAge: 17,
        format: 'individual',
        instructions: '',
      });
    }
  };
  return (
    <>
      <PageHeading
        eyebrow={l('المعرفة تتحول إلى أثر', 'DE LA RESSOURCE À L’ACCOMPAGNEMENT')}
        title={t('library')}
        description={l(
          'أنشطة تربوية متاحة للفريق، مرتبطة بأهداف واضحة ومهارات قابلة للملاحظة.',
          'Des activités partagées, liées à des objectifs clairs et à des compétences observables.',
        )}
        actions={
          <div className="heading-actions">
            <RecommendationLink
              contexts={[
                'workshops',
                'support-activities',
                'educational-resources',
                'professional-resources',
              ]}
              className="button secondary"
            >
              {t('recommendations')}
            </RecommendationLink>
            <Button onClick={() => setCreate(true)} disabled={Boolean(data.backend)||!data.activities.length} title={l('إنشاء موارد جديدة ينتظر اعتماد مسار النشر المؤسسي.','La création de ressources attend le circuit de publication institutionnel.')}>
              <Plus size={16} />
              {l('إضافة نشاط', 'Ajouter une activité')}
            </Button>
          </div>
        }
      />
      <Info tone="orange">
        {l(
          'أنشطة اصطناعية للتجربة، وليست محتوى Kit ADO. استيراد المرجع الرسمي مخطط عند توفره.',
          'Activités synthétiques de démonstration, sans contenu du Kit ADO. L’import du référentiel est prévu lorsqu’il sera disponible.',
        )}
      </Info>
      <div className="category-chips">
        <button className={!category ? 'active' : ''} onClick={() => setCategory('')}>
          {t('all')} <span>{data.activities.length}</span>
        </button>
        {Object.entries(skills).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCategory(category === key ? '' : key)}
            className={category === key ? 'active' : ''}
          >
            {b(label)}
            <span>{data.activities.filter((a) => a.category === key).length}</span>
          </button>
        ))}
      </div>
      <Panel className="library-toolbar">
        <div className="search-input">
          <Search size={17} />
          <input
            placeholder={l('ابحث عن نشاط أو مهارة…', 'Rechercher une activité ou une compétence…')}
            aria-label={l('بحث الأنشطة', 'Rechercher une activité')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label={l('صيغة النشاط', 'Format')}
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          <option value="">{l('كل الصيغ', 'Tous les formats')}</option>
          <option value="individual">{t('individual')}</option>
          <option value="group">{t('group')}</option>
        </select>
        <Button
          variant={favorites ? 'primary' : 'secondary'}
          onClick={() => setFavorites((v) => !v)}
        >
          <Heart size={15} />
          {l('المفضلة', 'Favoris')}
        </Button>
        <div className="view-switch">
          <IconButton label={l('بطاقات', 'Cartes')} onClick={() => setView('grid')}>
            <Grid2X2 size={17} />
          </IconButton>
          <IconButton label={l('قائمة', 'Liste')} onClick={() => setView('list')}>
            <List size={17} />
          </IconButton>
        </div>
      </Panel>
      <p className="results-count">
        {visible.length} {l('نشاطاً متاحاً', 'activités disponibles')}
      </p>
      <div className={`activity-grid ${view === 'list' ? 'list-view' : ''}`}>
        {visible.map((a, i) => (
          <Panel className={`activity-card activity-color-${i % 5}`} key={a.id}>
            <div className="activity-art">
              <BookOpen size={32} strokeWidth={1} />
              <span className="activity-art-shape" />
              <span className="activity-art-dots" />
              <Badge>{a.id.startsWith('ACT-0') ? a.id : l('نشاط مضاف', 'Activité ajoutée')}</Badge>
              <IconButton
                label={l('تبديل المفضلة', 'Ajouter ou retirer des favoris')}
                onClick={() =>
                  setFavoriteIds(ids=>{const next=ids.includes(a.id)?ids.filter(id=>id!==a.id):[...ids,a.id];localStorage.setItem(favoriteKey,JSON.stringify(next));return next;})
                }
              >
                <Heart size={16} fill={favoriteIds.includes(a.id) ? 'currentColor' : 'none'} />
              </IconButton>
            </div>
            <div className="activity-card-content">
              <Badge tone="green">{b(skills[a.category as keyof typeof skills])}</Badge>
              <h2>
                <button onClick={() => setDetail(a)}>{b(a.title)}</button>
              </h2>
              <p>{b(a.description)}</p>
              <div className="activity-card-meta">
                <span>
                  <Clock3 size={13} />
                  {a.duration} {t('minute')}
                </span>
                <span>
                  <Users size={13} />
                  {t(a.format)}
                </span>
                <span>
                  {a.minAge}–{a.maxAge} {l('سنة', 'ans')}
                </span>
              </div>
              <div className="activity-card-footer">
                <Button variant="secondary" onClick={() => setDetail(a)}>
                  {l('اكتشاف النشاط', 'Voir l’activité')}
                </Button>
                <RecommendationLink
                  contexts={['workshops', 'support-activities']}
                  activityId={a.id}
                  className="icon-button"
                >
                  <Plus size={18} />
                </RecommendationLink>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      {!visible.length && <Empty title={t('noResults')} />}
      <Panel className="professional-resource-panel">
        <div className="section-heading">
          <h2>{l('الموارد المهنية', 'Ressources professionnelles')}</h2>
          <Badge>{data.resources.length}</Badge>
        </div>
        <div className="resource-card-grid">
          {data.resources
            .filter((r) =>
              normalize(`${b(r.title)} ${b(r.description)}`).includes(normalize(query)),
            )
            .map((resource) => (
              <button
                key={resource.id}
                className="resource-card"
                onClick={() => setParams({ resource: resource.id })}
              >
                <BookOpen size={22} />
                <strong>{b(resource.title)}</strong>
                <p>{b(resource.description)}</p>
                <small>{b(resource.source)}</small>
              </button>
            ))}
        </div>
      </Panel>
      <ActivityDetails
        activity={detail ?? linkedActivity}
        onClose={() => {
          setDetail(null);
          closeLinked();
        }}
      />
      <ResourceDetails resource={linkedResource} onClose={closeLinked} />
      <Modal
        wide
        open={create}
        onClose={() => setCreate(false)}
        title={l('نشاط تربوي جديد', 'Nouvelle activité éducative')}
        description={l(
          'تضاف كمورد تجريبي يحتاج إلى مراجعة مهنية قبل استعماله.',
          'La ressource est un exemple à examiner avant toute utilisation.',
        )}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="dialog-body form-grid">
            <Field required label={l('العنوان بالعربية', 'Titre arabe')}>
              <input
                required
                value={draft.ar}
                onChange={(e) => setDraft((p) => ({ ...p, ar: e.target.value }))}
              />
            </Field>
            <Field required label={l('العنوان بالفرنسية', 'Titre français')}>
              <input
                required
                value={draft.fr}
                onChange={(e) => setDraft((p) => ({ ...p, fr: e.target.value }))}
              />
            </Field>
            <Field label={l('الفئة والمهارة', 'Catégorie et compétence')}>
              <select
                value={draft.category}
                onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
              >
                {Object.entries(skills).map(([key, value]) => (
                  <option key={key} value={key}>
                    {b(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={l('المدة بالدقائق', 'Durée (min)')}>
              <input
                type="number"
                min={5}
                max={180}
                required
                value={draft.duration}
                onChange={(e) => setDraft((p) => ({ ...p, duration: Number(e.target.value) }))}
              />
            </Field>
            <Field label={l('الحد الأدنى للعمر', 'Âge minimum')}>
              <input
                type="number"
                min={0}
                max={17}
                value={draft.minAge}
                onChange={(e) => setDraft((p) => ({ ...p, minAge: Number(e.target.value) }))}
              />
            </Field>
            <Field label={l('الحد الأقصى للعمر', 'Âge maximum')}>
              <input
                type="number"
                min={0}
                max={17}
                value={draft.maxAge}
                onChange={(e) => setDraft((p) => ({ ...p, maxAge: Number(e.target.value) }))}
              />
            </Field>
            <Field label={l('الصيغة', 'Format')}>
              <select
                value={draft.format}
                onChange={(e) => setDraft((p) => ({ ...p, format: e.target.value }))}
              >
                <option value="individual">{t('individual')}</option>
                <option value="group">{t('group')}</option>
              </select>
            </Field>
            <div className="full-span">
              <Field
                required
                label={l(
                  'تعليمات التنفيذ (بلغة التحرير الأصلية)',
                  'Instructions (conservées dans la langue de saisie)',
                )}
              >
                <textarea
                  required
                  value={draft.instructions}
                  onChange={(e) => setDraft((p) => ({ ...p, instructions: e.target.value }))}
                />
              </Field>
            </div>
          </div>
          <div className="dialog-footer">
            <Button type="button" variant="secondary" onClick={() => setCreate(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit">
              <Check size={16} />
              {t('save')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
