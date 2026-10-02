import { en } from './locales/en';
import { ar } from './locales/ar';
import type { PublicLanguage } from './public-seo';
import { publicPath } from './public-seo';

/** Public, non-personalized first response for the demo application route. */
export function DemoPreview({ language }: { language: PublicLanguage }) {
  const t = language === 'ar' ? ar : en;
  return <main className="page-wrap" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <section className="hero"><div className="hero-content">
      <div className="eyebrow">{t.brandTagline}</div>
      <h1>{t.heroTitle}</h1><p>{t.heroBody}</p>
      <p>{t.demoNotice}</p>
    </div></section>
    <section><h2>{t.whyMasar}</h2><p>{t.calmGuidance} · {t.localCare} · {t.alwaysClear}</p></section>
    <a href={publicPath('garages', language)}>{language === 'ar' ? 'خريطة الكراجات' : 'Explore the garage map'}</a>
  </main>;
}