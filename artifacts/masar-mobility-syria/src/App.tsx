import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { arSA, enUS } from '@clerk/localizations';
import { shadcn } from '@clerk/themes';
import { useGetProfile, useSaveProfile, getGetProfileQueryKey, useGetMembership, getGetMembershipQueryKey, useListRegisteredVehicles, getListRegisteredVehiclesQueryKey, useSubmitRoadsideRequest, type DriverProfileInput } from '@workspace/api-client-react';
import {
  ArrowLeft, ArrowRight, BatteryCharging, CarFront, Check, ChevronRight,
  CircleHelp, Clock3, FileText, Fuel, Globe2, Home as HomeIcon, Info, LockKeyhole,
   MapPin, Navigation, Pencil, Plus, ShieldCheck, Star,
  Truck, UserRound, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react';
import { en, type LocaleKey } from '@/locales/en';
import { ar } from '@/locales/ar';
import { ErrorBoundary } from '@/components/error-boundary';
import { GoogleLocationMap } from '@/components/GoogleLocationMap';
import { RoadsideAssistant } from '@/components/RoadsideAssistant';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { AccountPage, VehiclesPage, MembershipPage, ReceiptPage, SafetyPage, DemoToolLinks, EmergencyCallCard } from './DemoPages';
import { accountVehicle, activeVehicle, clearExtensionData, readFleet, resolveReportVehicle, type Fleet, type Vehicle, type VehicleChoice } from './demo-data';
import { ACTIVITY_KEY, readActivities, saveActivities, saveNewDemoRequest, type Activity, type ActivityStatus, type ServiceKey } from './demo-requests';
import { QuickReportDialog } from './QuickReportDialog';
import { ReportVehicleSelect } from './ReportVehicleSelect';
import WelcomePage from './WelcomePage';
import { AccountQuestions } from './AccountQuestions';
import { AccountSafetyPage } from './AccountSafetyPage';
import { LiveVehicles } from './LiveVehicles';
import { LiveRequests } from './LiveRequests';
import { PartnerGaragesPage } from './PartnerGaragesPage';
import './index.css';
import { DispatchQueue } from './DispatchQueue';
import { BankPaymentsAdmin } from './BankPaymentsAdmin';
import { ProviderInbox } from './ProviderInbox';
import { publicPath, publicRoute, pageMetadata, siteOrigin } from './public-seo';
import { DemoPreview } from './PublicPreview';
import { MembershipPublicPreview } from './MembershipPlans';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
const SETTINGS_KEY = 'masar-demo-settings';
type Language = 'en' | 'ar';
type Settings = {
  language: Language; name: string; phone: string; make: string;
  plate: string; ev: boolean; contactName: string; contactPhone: string;
};

const defaultSettings: Settings = {
  language: navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en',
  name: '', phone: '', make: 'Toyota Corolla',
  plate: 'DAM · 2741', ev: false, contactName: '', contactPhone: '',
};

function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<Settings> & { theme?: unknown };
    delete saved.theme;
    return { ...defaultSettings, ...saved };
  }
  catch { return defaultSettings; }
}
function saveSettings(settings: Settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function serviceLabel(key: ServiceKey, t: (key: LocaleKey) => string) {
  return t(`service${key[0].toUpperCase()}${key.slice(1)}` as LocaleKey);
}

const serviceOptions: { key: ServiceKey; icon: LucideIcon; image: string; imagePosition?: string }[] = [
  { key: 'flat', icon: Wrench, image: `${import.meta.env.BASE_URL}masar/roadside-service-tire.webp` },
  { key: 'battery', icon: BatteryCharging, image: `${import.meta.env.BASE_URL}masar/roadside-service-evening.webp` },
  { key: 'fuel', icon: Fuel, image: `${import.meta.env.BASE_URL}masar/roadside-service-citadel.webp`, imagePosition: '28% center' },
  { key: 'tow', icon: Truck, image: `${import.meta.env.BASE_URL}masar/masar-service-van.webp` },
  { key: 'lockout', icon: LockKeyhole, image: `${import.meta.env.BASE_URL}masar/roadside-service-tire.webp`, imagePosition: '28% center' },
  { key: 'ev', icon: Zap, image: `${import.meta.env.BASE_URL}masar/roadside-service-evening.webp`, imagePosition: '78% center' },
  { key: 'other', icon: CircleHelp, image: `${import.meta.env.BASE_URL}masar/roadside-service-citadel.webp`, imagePosition: '74% center' },
];

function useCopy(language: Language) {
  const copy = language === 'ar' ? ar : en;
  return (key: LocaleKey) => copy[key] as string;
}

function AppShell({
  children, settings, accountVehicleForReport, toast, onToast,
}: {
  children: React.ReactNode; settings: Settings;
  accountVehicleForReport: Vehicle | null; toast: string; onToast: (message: string) => void;
}) {
  const [path, setLocation] = useLocation();
  const [quickReportOpen, setQuickReportOpen] = useState(false);
  const [quickReportDraft, setQuickReportDraft] = useState('');
  const t = useCopy(settings.language);
  const rtl = settings.language === 'ar';
  const publicHref = (page: 'demo' | 'garages' | 'membership') => publicPath(page, settings.language);
  const nav = [
    { href: publicHref('demo'), label: t('navHome'), icon: HomeIcon, id: 'home' },
    { href: '/request', label: t('navRequest'), icon: Wrench, id: 'request' },
    { href: '/tracking', label: t('navTracking'), icon: Navigation, id: 'tracking' },
    { href: '/activity', label: t('navActivity'), icon: Clock3, id: 'activity' },
  ];
  const extraNav = [
    { href: publicHref('garages'), label: settings.language === 'ar' ? 'المرائب الشريكة' : 'Partner garages', icon: MapPin, id: 'garages' },
    { href: '/account', label: t('navAccount'), icon: UserRound, id: 'account' },
    { href: '/vehicles', label: t('navVehicles'), icon: CarFront, id: 'vehicles' },
    { href: publicHref('membership'), label: t('navMembership'), icon: FileText, id: 'membership' },
    { href: '/safety', label: t('navSafety'), icon: ShieldCheck, id: 'safety' },
  ];
  const desktopNav = rtl ? [nav[3], nav[2], null, nav[1], nav[0]] : [nav[0], nav[1], null, nav[2], nav[3]];
  const mobileNav = [nav[0], nav[1], null, nav[2], nav[3]];
  const active = (publicRoute(path)?.page === 'demo' ? 'home' : path.split('/')[settings.language === 'ar' && path.startsWith('/ar/') ? 2 : 1]) || 'home';
  return (
    <div className={`app-shell ${rtl ? 'rtl' : ''}`}>
      <aside className="nav-desktop" aria-label={t('primaryNav')}>
        <Link href={publicHref('demo')} className="brand" data-testid="link-logo">
          <img src="/masar/masar-pin.png" alt="" /><span className="brand-name">MASAR</span>
        </Link>
        {desktopNav.map((item) => item ? (
          <Link key={item.id} href={item.href} className={`desktop-nav-item ${active === item.id ? 'active' : ''}`} data-testid={`link-nav-${item.id}`}>
            <item.icon aria-hidden="true" /><span>{item.label}</span>
          </Link>
        ) : <button key="quick-report" type="button" className="desktop-nav-item desktop-quick-report" onClick={() => { setQuickReportDraft(''); setQuickReportOpen(true); }} data-testid="button-desktop-quick-report"><Plus aria-hidden="true" /><span>{t('quickReportOpen')}</span></button>)}
        <div className="desktop-legal" style={{ marginTop: 18, paddingBottom: 3 }}>{t('moreTools')}</div>
        {(rtl ? [...extraNav].reverse() : extraNav).map(({ href, label, icon: Icon, id }) => <Link key={id} href={href} className={`desktop-nav-item ${active === id ? 'active' : ''}`} data-testid={`link-nav-${id}`}><Icon aria-hidden="true" /><span>{label}</span></Link>)}
        <div className="desktop-legal">{t('demoNotice')}</div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <Link href={publicHref('demo')} className="brand" data-testid="link-mobile-logo">
            <img src="/masar/masar-pin.png" alt="" /><span className="brand-name">MASAR</span>
          </Link>
          <div className="top-actions">
            <Link href={publicHref('garages')} className={`top-garages-link ${active === 'garages' ? 'active' : ''}`} aria-label={settings.language === 'ar' ? 'المرائب الشريكة' : 'Partner garages'} aria-current={active === 'garages' ? 'page' : undefined} data-testid="link-top-garages">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2.5 9 12 4l9.5 5v11h-19V9Z" />
                <path d="M6 20v-9h12v9" />
                <path d="m8 17 1-3h6l1 3M8 20v-3h8v3" />
                <path d="M10 18.5h.01M14 18.5h.01" strokeWidth="2.6" />
              </svg>
            </Link>
            <Link href="/profile" className="top-profile-link" aria-label={t('navProfile')} aria-current={path === '/profile' ? 'page' : undefined} data-testid="link-top-profile"><UserRound size={18} /></Link>
          </div>
        </header>
        {children}
        <QuickReportDialog
          open={quickReportOpen}
          language={settings.language}
          initialNotes={quickReportDraft}
          accountVehicle={accountVehicleForReport}
          onDismiss={() => setQuickReportOpen(false)}
          onSubmitted={() => {
            setQuickReportOpen(false);
            setQuickReportDraft('');
            onToast(t('quickReportSaved'));
            setLocation('/tracking');
          }}
        />
        <RoadsideAssistant language={settings.language} onPrepareReport={(notes) => { setQuickReportDraft(notes); setQuickReportOpen(true); }} />
        <nav className="bottom-nav" aria-label={t('primaryNav')}>
          {mobileNav.map((item) => item ? (
            <Link key={item.id} href={item.href} className={`nav-item ${active === item.id ? 'active' : ''}`} data-testid={`link-bottom-${item.id}`}>
              <item.icon aria-hidden="true" /><span>{item.label}</span>
            </Link>
          ) : <button key="quick-report" type="button" className="nav-item nav-quick-report" onClick={() => { setQuickReportDraft(''); setQuickReportOpen(true); }} aria-label={t('quickReportOpen')} data-testid="button-quick-report"><span className="nav-quick-mark"><Plus aria-hidden="true" /></span></button>)}
        </nav>
        {toast && <div role="status" className="toast-message" data-testid="status-toast">{toast}</div>}
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, body, t }: { eyebrow?: string; title: string; body?: string; t: (key: LocaleKey) => string }) {
  return <div className="page-header"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{body && <p>{body}</p>}</div>;
}

function Home({ settings, fleet, onToast }: { settings: Settings; fleet: Fleet; onToast: (message: string) => void }) {
  const t = useCopy(settings.language);
  const [, setLocation] = useLocation();
  return (
    <div className="page-wrap">
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow" style={{ color: 'hsl(43 100% 67%)' }}>{t('brandTagline')}</div>
          <h1>{t('heroTitle')}</h1>
          <p>{t('heroBody')}</p>
          <button className="button button-primary" type="button" onClick={() => setLocation('/request')} data-testid="button-request-help">
            {t('requestHelp')} {settings.language === 'ar' ? <ArrowLeft size={17} /> : <ArrowRight size={17} />}
          </button>
        </div>
      </section>
      <div className="info-strip"><Info size={17} /><span>{t('demoNotice')}</span></div>
      <div className="home-grid">
        <div>
           <div className="section-heading"><h2>{t('yourVehicle')}</h2><button className="setting-action" onClick={() => setLocation('/vehicles')} type="button" data-testid="button-edit-vehicle"><Pencil size={14} /> {t('change')}</button></div>
           <Link href="/vehicles" className="vehicle-card" style={{ textDecoration: 'none', color: 'inherit' }} data-testid="card-current-vehicle">
            <div className="vehicle-mark"><CarFront size={25} /></div>
             <div><h3>{activeVehicle(fleet)?.make || t('noVehicles')}</h3><p>{activeVehicle(fleet)?.plate || t('noVehiclesBody')}</p></div>
            <ChevronRight size={18} color="hsl(var(--muted-foreground))" />
           </Link>
           <DemoToolLinks language={settings.language} />
        </div>
        <div>
          <div className="section-heading"><h2>{t('whyMasar')}</h2></div>
          <div className="trust-row">
            <div className="trust-item"><ShieldCheck size={19} /><strong>{t('calmGuidance')}</strong><span>{t('calmGuidanceHint')}</span></div>
            <div className="trust-item"><MapPin size={19} /><strong>{t('localCare')}</strong><span>{t('localCareHint')}</span></div>
            <div className="trust-item"><FileText size={19} /><strong>{t('alwaysClear')}</strong><span>{t('alwaysClearHint')}</span></div>
          </div>
          <div className="card" style={{ overflow: 'hidden', marginTop: 16 }}><img src={`${import.meta.env.BASE_URL}masar/roadside-assistance-aleppo.webp`} alt={t('technicianPhotoAlt')} style={{ width: '100%', display: 'block', aspectRatio: '2 / 1', objectFit: 'cover' }} /><div style={{ padding: 15, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{t('reviewPending')}</div></div>
        </div>
      </div>
      <PartnerGaragesPage language={settings.language} compact />
    </div>
  );
}

function Stepper({ step, t }: { step: number; t: (key: LocaleKey) => string }) {
  const labels: LocaleKey[] = ['stepProblem', 'stepPlace', 'stepConfirm'];
  return <div className="stepper" aria-label={`${t('requestTitle')} ${step} / 3`}>
    {labels.map((label, i) => <span key={label} style={{ display: 'contents' }}><span className={`step-dot ${i + 1 <= step ? 'current' : ''} ${i + 1 < step ? 'done' : ''}`}>{i + 1 < step ? <Check size={14} /> : i + 1}</span>{i < labels.length - 1 && <span className={`step-line ${i + 1 < step ? 'done' : ''}`} />}</span>)}
  </div>;
}

function RequestPage({ settings, onToast, accountVehicleForReport }: { settings: Settings; onToast: (message: string) => void; accountVehicleForReport: Vehicle | null }) {
  const t = useCopy(settings.language);
  const { isSignedIn } = useAuth();
  const idempotencyKey = useRef<string | null>(null);
  if (idempotencyKey.current === null) idempotencyKey.current = crypto.randomUUID();
  const requestIdempotencyKey = idempotencyKey.current;
  const entitlement = useGetMembership({ query: { queryKey: getGetMembershipQueryKey(), enabled: !!isSignedIn, staleTime: 0, retry: false } });
  const registered = useListRegisteredVehicles({ query: { queryKey: getListRegisteredVehiclesQueryKey(), enabled: !!isSignedIn } });
  const submitLive = useSubmitRoadsideRequest();
  const [, setLocation] = useLocation();
  const queryService = new URLSearchParams(window.location.search).get('service') as ServiceKey | null;
  const [step, setStep] = useState(1);
  const [service, setService] = useState<ServiceKey>(queryService && serviceOptions.some((x) => x.key === queryService) ? queryService : 'flat');
  const [notes, setNotes] = useState('');
  const [unsafe, setUnsafe] = useState(false);
  const [location, setRequestLocation] = useState('');
  const [findingLocation, setFindingLocation] = useState(false);
  const [destination, setDestination] = useState('');
  const [garage, setGarage] = useState('');
  const [replacementTransport, setReplacementTransport] = useState(false);
  const [registeredId, setRegisteredId] = useState('');
  const [requestError, setRequestError] = useState('');
  const [vehicleChoice, setVehicleChoice] = useState<VehicleChoice>(() => {
    const activeId = readFleet().activeId;
    return activeId ? `demo:${activeId}` : 'none';
  });
  const selectedVehicle = resolveReportVehicle(vehicleChoice, readFleet(), accountVehicleForReport);
  const tService = serviceLabel(service, t);
  const useCurrentLocation = () => {
    if (!navigator.geolocation) { onToast(t('locationUnavailable')); return; }
    setFindingLocation(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setRequestLocation(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        setFindingLocation(false);
        onToast(t('locationSaved'));
      },
      () => { setFindingLocation(false); onToast(t('locationUnavailable')); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };
  const createRequest = async () => {
    if (!location.trim()) { onToast(t('locationRequired')); setStep(2); return; }
    if (isSignedIn) {
      if (!entitlement.data?.active) { setRequestError(settings.language === 'ar' ? 'يلزم اشتراك مدفوع نشط.' : 'An active paid membership is required.'); return; }
      if (!registeredId) { setRequestError(settings.language === 'ar' ? 'اختر مركبة مسجلة.' : 'Choose a registered vehicle.'); return; }
      try {
        await submitLive.mutateAsync({ data: {
          vehicleId: registeredId, service, location: location.trim(),
          ...(service === 'tow' && destination.trim() ? { destination: destination.trim() } : {}),
          ...(service === 'tow' && garage.trim() ? { garage: garage.trim() } : {}),
          notes: notes.trim(), unsafe, replacementTransport,
          idempotencyKey: requestIdempotencyKey,
        } });
        setRequestError('');
        onToast(settings.language === 'ar' ? 'أُضيف الطلب إلى قائمة التوزيع. انتظر تأكيد التوفر.' : 'Request added to dispatch queue. Await availability confirmation.');
        setLocation('/activity');
      } catch (e) { setRequestError(e instanceof Error ? e.message : 'Could not submit request'); }
      return;
    }
    const vehicle = resolveReportVehicle(vehicleChoice, readFleet(), accountVehicleForReport);
    if (vehicleChoice !== 'none' && !vehicle) { onToast(t('reportVehicleUnavailable')); return; }
    const item: Activity = { id: `demo-${Date.now()}`, service, date: new Date().toISOString(), status: 'dispatch', notes, unsafe, location: location.trim(), destination: service === 'tow' ? destination : '', code: String(Math.floor(1000 + Math.random() * 9000)), vehicle };
    try { saveNewDemoRequest(item); } catch { onToast(t('quickReportSaveError')); return; }
    onToast(t('requestCreated')); setLocation('/tracking');
  };
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="MASAR" title={t('requestTitle')} t={t} />
      <Stepper step={step} t={t} />
      {step === 1 && <section className="card form-card">
        <h2 id="service-question" style={{ margin: 0, fontSize: 18 }}>{t('whatHappened')}</h2>
        <div className="choice-grid" role="group" aria-labelledby="service-question">
          {serviceOptions.map(({ key, icon: Icon }) => <label className={`choice ${service === key ? 'selected' : ''}`} key={key} data-testid={`choice-service-${key}`}><input type="radio" name="service" checked={service === key} onChange={() => setService(key)} /><Icon size={18} /><span>{serviceLabel(key, t)}</span></label>)}
        </div>
        <label className="form-label" htmlFor="request-notes">{t('optionalNotes')}</label>
        <textarea id="request-notes" className="textarea" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('notesPlaceholder')} data-testid="input-request-notes" />
        <div className="toggle-row"><div><label htmlFor="unsafe-toggle">{t('unsafe')}</label><p>{t('unsafeHint')}</p></div><input id="unsafe-toggle" className="switch" type="checkbox" checked={unsafe} onChange={(e) => setUnsafe(e.target.checked)} data-testid="switch-unsafe" /></div>
         {unsafe && <div className="notice"><strong>{t('highwayAdviceTitle')}</strong>{t('highwayAdvice')}<div style={{ marginTop: 10 }}><Link href="/safety" className="button button-ghost" data-testid="link-request-safety">{t('navSafety')}</Link></div></div>}
        <button type="button" className="button button-navy button-block" style={{ marginTop: 20 }} onClick={() => setStep(2)} data-testid="button-request-continue">{t('continue')} <ArrowRight size={16} /></button>
      </section>}
      {step === 2 && <section className="card form-card">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('whereAreYou')}</h2>
        <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>{t('locationDemo')}</p>
        <label className="form-label" htmlFor="request-location">{t('location')}</label>
          <input id="request-location" className="text-input" maxLength={500} value={location} onChange={(e) => setRequestLocation(e.target.value)} placeholder={t('locationPlaceholder')} autoComplete="street-address" data-testid="input-request-location" />
        <button type="button" className="button button-ghost" style={{ marginTop: 10 }} onClick={useCurrentLocation} disabled={findingLocation} data-testid="button-use-current-location"><Navigation size={16} /> {findingLocation ? t('findingLocation') : t('useCurrentLocation')}</button>
        <GoogleLocationMap value={location} language={settings.language} onSelect={setRequestLocation} />
        {!location.trim() && <p role="alert" className="field-error">{t('locationRequired')}</p>}
        {service === 'tow' && <><label className="form-label" htmlFor="destination">{t('towingDestination')}</label>
         {isSignedIn
           ? <input id="destination" className="text-input" value={destination} onChange={(e) => setDestination(e.target.value)} maxLength={300} placeholder={t('destinationOptional')} data-testid="input-towing-destination" />
           : <select id="destination" className="select-input" value={destination} onChange={(e) => setDestination(e.target.value)} data-testid="select-towing-destination"><option value="">{t('destinationOptional')}</option><option value="garage">{t('partnerGarage')}</option></select>}
         {isSignedIn && entitlement.data?.garageChoice && <><label className="form-label" htmlFor="chosen-garage">{settings.language === 'ar' ? 'المرآب الذي تختاره' : 'Your chosen garage'}</label><input id="chosen-garage" className="text-input" value={garage} onChange={e => setGarage(e.target.value)} maxLength={200} /></>}</>}
          {isSignedIn && entitlement.data?.replacementTransport && <label className="toggle-row">{settings.language === 'ar' ? 'أطلب وسيلة نقل بديلة (حسب التوفر)' : 'Request replacement transport (subject to availability)'} <input type="checkbox" checked={replacementTransport} onChange={e => setReplacementTransport(e.target.checked)} /></label>}
        <div style={{ display: 'flex', gap: 9, marginTop: 22 }}><button type="button" className="button button-ghost" onClick={() => setStep(1)} data-testid="button-request-back"><ArrowLeft size={16} /> {t('back')}</button><button type="button" className="button button-navy" style={{ flex: 1 }} onClick={() => setStep(3)} disabled={!location.trim()} data-testid="button-location-continue">{t('continue')} <ArrowRight size={16} /></button></div>
      </section>}
      {step === 3 && <section className="card form-card">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('confirmRequest')}</h2>
         {isSignedIn ? <><label className="form-label" htmlFor="registered-request-vehicle">{settings.language === 'ar' ? 'المركبة المسجلة' : 'Registered vehicle'}</label><select id="registered-request-vehicle" className="select-input" value={registeredId} onChange={e => setRegisteredId(e.target.value)}><option value="">{settings.language === 'ar' ? 'اختر مركبة' : 'Select vehicle'}</option>{registered.data?.map(v => <option key={v.id} value={v.id}>{v.make} · {v.plate}</option>)}</select></> :
           <ReportVehicleSelect id="request-vehicle" language={settings.language} fleet={readFleet()} account={accountVehicleForReport} value={vehicleChoice} onChange={setVehicleChoice} />}
           <div className="estimate"><div className="estimate-top"><div><small>{t('membershipLabel')}</small><strong>{isSignedIn && entitlement.data?.active ? `${entitlement.data.plan === 'premium' ? 'Premium' : 'Basic'} · ${settings.language === 'ar' ? 'مدفوع ومتحقق منه' : 'paid and verified'}` : settings.language === 'ar' ? 'لا توجد تغطية نشطة مؤكدة' : 'No confirmed active coverage'}</strong></div><ShieldCheck size={26} /></div><small>{isSignedIn ? settings.language === 'ar' ? 'يرى فريق التوزيع الطلب، لكن الخدمة والنقل البديل يتطلبان تأكيد التوفر.' : 'Dispatch operators can review the request; service and transport require availability confirmation.' : t('membershipDemoNote')}</small></div>
          {isSignedIn && (entitlement.isError || registered.isError) && <p role="alert" className="field-error">{settings.language === 'ar' ? 'تعذّر التحقق من الاشتراك والمركبات.' : 'Could not verify membership and vehicles.'}</p>}
          {isSignedIn && !entitlement.isLoading && !entitlement.data?.active && <Link href="/membership" className="button button-ghost">{settings.language === 'ar' ? 'عرض الاشتراكات' : 'View plans'}</Link>}
          {!isSignedIn && <p className="demo-lead"><Clock3 size={16} aria-hidden="true" /> {t('estimatedArrival')} ({t('demoStatus')}): 25–40 {t('minutes')}</p>}
        <div className="setting-row"><Wrench className="setting-icon" size={19} /><div className="setting-copy"><strong>{tService}</strong><span>{t('service')}</span></div></div>
          <div className="setting-row"><CarFront className="setting-icon" size={19} /><div className="setting-copy"><strong dir="auto">{isSignedIn ? (registered.data?.find(v => v.id === registeredId)?.plate || t('noVehicleRequest')) : selectedVehicle ? `${selectedVehicle.make} · ${selectedVehicle.plate}` : t('noVehicleRequest')}</strong><span>{t('receiptVehicle')}</span></div><Link href="/vehicles" className="setting-action" data-testid="link-request-vehicles">{t('change')}</Link></div>
        <div className="setting-row"><MapPin className="setting-icon" size={19} /><div className="setting-copy"><strong dir="auto">{location}</strong><span>{t('location')}</span></div></div>
         {service === 'tow' && destination.trim() && <div className="setting-row"><Truck className="setting-icon" size={19} /><div className="setting-copy"><strong dir="auto">{destination.trim()}</strong><span>{t('towingDestination')}</span></div></div>}
         {service === 'tow' && isSignedIn && garage.trim() && <div className="setting-row"><Truck className="setting-icon" size={19} /><div className="setting-copy"><strong dir="auto">{garage.trim()}</strong><span>{settings.language === 'ar' ? 'المرآب الذي تختاره' : 'Chosen garage'}</span></div></div>}
        <div className="setting-row"><ShieldCheck className="setting-icon" size={19} /><div className="setting-copy"><strong>{unsafe ? t('yes') : t('no')}</strong><span>{t('safetyFlag')}</span></div></div>
         {requestError && <p role="alert" className="field-error">{requestError}</p>}
          <div style={{ display: 'flex', gap: 9, marginTop: 16 }}><button type="button" className="button button-ghost" onClick={() => setStep(2)} data-testid="button-confirm-back"><ArrowLeft size={16} /> {t('back')}</button><button type="button" className="button button-primary" style={{ flex: 1 }} disabled={submitLive.isPending || (isSignedIn && (!entitlement.data?.active || !registeredId || registered.isError))} onClick={createRequest} data-testid="button-confirm-request">{isSignedIn ? settings.language === 'ar' ? 'إرسال الطلب للتوزيع' : 'Send to dispatch' : t('confirmAndDispatch')} <ArrowRight size={16} /></button></div>
      </section>}
    </div>
  );
}

function statusIndex(status: ActivityStatus) { return ['dispatch', 'assigned', 'enroute', 'arrived', 'completed'].indexOf(status); }
function TrackingPage({ settings, onToast }: { settings: Settings; onToast: (message: string) => void }) {
  const t = useCopy(settings.language);
  const [, setLocation] = useLocation();
  const [activities, setActivities] = useState<Activity[]>(readActivities);
  const currentId = localStorage.getItem('masar-current-request');
  const current = activities.find((x) => x.id === currentId) || activities[0];
  const [status, setStatus] = useState<ActivityStatus>(current?.status || 'dispatch');
  const [rating, setRating] = useState(current?.rating || 0);
  const [codeInput, setCodeInput] = useState('');
  useEffect(() => {
    const refresh = () => {
      const items = readActivities();
      const latest = items.find((item) => item.id === localStorage.getItem('masar-current-request')) || items[0];
      setActivities(items);
      setStatus(latest?.status || 'dispatch');
      setRating(latest?.rating || 0);
      setCodeInput('');
    };
    window.addEventListener('masar-demo-request-created', refresh);
    return () => window.removeEventListener('masar-demo-request-created', refresh);
  }, []);
  useEffect(() => { if (current) setStatus(current.status); }, [current?.id]);
  useEffect(() => {
    if (!current || status === 'completed' || status === 'arrived') return;
    const next: ActivityStatus = status === 'dispatch' ? 'assigned' : status === 'assigned' ? 'enroute' : 'arrived';
    const timer = window.setTimeout(() => {
      const updated = activities.map((item) => item.id === current.id ? { ...item, status: next } : item);
      saveActivities(updated); setActivities(updated); setStatus(next);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [status, current?.id]);
  if (!current) return <div className="page-wrap"><PageHeader title={t('navTracking')} body={t('noActivityHint')} t={t} /><div className="card center-empty"><Navigation size={30} /><h2>{t('noActivity')}</h2><p>{t('noActivityHint')}</p><Link href="/request" className="button button-navy" data-testid="link-start-tracking-request">{t('startRequest')}</Link></div></div>;
  const updateStatus = (next: ActivityStatus) => {
    const updated = activities.map((item) => item.id === current.id ? { ...item, status: next } : item);
    saveActivities(updated); setActivities(updated); setStatus(next);
  };
  const saveRating = () => {
    const updated = activities.map((item) => item.id === current.id ? { ...item, rating } : item);
    saveActivities(updated); setActivities(updated); onToast(t('ratingSaved'));
  };
  const verifyArrival = () => {
    if (codeInput !== current.code) { onToast(t('codeMismatch')); return; }
    const updated = activities.map((item) => item.id === current.id ? { ...item, verified: true } : item);
    saveActivities(updated); setActivities(updated); onToast(t('codeVerified'));
  };
  const labels: { status: ActivityStatus; title: LocaleKey; hint: LocaleKey }[] = [
    { status: 'dispatch', title: 'timelineRequested', hint: 'timelineRequestedHint' },
    { status: 'assigned', title: 'timelineAssigned', hint: 'timelineAssignedHint' },
    { status: 'enroute', title: 'timelineOnway', hint: 'timelineOnwayHint' },
    { status: 'arrived', title: 'timelineArrived', hint: 'timelineArrivedHint' },
    { status: 'completed', title: 'timelineDone', hint: 'timelineDoneHint' },
  ];
  return <div className="page-wrap">
    <PageHeader eyebrow={t('demoStatus')} title={t('dispatchTitle')} body={t('dispatchBody')} t={t} />
    <div className="wide-grid">
      <div>
        <GoogleLocationMap value={current.location} language={settings.language} />
        <div className="card" style={{ padding: 17, marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><div><span className="eyebrow">{t('service')}</span><h2 style={{ margin: '5px 0 0', fontSize: 18 }}>{serviceLabel(current.service, t)}</h2></div><span className="status-pill" data-testid="status-request"><span className="status-dot" />{t(status)}</span></div>
           <div className="setting-row" style={{ marginTop: 12, padding: '12px 0' }}><div className="avatar" style={{ width: 43, height: 43, fontSize: 16 }}>OH</div><div className="setting-copy"><strong>{t('technicianName')} · {t('demoStatus')}</strong><span>{t('van')} · {t('demoOnly')}</span></div></div>
        </div>
      </div>
      <div className="card form-card">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('timelineTitle')}</h2>
        <div className="timeline">{labels.map((item, index) => <div key={item.status} className={`timeline-item ${statusIndex(status) >= index ? 'complete' : ''}`} data-testid={`status-timeline-${item.status}`}><span className="timeline-icon">{statusIndex(status) > index ? <Check size={13} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}</span><div className="timeline-copy"><strong>{t(item.title)}</strong><span>{t(item.hint)}</span></div></div>)}</div>
        {status === 'arrived' && <div className="notice"><strong>{t('arrivalCode')}: <bdi dir="ltr" data-testid="text-arrival-code">{current.code}</bdi></strong>{t('arrivalCodeHint')}{current.verified ? <p role="status" data-testid="status-code-verified">{t('codeVerified')}</p> : <><label className="form-label" htmlFor="arrival-code-input">{t('enterArrivalCode')}</label><input id="arrival-code-input" className="text-input" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={4} value={codeInput} onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ''))} data-testid="input-arrival-code" /><button type="button" className="button button-navy button-block" style={{ marginTop: 12 }} onClick={verifyArrival} disabled={codeInput.length !== 4} data-testid="button-verify-arrival">{t('verifyArrival')}</button></>}</div>}
        {status === 'arrived' && <button type="button" className="button button-primary button-block" style={{ marginTop: 12 }} onClick={() => updateStatus('completed')} disabled={!current.verified} data-testid="button-finish-request">{t('finishRequest')} <Check size={16} /></button>}
        {status === 'completed' && !current.rating && <div className="notice" style={{ marginTop: 10 }}><strong>{t('rateService')}</strong><span>{t('rateHint')}</span><div className="rating-row">{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} className={`star-button ${rating >= star ? 'selected' : ''}`} onClick={() => setRating(star)} aria-label={`${star} ${t('rateService')}`} data-testid={`button-rating-${star}`}><Star size={18} fill={rating >= star ? 'currentColor' : 'none'} /></button>)}</div>{rating > 0 && <button type="button" className="button button-navy button-block" onClick={saveRating} data-testid="button-save-rating">{t('submitRating')}</button>}</div>}
        {status === 'completed' && current.rating && <div className="info-strip" style={{ marginTop: 12 }}><Star size={16} fill="currentColor" />{t('ratingSaved')}</div>}
      </div>
    </div>
  </div>;
}

