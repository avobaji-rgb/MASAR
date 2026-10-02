import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Minus, Plus } from 'lucide-react';
import type { PartnerGarage } from './partner-garages';

type Point = { lat: number; lng: number };
type Props = {
  focus: Point;
  focusId: string;
  initialZoom: number;
  garages: PartnerGarage[];
  language: 'en' | 'ar';
  onGarageClick: (garage: PartnerGarage) => void;
  onReady: () => void;
  onError: () => void;
};

const TILE_SIZE = 256;
const clampLat = (lat: number) => Math.max(-85, Math.min(85, lat));
const project = ({ lat, lng }: Point, zoom: number) => {
  const scale = 2 ** zoom * TILE_SIZE;
  const radians = clampLat(lat) * Math.PI / 180;
  return {
    x: (lng + 180) / 360 * scale,
    y: (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * scale,
  };
};
const unproject = (x: number, y: number, zoom: number): Point => {
  const scale = 2 ** zoom * TILE_SIZE;
  return {
    lng: x / scale * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) * 180 / Math.PI,
  };
};

export function PartnerGarageMap({ focus, focusId, initialZoom, garages, language, onGarageClick, onReady, onError }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; center: Point } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 560 });
  const [center, setCenter] = useState(focus);
  const [zoom, setZoom] = useState(initialZoom);

  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setCenter(focus); setZoom(initialZoom); }, [focusId, initialZoom]);

  const projectedCenter = project(center, zoom);
  const tiles = useMemo(() => {
    const count = 2 ** zoom;
    const minX = Math.floor((projectedCenter.x - dimensions.width / 2) / TILE_SIZE);
    const maxX = Math.floor((projectedCenter.x + dimensions.width / 2) / TILE_SIZE);
    const minY = Math.max(0, Math.floor((projectedCenter.y - dimensions.height / 2) / TILE_SIZE));
    const maxY = Math.min(count - 1, Math.floor((projectedCenter.y + dimensions.height / 2) / TILE_SIZE));
    const result: { key: string; src: string; left: number; top: number }[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        result.push({
          key: `${zoom}-${x}-${y}`,
          src: `https://a.tile.openstreetmap.fr/hot/${zoom}/${((x % count) + count) % count}/${y}.png`,
          left: dimensions.width / 2 + x * TILE_SIZE - projectedCenter.x,
          top: dimensions.height / 2 + y * TILE_SIZE - projectedCenter.y,
        });
      }
    }
    return result;
  }, [zoom, projectedCenter.x, projectedCenter.y, dimensions.width, dimensions.height]);

  const markers = garages.filter((garage) => Number.isFinite(garage.lat) && Number.isFinite(garage.lng)).map((garage) => {
    const point = project(garage, zoom);
    return { garage, left: dimensions.width / 2 + point.x - projectedCenter.x, top: dimensions.height / 2 + point.y - projectedCenter.y };
  }).filter(({ left, top }) => left >= -24 && left <= dimensions.width + 24 && top >= -24 && top <= dimensions.height + 24);

  return <div
    ref={container}
    className="pg-tile-map"
    role="group"
    aria-label={language === 'ar' ? 'خريطة تفاعلية للكراجات الشريكة' : 'Interactive partner garage map'}
    data-testid="map-garages-tiles"
    onPointerDown={(event) => {
      if (event.target !== container.current && (event.target as HTMLElement).closest('button')) return;
      drag.current = { x: event.clientX, y: event.clientY, center };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={(event) => {
      if (!drag.current) return;
      const start = project(drag.current.center, zoom);
      const next = unproject(start.x - event.clientX + drag.current.x, start.y - event.clientY + drag.current.y, zoom);
      setCenter({ lat: clampLat(next.lat), lng: Math.max(-180, Math.min(180, next.lng)) });
    }}
    onPointerUp={() => { drag.current = null; }}
    onPointerCancel={() => { drag.current = null; }}
  >
    {tiles.map((tile) => <img key={tile.key} className="pg-tile" src={tile.src} alt="" draggable={false} style={{ left: tile.left, top: tile.top }} onLoad={onReady} onError={onError} />)}
    {markers.map(({ garage, left, top }) => <button key={garage.id} type="button" className="pg-map-marker" style={{ left, top }} title={garage.name} aria-label={garage.name} onClick={() => onGarageClick(garage)} data-testid={`button-map-garage-${garage.id}`}><MapPin size={20} aria-hidden="true" /></button>)}
    <div className="pg-zoom-controls">
      <button type="button" onClick={() => setZoom((value) => Math.min(16, value + 1))} aria-label={language === 'ar' ? 'تكبير الخريطة' : 'Zoom in'} data-testid="button-garage-map-zoom-in"><Plus size={18} /></button>
      <button type="button" onClick={() => setZoom((value) => Math.max(5, value - 1))} aria-label={language === 'ar' ? 'تصغير الخريطة' : 'Zoom out'} data-testid="button-garage-map-zoom-out"><Minus size={18} /></button>
    </div>
  </div>;
}