// Sent with every response. A strict script-src needs per-request nonces and dynamic
// rendering, so it is not set yet. These directives already block framing (clickjacking),
// plugin content, foreign form targets and <base> changes, and keep images on this site,
// so Markdown in AI replies cannot load images from other hosts.
const sicherheitsHeader = [
  { key: "Content-Security-Policy", value: "img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: sicherheitsHeader }];
  },
};

module.exports = nextConfig;
