export type Vehicle = { id: string; make: string; plate: string; ev: boolean };
export type Fleet = { vehicles: Vehicle[]; activeId: string | null };
export type AccountVehicleFields = { vehicleMake: string; vehiclePlate: string; vehicleElectric: boolean };
export type VehicleChoice = 'none' | 'account' | `demo:${string}`;
export function accountVehicle(fields: AccountVehicleFields | null): Vehicle | null {
  if (!fields?.vehicleMake?.trim()) return null;
  return { id: 'account-vehicle', make: fields.vehicleMake.trim(), plate: fields.vehiclePlate?.trim() ?? '', ev: fields.vehicleElectric };
}
export function resolveReportVehicle(choice: VehicleChoice, fleet: Fleet, account: Vehicle | null): Vehicle | undefined {
  if (choice === 'account') return account ? { ...account } : undefined;
  if (choice.startsWith('demo:')) {
    const vehicle = fleet.vehicles.find(v => v.id === choice.slice(5));
    return vehicle ? { ...vehicle } : undefined;
  }
  return undefined;
}
const FLEET_KEY = 'masar-demo-fleet-v1';
const PAYMENT_KEY = 'masar-demo-payment-v1';
const SETTINGS_KEY = 'masar-demo-settings';

export function readFleet(): Fleet {
  try {
    const saved = localStorage.getItem(FLEET_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Fleet;
      if (Array.isArray(parsed.vehicles)) {
        const vehicles = parsed.vehicles.filter(v => v && typeof v.id === 'string' && typeof v.make === 'string');
        return { vehicles, activeId: vehicles.some(v => v.id === parsed.activeId) ? parsed.activeId : vehicles[0]?.id ?? null };
      }
    }
    // One-time migration only: never create a vehicle from the old placeholder defaults.
    const legacy = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const vehicles: Vehicle[] = legacy.make || legacy.plate
      ? [{ id: 'legacy-vehicle', make: legacy.make || '', plate: legacy.plate || '', ev: !!legacy.ev }]
      : [];
    const fleet = { vehicles, activeId: vehicles[0]?.id ?? null };
    saveFleet(fleet);
    return fleet;
  } catch { return { vehicles: [], activeId: null }; }
}
export function saveFleet(fleet: Fleet) { localStorage.setItem(FLEET_KEY, JSON.stringify(fleet)); }
export function activeVehicle(fleet: Fleet) { return fleet.vehicles.find(v => v.id === fleet.activeId) ?? null; }
export function clearExtensionData() {
  localStorage.removeItem(FLEET_KEY);
  localStorage.removeItem(PAYMENT_KEY);
  localStorage.removeItem('masar-demo-verified-phone-v1');
  localStorage.removeItem('masar-assistant-demo-reports-v1');
  window.dispatchEvent(new Event('masar-demo-data-erased'));
}