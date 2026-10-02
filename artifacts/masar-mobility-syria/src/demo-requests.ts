export const ACTIVITY_KEY = 'masar-demo-activity';

export type ServiceKey = 'flat' | 'battery' | 'fuel' | 'tow' | 'lockout' | 'ev' | 'other';
export type ActivityStatus = 'dispatch' | 'assigned' | 'enroute' | 'arrived' | 'completed';
export type Activity = {
  id: string; service: ServiceKey; date: string; status: ActivityStatus; notes: string;
  unsafe: boolean; location: string; destination: string; code: string; verified?: boolean; rating?: number;
  vehicle?: { id: string; make: string; plate: string; ev: boolean };
};

export function readActivities(): Activity[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
    return Array.isArray(saved) ? saved as Activity[] : [];
  } catch {
    return [];
  }
}

export function saveActivities(items: Activity[]) {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(items));
}

export function saveNewDemoRequest(item: Activity) {
  saveActivities([item, ...readActivities()]);
  localStorage.setItem('masar-current-request', item.id);
  window.dispatchEvent(new Event('masar-demo-request-created'));
}