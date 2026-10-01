import type { Theme } from '../types/settings';

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * amount)) as RGB;
}

export function rgbVar(rgb: RGB): string {
  return rgb.join(' ');
}

export function accentVars(hex: string, theme: Theme): Record<string, string> {
  const base = hexToRgb(hex);
  const black: RGB = [0, 0, 0];
  const white: RGB = [255, 255, 255];
  return {
    '--accent': rgbVar(base),
    '--accent-2': rgbVar(mix(base, black, 0.1)),
    '--accent-strong': rgbVar(mix(base, black, 0.22)),
    '--accent-ink': rgbVar(theme === 'dark' ? mix(base, white, 0.45) : mix(base, black, 0.3))
  };
}