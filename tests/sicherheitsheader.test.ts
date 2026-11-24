import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config.js";

test("every response carries security headers and no X-Powered-By", async () => {
  assert.equal(nextConfig.poweredByHeader, false);
  const regeln = await nextConfig.headers!();
  const alle = regeln.find((regel) => regel.source === "/:path*");
  assert.ok(alle, "one rule covers every path");
  const header = new Map(alle.headers.map(({ key, value }) => [key.toLowerCase(), value]));
  assert.equal(header.get("x-content-type-options"), "nosniff");
  assert.equal(header.get("x-frame-options"), "DENY");
  assert.ok(header.get("referrer-policy"));
  const csp = new Map(header.get("content-security-policy")!.split(";").map((teil) => {
    const [name, ...werte] = teil.trim().split(/\s+/);
    return [name, werte.join(" ")] as const;
  }));
  assert.equal(csp.get("frame-ancestors"), "'none'");
  assert.equal(csp.get("object-src"), "'none'");
  assert.equal(csp.get("base-uri"), "'self'");
  assert.equal(csp.get("form-action"), "'self'");
  assert.equal(csp.get("img-src"), "'self' data: blob:", "AI Markdown cannot load images from other hosts");
});
