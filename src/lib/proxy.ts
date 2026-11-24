import { isIP } from "node:net";

// Opt in only behind a proxy that replaces this header with one client IP and
// blocks direct access to the application port. Forwarded hosts are never trusted.
export function proxyIpHeaders(env: Record<string, string | undefined> = process.env): string[] {
  const header = env.TRUSTED_PROXY_IP_HEADER?.trim().toLowerCase();
  return header && /^[a-z0-9-]+$/.test(header) ? [header] : [];
}

export function clientIp(headers: Headers): string {
  const [header] = proxyIpHeaders();
  const ip = header ? headers.get(header)?.trim() : undefined;
  if (!ip || !isIP(ip)) return "unbekannt";
  return isIP(ip) === 6 ? ipv6Netz(ip) : ip;
}

/**
 * One IPv6 host usually controls a whole /64, so the /64 counts as one client, as in
 * Better Auth. Otherwise a single host could rotate addresses past per-IP limits and fill
 * the limiter. IPv4-mapped addresses count as their IPv4 address.
 */
function ipv6Netz(ip: string): string {
  // The URL parser canonicalizes: lowercase, no leading zeros, embedded IPv4 as hex groups.
  const kanonisch = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  let gruppen = kanonisch.split(":");
  if (kanonisch.includes("::")) {
    const [links, rechts] = kanonisch.split("::").map((teil) => (teil ? teil.split(":") : []));
    gruppen = [...links, ...Array<string>(8 - links.length - rechts.length).fill("0"), ...rechts];
  }
  const zahlen = gruppen.map((gruppe) => Number.parseInt(gruppe, 16));
  if (zahlen.slice(0, 5).every((zahl) => zahl === 0) && zahlen[5] === 0xffff) {
    return [zahlen[6] >> 8, zahlen[6] & 255, zahlen[7] >> 8, zahlen[7] & 255].join(".");
  }
  return `${zahlen.slice(0, 4).map((zahl) => zahl.toString(16)).join(":")}::/64`;
}
