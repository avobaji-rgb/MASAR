import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetProfileQueryKey, useGetProfile, useSaveProfile, type DriverProfileInput } from '@workspace/api-client-react';
import { ar } from '@/locales/ar';
import { en, type LocaleKey } from '@/locales/en';
import { EmergencyCallCard } from './DemoPages';

type Language = 'en' | 'ar';
type ContactDraft = { userId: string; name: string; phone: string };

const copy: Record<Language, {
  loading: string;
  loadError: string;
  retry: string;
  signInRequired: string;
  validationError: string;
  saveError: string;
  refreshError: string;
  saved: string;
  saving: string;
}> = {
  en: {
    loading: 'Loading your account safety contact…',
    loadError: 'Could not load your account safety contact. Please try again.',
    retry: 'Retry',
    signInRequired: 'Sign in to view and update your account safety contact.',
    validationError: 'Enter a contact name and phone number.',
    saveError: 'Could not save your safety contact. Please try again.',
    refreshError: 'Your contact was saved, but the profile could not be refreshed. Retry to confirm the latest profile.',
    saved: 'Your safety contact was saved to your account.',
    saving: 'Saving…',
  },
  ar: {
    loading: 'جارٍ تحميل جهة اتصال السلامة في حسابك…',
    loadError: 'تعذّر تحميل جهة اتصال السلامة في حسابك. حاول مرة أخرى.',
    retry: 'إعادة المحاولة',
    signInRequired: 'سجّل الدخول لعرض جهة اتصال السلامة في حسابك وتحديثها.',
    validationError: 'أدخل اسم جهة الاتصال ورقم هاتفها.',
    saveError: 'تعذّر حفظ جهة اتصال السلامة. حاول مرة أخرى.',
    refreshError: 'حُفظت جهة الاتصال، لكن تعذّر تحديث الملف الشخصي. أعد المحاولة للتأكد من أحدث بيانات الملف.',
    saved: 'حُفظت جهة اتصال السلامة في حسابك.',
    saving: 'جارٍ الحفظ…',
  },
};

