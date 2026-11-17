import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Mail, Pencil, UserRoundCheck } from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { features } from '../../config/features';
import { useLocale } from '../../i18n';
import type { Professional } from '../../types';
import {
  Avatar,
  Badge,
  Button,
  Field,
  Info,
  Modal,
  PageHeading,
  Panel,
  useAction,
  useToast,
} from '../../components/ui';
export function Professionals() {
  const { l, b, t } = useLocale();
  const { data, session, mutate, signIn } = useWorkspace();
  const toast = useToast();
  const run = useAction();
  const [edit, setEdit] = useState<Professional | null>(null);
  const [draft, setDraft] = useState({ ar: '', fr: '', email: '', availability: '' });
  return (
    <>
      <PageHeading
        title={t('professionals')}
        description={l(
          'فريق متعدد الاختصاصات، ومسؤوليات تتكامل حول مسار الطفل.',
          'Une équipe pluridisciplinaire, des contributions autour d’un même parcours.',
        )}
      />
      <Info tone="orange">
        {l(
          'هويات اصطناعية للعرض فقط. تُحل التكليفات والصلاحيات بواسطة الخادم من قاعدة البيانات.',
          'Identités fictives de démonstration. Le backend résout les affectations et les autorisations depuis la base.',
        )}
      </Info>
      <div className="professional-grid">
        {data.professionals
          .filter((p) => p.centerId === session!.centerId)
          .map((p, i) => (
            <Panel className="professional-card" key={p.id}>
              <div className="card-topline">
                <Avatar name={b(p.name)} size="lg" color={i} />
                {p.id === session!.professionalId ? (
                  <Badge tone="green">{l('هويتك الحالية', 'Profil actuel')}</Badge>
                ) : (
                  <Badge>{t(p.role)}</Badge>
                )}
              </div>
              <h2>{b(p.name)}</h2>
              <p>{b(p.specialty)}</p>
              <span>
                <Mail size={14} />
                {p.email}
              </span>
              <span>
                <CalendarClock size={14} />
                {p.availability}
              </span>
              <div className="professional-contribution">
                <strong>{p.id===session!.userId?data.assignments.filter((a) => a.professionalId === p.id).length:'—'}</strong>
                <small>{l('ملفات مسندة تجريبياً', 'dossiers affectés (simulation)')}</small>
              </div>
              <div className="professional-actions">
                <Button
                  variant="secondary"
                  disabled={Boolean(data.backend)}
                  onClick={() => {
                    setEdit(p);
                    setDraft({
                      ar: p.name.ar,
                      fr: p.name.fr,
                      email: p.email,
                      availability: p.availability,
                    });
                  }}
                >
                  <Pencil size={14} />
                  {l('تحديث الملف', 'Modifier le profil')}
                </Button>
                {p.id !== session!.professionalId && (
                  <Button
                    onClick={() =>
                      void signIn(p.id)
                        .then(() =>
                          toast(
                            l('تغيرت الهوية المهنية التجريبية.', 'Profil de démonstration changé.'),
                          ),
                        )
                        .catch(() =>
                          toast(l('تعذّر تغيير الهوية.', 'Impossible de changer de profil.'), true),
                        )
                    }
                  >
                    <UserRoundCheck size={15} />
                    {l('تجربة الهوية', 'Utiliser ce profil')}
                  </Button>
                )}
              </div>
            </Panel>
          ))}
      </div>
      <Modal
        open={Boolean(edit)}
        onClose={() => setEdit(null)}
        title={l('تحديث الملف المهني الاصطناعي', 'Modifier le profil professionnel fictif')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const result = run(() => {
              mutate((d) => {
                if (!draft.email.endsWith('.test')) throw Error('VALIDATION');
                const p = d.professionals.find((p) => p.id === edit?.id)!;
                p.name = { ar: draft.ar, fr: draft.fr };
                p.email = draft.email;
                p.availability = draft.availability;
              });
              return true;
            });
            if (result) setEdit(null);
          }}
        >
          <div className="dialog-body">
            <Field required label={l('اسم اصطناعي بالعربية', 'Nom fictif en arabe')}>
              <input
                required
                value={draft.ar}
                onChange={(e) => setDraft((p) => ({ ...p, ar: e.target.value }))}
              />
            </Field>
            <Field required label={l('اسم اصطناعي بالفرنسية', 'Nom fictif en français')}>
              <input
                required
                value={draft.fr}
                onChange={(e) => setDraft((p) => ({ ...p, fr: e.target.value }))}
              />
            </Field>
            <Field
              required
              label={l('بريد تجريبي ينتهي بـ .test', 'Adresse fictive finissant par .test')}
            >
              <input
                required
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
              />
            </Field>
            <Field label={l('التوفر', 'Disponibilités')}>
              <input
                value={draft.availability}
                onChange={(e) => setDraft((p) => ({ ...p, availability: e.target.value }))}
              />
            </Field>
          </div>
          <div className="dialog-footer">
            <Button type="button" variant="secondary" onClick={() => setEdit(null)}>
              {t('cancel')}
            </Button>
            <Button type="submit">{t('save')}</Button>
          </div>
        </form>
      </Modal>
      <div className="profile-navigation">
        <Link className="button secondary" to="/supervision">
          {t('supervision')}
        </Link>
        {features.professionalNetwork&&<Link className="button secondary" to="/network">
          {t('network')}
        </Link>}
      </div>
    </>
  );
}
