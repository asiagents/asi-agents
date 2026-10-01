import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";

const execFileAsync = promisify(execFile);

export interface NetworkProbe {
  online: boolean;
  connType: string | null;
  productName: string | null;
  linkSpeedMbps: number | null;
  localIp: string | null;
  ipv6: string | null;
  gateway: string | null;
  dns: string[];
  publicIp: string | null;
  isp: string | null;
  org: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  checkedAt: string;
  sources: { os: boolean; publicLookup: boolean };
  notes: string[];
}

function emptyProbe(notes: string[] = []): NetworkProbe {
  return {
    online: false,
    connType: null,
    productName: null,
    linkSpeedMbps: null,
    localIp: null,
    ipv6: null,
    gateway: null,
    dns: [],
    publicIp: null,
    isp: null,
    org: null,
    city: null,
    region: null,
    country: null,
    checkedAt: new Date().toISOString(),
    sources: { os: false, publicLookup: false },
    notes,
  };
}

async function psJson(script: string): Promise<unknown | null> {
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { timeout: 12000, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }
    );
    const text = stdout.trim();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function firstIpv4FromOs(): string | null {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ent of ifaces[name] ?? []) {
      if (ent && ent.family === "IPv4" && !ent.internal) return ent.address;
    }
  }
  return null;
}

