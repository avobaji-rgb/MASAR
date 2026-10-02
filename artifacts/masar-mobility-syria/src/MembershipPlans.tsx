import { useState } from 'react';
import { CarFront, Check, CircleHelp, Copy, Info, Route, ShieldCheck } from 'lucide-react';
import './MembershipPlans.css';
import { useAuth } from '@clerk/react';
import { useGetMembership, getGetMembershipQueryKey } from '@workspace/api-client-react';

type Language = 'en' | 'ar';
type Billing = 'annual' | 'monthly';

const content = {
  en: {
    kicker: 'MASAR / SUBSCRIPTIONS',
    title: 'A little more certainty for the road ahead.',
    lead: 'Compare the proposed plans for registered vehicles. Membership will be confirmed manually after a bank transfer.',
    compare: 'Find your fit',
    compareDetail: 'Two straightforward options for drivers in Syria.',
    annual: 'Pay annually',
    monthly: 'Pay monthly',
    save: 'Save',
    basic: 'Basic',
    basicIntro: 'A considered starting point for your everyday car.',
    premium: 'Premium',
    premiumIntro: 'More room for the cars and journeys you look after.',
    moreFlexibility: 'More flexibility',
    perYear: '/ year',
    perMonth: '/ month',
    annualDetail: (equivalent: string) => `Paid upfront for the year · equivalent to $${equivalent}/month`,
    monthlyDetail: (total: number) => `$${total} over 12 monthly payments, if kept for a full year`,
    includes: 'Proposed benefits — not active',
    basicFeatures: [
      'One registered car and one licence plate',
      'Roadside request registration for your registered car',
      'Towing request registration when the vehicle needs transporting',
    ],
    premiumFeatures: [
      'Up to three registered cars and licence plates',
      'Roadside and towing request registration',
      'Request replacement transport (subject to separate availability confirmation)',
      'Specify a preferred towing garage (subject to provider confirmation)',
    ],
    basicFoot: 'For a driver who wants to plan ahead for one vehicle.',
    premiumFoot: 'For households or drivers managing more than one car.',
    termsTitle: 'Before you rely on a plan',
    termsBody: 'Service availability, response times, usage limits, refunds and monthly cancellation rules are not yet agreed. Existing paid members can submit to an operator queue; a provider must accept an offer before availability is confirmed. Replacement transport needs separate confirmation.',
    paymentTitle: 'Bank transfer details are not available yet',
    paymentBody: 'Do not send money yet. We will publish the verified business bank account details here when they are ready. An operator will check the bank statement before activating a membership; sending money alone does not activate coverage.',
    unavailable: 'Bank details coming soon',
    agreementTitle: 'Proposed subscription agreement',
    agreementIntro: 'Draft for review only. These details do not constitute an offer you can accept, and no contract is signed here.',
    agreementItems: [
      'Provider: MASAR Mobility Syria.',
      'Proposed service area: Aleppo, Syria.',
      'Basic: one registered vehicle; Premium: up to three, with a request for replacement transport and choice of towing garage. Services depend on confirmed availability.',
      'Proposed prices: Basic $99 yearly or $13 monthly; Premium $179 yearly or $18 monthly. Bank details are not available yet; do not send payment.',
      'For a yearly contract, cancellation must be requested at least one month before the yearly contract expires (as specified by the provider).',
    ],
    agreementMissing: 'Still to confirm before this can become a binding agreement: provider contact address, exact service coverage and exclusions, response and usage conditions, refund policy, and the term and cancellation rules for monthly billing. Have the final terms reviewed by a qualified local lawyer.',
    active: 'Verified paid subscription', inactive: 'No active paid subscription',
    error: 'Unable to verify your subscription right now. Please try again.',
    checking: 'Checking your membership…',
    statusLabel: 'Your membership',
    accountId: 'Account ID for manual verification',
    copyId: 'Copy ID',
    copiedId: 'Copied',
    copyFailed: 'Could not copy. Please select the ID instead.',
  },
  ar: {
    kicker: 'مسار / الاشتراكات',
    title: 'اطمئنان أكبر للطريق القادم.',
    lead: 'قارن الباقات المقترحة للمركبات المسجلة. يُفعّل الاشتراك يدوياً بعد التحقق من الحوالة المصرفية.',
    compare: 'اختر ما يناسبك',
    compareDetail: 'خياران واضحان للسائقين في سوريا.',
    annual: 'دفع سنوي',
    monthly: 'دفع شهري',
    save: 'وفّر',
    basic: 'الأساسية',
    basicIntro: 'بداية مدروسة لمركبتك اليومية.',
    premium: 'المميزة',
    premiumIntro: 'مرونة أكبر للمركبات والرحلات التي تهتم بها.',
    moreFlexibility: 'مرونة أكبر',
    perYear: '/ السنة',
    perMonth: '/ الشهر',
    annualDetail: (equivalent: string) => `يُدفع المبلغ مقدماً للسنة · ما يعادل $${equivalent} شهرياً`,
    monthlyDetail: (total: number) => `$${total} عبر ١٢ دفعة شهرية إذا استمر الاشتراك لسنة كاملة`,
    includes: 'مزايا مقترحة — غير مفعّلة',
    basicFeatures: [
      'مركبة مسجلة واحدة ولوحة واحدة',
      'تسجيل طلب مساعدة على الطريق للمركبة المسجلة',
      'تسجيل طلب سحب عند الحاجة إلى نقل المركبة',
    ],
    premiumFeatures: [
      'حتى ثلاث مركبات مسجلة ولوحاتها',
      'تسجيل طلبات المساعدة والسحب',
      'طلب وسيلة نقل بديلة (بعد تأكيد توفرها بشكل منفصل)',
      'تحديد مرآب مفضل للسحب (بعد تأكيد مقدم الخدمة)',
    ],
    basicFoot: 'للسائق الذي يرغب بالاستعداد لمركبة واحدة.',
    premiumFoot: 'للأسر أو السائقين الذين يديرون أكثر من مركبة.',
    termsTitle: 'قبل الاعتماد على أي باقة',
    termsBody: 'لم تُحدد بعد شروط التوافر وأوقات الاستجابة وحدود الاستخدام والاسترداد وإلغاء الدفع الشهري. يمكن للمشترك الحالي تقديم طلب إلى قائمة المشغلين؛ لا يتأكد توفر الخدمة إلا بعد قبول مقدم الخدمة للعرض، ويستلزم النقل البديل تأكيداً منفصلاً.',
    paymentTitle: 'تفاصيل التحويل المصرفي غير متاحة بعد',
    paymentBody: 'لا ترسل أي أموال الآن. سننشر تفاصيل الحساب المصرفي التجاري المؤكدة هنا عندما تصبح جاهزة. يتحقق الموظف من وصول المبلغ إلى البنك قبل تفعيل الاشتراك؛ التحويل وحده لا يفعّل التغطية.',
    unavailable: 'تفاصيل البنك قريباً',
    agreementTitle: 'مسودة اتفاقية الاشتراك',
    agreementIntro: 'مسودة للمراجعة فقط. هذه التفاصيل ليست عرضاً قابلاً للقبول ولا يُوقَّع أي عقد هنا.',
    agreementItems: [
      'مقدم الخدمة: MASAR Mobility Syria.',
      'نطاق الخدمة المقترح: حلب، سوريا.',
      'الأساسية: مركبة مسجلة واحدة؛ المميزة: حتى ثلاث مركبات، مع إمكانية طلب نقل بديل واختيار مرآب السحب. تخضع الخدمات للتوافر المؤكد.',
      'الأسعار المقترحة: الأساسية 99 دولاراً سنوياً أو 13 دولاراً شهرياً؛ المميزة 179 دولاراً سنوياً أو 18 دولاراً شهرياً. تفاصيل البنك غير متاحة بعد؛ لا ترسل أي دفعة.',
      'بالنسبة للعقد السنوي، يجب طلب الإلغاء قبل شهر واحد على الأقل من انتهاء العقد السنوي (وفقاً لما حدده مقدم الخدمة).',
    ],
    agreementMissing: 'يجب تحديد عنوان التواصل التجاري ونطاق الخدمة واستثناءاتها وأوقات الاستجابة وحدود الاستخدام وسياسة الاسترداد ومدة الدفع الشهري وشروط إلغائه قبل اعتماد عقد ملزم. راجع الشروط النهائية مع محامٍ محلي مؤهل.',
    active: 'اشتراك مدفوع تم التحقق منه', inactive: 'لا يوجد اشتراك مدفوع نشط',
    error: 'تعذّر التحقق من اشتراكك الآن. حاول مجدداً.',
    checking: 'جارٍ التحقق من اشتراكك…',
    statusLabel: 'حالة اشتراكك',
    accountId: 'معرّف الحساب للتحقق اليدوي',
    copyId: 'نسخ المعرّف',
    copiedId: 'تم النسخ',
    copyFailed: 'تعذر النسخ. يمكنك تحديد المعرّف ونسخه يدوياً.',
  },
};

