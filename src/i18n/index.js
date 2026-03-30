import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';
import pt_BR from './locales/pt_BR.json';
import ja from './locales/ja.json';
import ru from './locales/ru.json';

i18n.use(initReactI18next).init({
  resources: {
    en:    { translation: en },
    es:    { translation: es },
    pt_BR: { translation: pt_BR },
    ja:    { translation: ja },
    ru:    { translation: ru },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