function ActivityPage({ settings }: { settings: Settings }) {
  const t = useCopy(settings.language);
  const activities = readActivities();
  const [, setLocation] = useLocation();
  return <div className="page-wrap"><PageHeader eyebrow="MASAR" title={t('activityTitle')} body={t('activitySubtitle')} t={t} />
     <div className="card form-card">{activities.length === 0 ? <div className="center-empty"><Clock3 size={30} /><h2>{t('noActivity')}</h2><p>{t('noActivityHint')}</p><button type="button" className="button button-navy" onClick={() => setLocation('/request')} data-testid="button-start-activity-request">{t('startRequest')}</button></div> : activities.map((activity) => <button type="button" className="activity-item" key={activity.id} onClick={() => setLocation(`/activity/${encodeURIComponent(activity.id)}`)} data-testid={`button-activity-${activity.id}`} style={{ width: '100%', border: 0, borderBottom: '1px solid hsl(var(--border))', textAlign: 'inherit', cursor: 'pointer' }}><span className="activity-badge"><Wrench size={18} /></span><span className="activity-copy"><strong>{serviceLabel(activity.service, t)}</strong><span>{new Date(activity.date).toLocaleDateString(settings.language === 'ar' ? 'ar-SY' : 'en-SY')} · {activity.location}</span></span><span className="activity-price"><span className="status-pill">{t(activity.status)}</span><small>{activity.rating ? `${activity.rating}/5` : t('demoStatus')}</small></span></button>)}</div>
  </div>;
}

