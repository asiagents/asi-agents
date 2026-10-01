/**
 * Real UI captures only. Add basenames here when files exist under `Default/public/`.
 * Until then, components show structured empty states — never broken placeholder images.
 */
export const SHIPPED_THEME_ASSETS = new Set<string>([
  "assets/fireheads/roster_sheet.jpg",
  "assets/fireheads/meeting_room.jpg",
  "assets/fireheads/desk_working.jpg",
  "38c8914b-4cb9-4602-a890-37c8bc4a3db6.jpg",
  "49af1521-77d1-40aa-b6fa-a459c12e742b.jpg",
  "b104522c-28b3-4dd2-9e09-1631b970a2e0.jpg",
  "e2b650a4-4c63-42fc-b52f-60d2a4fb8025.jpg",
]);

export function themeAssetUrl(basename: string): string | null {
  const name = basename.replace(/^\//, "");
  if (!SHIPPED_THEME_ASSETS.has(name)) return null;
  return `/${name}`;
}
