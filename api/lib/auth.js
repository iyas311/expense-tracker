import crypto from 'crypto';

// In-memory rate limiter (max 60 requests/minute per IP)
const rateLimitMap = new Map();

export function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 60;
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= max) return true;
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'ET_SALT_99').digest('hex');
}
