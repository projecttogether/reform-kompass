import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import type { Datenbank } from "./db";
import { mitglied, session, user, verification } from "./db/schema";
import { loeschcodeMail, type MailVersand } from "./mail";

export const WIEDERHERSTELLUNG_TAGE = 30;
const LOESCHCODE_MINUTEN = 10;
const LOESCHCODE_VERSUCHE = 5;
const TAG_MS = 24 * 60 * 60 * 1000;

export interface Profil {
  kommune: string;
  funktion: string;
  fachbereich: string;
}

export interface KontoStatus {
  loeschungBeantragtAm: Date | null;
  /** When the account and its assessments are removed for good, if deletion was requested. */
  endgueltigAm: Date | null;
}

export type LoeschErgebnis = "geloescht" | "falscher-code" | "kein-code";

const LEERES_PROFIL: Profil = { kommune: "", funktion: "", fachbereich: "" };

export function endgueltigAm(beantragtAm: Date): Date {
  return new Date(beantragtAm.getTime() + WIEDERHERSTELLUNG_TAGE * TAG_MS);
}

/** Profile, account deletion with a 30-day restore window, and final removal. */
export function erstelleKontoVerwaltung(options: { db: Datenbank; mail: MailVersand; secret: string; baseURL: string; jetzt?: () => Date }) {
  const { db } = options;
  const jetzt = options.jetzt ?? (() => new Date());
  const loeschId = (userId: string) => `konto-loeschen:${userId}`;
  const hash = (code: string) => createHmac("sha256", options.secret).update(code).digest("hex");

  /**
   * Deletes the account only if it is still marked for deletion (and, with `grenze`,
   * marked before that time). The row lock makes a concurrent restore either win
   * completely or wait until the account is gone.
   */
  async function loescheWennVorgemerkt(userId: string, grenze?: Date): Promise<boolean> {
    return db.transaction(async (tx) => {
      const bedingung = grenze
        ? and(eq(mitglied.userId, userId), isNotNull(mitglied.loeschungBeantragtAm), lte(mitglied.loeschungBeantragtAm, grenze))
        : and(eq(mitglied.userId, userId), isNotNull(mitglied.loeschungBeantragtAm));
      const [vorgemerkt] = await tx.select({ userId: mitglied.userId }).from(mitglied).where(bedingung).for("update");
      if (!vorgemerkt) return false;
      await tx.delete(user).where(eq(user.id, userId));
      return true;
    });
  }

  async function zeile(userId: string) {
    const [z] = await db.select().from(mitglied).where(eq(mitglied.userId, userId)).limit(1);
    return z;
  }

  async function beantrageLoeschung(userId: string) {
    await db.transaction(async (tx) => {
      const zeitpunkt = jetzt();
      await tx.insert(mitglied).values({ userId, loeschungBeantragtAm: zeitpunkt, aktualisiertAm: zeitpunkt })
        .onConflictDoUpdate({ target: mitglied.userId, set: { loeschungBeantragtAm: zeitpunkt, aktualisiertAm: zeitpunkt } });
      await tx.delete(session).where(eq(session.userId, userId));
      await tx.delete(verification).where(eq(verification.identifier, loeschId(userId)));
    });
  }

  return {
    async profil(userId: string): Promise<Profil> {
      const z = await zeile(userId);
      return z ? { kommune: z.kommune, funktion: z.funktion, fachbereich: z.fachbereich } : { ...LEERES_PROFIL };
    },

    async speichereProfil(userId: string, profil: Profil) {
      const zeitpunkt = jetzt();
      await db.insert(mitglied).values({ userId, ...profil, aktualisiertAm: zeitpunkt })
        .onConflictDoUpdate({ target: mitglied.userId, set: { ...profil, aktualisiertAm: zeitpunkt } });
    },

    async status(userId: string): Promise<KontoStatus> {
      const beantragt = (await zeile(userId))?.loeschungBeantragtAm ?? null;
      return { loeschungBeantragtAm: beantragt, endgueltigAm: beantragt ? endgueltigAm(beantragt) : null };
    },

    /** Sends a fresh six-digit code that confirms account deletion. */
    async fordereLoeschcodeAn(userId: string, email: string) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const zeitpunkt = jetzt();
      await db.transaction(async (tx) => {
        await tx.delete(verification).where(eq(verification.identifier, loeschId(userId)));
        await tx.insert(verification).values({
          id: randomUUID(),
          identifier: loeschId(userId),
          value: JSON.stringify({ hash: hash(code), versuche: 0 }),
          expiresAt: new Date(zeitpunkt.getTime() + LOESCHCODE_MINUTEN * 60_000),
          createdAt: zeitpunkt,
          updatedAt: zeitpunkt,
        });
      });
      await options.mail.sende({ an: email, ...loeschcodeMail(code, options.baseURL) });
    },

    /** Checks the code, then marks the account for deletion and signs out every session. */
    async bestaetigeLoeschung(userId: string, code: string): Promise<LoeschErgebnis> {
      // The row lock serializes parallel attempts, so the attempt limit holds.
      const ergebnis = await db.transaction(async (tx): Promise<LoeschErgebnis | "pruefen"> => {
        const [eintrag] = await tx.select().from(verification).where(eq(verification.identifier, loeschId(userId))).limit(1).for("update");
        if (!eintrag || eintrag.expiresAt <= jetzt()) return "kein-code";
        const wert = JSON.parse(eintrag.value) as { hash: string; versuche: number };
        const erwartet = Buffer.from(wert.hash, "hex");
        const erhalten = Buffer.from(hash(code.trim()), "hex");
        if (timingSafeEqual(erwartet, erhalten)) {
          await tx.delete(verification).where(eq(verification.id, eintrag.id));
          return "pruefen";
        }
        if (wert.versuche + 1 >= LOESCHCODE_VERSUCHE) {
          await tx.delete(verification).where(eq(verification.id, eintrag.id));
          return "kein-code";
        }
        await tx.update(verification).set({ value: JSON.stringify({ ...wert, versuche: wert.versuche + 1 }), updatedAt: jetzt() }).where(eq(verification.id, eintrag.id));
        return "falscher-code";
      });
      if (ergebnis !== "pruefen") return ergebnis;
      await beantrageLoeschung(userId);
      return "geloescht";
    },

    beantrageLoeschung,

    /** Returns false if the account was not marked (for example, already removed). */
    async stelleWiederHer(userId: string): Promise<boolean> {
      const geaendert = await db.update(mitglied).set({ loeschungBeantragtAm: null, aktualisiertAm: jetzt() })
        .where(and(eq(mitglied.userId, userId), isNotNull(mitglied.loeschungBeantragtAm)))
        .returning({ userId: mitglied.userId });
      return geaendert.length > 0;
    },

    async meldeAb(userId: string) {
      await db.delete(session).where(eq(session.userId, userId));
    },

    /**
     * Removes an account marked for deletion right away; sessions, profile, and
     * assessments cascade. Returns false if it is no longer marked.
     */
    loescheEndgueltig: (userId: string) => loescheWennVorgemerkt(userId),

    /** Removes accounts whose restore window has passed. Returns the number removed. */
    async bereinige(): Promise<number> {
      const grenze = new Date(jetzt().getTime() - WIEDERHERSTELLUNG_TAGE * TAG_MS);
      const faellig = await db.select({ userId: mitglied.userId }).from(mitglied)
        .where(and(isNotNull(mitglied.loeschungBeantragtAm), lte(mitglied.loeschungBeantragtAm, grenze)));
      // Each candidate is checked again under a lock: it may have been restored meanwhile.
      let geloescht = 0;
      for (const { userId } of faellig) if (await loescheWennVorgemerkt(userId, grenze)) geloescht++;
      return geloescht;
    },
  };
}

export type KontoVerwaltung = ReturnType<typeof erstelleKontoVerwaltung>;
