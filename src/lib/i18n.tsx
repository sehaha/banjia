import { createContext, useContext, useState, type ReactNode } from 'react';

// Lightweight i18n: Chinese is the default/priority language, English is opt-in
// via the header toggle. `t(zh, en)` reads a module-level current language so it
// works from anywhere (components, ui helpers, data maps). The provider keeps the
// module var in lockstep with React state; App consumes the context so a language
// switch re-renders the whole tree.
export type Lang = 'zh' | 'en';
const KEY = 'mg_lang';

function initialLang(): Lang {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'zh'; } catch { return 'zh'; }
}

let _lang: Lang = initialLang();

/** Pick the English string when English is active, otherwise the Chinese one. */
export function t(zh: string, en: string): string {
  return _lang === 'en' ? en : zh;
}
export function curLang(): Lang { return _lang; }

interface I18n { lang: Lang; setLang: (l: Lang) => void; }
const Ctx = createContext<I18n>({ lang: 'zh', setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(_lang);
  _lang = lang; // keep the module var in sync with what's rendered
  const setLang = (l: Lang) => {
    _lang = l;
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    setLangState(l);
  };
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n { return useContext(Ctx); }
