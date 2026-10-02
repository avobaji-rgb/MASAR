import { useCallback, useEffect, useRef, useState } from 'react';

type AlertRequest = { id: string; status: string; service: string };
type Permission = NotificationPermission | 'unsupported';

export function useNewRequestAlerts(
  items: AlertRequest[] | undefined,
  ready: boolean,
  role: 'operator' | 'provider',
  sessionId: string | null | undefined,
  language: 'en' | 'ar',
) {
  const [permission, setPermission] = useState<Permission>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const [feedback, setFeedback] = useState('');
  const snapshot = useRef<Map<string, string> | null>(null);
  const lastSession = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (lastSession.current !== sessionId) {
      lastSession.current = sessionId;
      snapshot.current = null;
      setFeedback('');
    }
    if (!ready || !sessionId || !items) {
      snapshot.current = null;
      return;
    }
    const relevant = items.filter((item) => role === 'operator'
      ? item.status === 'pending'
      : item.status === 'offered');
    const current = new Map(relevant.map((item) => [item.id, item.status]));
    if (snapshot.current === null) {
      snapshot.current = current;
      return;
    }
    const fresh = relevant.filter((item) => snapshot.current?.get(item.id) !== item.status);
    snapshot.current = current;
    if (!fresh.length) return;

    const message = language === 'ar'
      ? role === 'operator' ? `وصلت ${fresh.length} طلبات مساعدة جديدة.` : `لديك ${fresh.length} عروض مساعدة جديدة.`
      : role === 'operator' ? `${fresh.length} new assistance request${fresh.length === 1 ? '' : 's'} received.`
        : `${fresh.length} new assistance offer${fresh.length === 1 ? '' : 's'} received.`;
    setFeedback(message);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      fresh.slice(0, 3).forEach((item) => {
        const title = role === 'operator'
          ? language === 'ar' ? 'طلب مساعدة جديد' : 'New assistance request'
          : language === 'ar' ? 'عرض مساعدة جديد' : 'New assistance offer';
        new Notification(title, {
          body: `${item.service} · ${item.id.slice(0, 8)}`,
          tag: `${role}-${item.id}`,
        });
      });
    }
  }, [items, language, ready, role, sessionId]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      return;
    }
    const next = await Notification.requestPermission();
    setPermission(next);
  }, []);

  return { permission, feedback, requestPermission };
}

export function NewRequestAlertControls({
  language, permission, feedback, onRequestPermission,
}: {
  language: 'en' | 'ar';
  permission: Permission;
  feedback: string;
  onRequestPermission: () => void;
}) {
  const ar = language === 'ar';
  const buttonLabel = permission === 'granted'
    ? ar ? 'إشعارات المتصفح مفعّلة' : 'Browser notifications enabled'
    : permission === 'denied'
      ? ar ? 'الإشعارات محظورة في المتصفح' : 'Notifications blocked by browser'
      : permission === 'unsupported'
        ? ar ? 'الإشعارات غير مدعومة في هذا المتصفح' : 'Notifications are not supported in this browser'
        : ar ? 'تفعيل إشعارات الطلبات الجديدة' : 'Enable new-request notifications';
  return <div className="demo-note" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
    <button type="button" className="button button-ghost" onClick={onRequestPermission}
      disabled={permission === 'granted' || permission === 'denied' || permission === 'unsupported'}>
      {buttonLabel}
    </button>
    <span aria-live="polite" role="status">{feedback || (ar
      ? 'التنبيهات اختيارية وتعمل أثناء بقاء هذه الصفحة مفتوحة فقط؛ لا يوجد ضمان لإشعارات عند إغلاقها.'
      : 'Alerts are optional and work only while this page remains open; there is no offline push guarantee.')}</span>
  </div>;
}