function ProfileLanguagePreference({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  const t = useCopy(language);
  return <section className="settings-group">
    <h2>{t('preferences')}</h2>
    <div className="card settings-card">
      <div className="setting-row">
        <span className="setting-icon"><Globe2 size={19} aria-hidden="true" /></span>
        <div className="setting-copy"><strong>{t('language')}</strong><span>{language === 'en' ? 'English' : 'العربية'}</span></div>
        <button type="button" className="setting-action" onClick={() => onChange(language === 'en' ? 'ar' : 'en')} data-testid="button-profile-language">{t('change')}</button>
      </div>
    </div>
  </section>;
}

function ProfilePage({ settings, setSettings, onToast, onFleetChange }: { settings: Settings; setSettings: (s: Settings) => void; onToast: (message: string) => void; onFleetChange: (fleet: Fleet) => void }) {
  const t = useCopy(settings.language);
  const [name, setName] = useState(settings.name); const [phone, setPhone] = useState(settings.phone);
  const [contactName, setContactName] = useState(settings.contactName); const [contactPhone, setContactPhone] = useState(settings.contactPhone);
  const [showHelp, setShowHelp] = useState(false);
   const save = (partial: Partial<Settings>, message: string) => { if (partial.phone !== undefined && partial.phone !== settings.phone) localStorage.removeItem('masar-demo-verified-phone-v1'); const next = { ...settings, ...partial }; saveSettings(next); setSettings(next); onToast(message); };
  const resetDemoData = () => {
    if (!window.confirm(t('resetConfirm'))) return;
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    localStorage.removeItem('masar-current-request');
    clearExtensionData();
    onFleetChange({ vehicles: [], activeId: null });
     setName(''); setPhone('');
    setContactName(''); setContactPhone('');
     setSettings({ ...defaultSettings, make: '', plate: '' });
    onToast(t('resetDone'));
  };
  return <div className="page-wrap">
    <div className="profile-head"><div className="avatar">{(name || t('guest')).slice(0, 1).toUpperCase()}</div><div><h1>{name || t('guest')}</h1><p>{phone || t('profileSubtitle')}</p></div></div>
    <section className="settings-group"><h2>{t('moreTools')}</h2><DemoToolLinks language={settings.language} /></section>
    <section className="settings-group"><h2>{t('driverDetails')}</h2><div className="card form-card"><label className="form-label" htmlFor="profile-name">{t('name')}</label><input id="profile-name" className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('guest')} data-testid="input-profile-name" /><label className="form-label" htmlFor="profile-phone">{t('phone')}</label><input id="profile-phone" className="text-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('phonePlaceholder')} data-testid="input-profile-phone" /><button type="button" className="button button-navy" style={{ marginTop: 16 }} onClick={() => save({ name, phone }, t('detailsSaved'))} data-testid="button-save-details">{t('saveDetails')}</button></div></section>
     <section className="settings-group"><h2>{t('vehicleSettings')}</h2><div className="card form-card"><p className="demo-lead">{t('vehiclesIntro')}</p><Link href="/vehicles" className="button button-ghost" data-testid="link-profile-manage-vehicles"><CarFront size={16} />{t('navVehicles')}</Link></div></section>
     <ProfileLanguagePreference language={settings.language} onChange={language => save({ language }, t('saved'))} />
    <section className="settings-group"><h2>{t('help')}</h2><div className="card settings-card"><button type="button" className="setting-row" style={{ width: '100%', border: 0, textAlign: 'inherit', cursor: 'pointer' }} onClick={() => setShowHelp(!showHelp)} data-testid="button-toggle-help"><span className="setting-icon"><CircleHelp size={19} /></span><span className="setting-copy"><strong>{t('help')}</strong><span>{showHelp ? t('close') : t('demoNotice')}</span></span><ChevronRight size={17} /></button>{showHelp && <div className="notice" style={{ margin: '0 15px 15px' }}><strong>{t('help')}</strong>{t('helpText')}</div>}</div></section>
    <section className="settings-group"><h2>{t('safetyContact')}</h2><div className="card form-card"><p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginTop: 0 }}>{t('safetyContactText')}</p><label className="form-label" htmlFor="contact-name">{t('contactName')}</label><input id="contact-name" className="text-input" value={contactName} onChange={(e) => setContactName(e.target.value)} data-testid="input-contact-name" /><label className="form-label" htmlFor="contact-phone">{t('contactPhone')}</label><input id="contact-phone" className="text-input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} data-testid="input-contact-phone" /><button type="button" className="button button-ghost" style={{ marginTop: 16 }} onClick={() => save({ contactName, contactPhone }, t('contactSaved'))} data-testid="button-save-contact">{t('saveContact')}</button></div></section>
    <EmergencyCallCard language={settings.language} />
     <section className="settings-group"><h2>{t('privacy')}</h2><div className="card form-card"><p style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13, marginTop: 0 }}>{t('privacyHint')}</p><button type="button" className="button demo-reset" onClick={resetDemoData} data-testid="button-reset-demo-data">{t('resetExtension')}</button></div></section>
  </div>;
}

