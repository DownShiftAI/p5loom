// The response headers the site is served with. One place: the local server (scripts/serve-docs.mjs), the browser
// test, and deploy/nginx.conf all use this. A test fails if nginx.conf drifts from it.

export const P5_ORIGIN = "https://cdnjs.cloudflare.com";

export const CSP = [
  "default-src 'none'",
  `script-src 'self' ${P5_ORIGIN}`,
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "frame-src 'self'",
  "form-action 'none'",
].join("; ");

export const HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "accelerometer=(self), gyroscope=(self), camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000",
};
