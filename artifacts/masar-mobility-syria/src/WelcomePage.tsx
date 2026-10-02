import { ArrowRight, Compass, ShieldCheck } from 'lucide-react';
import './WelcomePage.css';
import { publicPath } from './public-seo';

type Language = 'en' | 'ar';

type WelcomePageProps = {
  language: Language;
};

const copy = {
  en: {
    brandContext: 'Mobility Syria',
    location: 'Made for the road ahead',
    photoAlt: 'A MASAR roadside assistance technician beside a car and a yellow service van.',
    storyTitle: 'A clearer way forward, wherever the road takes you.',
    storyBody: 'A calm place to find your next step when your journey does not go to plan.',
    storyFooter: 'Here for the journey',
    step: 'First, make yourself at home',
    title: 'Welcome to MASAR.',
    intro: 'Sign in or create an account to get started. You can change the language on your profile page.',
    continueLabel: 'Continue with your account',
    signIn: 'Sign in',
    signUp: 'Create an account',
    demoTitle: 'Just looking around?',
    demoBody: 'Explore a public, local-only breakdown demo. It does not create an account, contact a provider, or send a real roadside assistance request.',
    demoLink: 'Explore the demo',
    legal: 'MASAR Mobility Syria · A more reassuring start to every journey.',
  },
  ar: {
    brandContext: 'للتنقل في سوريا',
    location: 'صُمّم للطريق أمامك',
    photoAlt: 'فني مساعدة على الطريق من مسار بجانب سيارة ومركبة خدمة صفراء.',
    storyTitle: 'خطوة أوضح إلى الأمام، أينما يأخذك الطريق.',
    storyBody: 'مساحة هادئة تساعدك على معرفة خطوتك التالية عندما لا تسير رحلتك كما توقعت.',
    storyFooter: 'معك في رحلتك',
    step: 'أولاً، اختر ما يناسبك',
    title: 'أهلاً بك في مسار.',
    intro: 'سجّل الدخول أو أنشئ حساباً للبدء. يمكنك تغيير اللغة من صفحة ملفك الشخصي.',
    continueLabel: 'تابع إلى حسابك',
    signIn: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',
    demoTitle: 'تريد الاستكشاف أولاً؟',
    demoBody: 'استكشف عرضاً تجريبياً عاماً لحالات تعطل السيارة يعمل محلياً فقط. لا ينشئ حساباً، ولا يتواصل مع مزود خدمة، ولا يرسل طلب مساعدة حقيقي على الطريق.',
    demoLink: 'استكشف العرض التجريبي',
    legal: 'مسار للتنقل في سوريا · بداية أكثر اطمئناناً لكل رحلة.',
  },
} as const;

export default function WelcomePage({ language }: WelcomePageProps) {
  const t = copy[language];

  return (
    <main className="masar-welcome" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <div className="masar-welcome__shell">
        <section className="masar-welcome__story" aria-labelledby="welcome-story-title">
          <span className="masar-welcome__photo-label">{t.location}</span>
          <figure className="masar-welcome__photo">
            <img src={`${import.meta.env.BASE_URL}masar/roadside-service-evening.webp`} alt={t.photoAlt} width={1024} height={512} data-testid="img-welcome-photo" />
          </figure>
          <div className="masar-welcome__story-content">
            <span className="masar-welcome__story-rule" aria-hidden="true" />
            <h2 id="welcome-story-title">{t.storyTitle}</h2>
            <p>{t.storyBody}</p>
          </div>
          <div className="masar-welcome__story-footer"><span aria-hidden="true" />{t.storyFooter}</div>
        </section>

        <section className="masar-welcome__entry" aria-labelledby="welcome-title">
          <header className="masar-welcome__header">
            <div className="masar-welcome__brand"><img className="masar-welcome__logo" src="/masar/masar-pin.png" alt="" data-testid="img-welcome-logo" /><span>MASAR</span></div>
            <span className="masar-welcome__header-note">{t.brandContext}</span>
          </header>

          <div className="masar-welcome__center">
            <div className="masar-welcome__step"><span className="masar-welcome__step-number">01</span><span>{t.step}</span></div>
            <h1 id="welcome-title" data-testid="text-welcome-title">{t.title}</h1>
            <p className="masar-welcome__intro">{t.intro}</p>

            <div className="masar-welcome__divider"><span>{t.continueLabel}</span></div>
            <nav className="masar-welcome__actions" aria-label={t.continueLabel}>
              <a href="/sign-in" className="masar-welcome__action masar-welcome__action--primary" data-testid="link-welcome-sign-in">
                {t.signIn}<ArrowRight aria-hidden="true" />
              </a>
              <a href="/sign-up" className="masar-welcome__action masar-welcome__action--secondary" data-testid="link-welcome-sign-up">
                {t.signUp}<ArrowRight aria-hidden="true" />
              </a>
            </nav>

            <aside className="masar-welcome__demo" aria-label={t.demoTitle}>
              <div className="masar-welcome__demo-heading"><Compass size={19} aria-hidden="true" /><span>{t.demoTitle}</span></div>
              <p data-testid="text-welcome-demo-disclaimer">{t.demoBody}</p>
              <a href={publicPath('demo', language)} className="masar-welcome__demo-link" data-testid="link-welcome-demo">
                {t.demoLink}<ArrowRight aria-hidden="true" />
              </a>
            </aside>
          </div>

          <p className="masar-welcome__legal"><ShieldCheck size={13} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px', marginInlineEnd: 5 }} />{t.legal}</p>
        </section>
      </div>
    </main>
  );
}