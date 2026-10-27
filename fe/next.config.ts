import path from 'node:path';
import type { NextConfig } from 'next';

const origin = (url: string | undefined, fallback: string) => {
  try {
    return new URL(url ?? fallback).origin;
  } catch {
    return new URL(fallback).origin;
  }
};

const isDev = process.env.NODE_ENV !== 'production';
const api = origin(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4000');
const media = origin(process.env.MEDIA_ORIGIN, 'http://localhost:9000');
const widgets = origin(process.env.WIDGETS_BASE_URL, 'http://localhost:9000');

/**
 * Next's inline bootstrap scripts need 'unsafe-inline' (no nonce setup), so script safety rests on the Markdown
 * sanitizer plus the sandboxed widget iframes rather than on script-src. Everything else is locked to known origins.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: https: ${media}`,
  "font-src 'self' data:",
  `connect-src 'self' ${api}${isDev ? ' ws:' : ''}`,
  `frame-src ${widgets}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

const nextConfig: NextConfig = {
  // Monorepo root, so Next doesn't pick up an unrelated lockfile higher up the directory tree.
  outputFileTracingRoot: path.join(__dirname, '..'),
  poweredByHeader: false,
  // Self-contained server bundle for the Docker image.
  output: 'standalone',
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  // Keep the reference site's feed URL working for existing subscribers.
  async rewrites() {
    return [{ source: '/index.xml', destination: '/rss.xml' }];
  },
};

export default nextConfig;
