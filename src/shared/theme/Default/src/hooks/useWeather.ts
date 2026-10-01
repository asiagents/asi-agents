import { useEffect, useState } from 'react';

export interface WeatherState {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'denied';
  place?: string;
  temp?: number;
  code?: number;
}

const labels: [number[], string][] = [
  [[0], 'Clear'],
  [[1, 2], 'Partly cloudy'],
  [[3], 'Overcast'],
  [[45, 48], 'Fog'],
  [[51, 53, 55, 56, 57], 'Drizzle'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain'],
  [[71, 73, 75, 77, 85, 86], 'Snow'],
  [[95, 96, 99], 'Thunderstorm'],
];

export function weatherLabel(code?: number): string {
  if (code === undefined) return '';
  return labels.find(([codes]) => codes.includes(code))?.[1] ?? 'Mixed';
}

async function forecastAt(lat: number, lon: number, unit: 'C' | 'F') {
  const wx = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=${unit === 'F' ? 'fahrenheit' : 'celsius'}`,
  ).then((r) => r.json());
  return {
    temp: Math.round(wx.current.temperature_2m),
    code: wx.current.weather_code as number,
  };
}

/** Named places Open-Meteo search misses — pin to real coords, keep display label. */
const PLACE_OVERRIDES: Record<string, { lat: number; lon: number; place: string }> = {
  'silicon valley': { lat: 37.37, lon: -122.04, place: 'Silicon Valley' },
};

/** Reverse-geocode only for a real place name — never invent a city. */
async function placeName(lat: number, lon: number): Promise<string | undefined> {
  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`,
    ).then((r) => r.json());
    const name = geo?.name || geo?.city || geo?.locality;
    return typeof name === 'string' && name.trim() ? name.trim() : undefined;
  } catch {
    return undefined;
  }
}

function readGeo(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('unsupported'), { code: 2 }));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 300_000,
    });
  });
}

/**
 * Live weather from Open-Meteo. Auto-detects via browser geolocation when `location` is empty.
 * Fail-closed: idle / denied / error — never a fake city.
 */
export function useWeather(location: string, unit: 'C' | 'F'): WeatherState {
  const [state, setState] = useState<WeatherState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    const place = location.trim();

    (async () => {
      setState({ status: 'loading' });
      try {
        if (place) {
          const override = PLACE_OVERRIDES[place.toLowerCase()];
          if (override) {
            const cur = await forecastAt(override.lat, override.lon, unit);
            if (!cancelled) setState({ status: 'ready', place: override.place, ...cur });
            return;
          }
          const coord = place.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
          if (coord) {
            const lat = Number(coord[1]);
            const lon = Number(coord[2]);
            const cur = await forecastAt(lat, lon, unit);
            const name = await placeName(lat, lon);
            if (!cancelled) setState({ status: 'ready', place: name, ...cur });
            return;
          }
          const geo = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1`,
          ).then((r) => r.json());
          const hit = geo?.results?.[0];
          if (!hit) throw new Error('not found');
          const cur = await forecastAt(hit.latitude, hit.longitude, unit);
          if (!cancelled) setState({ status: 'ready', place: hit.name, ...cur });
          return;
        }

        let pos: GeolocationPosition;
        try {
          pos = await readGeo();
        } catch (err) {
          const code = (err as GeolocationPositionError)?.code;
          if (!cancelled) setState({ status: code === 1 ? 'denied' : 'idle' });
          return;
        }
        const { latitude, longitude } = pos.coords;
        const cur = await forecastAt(latitude, longitude, unit);
        const name = await placeName(latitude, longitude);
        if (!cancelled) setState({ status: 'ready', place: name, ...cur });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location, unit]);

  return state;
}
