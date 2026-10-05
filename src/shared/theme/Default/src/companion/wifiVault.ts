/**
 * Local-only home Wi‑Fi vault for the Companion desk hub.
 *
 * Secrets pattern: AES-GCM ciphertext in localStorage; plaintext never logged.
 * Fail-closed: empty until the user enters SSID + password. Never invents or
 * reads OS / system Wi‑Fi credentials.
 */
import { readStorage, writeStorage, STORAGE_KEYS } from '../utils/storage';

export type WifiVaultPublic = {
  ssid: string;
  /** Last 4 chars of password when set (Secrets-style mask). */
  last4: string;
  configured: boolean;
};

type StoredVault = {
  v: 1;
  ssid: string;
  last4: string;
  cipher: string;
  iv: string;
};

function b64Encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getOrCreateKey(): Promise<CryptoKey> {
  let raw = readStorage(STORAGE_KEYS.companionWifiVaultKey);
  if (!raw) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    raw = b64Encode(bytes);
    writeStorage(STORAGE_KEYS.companionWifiVaultKey, raw);
  }
  const bytes = b64Decode(raw);
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function readStored(): StoredVault | null {
  const raw = readStorage(STORAGE_KEYS.companionWifiVault);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredVault;
    if (parsed?.v !== 1 || typeof parsed.ssid !== 'string' || !parsed.cipher || !parsed.iv) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Public status — never includes password. */
export function readWifiVaultPublic(): WifiVaultPublic {
  const stored = readStored();
  if (!stored) {
    return { ssid: '', last4: '', configured: false };
  }
  return {
    ssid: stored.ssid,
    last4: stored.last4 || '',
    configured: Boolean(stored.ssid && stored.cipher),
  };
}

/**
 * Save user-entered home Wi‑Fi. Empty password clears the vault.
 * Does not read the OS network list.
 */
export async function saveWifiVault(ssid: string, password: string): Promise<WifiVaultPublic> {
  const name = ssid.trim();
  const pass = password;
  if (!name || !pass) {
    clearWifiVault();
    return readWifiVaultPublic();
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure storage unavailable in this browser');
  }
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(pass);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const last4 = pass.length <= 4 ? pass.replace(/./g, '•') : pass.slice(-4);
  const stored: StoredVault = {
    v: 1,
    ssid: name,
    last4,
    cipher: b64Encode(new Uint8Array(cipherBuf)),
    iv: b64Encode(iv),
  };
  writeStorage(STORAGE_KEYS.companionWifiVault, JSON.stringify(stored));
  return readWifiVaultPublic();
}

/** Decrypt password for show / copy. Returns null if unset or corrupt (fail-closed). */
export async function unlockWifiPassword(): Promise<string | null> {
  const stored = readStored();
  if (!stored?.cipher || !stored.iv) return null;
  if (!globalThis.crypto?.subtle) return null;
  try {
    const key = await getOrCreateKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64Decode(stored.iv) },
      key,
      b64Decode(stored.cipher)
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export function clearWifiVault(): void {
  writeStorage(STORAGE_KEYS.companionWifiVault, '');
}