const plans = [
  { id: 'basic', annual: 99, monthly: 13, yearlyMonthly: 156 },
  { id: 'premium', annual: 179, monthly: 18, yearlyMonthly: 216 },
] as const;

/** First-response content reusing the public plan copy without querying a visitor's account. */
export function MembershipPublicPreview({ language }: { language: Language }) {
  const t = content[language];
  return <main className="page-wrap membership-plans" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <header className="membership-hero"><span className="membership-kicker">{t.kicker}</span>
      <h1>{t.title}</h1><p>{t.lead}</p>
      <div className="membership-pause"><strong>{t.paymentTitle}</strong><p>{t.paymentBody}</p></div>
    </header>
    <section aria-label={t.compare}><h2>{t.compare}</h2><p>{t.compareDetail}</p>
      <div className="membership-grid">{plans.map(plan => <article className="membership-card" key={plan.id}>
        <h3>{plan.id === 'basic' ? t.basic : t.premium}</h3>
        <p>{plan.id === 'basic' ? t.basicIntro : t.premiumIntro}</p>
        <p>${plan.annual} {t.perYear} · ${plan.monthly} {t.perMonth}</p>
        <p>{t.includes}</p>
        <ul className="membership-features">{(plan.id === 'basic' ? t.basicFeatures : t.premiumFeatures).map(feature => <li key={feature}>{feature}</li>)}</ul>
      </article>)}</div>
    </section>
    <section className="membership-agreement"><h2>{t.agreementTitle}</h2><p>{t.agreementIntro}</p><ul>{t.agreementItems.map(item => <li key={item}>{item}</li>)}</ul><p>{t.agreementMissing}</p></section>
    <aside className="membership-bottom"><h2>{t.termsTitle}</h2><p>{t.termsBody}</p></aside>
  </main>;
}

