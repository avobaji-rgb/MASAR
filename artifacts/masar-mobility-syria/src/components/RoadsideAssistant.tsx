import { useAskAssistant } from '@workspace/api-client-react';
import { AlertTriangle, ArrowRight, ArrowUp, FilePlus2, MessageCircle, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation } from 'wouter';
import { en } from '@/locales/en';
import { ar } from '@/locales/ar';

const REPORTS_KEY = 'masar-assistant-demo-reports-v1';
type Language = 'en' | 'ar';
type Turn = { role: 'user' | 'assistant'; content: string };
type Report = { id: string; description: string; createdAt: string };

function readReports(): Report[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Report =>
      !!item && typeof item.id === 'string' && typeof item.description === 'string' && typeof item.createdAt === 'string');
  } catch { return []; }
}

export function RoadsideAssistant({ language, onPrepareReport }: { language: Language; onPrepareReport: (notes: string) => void }) {
  const copy = language === 'ar' ? ar : en;
  const [page] = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(false);
  const [reportError, setReportError] = useState(false);
  const [reports, setReports] = useState<Report[]>(readReports);
  const ask = useAskAssistant();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const onReset = () => {
      requestVersionRef.current += 1;
      pendingRef.current = false;
      ask.reset();
      setReports([]); setMessages([]); setDraft(''); setError(false); setReportError(false);
    };
    window.addEventListener('masar-demo-data-erased', onReset);
    return () => window.removeEventListener('masar-demo-data-erased', onReset);
  }, []);
  useEffect(() => {
    if (!open) return;
    if (window.matchMedia('(max-width: 767px)').matches) closeRef.current?.focus();
    else inputRef.current?.focus();
    document.body.classList.add('assistant-open');
    const viewport = window.visualViewport;
    const fitToViewport = () => {
      const panel = panelRef.current;
      if (!panel) return;
      if (window.matchMedia('(max-width: 767px)').matches) {
        panel.style.height = `${viewport?.height ?? window.innerHeight}px`;
        panel.style.top = `${viewport?.offsetTop ?? 0}px`;
      } else {
        panel.style.removeProperty('height');
        panel.style.removeProperty('top');
      }
    };
    fitToViewport();
    viewport?.addEventListener('resize', fitToViewport);
    viewport?.addEventListener('scroll', fitToViewport);
    window.addEventListener('resize', fitToViewport);
    return () => {
      document.body.classList.remove('assistant-open');
      viewport?.removeEventListener('resize', fitToViewport);
      viewport?.removeEventListener('scroll', fitToViewport);
      window.removeEventListener('resize', fitToViewport);
    };
  }, [open]);
  useEffect(() => { if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, ask.isPending, open]);

  const close = () => { setOpen(false); requestAnimationFrame(() => launcherRef.current?.focus()); };
  const send = async (next: Turn[]) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    const requestVersion = ++requestVersionRef.current;
    setError(false);
    try {
      // Only explicitly entered turns and the current route are shared. Never read profile, phone, vehicle or location here.
      const answer = await ask.mutateAsync({
        data: {
          language,
          page: page.slice(0, 100),
          messages: next.slice(-10).map(({ role, content }) => ({ role, content: content.slice(0, 1500) })),
        },
      });
      if (!answer.reply?.trim()) throw new Error('Empty assistant reply');
      if (requestVersion === requestVersionRef.current) {
        setMessages((current) => [...current, { role: 'assistant', content: answer.reply }]);
      }
    } catch {
      if (requestVersion === requestVersionRef.current) setError(true);
    } finally {
      if (requestVersion === requestVersionRef.current) pendingRef.current = false;
    }
  };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || pendingRef.current) return;
    const next: Turn[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setDraft('');
    void send(next);
  };
  const startQuestion = (content: string) => {
    if (pendingRef.current) return;
    const next: Turn[] = [...messages, { role: 'user', content }];
    setMessages(next);
    void send(next);
  };
  const prepareReport = (notes: string) => {
    setOpen(false);
    onPrepareReport(notes.slice(0, 500));
  };
  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };
  const deleteReport = (id: string) => {
    const next = reports.filter((report) => report.id !== id);
    try { localStorage.setItem(REPORTS_KEY, JSON.stringify(next)); setReports(next); setReportError(false); } catch { setReportError(true); }
  };

  return <div className="assistant-dock" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    {open && <section ref={panelRef} id="assistant-panel" className="assistant-panel" role="dialog" aria-modal={window.matchMedia('(max-width: 767px)').matches} aria-labelledby="assistant-title" data-testid="panel-assistant" onKeyDown={(event) => { if (event.key === 'Escape') close(); }}>
      <header className="assistant-header">
        <span className="assistant-mark"><MessageCircle size={19} aria-hidden="true" /></span>
        <span className="assistant-heading"><strong id="assistant-title">{copy.assistantTitle}</strong><small>{copy.assistantSubtitle}</small></span>
        <button ref={closeRef} type="button" className="assistant-close" onClick={close} aria-label={copy.assistantClose} data-testid="button-close-assistant"><X size={18} /></button>
      </header>
      <div className="assistant-scroll" ref={scrollRef} role="log" aria-label={copy.assistantHistory} aria-live="polite" data-testid="log-assistant-history">
        <div className="assistant-intro"><strong>{copy.assistantWelcome}</strong><p>{copy.assistantIntro}</p></div>
        <p className="assistant-emergency"><AlertTriangle size={15} aria-hidden="true" />{copy.assistantEmergency}</p>
        {messages.length === 0 && <div className="assistant-starters">
          <button type="button" disabled={ask.isPending} onClick={() => startQuestion(copy.assistantStarterSafety)}>{copy.assistantStarterSafety}</button>
          <button type="button" disabled={ask.isPending} onClick={() => startQuestion(copy.assistantStarterReport)}>{copy.assistantStarterReport}</button>
        </div>}
        {messages.map((turn, index) => <div key={index} className={`assistant-turn ${turn.role}`} dir="auto" data-testid={`text-assistant-${turn.role}-${index}`}>{turn.content}</div>)}
        {ask.isPending && <div role="status" aria-label={copy.assistantThinking} data-testid="status-assistant-loading"><div className="assistant-loading" aria-hidden="true"><span /><span /><span /></div><span className="sr-only">{copy.assistantThinking}</span></div>}
        {error && <div className="assistant-error" role="alert" data-testid="status-assistant-error">{copy.assistantError}{messages.at(-1)?.role === 'user' && <button type="button" onClick={() => void send(messages)} disabled={ask.isPending} data-testid="button-retry-assistant">{copy.assistantRetry}</button>}</div>}
      </div>
      <div className="assistant-report-area">
        <button type="button" className="assistant-prepare" onClick={() => prepareReport([...messages].reverse().find((turn) => turn.role === 'user')?.content || draft)} data-testid="button-create-assistant-report"><FilePlus2 size={19} aria-hidden="true" /><span><strong>{copy.assistantReportAction}</strong><small>{copy.assistantReportHint}</small></span><ArrowRight className="assistant-prepare-arrow" size={17} aria-hidden="true" /></button>
        {reports.length > 0 && <details className="assistant-legacy" data-testid="list-assistant-reports"><summary>{copy.assistantSavedReports} ({reports.length})</summary><div className="assistant-reports">{reports.map((report) => <article className="assistant-report-item" key={report.id} data-testid={`card-assistant-report-${report.id}`}><small>{copy.assistantNotSent}</small><p dir="auto">{report.description}</p><div className="assistant-report-item-actions"><button type="button" onClick={() => prepareReport(report.description)}>{copy.assistantContinueReport}</button><button type="button" onClick={() => deleteReport(report.id)} aria-label={`${copy.assistantDeleteReport}: ${report.description}`} data-testid={`button-delete-assistant-report-${report.id}`}><Trash2 size={13} />{copy.assistantDeleteReport}</button></div></article>)}</div></details>}
        {reportError && <p className="assistant-error" role="alert" data-testid="status-assistant-report-error">{copy.assistantReportError}</p>}
      </div>
      <form className="assistant-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="assistant-message">{copy.assistantInputLabel}</label>
        <textarea ref={inputRef} id="assistant-message" className="textarea" rows={1} maxLength={1500} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleKey} placeholder={copy.assistantPlaceholder} data-testid="input-assistant-message" />
        <button type="submit" className="assistant-send" disabled={!draft.trim() || ask.isPending} aria-label={copy.assistantSend} data-testid="button-send-assistant"><ArrowUp size={19} /></button>
      </form>
      <div className="assistant-footnote"><p>{copy.assistantBoundary}</p><details><summary>{copy.assistantDataLabel}</summary><p>{copy.assistantPrivacy}</p></details></div>
    </section>}
    <button ref={launcherRef} type="button" className="assistant-launcher" onClick={() => open ? close() : setOpen(true)} aria-expanded={open} aria-controls="assistant-panel" data-testid="button-open-assistant"><MessageCircle size={19} aria-hidden="true" />{copy.assistantLauncher}</button>
  </div>;
}