export function AccountSafetyPage({ language }: { language: Language }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const t = (key: LocaleKey) => (language === 'ar' ? ar[key] : en[key]) as string;
  const copyForLanguage = copy[language];
  const profileQueryKey = [...getGetProfileQueryKey(), userId];
  const profileQuery = useGetProfile({
    query: {
      queryKey: profileQueryKey,
      enabled: !!isSignedIn && !!userId,
      retry: false,
      staleTime: 0,
      refetchOnMount: 'always',
    },
  });
  const saveProfile = useSaveProfile();
  const [draft, setDraft] = useState<ContactDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const contact = draft?.userId === userId ? draft : null;

  useEffect(() => {
    if (
      userId &&
      profileQuery.data &&
      !profileQuery.isLoading &&
      !profileQuery.isFetching &&
      !profileQuery.isError &&
      !contact
    ) {
      setDraft({
        userId,
        name: profileQuery.data.safetyContactName,
        phone: profileQuery.data.safetyContactPhone,
      });
    }
  }, [contact, profileQuery.data, profileQuery.isError, profileQuery.isFetching, profileQuery.isLoading, userId]);

  const retryProfile = async () => {
    try {
      const result = await profileQuery.refetch({ throwOnError: true });
      if (result.data && userId) {
        setDraft({
          userId,
          name: result.data.safetyContactName,
          phone: result.data.safetyContactPhone,
        });
        setFormError('');
      }
    } catch {
      // The query's error state remains visible with the retry action.
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setSaveSucceeded(false);
    setRefreshFailed(false);

    if (!contact?.name.trim() || !contact.phone.trim()) {
      setFormError(copyForLanguage.validationError);
      return;
    }
    if (!userId) {
      setFormError(copyForLanguage.signInRequired);
      return;
    }

    setSaving(true);
    try {
      // Read the latest server profile immediately before writing so every
      // field other than the safety contact is preserved from fresh data.
      const latest = await profileQuery.refetch({ throwOnError: true });
      if (!latest.data) throw new Error('Profile refresh returned no data');
      const data: DriverProfileInput = {
        ...latest.data,
        safetyContactName: contact.name.trim(),
        safetyContactPhone: contact.phone.trim(),
      };
      const saved = await saveProfile.mutateAsync({ data });
      queryClient.setQueryData(profileQueryKey, saved);
      setDraft({
        userId,
        name: saved.safetyContactName,
        phone: saved.safetyContactPhone,
      });
      setSaveSucceeded(true);

      try {
        await queryClient.invalidateQueries(
          { queryKey: profileQueryKey, exact: true },
          { throwOnError: true },
        );
      } catch {
        setRefreshFailed(true);
      }
    } catch {
      setFormError(copyForLanguage.saveError);
    } finally {
      setSaving(false);
    }
  };

  const loadingAuth = !isLoaded;
  const needsSignIn = isLoaded && (!isSignedIn || !userId);
  const loadingProfile = !needsSignIn && (profileQuery.isLoading || (!contact && profileQuery.isFetching));
  const waitingForContact = !needsSignIn && !contact && !profileQuery.isError;

  return <div className="page-wrap" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <div className="page-header">
      <div className="eyebrow">MASAR / {t('demoStatus')}</div>
      <h1>{t('safetyTitle')}</h1>
      <p>{t('safetyIntro')}</p>
    </div>
    <EmergencyCallCard language={language} />
    <div className="wide-grid">
      <section className="card demo-panel">
        <h2>{t('safetyFlag')}</h2>
        <ol className="demo-steps">
          <li>{t('safetyStep1')}</li>
          <li>{t('safetyStep2')}</li>
          <li>{t('safetyStep3')}</li>
          <li>{t('safetyStep4')}</li>
        </ol>
      </section>
      <section className="card form-card">
        <h2 style={{ margin: 0 }}>{t('safetyContact')}</h2>
        <p className="demo-lead" style={{ marginTop: 10 }} data-testid="text-safety-saved-contact">
          {contact && profileQuery.data?.safetyContactName
            ? `${profileQuery.data.safetyContactName} · ${profileQuery.data.safetyContactPhone}`
            : t('safetyContactEmpty')}
        </p>
        <p className="demo-note">
          {language === 'ar'
            ? 'حفظ جهة الاتصال لا يتصل بها ولا يرسل لها رسالة نصية أو إشعاراً، ولا يشارك موقعك.'
            : 'Saving a contact does not call, text, notify them, or share your location.'}
        </p>

        {loadingAuth && <p role="status" data-testid="status-safety-loading">{copyForLanguage.loading}</p>}
        {needsSignIn && <p role="alert" data-testid="error-safety-sign-in">{copyForLanguage.signInRequired}</p>}
        {!needsSignIn && (loadingProfile || waitingForContact) && <p role="status" data-testid="status-safety-loading">{copyForLanguage.loading}</p>}
        {!needsSignIn && profileQuery.isError && <div>
          <p role="alert" data-testid="error-safety-profile">{copyForLanguage.loadError}</p>
          <button type="button" className="button button-ghost" onClick={retryProfile} data-testid="button-retry-safety-profile">{copyForLanguage.retry}</button>
        </div>}

        {contact && <form className="demo-form" onSubmit={submit}>
          <label className="form-label" htmlFor="safety-name">{t('contactName')}</label>
          <input id="safety-name" className="text-input" value={contact.name} maxLength={120} onChange={event => {
            setDraft(previous => previous && previous.userId === userId ? { ...previous, name: event.target.value } : previous);
            setFormError('');
            setSaveSucceeded(false);
          }} data-testid="input-safety-name" />
          <label className="form-label" htmlFor="safety-phone">{t('contactPhone')}</label>
          <input id="safety-phone" className="text-input" type="tel" dir="ltr" value={contact.phone} maxLength={40} autoComplete="tel" onChange={event => {
            setDraft(previous => previous && previous.userId === userId ? { ...previous, phone: event.target.value } : previous);
            setFormError('');
            setSaveSucceeded(false);
          }} data-testid="input-safety-phone" />
          {formError && <p className="field-error" role="alert" data-testid="error-safety-save">{formError}</p>}
          {saveSucceeded && <p role="status" data-testid="status-safety-save">{copyForLanguage.saved}</p>}
          {refreshFailed && <p className="field-error" role="alert" data-testid="error-safety-refresh">{copyForLanguage.refreshError}</p>}
          <button type="submit" className="button button-navy" style={{ marginTop: 15 }} disabled={saving} data-testid="button-save-safety-contact">
            {saving ? copyForLanguage.saving : t('saveContact')}
          </button>
        </form>}
      </section>
    </div>
  </div>;
}