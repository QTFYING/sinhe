import { Request, Response, CookieOptions } from 'express';

export const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds
export const ACCESS_TOKEN_TTL = 2 * 60 * 60; // 2 hours in seconds

const DEV_REFRESH_COOKIE_NAME = 'refreshToken';
const PROD_REFRESH_COOKIE_NAME = '__Host-refreshToken';

function shouldUseSecureCookies(req: Request): boolean {
  const secureOverride = process.env.AUTH_COOKIE_SECURE;
  if (secureOverride === 'true') {
    return true;
  }
  if (secureOverride === 'false') {
    return false;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  if (typeof proto === 'string') {
    return proto.split(',')[0]?.trim() === 'https';
  }

  return req.secure || process.env.NODE_ENV === 'production';
}

export function getRefreshTokenCookieName(req: Request): string {
  return shouldUseSecureCookies(req) ? PROD_REFRESH_COOKIE_NAME : DEV_REFRESH_COOKIE_NAME;
}

export function getRefreshTokenCookieOptions(req: Request): CookieOptions {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookies(req),
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL * 1000,
  };
}

function getRefreshTokenClearCookieOptions(req: Request): CookieOptions {
  void req;
  return {
    path: '/',
  };
}

export function setRefreshTokenCookie(res: Response, req: Request, refreshToken: string): void {
  res.cookie(getRefreshTokenCookieName(req), refreshToken, getRefreshTokenCookieOptions(req));
}

export function clearRefreshTokenCookie(res: Response, req: Request): void {
  res.clearCookie(getRefreshTokenCookieName(req), getRefreshTokenClearCookieOptions(req));
}

export function getRefreshTokenFromCookie(req: Request): string | null {
  const rawCookie = req.headers.cookie;
  if (!rawCookie) {
    return null;
  }

  const cookieName = getRefreshTokenCookieName(req);
  const cookies = rawCookie.split(';');

  for (const cookie of cookies) {
    const [rawKey, ...rawValueParts] = cookie.split('=');
    if (!rawKey || rawValueParts.length === 0) {
      continue;
    }

    if (rawKey.trim() !== cookieName) {
      continue;
    }

    return decodeURIComponent(rawValueParts.join('=').trim());
  }

  return null;
}

export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