async function readOsNetwork(out: NetworkProbe): Promise<void> {
  // Newlines (not "; ") so if/elseif stays valid PowerShell. Prefer ReceiveLinkSpeed
  // (raw bps) — LinkSpeed string parse used to break when Gbps branch missed and
  // semicolon-joined `elseif` became a bare command, leaving LinkSpeedMbps null.
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$adapter = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.HardwareInterface -eq $true } | Sort-Object -Property ReceiveLinkSpeed -Descending | Select-Object -First 1
if (-not $adapter) { $adapter = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1 }
if ($adapter) {
  $cfg = Get-NetIPConfiguration -InterfaceIndex $adapter.ifIndex
  $ip = ($cfg.IPv4Address | Select-Object -First 1).IPAddress
  $v6 = ($cfg.IPv6Address | Where-Object { $_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike 'fe80*' } | Select-Object -First 1).IPAddress
  $gw = ($cfg.IPv4DefaultGateway | Select-Object -First 1).NextHop
  $dns = @($cfg.DNSServer | ForEach-Object { $_.ServerAddresses } | ForEach-Object { $_ } | Where-Object { $_ })
  $speed = $null
  $bps = 0
  try { $bps = [int64]$adapter.ReceiveLinkSpeed } catch {}
  if ($bps -le 0) { try { $bps = [int64]$adapter.TransmitLinkSpeed } catch {} }
  if ($bps -gt 0) { $speed = [int][Math]::Round($bps / 1e6) }
  elseif ([string]$adapter.LinkSpeed -match '([0-9.]+)\\s*Gbps') { $speed = [int]([double]$Matches[1] * 1000) }
  elseif ([string]$adapter.LinkSpeed -match '([0-9.]+)\\s*Mbps') { $speed = [int][Math]::Round([double]$Matches[1]) }
  [pscustomobject]@{ Name = $adapter.Name; InterfaceDescription = $adapter.InterfaceDescription; MediaType = [string]$adapter.MediaType; LinkSpeed = [string]$adapter.LinkSpeed; LinkSpeedMbps = $speed; LocalIp = $ip; IPv6 = $v6; Gateway = $gw; Dns = @($dns) } | ConvertTo-Json -Compress
}
`.trim();

  const raw = await psJson(script);
  if (!raw || typeof raw !== "object") {
    out.localIp = firstIpv4FromOs();
    out.notes.push("PowerShell net adapter probe unavailable; used Node os.networkInterfaces for local IP only.");
    return;
  }
  out.sources.os = true;
  const o = raw as Record<string, unknown>;
  const media = String(o.MediaType ?? "").toLowerCase();
  const name = String(o.Name ?? "").toLowerCase();
  const desc = String(o.InterfaceDescription ?? "");
  if (media.includes("802.11") || name.includes("wi-fi") || name.includes("wifi") || desc.toLowerCase().includes("wireless")) {
    out.connType = "wifi";
  } else if (media.includes("802.3") || name.includes("ethernet") || desc.toLowerCase().includes("ethernet")) {
    out.connType = "ethernet";
  } else if (media || name) {
    out.connType = media || name;
  }
  out.productName = desc || String(o.Name ?? "") || null;
  out.linkSpeedMbps = typeof o.LinkSpeedMbps === "number" ? o.LinkSpeedMbps : null;
  out.localIp = (o.LocalIp as string) || firstIpv4FromOs();
  out.ipv6 = (o.IPv6 as string) || null;
  out.gateway = (o.Gateway as string) || null;
  out.dns = Array.isArray(o.Dns) ? o.Dns.map(String).filter(Boolean) : [];
}

async function readPublic(out: NetworkProbe): Promise<void> {
  try {
    const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
    if (ipRes.ok) {
      const data = (await ipRes.json()) as { ip?: string };
      if (data.ip) {
        out.publicIp = data.ip;
        out.sources.publicLookup = true;
        out.online = true;
      }
    }
  } catch {
    out.notes.push("Public IP lookup (ipify) failed.");
  }

  if (!out.publicIp) return;

  try {
    const geoRes = await fetch(`https://ipapi.co/${out.publicIp}/json/`, {
      signal: AbortSignal.timeout(6000),
      headers: { accept: "application/json" },
    });
    if (geoRes.ok) {
      const geo = (await geoRes.json()) as Record<string, unknown>;
      if (!geo.error) {
        out.isp = geo.org ? String(geo.org) : null;
        out.org = geo.org ? String(geo.org) : null;
        out.city = geo.city ? String(geo.city) : null;
        out.region = geo.region ? String(geo.region) : null;
        out.country = geo.country_name ? String(geo.country_name) : geo.country ? String(geo.country) : null;
      } else {
        out.notes.push(String(geo.reason ?? geo.error));
      }
    } else {
      out.notes.push(`ipapi.co HTTP ${geoRes.status}; trying ipwho.is`);
    }
  } catch {
    out.notes.push("ISP/geo lookup (ipapi.co) failed.");
  }

  if (out.isp) return;

  try {
    const who = await fetch(`https://ipwho.is/${out.publicIp}`, {
      signal: AbortSignal.timeout(6000),
      headers: { accept: "application/json" },
    });
    if (!who.ok) {
      out.notes.push(`ipwho.is HTTP ${who.status}.`);
      return;
    }
    const geo = (await who.json()) as Record<string, unknown>;
    if (geo.success === false) {
      out.notes.push(String(geo.message ?? "ipwho.is failed"));
      return;
    }
    const conn = geo.connection as Record<string, unknown> | undefined;
    out.isp = conn?.isp ? String(conn.isp) : geo.org ? String(geo.org) : null;
    out.org = conn?.org ? String(conn.org) : out.isp;
    out.city = geo.city ? String(geo.city) : out.city;
    out.region = geo.region ? String(geo.region) : out.region;
    out.country = geo.country ? String(geo.country) : out.country;
  } catch {
    out.notes.push("ISP/geo lookup (ipwho.is) failed.");
  }
}

/** Real OS + optional public IP/ISP. Null = truly unavailable; never invent values. */
export async function probeNetwork(): Promise<NetworkProbe> {
  const out = emptyProbe();
  out.online = true;
  await readOsNetwork(out);
  await readPublic(out);
  if (!out.publicIp && !out.localIp) {
    out.online = false;
    out.notes.push("No local or public IP could be read.");
  } else if (!out.publicIp) {
    out.online = true;
    out.notes.push("Public IP unavailable; showing local adapter details only.");
  }
  out.checkedAt = new Date().toISOString();
  return out;
}

