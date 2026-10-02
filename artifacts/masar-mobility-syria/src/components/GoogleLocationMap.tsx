import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { ExternalLink, MapPin, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { en } from '@/locales/en';
import { ar } from '@/locales/ar';

type Language = 'en' | 'ar';
type Point = { lat: number; lng: number };
type Props = { value: string; language: Language; onSelect?: (location: string) => void };

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
const damascus: Point = { lat: 33.5138, lng: 36.2765 };
let configured = false;

function coordinates(value: string): Point | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function GoogleLocationMap({ value, language, onSelect }: Props) {
  const copy = language === 'ar' ? ar : en;
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>(apiKey ? 'loading' : 'missing');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const pin = useRef<google.maps.Marker | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const lastResolvedAddress = useRef('');
  const latest = useRef({ value, onSelect });
  latest.current = { value, onSelect };

  const placePin = (point: Point) => {
    if (!map.current) return;
    if (pin.current) pin.current.setPosition(point);
    else pin.current = new google.maps.Marker({ map: map.current, position: point, title: copy.location });
    map.current.panTo(point);
    if ((map.current.getZoom() ?? 0) < 15) map.current.setZoom(15);
  };

  const searchAddress = async (address: string, updateInput: boolean) => {
    const query = address.trim();
    if (!query || !geocoder.current) return;
    setSearching(true);
    setSearchError(false);
    try {
      const response = await geocoder.current.geocode({ address: query, region: 'SY' });
      if (!map.current || latest.current.value.trim() !== query) return;
      const result = response.results[0];
      if (!result?.geometry?.location) throw new Error('Address not found');
      lastResolvedAddress.current = result.formatted_address;
      placePin(result.geometry.location.toJSON());
      if (updateInput) latest.current.onSelect?.(result.formatted_address);
    } catch {
      if (map.current) setSearchError(true);
    } finally {
      if (map.current) setSearching(false);
    }
  };

  useEffect(() => {
    if (!apiKey || !canvas.current) return;
    let mounted = true;
    let authFailed = false;
    if (!configured) {
      setOptions({ key: apiKey, v: 'weekly', language, region: 'SY', authReferrerPolicy: 'origin' });
      configured = true;
    }
    const browser = window as Window & { gm_authFailure?: () => void };
    const previousAuthFailure = browser.gm_authFailure;
    const authFailure = () => { authFailed = true; if (mounted) setStatus('error'); previousAuthFailure?.(); };
    browser.gm_authFailure = authFailure;
    let clickListener: google.maps.MapsEventListener | undefined;
    Promise.all([importLibrary('maps'), importLibrary('geocoding')]).then(([{ Map }, { Geocoder }]) => {
      if (!mounted || authFailed || !canvas.current) return;
      const initial = coordinates(latest.current.value);
      map.current = new Map(canvas.current, {
        center: initial ?? damascus,
        zoom: initial ? 15 : 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: 'cooperative',
      });
      geocoder.current = new Geocoder();
      if (initial) placePin(initial);
      else if (!latest.current.onSelect && latest.current.value.trim()) void searchAddress(latest.current.value, false);
      if (latest.current.onSelect) {
        clickListener = map.current.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          const point = event.latLng.toJSON();
          lastResolvedAddress.current = '';
          placePin(point);
          setSearchError(false);
          latest.current.onSelect?.(`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`);
        });
      }
      setStatus('ready');
    }).catch(() => { if (mounted) setStatus('error'); });
    return () => {
      mounted = false;
      if (browser.gm_authFailure === authFailure) browser.gm_authFailure = previousAuthFailure;
      clickListener?.remove();
      pin.current?.setMap(null);
      pin.current = null;
      map.current = null;
      geocoder.current = null;
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    const point = coordinates(value);
    if (point) {
      placePin(point);
      setSearchError(false);
    } else if (value.trim() !== lastResolvedAddress.current) {
      pin.current?.setMap(null);
      pin.current = null;
    }
  }, [value, status]);

  const googleUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.trim() || 'Damascus, Syria')}`;
  const feedback = status === 'missing' ? copy.mapNotConfigured : status === 'error' ? copy.mapLoadError : copy.mapLoading;

  return <div className="google-location-map" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <div className="map-surface" data-testid="google-map-surface">
      <div ref={canvas} className="map-canvas" aria-label={copy.mapAriaLabel} data-testid="google-map-canvas" />
      {status !== 'ready' && <div className="map-fallback" role="status">
        <span className="map-fallback-icon"><MapPin size={24} aria-hidden="true" /></span>
        <strong>Google Maps</strong>
        <span>{feedback}</span>
      </div>}
    </div>
    <div className="map-tools">
      {status === 'ready' && <span className="map-context"><MapPin size={15} aria-hidden="true" />{onSelect ? copy.mapTapToSelect : copy.mapPreviewOnly}</span>}
      <a className="map-external" href={googleUrl} target="_blank" rel="noopener noreferrer" data-testid="link-open-google-maps">{copy.mapOpenGoogle}<ExternalLink size={14} aria-hidden="true" /></a>
    </div>
    {onSelect && <button type="button" className="button button-ghost map-search" onClick={() => void searchAddress(value, true)} disabled={!value.trim() || status !== 'ready' || searching} data-testid="button-search-google-map">
      <Search size={16} aria-hidden="true" />{searching ? copy.mapSearching : copy.mapSearch}
    </button>}
    {searchError && <p className="field-error" role="alert" data-testid="status-google-map-search-error">{copy.mapAddressNotFound}</p>}
  </div>;
}