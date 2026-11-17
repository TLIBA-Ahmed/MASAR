import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import ar from './ar.json';
import fr from './fr.json';
import type { Bi, Language } from '../types';
const stored = localStorage.getItem('masar.language');
void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, fr: { translation: fr } },
  lng: stored === 'fr' ? 'fr' : 'ar',
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});
function applyLanguage(lng: string) {
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  localStorage.setItem('masar.language', lng);
}
i18n.on('languageChanged', applyLanguage);
applyLanguage(i18n.language);
export function useLocale() {
  const { t, i18n: instance } = useTranslation();
  const lang: Language = instance.language === 'fr' ? 'fr' : 'ar';
  return {
    t,
    lang,
    l: (a: string, f: string) => (lang === 'ar' ? a : f),
    b: (v: Bi) => v[lang],
    setLanguage: (value: Language) => void instance.changeLanguage(value),
    date: (v: string, opts?: Intl.DateTimeFormatOptions) =>
      !v || Number.isNaN(Date.parse(v))
        ? '—'
        : new Intl.DateTimeFormat(
            lang === 'ar' ? 'ar-TN' : 'fr-TN',
            opts ?? { day: 'numeric', month: 'short', year: 'numeric' },
          ).format(new Date(`${v.slice(0, 10)}T12:00:00`)),
    number: (v: number) => new Intl.NumberFormat(lang === 'ar' ? 'ar-TN' : 'fr-TN').format(v),
  };
}
export default i18n;
