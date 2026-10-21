// Shared access token gate for the hosted API.
//
// When TOLESH_ACCESS_TOKEN is set, every /api/* route except /api/health needs
// `Authorization: Bearer <token>`. When it is unset (local development), the
// gate is a no-op so the local flow is unchanged. The token is compared in
// constant time. It is never logged or echoed back.
import { timingSafeEqual } from 'node:crypto';

export function accessGate(token) {
  const expected = token ? Buffer.from(token, 'utf8') : null;
  return (req, res, next) => {
    if (!expected) return next();
    if (req.method === 'OPTIONS' || req.path === '/api/health') return next();
    const match = /^Bearer (.+)$/.exec(req.get('authorization') ?? '');
    if (match) {
      const given = Buffer.from(match[1], 'utf8');
      if (given.length === expected.length && timingSafeEqual(given, expected)) return next();
    }
    res.status(401).json({ error: { kind: 'unauthorized', message: 'Access token required.' } });
  };
}

// ALLOWED_ORIGINS is a comma-separated list of exact browser origins, e.g.
// "https://tolesh-ai.vercel.app". Localhost is always allowed for development.
export function parseAllowedOrigins(value) {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter((s) => /^https:\/\/[^\s/]+$/.test(s) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(s));
}

export function originAllowed(origin, extra) {
  if (!origin) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return extra.includes(origin);
}
