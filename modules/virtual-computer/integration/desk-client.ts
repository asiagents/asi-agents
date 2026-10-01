import { DESK_CONTROL_URL, DESK_DESKS_PATH } from "./config.js";

export async function listDesks(): Promise<unknown> {
  const res = await fetch(`${DESK_CONTROL_URL}${DESK_DESKS_PATH}`);
  if (!res.ok) throw new Error(`desk ${res.status}`);
  return res.json();
}
