import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Compass, ExternalLink, Info, MapPin, Navigation, Phone, RotateCcw, Search, ShieldCheck, Wrench, X } from 'lucide-react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useListPublicPartners, getListPublicPartnersQueryKey } from '@workspace/api-client-react';
import './PartnerGaragesPage.css';

type Language = 'en' | 'ar';
type Props = { language: Language; compact?: boolean };
const copy = {
  en: {
    eyebrow: 'THE GARAGE MAP', title: 'A clearer way to find your way.',
    compactTitle: 'Explore the garage map',
    intro: 'Explore Syria city by city. Verified partner garages will appear here as soon as they join the network.',
    compactIntro: 'Look around Syria now; verified garages will appear here when available.',
    mapSource: 'Map data by OpenStreetMap',
    explore: 'Choose a place to explore', exploreSub: 'Move between cities, or browse the whole country.',
    all: 'All Syria', reset: 'Reset view',
    mapAt: 'Map view:', syria: 'Syria',
    partners: 'Partner garages', verified: 'Only verified listings appear here',
    search: 'Search garages, places or services', clear: 'Clear search',
    emptyKicker: 'A network in the making', emptyTitle: 'No verified garages yet',
    emptyBody: 'We are preparing this space carefully. Until partners are verified, we will not place garage pins or share unconfirmed details.',
    emptyHint: 'The map is ready to explore. Pick a city above to get oriented.',
    filteredTitle: 'Nothing matches this view',
    filteredBody: 'There are no verified listings for this place or search. Try another city or clear your search.',
    seeAll: 'See all locations',
    mapErrorTitle: 'The map could not load',
    mapErrorBody: 'Your connection or browser may be blocking the embedded map. You can still explore directly on OpenStreetMap.',
    openMap: 'Open in OpenStreetMap', mapAttribution: '© OpenStreetMap contributors · HOT style',
    noteTitle: 'A little transparency goes a long way',
    noteBody: 'Locations shown on the map are cities, not garage recommendations. Garage profiles are only published once verified.',
    profile: 'Garage profile', close: 'Close profile', address: 'Address', services: 'Services',
    contact: 'Contact', call: 'Call garage', email: 'Send email', website: 'Visit website',
    directions: 'Get directions', viewMap: 'View on map', location: 'Location',
  },
  ar: {
    eyebrow: 'خريطة الكراجات', title: 'طريق أوضح لتعرف وجهتك.',
    compactTitle: 'استكشف خريطة الكراجات',
    intro: 'استكشف سوريا مدينةً بعد مدينة. ستظهر الكراجات الشريكة الموثّقة هنا فور انضمامها إلى الشبكة.',
    compactIntro: 'تعرّف على المدن الآن، وستظهر الكراجات الموثّقة عند توفرها.',
    mapSource: 'بيانات الخريطة من OpenStreetMap',
    explore: 'اختر مكاناً لاستكشافه', exploreSub: 'تنقّل بين المدن أو تصفّح أنحاء سوريا.',
    all: 'كل سوريا', reset: 'إعادة ضبط الخريطة',
    mapAt: 'عرض الخريطة:', syria: 'سوريا',
    partners: 'الكراجات الشريكة', verified: 'تظهر المواقع الموثّقة فقط هنا',
    search: 'ابحث عن كراج أو مدينة أو خدمة', clear: 'مسح البحث',
    emptyKicker: 'شبكة قيد التأسيس', emptyTitle: 'لا توجد كراجات موثّقة بعد',
    emptyBody: 'نجهّز هذه المساحة بعناية. إلى أن يتم التحقق من الشركاء، لن نضع علامات لكراجات أو ننشر معلومات غير مؤكدة.',
    emptyHint: 'الخريطة جاهزة للاستكشاف. اختر مدينة أعلاه لتتعرّف على المنطقة.',
    filteredTitle: 'لا توجد نتائج لهذا العرض',
    filteredBody: 'لا توجد مواقع موثّقة لهذه المدينة أو لهذا البحث. جرّب مدينة أخرى أو امسح البحث.',
    seeAll: 'عرض جميع المواقع',
    mapErrorTitle: 'تعذّر تحميل الخريطة',
    mapErrorBody: 'قد يكون الاتصال أو المتصفح يمنع عرض الخريطة المضمّنة. يمكنك استكشافها مباشرةً عبر OpenStreetMap.',
    openMap: 'افتح في OpenStreetMap', mapAttribution: '© مساهمو OpenStreetMap · نمط HOT',
    noteTitle: 'الوضوح يطمئنك في الطريق',
    noteBody: 'المدن المعروضة على الخريطة ليست توصيات لكراجات. ننشر ملفات الكراجات بعد التحقق منها فقط.',
    profile: 'ملف الكراج', close: 'إغلاق الملف', address: 'العنوان', services: 'الخدمات',
    contact: 'تواصل', call: 'اتصل بالكراج', email: 'أرسل بريداً إلكترونياً', website: 'زيارة الموقع',
    directions: 'الاتجاهات', viewMap: 'اعرض على الخريطة', location: 'الموقع',
  },
};

