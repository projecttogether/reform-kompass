import { count, countDistinct, desc, eq, gte, ilike, isNotNull, max, or } from "drizzle-orm";
import type { Datenbank } from "./db";
import { bewertung, mitglied, session, user } from "./db/schema";
import { leseBestehendenBewertungStand, type BewertungStand } from "./bewertung";
import { leseUebersicht, uebersichtSpalten } from "./bewertungen";
import { endgueltigAm } from "./konten";

export const KONTEN_PRO_SEITE = 50;

export interface AdminKontoZeile {
  id: string;
  email: string;
  erstelltAm: Date;
  kommune: string;
  bewertungen: number;
  letzteAktivitaet: Date | null;
  loeschungBeantragtAm: Date | null;
}

function lies(stand: unknown): BewertungStand | null {
  try { return leseBestehendenBewertungStand(stand); } catch { return null; }
}

/** Read models for the admin area. Access checks happen in the routes and pages. */
export function erstelleAdmin(options: { db: Datenbank; jetzt?: () => Date }) {
  const { db } = options;
  const jetzt = options.jetzt ?? (() => new Date());

  return {
    async kennzahlen() {
      const vor7Tagen = new Date(jetzt().getTime() - 7 * 24 * 60 * 60 * 1000);
      const [[konten], [geloescht], [bewertungen], [aktiv]] = await Promise.all([
        db.select({ n: count() }).from(user),
        db.select({ n: count() }).from(mitglied).where(isNotNull(mitglied.loeschungBeantragtAm)),
        db.select({ n: count() }).from(bewertung),
        db.select({ n: countDistinct(session.userId) }).from(session).where(gte(session.updatedAt, vor7Tagen)),
      ]);
      return { konten: konten.n, zurLoeschungVorgemerkt: geloescht.n, bewertungen: bewertungen.n, aktivLetzte7Tage: aktiv.n };
    },

    async konten(filter: { suche?: string; seite?: number } = {}): Promise<{ zeilen: AdminKontoZeile[]; gesamt: number }> {
      const suche = filter.suche?.trim();
      const muster = suche ? `%${suche.replace(/[\\%_]/g, (z) => `\\${z}`)}%` : null;
      const bedingung = muster ? or(ilike(user.email, muster), ilike(mitglied.kommune, muster)) : undefined;
      const seite = Math.max(1, Math.floor(filter.seite ?? 1));
      const anzahlBewertungen = db.select({ userId: bewertung.userId, n: count().as("n") }).from(bewertung).groupBy(bewertung.userId).as("anzahl_bewertungen");
      const aktivitaet = db.select({ userId: session.userId, letzte: max(session.updatedAt).as("letzte") }).from(session).groupBy(session.userId).as("aktivitaet");
      const [zeilen, [{ gesamt }]] = await Promise.all([
        db.select({
          id: user.id,
          email: user.email,
          erstelltAm: user.createdAt,
          kommune: mitglied.kommune,
          bewertungen: anzahlBewertungen.n,
          letzteAktivitaet: aktivitaet.letzte,
          loeschungBeantragtAm: mitglied.loeschungBeantragtAm,
        }).from(user)
          .leftJoin(mitglied, eq(mitglied.userId, user.id))
          .leftJoin(anzahlBewertungen, eq(anzahlBewertungen.userId, user.id))
          .leftJoin(aktivitaet, eq(aktivitaet.userId, user.id))
          .where(bedingung)
          .orderBy(desc(user.createdAt))
          .limit(KONTEN_PRO_SEITE)
          .offset((seite - 1) * KONTEN_PRO_SEITE),
        db.select({ gesamt: count() }).from(user).leftJoin(mitglied, eq(mitglied.userId, user.id)).where(bedingung),
      ]);
      return {
        zeilen: zeilen.map((z) => ({
          ...z,
          kommune: z.kommune ?? "",
          bewertungen: Number(z.bewertungen ?? 0),
          letzteAktivitaet: z.letzteAktivitaet ? new Date(z.letzteAktivitaet) : null,
        })),
        gesamt,
      };
    },

    async konto(userId: string) {
      const [z] = await db.select({ user, mitglied }).from(user).leftJoin(mitglied, eq(mitglied.userId, user.id)).where(eq(user.id, userId)).limit(1);
      if (!z) return null;
      const [[sitzungen], zeilen] = await Promise.all([
        db.select({ n: count(), letzte: max(session.updatedAt) }).from(session).where(eq(session.userId, userId)),
        // Overviews only: whole states would load every conversation of the account into memory.
        db.select({ id: bewertung.id, erstelltAm: bewertung.erstelltAm, aktualisiertAm: bewertung.aktualisiertAm, ...uebersichtSpalten })
          .from(bewertung).where(eq(bewertung.userId, userId)).orderBy(desc(bewertung.aktualisiertAm)),
      ]);
      const beantragt = z.mitglied?.loeschungBeantragtAm ?? null;
      return {
        id: z.user.id,
        email: z.user.email,
        erstelltAm: z.user.createdAt,
        profil: { kommune: z.mitglied?.kommune ?? "", funktion: z.mitglied?.funktion ?? "", fachbereich: z.mitglied?.fachbereich ?? "" },
        loeschungBeantragtAm: beantragt,
        endgueltigAm: beantragt ? endgueltigAm(beantragt) : null,
        aktiveSitzungen: sitzungen.n,
        letzteAktivitaet: sitzungen.letzte ? new Date(sitzungen.letzte) : null,
        bewertungen: zeilen.map((b) => ({ id: b.id, erstelltAm: b.erstelltAm, aktualisiertAm: b.aktualisiertAm, uebersicht: leseUebersicht(b) })),
      };
    },

    async bewertung(id: string) {
      const [z] = await db.select({ bewertung, email: user.email }).from(bewertung).innerJoin(user, eq(user.id, bewertung.userId)).where(eq(bewertung.id, id)).limit(1);
      if (!z) return null;
      return { id: z.bewertung.id, userId: z.bewertung.userId, email: z.email, erstelltAm: z.bewertung.erstelltAm, aktualisiertAm: z.bewertung.aktualisiertAm, stand: lies(z.bewertung.stand) };
    },

    async loescheBewertung(id: string): Promise<string | null> {
      const [z] = await db.delete(bewertung).where(eq(bewertung.id, id)).returning({ userId: bewertung.userId });
      return z?.userId ?? null;
    },
  };
}

export type Admin = ReturnType<typeof erstelleAdmin>;
