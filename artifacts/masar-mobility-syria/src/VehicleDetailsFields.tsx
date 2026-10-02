import { useEffect, useRef, useState } from 'react';
import './VehicleDetailsFields.css';

type Language = 'en' | 'ar';

// A useful starting selection, not an exhaustive vehicle registry. Both fields allow a custom value.
const modelsByBrand: Record<string, string[]> = {
  Audi: ['A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7'],
  BMW: ['1 Series', '3 Series', '5 Series', 'X1', 'X3', 'X5'],
  BYD: ['F3', 'Song', 'Atto 3', 'Dolphin', 'Seal'],
  Chery: ['Arrizo 5', 'Tiggo 2', 'Tiggo 4', 'Tiggo 7', 'Tiggo 8'],
  Chevrolet: ['Aveo', 'Cruze', 'Malibu', 'Captiva', 'Spark'],
  Fiat: ['500', 'Punto', 'Tipo', 'Doblo'],
  Ford: ['Fiesta', 'Focus', 'Mondeo', 'Escape', 'Ranger'],
  Geely: ['Emgrand', 'Coolray', 'Tugella', 'Okavango'],
  Honda: ['Civic', 'Accord', 'City', 'CR-V', 'HR-V'],
  Hyundai: ['Accent', 'Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'i10', 'i20'],
  Kia: ['Picanto', 'Rio', 'Cerato', 'Sportage', 'Sorento', 'K5'],
  Mazda: ['2', '3', '6', 'CX-3', 'CX-5'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'GLA', 'GLC'],
  MG: ['3', '5', 'ZS', 'HS', 'RX5'],
  Mitsubishi: ['Lancer', 'Outlander', 'Pajero', 'ASX', 'L200'],
  Nissan: ['Sunny', 'Sentra', 'Altima', 'Patrol', 'X-Trail'],
  Opel: ['Astra', 'Corsa', 'Insignia', 'Mokka'],
  Peugeot: ['206', '207', '301', '308', '508', '2008'],
  Renault: ['Clio', 'Logan', 'Duster', 'Megane', 'Symbol'],
  Škoda: ['Fabia', 'Octavia', 'Superb', 'Karoq', 'Kodiaq'],
  Suzuki: ['Alto', 'Swift', 'Celerio', 'Vitara', 'Jimny'],
  Toyota: ['Corolla', 'Camry', 'Yaris', 'RAV4', 'Land Cruiser', 'Hilux'],
  Volkswagen: ['Golf', 'Passat', 'Polo', 'Tiguan', 'Jetta'],
};

const brands = Object.keys(modelsByBrand).sort((a, b) => a.localeCompare(b));
const OTHER = '__other__';

const labels = {
  en: {
    make: 'Make', model: 'Model', plate: 'Plate number',
    selectMake: 'Choose a make', selectModel: 'Choose a model',
    otherMake: 'Another make', otherModel: 'Another model',
    makePlaceholder: 'Enter the make', modelPlaceholder: 'Enter the model',
    platePlaceholder: 'e.g. Damascus 123456',
    plateHint: 'Enter the plate as printed. Arabic or Latin letters and numbers are welcome; no special format is required.',
  },
  ar: {
    make: 'ماركة المركبة', model: 'الطراز', plate: 'رقم اللوحة',
    selectMake: 'اختر الماركة', selectModel: 'اختر الطراز',
    otherMake: 'ماركة أخرى', otherModel: 'طراز آخر',
    makePlaceholder: 'أدخل الماركة', modelPlaceholder: 'أدخل الطراز',
    platePlaceholder: 'مثال: دمشق ١٢٣٤٥٦',
    plateHint: 'أدخل رقم اللوحة كما يظهر عليها. يمكنك استخدام الحروف والأرقام العربية أو اللاتينية، دون تنسيق إلزامي.',
  },
};

type VehicleIdentity = { brand: string; model: string };

function parseIdentity(value: string): VehicleIdentity {
  const name = value.trim();
  const known = [...brands].sort((a, b) => b.length - a.length)
    .find(brand => name.toLowerCase() === brand.toLowerCase()
      || name.toLowerCase().startsWith(`${brand.toLowerCase()} · `)
      || name.toLowerCase().startsWith(`${brand.toLowerCase()} `));
  if (known) {
    const rest = name.slice(known.length).replace(/^(?:\s*·\s*|\s+)/, '');
    return { brand: known, model: rest };
  }
  const separator = name.indexOf(' · ');
  return separator < 0
    ? { brand: name, model: '' }
    : { brand: name.slice(0, separator), model: name.slice(separator + 3) };
}

function joinIdentity({ brand, model }: VehicleIdentity) {
  return model.trim() ? `${brand.trim()} · ${model.trim()}` : brand.trim();
}

export function VehicleDetailsFields({ language, value, onValueChange, plate, onPlateChange, idPrefix }: {
  language: Language;
  value: string;
  onValueChange: (value: string) => void;
  plate: string;
  onPlateChange: (value: string) => void;
  idPrefix: string;
}) {
  const t = labels[language];
  const [identity, setIdentity] = useState(() => parseIdentity(value));
  const [customBrandSelected, setCustomBrandSelected] = useState(() => {
    const parsed = parseIdentity(value);
    return !!parsed.brand && !brands.includes(parsed.brand);
  });
  const [customModelSelected, setCustomModelSelected] = useState(() => {
    const parsed = parseIdentity(value);
    return !!parsed.model && !(modelsByBrand[parsed.brand] ?? []).includes(parsed.model);
  });
  const lastEmitted = useRef(value);

  // Profile data can arrive after mount, or a different vehicle can be opened for editing.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      const parsed = parseIdentity(value);
      setIdentity(parsed);
      setCustomBrandSelected(!!parsed.brand && !brands.includes(parsed.brand));
      setCustomModelSelected(!!parsed.model && !(modelsByBrand[parsed.brand] ?? []).includes(parsed.model));
      lastEmitted.current = value;
    }
  }, [value]);

  const changeIdentity = (next: VehicleIdentity) => {
    setIdentity(next);
    const combined = joinIdentity(next);
    lastEmitted.current = combined;
    onValueChange(combined);
  };
  const brandChoice = customBrandSelected ? OTHER : identity.brand;
  const modelOptions = modelsByBrand[identity.brand] ?? [];
  const modelChoice = customModelSelected ? OTHER : identity.model;

  return <div className="vehicle-details-fields">
    <label className="vehicle-details-field" htmlFor={`${idPrefix}-make`}>
      <span>{t.make}</span>
      <select id={`${idPrefix}-make`} value={brandChoice} onChange={e => {
        const brand = e.target.value;
        setCustomBrandSelected(brand === OTHER);
        setCustomModelSelected(false);
        changeIdentity({ brand: brand === OTHER ? '' : brand, model: '' });
      }} data-testid={`${idPrefix}-make`}>
        <option value="">{t.selectMake}</option>
        {brands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
        <option value={OTHER}>{t.otherMake}</option>
      </select>
    </label>
    {brandChoice === OTHER && <label className="vehicle-details-field" htmlFor={`${idPrefix}-custom-make`}>
      <span>{t.otherMake}</span>
      <input id={`${idPrefix}-custom-make`} value={identity.brand}
        onChange={e => changeIdentity({ brand: e.target.value, model: identity.model })}
        placeholder={t.makePlaceholder} maxLength={55} dir="auto" autoComplete="off" />
    </label>}
    <label className="vehicle-details-field" htmlFor={`${idPrefix}-model`}>
      <span>{t.model}</span>
      <select id={`${idPrefix}-model`} value={modelChoice} disabled={!identity.brand} onChange={e => {
        const model = e.target.value;
        setCustomModelSelected(model === OTHER);
        changeIdentity({ ...identity, model: model === OTHER ? '' : model });
      }} data-testid={`${idPrefix}-model`}>
        <option value="">{t.selectModel}</option>
        {modelOptions.map(model => <option key={model} value={model}>{model}</option>)}
        <option value={OTHER}>{t.otherModel}</option>
      </select>
    </label>
    {modelChoice === OTHER && <label className="vehicle-details-field" htmlFor={`${idPrefix}-custom-model`}>
      <span>{t.otherModel}</span>
      <input id={`${idPrefix}-custom-model`} value={identity.model}
        onChange={e => changeIdentity({ ...identity, model: e.target.value })}
        placeholder={t.modelPlaceholder} maxLength={55} dir="auto" autoComplete="off" />
    </label>}
    <label className="vehicle-details-field" htmlFor={`${idPrefix}-plate`}>
      <span>{t.plate}</span>
      <input id={`${idPrefix}-plate`} type="text" dir="auto" inputMode="text"
        autoCapitalize="characters" autoCorrect="off" spellCheck={false}
        value={plate} onChange={e => onPlateChange(e.target.value)}
        maxLength={40} placeholder={t.platePlaceholder} aria-describedby={`${idPrefix}-plate-hint`}
        data-testid={`${idPrefix}-plate`} />
      <small id={`${idPrefix}-plate-hint`}>{t.plateHint}</small>
    </label>
  </div>;
}