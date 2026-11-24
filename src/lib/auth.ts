import { proxyIpHeaders } from "./proxy";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins/email-otp";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { Datenbank } from "./db";
import { user, session, account, verification } from "./db/schema";
import { anmeldecodeMail, type MailVersand } from "./mail";
import { erstelleLimiter } from "./limiter";

export const SITZUNG_TAGE = 30;
export const CODE_MINUTEN = 10;

// Colleagues in one town hall often share an IP address, so per-IP limits stay generous.
// Each email address additionally receives at most CODES_PRO_ADRESSE codes per window
// and CODES_PRO_TAG per day. Each code allows 5 attempts, so the daily cap bounds
// guessing at 100 attempts per address and day against a million possible codes.
const CODES_PRO_ADRESSE = { max: 5, fensterMs: 10 * 60_000 };
const CODES_PRO_TAG = { max: 20, fensterMs: 24 * 60 * 60_000 };

export function erstelleAuth(options: { db: Datenbank; secret: string; baseURL: string; mail: MailVersand; rateLimit?: boolean; jetzt?: () => Date }) {
  const uhr = () => (options.jetzt ? options.jetzt().getTime() : Date.now());
  const proAdresse = erstelleLimiter(uhr);
  // A full limiter refuses new addresses, so the day-long counter gets more room.
  const proTag = erstelleLimiter(uhr, 100_000);
  return betterAuth({
    appName: "Reform-Kompass",
    baseURL: options.baseURL,
    basePath: "/api/auth",
    secret: options.secret,
    trustedOrigins: [options.baseURL],
    database: drizzleAdapter(options.db, { provider: "pg", schema: { user, session, account, verification } }),
    emailAndPassword: { enabled: false },
    // Rolling 30-day sessions: each visit after a day extends the expiry.
    session: { expiresIn: 60 * 60 * 24 * SITZUNG_TAGE, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: options.rateLimit ?? true,
      window: 60,
      max: 100,
      customRules: {
        "/email-otp/send-verification-otp": { window: 10 * 60, max: 30 },
        "/sign-in/email-otp": { window: 10 * 60, max: 60 },
      },
    },
    advanced: { ipAddress: { ipAddressHeaders: proxyIpHeaders() } },
    hooks: {
      // Runs before Better Auth stores a new code, so a refused request never
      // replaces the code a person already received.
      before: createAuthMiddleware(async (ctx) => {
        // Only sign-in codes are emailed and can sign anyone in. Other code types must not
        // use up an address's quota, or anyone could silently lock that address out.
        if (ctx.path !== "/email-otp/send-verification-otp" || ctx.body?.type !== "sign-in") return;
        const email = typeof ctx.body?.email === "string" ? ctx.body.email.trim().toLowerCase() : "";
        if (!email) return;
        if (proAdresse.zaehle(email, CODES_PRO_ADRESSE) !== null) {
          throw new APIError("TOO_MANY_REQUESTS", { message: "Zu viele Codes für diese Adresse. Bitte warten Sie einige Minuten.", code: "CODES_PRO_ADRESSE" });
        }
        if (proTag.zaehle(email, CODES_PRO_TAG) !== null) {
          throw new APIError("TOO_MANY_REQUESTS", { message: "Für diese Adresse wurden heute zu viele Codes angefordert. Bitte versuchen Sie es morgen erneut.", code: "CODES_PRO_TAG" });
        }
      }),
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: CODE_MINUTEN * 60,
        allowedAttempts: 5,
        storeOTP: "hashed",
        // Better Auth logs errors thrown here and still answers with success, so the form
        // cannot report delivery failures; users can request a new code.
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "sign-in") return;
          await options.mail.sende({ an: email, ...anmeldecodeMail(otp, options.baseURL) });
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof erstelleAuth>;