function RouterContent({ settings, setSettings, fleet, setFleet, onToast, profileContent, accountVehicleForReport }: { settings: Settings; setSettings: (s: Settings) => void; fleet: Fleet; setFleet: (fleet: Fleet) => void; onToast: (message: string) => void; profileContent: React.ReactNode; accountVehicleForReport: Vehicle | null }) {
  const { isSignedIn, userId } = useAuth();
  const membership = useGetMembership({ query: { queryKey: getGetMembershipQueryKey(), enabled: !!isSignedIn, staleTime: 0, retry: false } });
  const membershipSummary = isSignedIn && <div className="card form-card" role="status" style={{ marginBottom: 18 }}>
    <strong>{settings.language === 'ar' ? 'حالة اشتراكك' : 'Your membership'}</strong>
    <p>{membership.isLoading ? settings.language === 'ar' ? 'جارٍ التحقق…' : 'Checking…' : membership.isError ? settings.language === 'ar' ? 'تعذّر التحقق من الدفع.' : 'Could not verify payment.' : membership.data?.active ? `${membership.data.plan === 'premium' ? 'Premium' : 'Basic'} · ${settings.language === 'ar' ? 'مدفوع ونشط' : 'paid and active'} · ${membership.data.vehicleLimit} ${settings.language === 'ar' ? 'مركبات' : 'vehicle(s)'}` : settings.language === 'ar' ? 'لا يوجد اشتراك مدفوع نشط.' : 'No active paid subscription.'}</p>
    <Link href="/membership" className="button button-ghost">{settings.language === 'ar' ? 'إدارة الاشتراك' : 'View membership'}</Link>
  </div>;
  return <Switch>
    <Route path="/ar/demo" component={() => <Home settings={settings} fleet={fleet} onToast={onToast} />} />
    <Route path="/ar/garages" component={() => <PartnerGaragesPage language="ar" />} />
    <Route path="/ar/membership" component={() => <MembershipPage language="ar" />} />
    <Route path="/demo" component={() => <Home settings={settings} fleet={fleet} onToast={onToast} />} />
    <Route path="/" component={() => <Home settings={settings} fleet={fleet} onToast={onToast} />} />
    <Route path="/garages" component={() => <PartnerGaragesPage language={settings.language} />} />
    <Route path="/request"><RequestPage key={userId ?? 'guest'} settings={settings} onToast={onToast} accountVehicleForReport={accountVehicleForReport} /></Route>
    <Route path="/tracking">{isSignedIn ? <Redirect to="/activity" /> : <TrackingPage settings={settings} onToast={onToast} />}</Route>
    <Route path="/activity">{isSignedIn ? <LiveRequests language={settings.language} /> : <ActivityPage settings={settings} />}</Route>
    <Route path="/dispatch">{isSignedIn ? <DispatchQueue key={userId} language={settings.language} /> : <Redirect to="/sign-in" />}</Route>
    <Route path="/bank-payments">{isSignedIn ? <BankPaymentsAdmin language={settings.language} /> : <Redirect to="/sign-in" />}</Route>
    <Route path="/provider">{isSignedIn ? <ProviderInbox key={userId} language={settings.language} /> : <Redirect to="/sign-in" />}</Route>
    <Route path="/activity/:id" component={() => <ReceiptPage language={settings.language} onToast={onToast} />} />
    <Route path="/profile"><>{membershipSummary}{profileContent ?? <ProfilePage settings={settings} setSettings={setSettings} onFleetChange={setFleet} onToast={onToast} />}</></Route>
    <Route path="/account" component={() => isSignedIn ? <div className="page-wrap">{membershipSummary}<Link href="/profile" className="button button-navy">{settings.language === 'ar' ? 'بيانات الحساب' : 'Account details'}</Link></div> : <AccountPage language={settings.language} driver={settings} onToast={onToast} onSave={(name, phone) => setSettings({ ...settings, name, phone })} />} />
    <Route path="/vehicles">{isSignedIn ? <LiveVehicles language={settings.language} /> : <VehiclesPage language={settings.language} onToast={onToast} onFleetChange={setFleet} />}</Route>
    <Route path="/membership" component={() => <MembershipPage language={settings.language} />} />
    <Route path="/payment"><Redirect to="/membership" /></Route>
    <Route path="/safety">{isSignedIn ? <AccountSafetyPage key={userId} language={settings.language} /> : <SafetyPage language={settings.language} driver={settings} onToast={onToast} onSaveContact={(contactName, contactPhone) => setSettings({ ...settings, contactName, contactPhone })} />}</Route>
    <Route component={NotFound} />
  </Switch>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const id = user?.id ?? null;
    if (previous.current !== undefined && previous.current !== id) client.clear();
    previous.current = id;
  }), [addListener, client]);
  return null;
}

