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

// Strict login brute-force limiter (max 5 failed attempts per 15 minutes per IP)
const failedLoginMap = new Map();

export function isLoginRateLimited(ip) {
  const now = Date.now();
  const lockoutWindowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;
  const attempts = (failedLoginMap.get(ip) || []).filter(t => now - t < lockoutWindowMs);
  return attempts.length >= maxAttempts;
}

export function recordFailedLogin(ip) {
  const now = Date.now();
  const lockoutWindowMs = 15 * 60 * 1000;
  const attempts = (failedLoginMap.get(ip) || []).filter(t => now - t < lockoutWindowMs);
  attempts.push(now);
  failedLoginMap.set(ip, attempts);
  return attempts.length;
}

export function clearFailedLogins(ip) {
  failedLoginMap.delete(ip);
}

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'ET_SALT_99').digest('hex');
}