export function MembershipPlans({ language }: { language: Language }) {
  const [billing, setBilling] = useState<Billing>('annual');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const { isSignedIn, userId } = useAuth();
  const status = useGetMembership({ query: { queryKey: getGetMembershipQueryKey(), enabled: !!isSignedIn, staleTime: 0, refetchInterval: 15000, retry: false } });
  const t = content[language];
  const active = status.data?.active && !status.isError;
  const copyId = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <main className="page-wrap membership-plans" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <header className="membership-hero">
        <span className="membership-kicker">{t.kicker}</span>
        <h1 data-testid="text-membership-title">{t.title}</h1>
        <p>{t.lead}</p>
        <div className="membership-pause" id="membership-payment-unavailable" role="status">
          <strong>{t.paymentTitle}</strong>
          <p>{t.paymentBody}</p>
        </div>
        {isSignedIn && <div className="membership-status">
          <div className="membership-status-main">
            <span className="membership-status-icon" aria-hidden="true">
              {active ? <ShieldCheck size={20} strokeWidth={1.8} /> : <CircleHelp size={20} strokeWidth={1.8} />}
            </span>
            <div className="membership-status-copy" aria-live="polite">
              <span className="membership-status-label">{t.statusLabel}</span>
              <strong>{status.isLoading ? t.checking : status.isError ? t.error : active ? t.active : t.inactive}</strong>
              {active && status.data && <span className="membership-status-plan">
                {status.data.plan === 'premium' ? t.premium : t.basic} · {status.data.billing === 'annual' ? t.annual : t.monthly}
              </span>}
            </div>
          </div>
          {userId && <details className="membership-account-reference">
            <summary>{t.accountId}</summary>
            <div className="membership-account-reference-value">
              <code dir="ltr">{userId}</code>
              <button type="button" onClick={copyId} aria-label={t.copyId}>
                <Copy size={15} aria-hidden="true" /> {copyState === 'copied' ? t.copiedId : t.copyId}
              </button>
            </div>
            {copyState === 'error' && <p role="alert">{t.copyFailed}</p>}
          </details>}
        </div>}
      </header>

      <section aria-labelledby="membership-compare-title">
        <div className="membership-intro">
          <div>
            <h2 id="membership-compare-title">{t.compare}</h2>
            <p>{t.compareDetail}</p>
          </div>
          <div className="membership-billing" role="group" aria-label={language === 'ar' ? 'طريقة الدفع' : 'Billing frequency'}>
            <button type="button" aria-pressed={billing === 'annual'} onClick={() => setBilling('annual')} data-testid="button-billing-annual">
              {t.annual} <span className="billing-save">{t.save}</span>
            </button>
            <button type="button" aria-pressed={billing === 'monthly'} onClick={() => setBilling('monthly')} data-testid="button-billing-monthly">{t.monthly}</button>
          </div>
        </div>
        <nav className="membership-glance" aria-label={t.compare}>
          {plans.map(plan => <a key={plan.id} href={`#membership-${plan.id}-title`} data-testid={`link-plan-${plan.id}`}>
            <span>{plan.id === 'basic' ? t.basic : t.premium}</span>
            <strong dir="ltr">${billing === 'annual' ? plan.annual : plan.monthly}<small>{billing === 'annual' ? t.perYear : t.perMonth}</small></strong>
          </a>)}
        </nav>

        <div className="membership-grid">
          {plans.map(plan => {
            const premium = plan.id === 'premium';
            const features = premium ? t.premiumFeatures : t.basicFeatures;
            return (
              <article className={`membership-card ${premium ? 'premium' : ''}`} key={plan.id} aria-labelledby={`membership-${plan.id}-title`} data-testid={`card-plan-${plan.id}`}>
                <div className="membership-card-top">
                  <span className="membership-icon" aria-hidden="true">{premium ? <Route size={23} strokeWidth={1.8} /> : <CarFront size={23} strokeWidth={1.8} />}</span>
                  {premium && <span className="membership-label">{t.moreFlexibility}</span>}
                </div>
                <h3 id={`membership-${plan.id}-title`}>{premium ? t.premium : t.basic}</h3>
                <p className="membership-card-subtitle">{premium ? t.premiumIntro : t.basicIntro}</p>
                <div className="membership-price" dir="ltr" data-testid={`text-price-${plan.id}`}>
                  <strong>${billing === 'annual' ? plan.annual : plan.monthly}</strong>
                  <span>{billing === 'annual' ? t.perYear : t.perMonth}</span>
                </div>
                <p className="membership-price-detail" data-testid={`text-price-detail-${plan.id}`}>
                  {billing === 'annual' ? t.annualDetail((plan.annual / 12).toFixed(2)) : t.monthlyDetail(plan.yearlyMonthly)}
                </p>
                <div className="membership-card-rule" />
                <p className="membership-feature-heading">{t.includes}</p>
                <ul className="membership-features">
                  {features.map(feature => <li key={feature}><Check size={17} strokeWidth={2.5} aria-hidden="true" /><span>{feature}</span></li>)}
                </ul>
                <div className="membership-card-foot"><p>{premium ? t.premiumFoot : t.basicFoot}</p></div>
                 <button type="button" className="button button-navy" disabled aria-describedby="membership-payment-unavailable">{t.unavailable}</button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="membership-agreement" aria-labelledby="membership-agreement-title">
        <h2 id="membership-agreement-title">{t.agreementTitle}</h2>
        <p>{t.agreementIntro}</p>
        <ul>{t.agreementItems.map(item => <li key={item}>{item}</li>)}</ul>
        <p className="membership-agreement-missing">{t.agreementMissing}</p>
      </section>
      <aside className="membership-bottom" aria-label={language === 'ar' ? 'ملاحظات مهمة' : 'Important plan notes'}>
        <div className="membership-bottom-block">
          <span className="membership-bottom-icon" aria-hidden="true"><Info size={19} /></span>
           <div><h3>{language === 'ar' ? 'الاشتراك والتحقق' : 'Subscription and verification'}</h3><p data-testid="text-membership-demo-note">{language === 'ar' ? 'تفاصيل الحساب المصرفي غير متاحة بعد. لا تُفعّل العضوية إلا بعد أن يتحقق الموظف من وصول الحوالة.' : 'Bank details are not available yet. An operator activates membership only after checking that the transfer arrived.'}</p></div>
        </div>
        <div className="membership-bottom-block">
          <span className="membership-bottom-icon" aria-hidden="true"><CircleHelp size={19} /></span>
          <div><h3>{t.termsTitle}</h3><p>{t.termsBody}</p></div>
        </div>
      </aside>
    </main>
  );
}