const normalized = (text: string) => text.trim().toLocaleLowerCase();
const fallbackClient = new QueryClient();
const osmSearch = (g: { name: string; address: string; city: string }) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${g.address}, ${g.city}`)}`;

function PartnerGaragesInner({ language, compact = false }: Props) {
  const t = copy[language];
  const ar = language === 'ar';
  const partners = useListPublicPartners({ query: { queryKey: getListPublicPartnersQueryKey(), retry: 1 } });
  const garages = useMemo(() => partners.data ?? [], [partners.data]);
  const [city, setCity] = useState('all');
  const [query, setQuery] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const cityList = useMemo(() => Array.from(new Set(garages.map(g => g.city.trim()).filter(Boolean))), [garages]);
  const profile = garages.find(g => g.id === profileId);
  const visible = useMemo(() => garages.filter(g => {
    const needle = normalized(query);
    return (city === 'all' || g.city === city) && (!needle || [g.name, g.city, g.area, g.address, ...g.services].some(v => normalized(v).includes(needle)));
  }), [garages, city, query]);
  useEffect(() => {
    if (!profile) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProfileId(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [profile]);
  const typeLabel = (v: string) => ({ towing: ar ? 'سحب' : 'Towing', garage: ar ? 'كراج' : 'Garage', both: ar ? 'سحب وكراج' : 'Towing & garage' }[v] ?? v);
  return (
    <section className={`pg-page${compact ? ' pg-compact' : ''}`} dir={ar ? 'rtl' : 'ltr'} lang={language} data-testid={compact ? 'section-garages-compact' : 'page-partner-garages'} aria-labelledby={compact ? 'pg-compact-title' : 'pg-page-title'}>
      <div className="pg-topline"><Compass size={15} aria-hidden="true" /> {t.eyebrow}</div>
      <div className="pg-intro"><div>
        {compact ? <h2 id="pg-compact-title">{t.compactTitle}</h2> : <h1 id="pg-page-title">{t.title}</h1>}
        <p>{ar ? 'شركات معتمدة ونشطة سجّلت لدى مسار. لا نعرض مواقع على الخريطة ما لم تكن مؤكدة.' : 'Approved, active companies registered with MASAR. We show no map pins for unconfirmed locations.'}</p>
      </div></div>
      <div className="pg-explorer">
        {cityList.length > 0 && <div className="pg-city-strip" role="group" aria-label={t.explore} data-testid="group-garage-cities">
          <button type="button" className="pg-city" aria-pressed={city === 'all'} onClick={() => setCity('all')}><Compass aria-hidden="true" />{t.all}</button>
          {cityList.map(c => <button key={c} type="button" className="pg-city" aria-pressed={city === c} onClick={() => setCity(c)}><MapPin aria-hidden="true" /><span dir="auto">{c}</span></button>)}
        </div>}
        <aside className="pg-rail" style={{ width: '100%' }} aria-label={t.partners}>
          <div className="pg-rail-head">
            <div className="pg-rail-heading"><span className="pg-rail-icon"><Wrench size={18} aria-hidden="true" /></span><div><h2>{t.partners}</h2><p>{t.verified}</p></div></div>
            <div className="pg-search"><Search aria-hidden="true" />
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search} aria-label={t.search} data-testid="input-search-garages" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label={t.clear}><X aria-hidden="true" /></button>}
            </div>
          </div>
          <div className="pg-rail-content">
            {partners.isLoading ? <div className="pg-map-skeleton" role="status" style={{ minHeight: 120 }} aria-label={ar ? 'جارٍ التحميل' : 'Loading'} />
            : partners.isError ? <div className="pg-empty" role="alert" data-testid="status-garages-error"><h3>{ar ? 'تعذر تحميل الشركاء' : 'Could not load partners'}</h3><p>{ar ? 'تحقق من الاتصال وحاول مجدداً.' : 'Check your connection and try again.'}</p><button type="button" className="pg-reset" onClick={() => void partners.refetch()}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></div>
            : visible.length ? <div className="pg-list" data-testid="list-partner-garages">{visible.map(g => <button key={g.id} type="button" className="pg-garage" onClick={() => setProfileId(g.id)} data-testid={`button-garage-${g.id}`}>
                <strong dir="auto">{g.name}</strong>
                <span><MapPin size={13} aria-hidden="true" /><span dir="auto">{g.address}, {g.city}</span></span>
                <small dir="auto">{[typeLabel(g.type), ...g.services].join(' · ')}</small>
              </button>)}</div>
            : <div className="pg-empty" data-testid={garages.length ? 'status-garages-no-results' : 'status-garages-empty'}>
                <div className="pg-empty-illustration" aria-hidden="true"><MapPin /><span /></div>
                <div className="pg-empty-kicker">{garages.length ? t.partners : t.emptyKicker}</div>
                <h3>{garages.length ? t.filteredTitle : t.emptyTitle}</h3>
                <p>{garages.length ? t.filteredBody : t.emptyBody}</p>
                {garages.length > 0 && <button type="button" className="pg-reset pg-empty-hint" onClick={() => { setCity('all'); setQuery(''); }}><RotateCcw size={13} aria-hidden="true" /> {t.seeAll}</button>}
              </div>}
          </div>
        </aside>
      </div>
      {!compact && <div className="pg-note"><Info size={18} aria-hidden="true" /><div><strong>{t.noteTitle}</strong><p>{ar ? 'تظهر هنا بيانات سجّلتها الشركات واعتُمدت فقط: الاسم والعنوان والهاتف والخدمات.' : 'Only registered, approved details appear here: name, address, phone and services.'}</p></div></div>}
      {profile && <div className="pg-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setProfileId(null); }}>
        <div className="pg-modal" role="dialog" aria-modal="true" aria-labelledby="pg-profile-title" data-testid="dialog-garage-profile">
          <div className="pg-modal-top"><span><Wrench size={16} aria-hidden="true" />{t.profile}</span><button ref={closeRef} type="button" onClick={() => setProfileId(null)} aria-label={t.close}><X size={19} aria-hidden="true" /></button></div>
          <h2 id="pg-profile-title" dir="auto">{profile.name}</h2>
          <div className="pg-modal-location"><MapPin size={17} aria-hidden="true" /><span dir="auto">{profile.address}, {profile.area}, {profile.city}</span></div>
          {profile.hours && <p dir="auto">{ar ? 'ساعات العمل:' : 'Hours:'} {profile.hours}</p>}
          {!!profile.services.length && <div className="pg-modal-section"><h3>{t.services}</h3><div className="pg-service-tags">{profile.services.map((s, i) => <span key={`${s}-${i}`}>{s}</span>)}</div></div>}
          {profile.phone && <div className="pg-modal-section"><h3>{t.contact}</h3><div className="pg-contact-list"><a href={`tel:${profile.phone.replace(/[^\d+]/g, '')}`}><Phone size={16} aria-hidden="true" /><span dir="ltr">{profile.phone}</span><ArrowUpRight size={15} aria-hidden="true" /></a></div></div>}
          <div className="pg-modal-actions">
            <a href={osmSearch(profile)} target="_blank" rel="noopener noreferrer" className="pg-direction"><Navigation size={16} aria-hidden="true" />{t.openMap}</a>
            <button type="button" onClick={() => setProfileId(null)} className="pg-view-map">{t.close}</button>
          </div>
        </div>
      </div>}
      <div className="pg-bottom"><span><ShieldCheck aria-hidden="true" />{t.verified}</span><a href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap<ExternalLink aria-hidden="true" /></a></div>
    </section>
  );
}

export function PartnerGaragesPage(props: Props) {
  let hasClient = true;
  try { useQueryClient(); } catch { hasClient = false; }
  return hasClient ? <PartnerGaragesInner {...props} /> : <QueryClientProvider client={fallbackClient}><PartnerGaragesInner {...props} /></QueryClientProvider>;
}

export default PartnerGaragesPage;
