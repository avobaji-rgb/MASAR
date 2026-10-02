export type PublicLanguage = 'en' | 'ar';
export type PublicPage = 'welcome' | 'demo' | 'garages' | 'membership';

// The published domain was verified through deployment metadata. Override when moving domains.
export const siteOrigin = (typeof process !== 'undefined' && process.env.PUBLIC_SITE_URL || 'https://masar-mobility-syria.replit.app').replace(/\/$/, '');
export const publicPages: PublicPage[] = ['welcome', 'demo', 'garages', 'membership'];

export function publicPath(page: PublicPage, language: PublicLanguage): string {
  const slug = page === 'welcome' ? '/' : `/${page}`;
  return language === 'ar' ? `/ar${slug}` : slug;
}

export function publicRoute(path: string): { page: PublicPage; language: PublicLanguage } | null {
  const normalized = path.replace(/\/+$/, '') || '/';
  for (const language of ['en', 'ar'] as const) {
    for (const page of publicPages) {
      if ((publicPath(page, language).replace(/\/+$/, '') || '/') === normalized) return { page, language };
    }
  }
  return null;
}

export const pageMetadata: Record<PublicLanguage, Record<PublicPage, { title: string; description: string }>> = {
  en: {
    welcome: { title: 'Welcome to MASAR | Mobility Syria', description: 'Explore MASAR Mobility Syria, a bilingual roadside assistance experience. This is a demo: no real roadside help requests are sent.' },
    demo: { title: 'Roadside Assistance Demo | MASAR Mobility Syria', description: 'Explore the MASAR roadside assistance demo for drivers in Syria. Demo requests stay local and do not contact a real provider.' },
    garages: { title: 'Garage Map | MASAR Mobility Syria', description: 'Explore cities in Syria on the MASAR garage map. Verified partner garages will be shown only when they are available.' },
    membership: { title: 'Proposed Membership Plans | MASAR Mobility Syria', description: 'Compare proposed Basic and Premium membership plans. Bank details are not available yet; do not send payment or rely on coverage.' },
  },
  ar: {
    welcome: { title: 'أهلاً بك في مسار | للتنقل في سوريا', description: 'استكشف مسار للتنقل في سوريا. هذا عرض تجريبي للمساعدة على الطريق، ولا يرسل طلبات مساعدة حقيقية.' },
    demo: { title: 'عرض المساعدة على الطريق | مسار سوريا', description: 'استكشف عرض مسار التجريبي للمساعدة على الطريق في سوريا. لا تتواصل الطلبات التجريبية مع مقدم خدمة حقيقي.' },
    garages: { title: 'خريطة الكراجات | مسار سوريا', description: 'استكشف مدن سوريا على خريطة مسار. لن تُعرض الكراجات الشريكة إلا بعد التحقق منها وتوفرها.' },
    membership: { title: 'باقات الاشتراك المقترحة | مسار سوريا', description: 'قارن باقات مسار الأساسية والمميزة المقترحة. تفاصيل البنك غير متاحة بعد؛ لا ترسل أي دفعة ولا تعتمد على التغطية.' },
  },
};