function AppRoutes({ settings, setSettings }: { settings: Settings; setSettings: (next: Settings) => void }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { signOut } = useClerk();
  const profileQueryKey = [...getGetProfileQueryKey(), userId];
  const { data: profile, isLoading, isError, refetch } = useGetProfile({ query: { enabled: !!isSignedIn && !!userId, retry: false, queryKey: profileQueryKey } });
  const saveProfileMutation = useSaveProfile();
  const saveProfile = async (data: DriverProfileInput) => {
    const saved = await saveProfileMutation.mutateAsync({ data });
    queryClient.setQueryData(profileQueryKey, saved);
  };
  const [fleet, setFleet] = useState<Fleet>(readFleet);
  const [toast, setToast] = useState('');
  const [path, setLocation] = useLocation();
  const publicPage = publicRoute(path);
  const pageLanguage = publicPage?.language ?? settings.language;
  const pageSettings = publicPage ? { ...settings, language: pageLanguage } : settings;
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.lang = pageLanguage;
    document.documentElement.dir = pageLanguage === 'ar' ? 'rtl' : 'ltr';
    const upsertMeta = (attribute: 'name' | 'property', key: string, value: string) => {
      let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, key);
        document.head.appendChild(meta);
      }
      meta.content = value;
    };
    document.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang]').forEach(link => link.remove());
    if (!publicPage) {
      document.title = 'MASAR Mobility Syria';
      upsertMeta('name', 'robots', 'noindex, nofollow');
      return;
    }
    const metadata = pageMetadata[publicPage.language][publicPage.page];
    document.title = metadata.title;
    upsertMeta('name', 'robots', 'index, follow');
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = siteOrigin + publicPath(publicPage.page, publicPage.language);
    document.head.appendChild(canonical);
    for (const language of ['en', 'ar'] as const) {
      const alternate = document.createElement('link');
      alternate.rel = 'alternate';
      alternate.hreflang = language;
      alternate.href = siteOrigin + publicPath(publicPage.page, language);
      document.head.appendChild(alternate);
    }
    const values: [string, string, string][] = [
      ['name', 'description', metadata.description],
      ['property', 'og:title', metadata.title],
      ['property', 'og:description', metadata.description],
      ['property', 'og:url', siteOrigin + publicPath(publicPage.page, publicPage.language)],
      ['property', 'og:image', `${siteOrigin}/masar/masar-social.webp`],
      ['name', 'twitter:title', metadata.title],
      ['name', 'twitter:description', metadata.description],
      ['name', 'twitter:image', `${siteOrigin}/masar/masar-social.webp`],
    ];
    for (const [attribute, key, value] of values) {
      upsertMeta(attribute as 'name' | 'property', key, value);
    }
  }, [pageLanguage, path]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer); }, [toast]);
  const setSettingsAndPersist = (next: Settings) => { setSettings(next); saveSettings(next); };
  const setLanguage = (language: Language) => setSettingsAndPersist({ ...settings, language });
  const errorNotice = <div className="account-load-state" role="alert">{settings.language === 'ar' ? 'تعذّر تحميل ملفك الشخصي.' : 'Could not load your account profile.'} <button type="button" onClick={() => refetch()}>{settings.language === 'ar' ? 'إعادة المحاولة' : 'Try again'}</button></div>;
  const accountQuestions = profile && <AccountQuestions language={settings.language} profile={profile} onSave={saveProfile} onDone={() => setLocation('/profile')} />;
  const profileContent = isSignedIn ? <div className="page-wrap">
    <ProfileLanguagePreference language={settings.language} onChange={setLanguage} />
    {isLoading ? <p role="status">{settings.language === 'ar' ? 'جارٍ تحميل الملف…' : 'Loading profile…'}</p> : isError ? errorNotice : profile && <>
      <AccountQuestions language={settings.language} profile={profile} onSave={saveProfile} onSignOut={() => signOut({ redirectUrl: basePath || '/' })} editing />
    </>}
  </div> : null;
  const accountVehicleForReport = isSignedIn && !isLoading && !isError ? accountVehicle(profile ?? null) : null;
  const shell = <AppShell key={userId ?? 'guest'} settings={pageSettings} accountVehicleForReport={accountVehicleForReport} toast={toast} onToast={setToast}><RouterContent settings={pageSettings} setSettings={setSettingsAndPersist} fleet={fleet} setFleet={setFleet} onToast={setToast} profileContent={profileContent} accountVehicleForReport={accountVehicleForReport} /></AppShell>;
  if (!isLoaded) {
    if (publicPage?.page === 'welcome') return <WelcomePage language={pageLanguage} />;
    if (publicPage?.page === 'garages') return <PartnerGaragesPage language={pageLanguage} />;
    if (publicPage?.page === 'membership') return <MembershipPublicPreview language={pageLanguage} />;
    if (publicPage?.page === 'demo') return <DemoPreview language={pageLanguage} />;
    return <div className="account-load-state" role="status">{settings.language === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</div>;
  }
  return <Switch>
    <Route path="/ar/">{<WelcomePage language="ar" />}</Route>
    <Route path="/ar">{<WelcomePage language="ar" />}</Route>
    <Route path="/sign-in/*?"><div className="auth-screen" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}><div className="auth-top"><Link href="/">{settings.language === 'ar' ? 'العودة إلى مسار' : 'Back to MASAR'}</Link></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={basePath || '/'} /></div></Route>
    <Route path="/sign-up/*?"><div className="auth-screen" dir={settings.language === 'ar' ? 'rtl' : 'ltr'}><div className="auth-top"><Link href="/">{settings.language === 'ar' ? 'العودة إلى مسار' : 'Back to MASAR'}</Link></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={basePath || '/'} /></div></Route>
    <Route path="/onboarding">{!isSignedIn ? <Redirect to="/" /> : isLoading ? <div className="account-load-state" role="status">{settings.language === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</div> : isError ? errorNotice : profile?.completed ? <Redirect to="/demo" /> : accountQuestions}</Route>
    <Route path="/">{isSignedIn ? isLoading ? <div className="account-load-state" role="status">{settings.language === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</div> : isError ? errorNotice : <Redirect to={profile?.completed ? '/demo' : '/onboarding'} /> : <WelcomePage language="en" />}</Route>
    <Route>{shell}</Route>
  </Switch>;
}

function App() {
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    appearance={{
      theme: shadcn,
      cssLayerName: 'clerk',
      options: { logoPlacement: 'inside', logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/masar/masar-pin.png` },
      variables: { colorPrimary: '#164c85', colorForeground: '#142b44', colorMutedForeground: '#52657a', colorBackground: '#ffffff', colorInput: '#faf8f2', colorInputForeground: '#142b44', colorDanger: '#b32f32', colorNeutral: '#d7d1c4', fontFamily: "'DM Sans', 'Noto Sans Arabic', sans-serif", borderRadius: '12px' },
      elements: { cardBox: { background: '#fff', width: '440px', maxWidth: '100%', borderRadius: '18px', overflow: 'hidden' }, card: { boxShadow: 'none', border: 'none' }, footer: { boxShadow: 'none', background: '#fff' }, logoImage: { width: '60px', height: '76px', objectFit: 'contain' }, formButtonPrimary: { color: '#ffffff', fontWeight: 700 }, headerTitle: { color: '#142b44' }, headerSubtitle: { color: '#52657a' }, socialButtonsBlockButtonText: { color: '#142b44' }, formFieldLabel: { color: '#142b44' }, footerActionLink: { color: '#164c85' }, footerActionText: { color: '#52657a' }, dividerText: { color: '#52657a' }, identityPreviewEditButton: { color: '#164c85' }, formFieldSuccessText: { color: '#146747' }, alertText: { color: '#142b44' } },
    }}
    localization={settings.language === 'ar' ? arSA : enUS}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  ><ClerkQueryClientCacheInvalidator /><AppRoutes settings={settings} setSettings={setSettings} /></ClerkProvider>;
}

function Root() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><App /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default Root;
