import { randomUUID } from "node:crypto";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import type { Datenbank } from "./db";
import { bewertung, user } from "./db/schema";
import { leseBestehendenBewertungStand, uebersichtAusKopf, type BewertungStand, type BewertungUebersicht } from "./bewertung";

export const MAX_BEWERTUNGEN_PRO_KONTO = 200;
/**
 * Database space one account's saved states may take, measured as stored (after
 * compression) plus the uncompressed size of the state being saved. Typical
 * assessments take well under 100 KiB; the limit only stops accounts from filling the disk.
 */
export const MAX_SPEICHER_PRO_KONTO = 20 * 1024 * 1024;

export interface GespeicherteBewertung {
  id: string;
  revision: number;
  erstelltAm: Date;
  aktualisiertAm: Date;
  /** Null when the stored state no longer matches the current questionnaire. */
  stand: BewertungStand | null;
}

export interface BewertungListenEintrag {
  id: string;
  erstelltAm: Date;
  aktualisiertAm: Date;
  uebersicht: BewertungUebersicht | null;
}

/**
 * Results name refusals instead of throwing error classes: each Next.js route bundle
 * has its own copy of this module, so `instanceof` fails for services another bundle created.
 */
export type ErstellErgebnis = { id: string; revision: number } | "zu-viele" | "voll";
/** Result of a save: the new revision, or why it was refused. */
export type SpeicherErgebnis = { revision: number } | "konflikt" | "nicht-gefunden" | "voll";

function lies(stand: unknown): BewertungStand | null {
  try { return leseBestehendenBewertungStand(stand); } catch { return null; }
}

// Array length at a fixed JSON path, 0 when there is no array.
function laenge(pfad: "{nachrichten}" | "{katalog,massnahmen}") {
  const wert = sql`${bewertung.stand} #> ${sql.raw(`'${pfad}'`)}`;
  return sql<number>`case jsonb_typeof(${wert}) when 'array' then jsonb_array_length(${wert}) else 0 end`.mapWith(Number);
}

/**
 * What an overview needs from a stored state. Conversations and catalogues stay in the
 * database: an account may hold hundreds of states of up to 4 MiB each, and loading
 * them all for a list would exhaust the server's memory.
 */
export const uebersichtSpalten = {
  kopf: sql<unknown>`${bewertung.stand} - 'nachrichten' - 'katalog'`.mapWith((wert: unknown): unknown => (typeof wert === "string" ? JSON.parse(wert) : wert)),
  nachrichten: laenge("{nachrichten}"),
  massnahmen: laenge("{katalog,massnahmen}"),
};

export function leseUebersicht(zeile: { kopf: unknown; nachrichten: number; massnahmen: number }): BewertungUebersicht | null {
  return uebersichtAusKopf(zeile.kopf, zeile);
}

const belegterSpeicher = sql<number>`coalesce(sum(pg_column_size(${bewertung.stand})), 0)`.mapWith(Number);
const groesse = (stand: BewertungStand) => Buffer.byteLength(JSON.stringify(stand));

/** Saved assessments. Every query is scoped to the owning user. */
export function erstelleBewertungen(options: { db: Datenbank; jetzt?: () => Date }) {
  const { db } = options;
  const jetzt = options.jetzt ?? (() => new Date());
  const eigene = (userId: string, id: string) => and(eq(bewertung.id, id), eq(bewertung.userId, userId));

  return {
    async liste(userId: string): Promise<BewertungListenEintrag[]> {
      const zeilen = await db.select({ id: bewertung.id, erstelltAm: bewertung.erstelltAm, aktualisiertAm: bewertung.aktualisiertAm, ...uebersichtSpalten })
        .from(bewertung).where(eq(bewertung.userId, userId)).orderBy(desc(bewertung.aktualisiertAm));
      return zeilen.map((z) => ({ id: z.id, erstelltAm: z.erstelltAm, aktualisiertAm: z.aktualisiertAm, uebersicht: leseUebersicht(z) }));
    },

    async lade(userId: string, id: string): Promise<GespeicherteBewertung | null> {
      const [z] = await db.select().from(bewertung).where(eigene(userId, id)).limit(1);
      return z ? { id: z.id, revision: z.revision, erstelltAm: z.erstelltAm, aktualisiertAm: z.aktualisiertAm, stand: lies(z.stand) } : null;
    },

    /** "zu-viele" or "voll" when the account has no room left. */
    async erstelle(userId: string, stand: BewertungStand): Promise<ErstellErgebnis> {
      const bytes = groesse(stand);
      return db.transaction(async (tx): Promise<ErstellErgebnis> => {
        // Locking the member's row serializes their saves, so parallel requests cannot overshoot either limit.
        await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
        const [{ anzahl, belegt }] = await tx.select({ anzahl: count(), belegt: belegterSpeicher }).from(bewertung).where(eq(bewertung.userId, userId));
        if (anzahl >= MAX_BEWERTUNGEN_PRO_KONTO) return "zu-viele";
        if (belegt + bytes > MAX_SPEICHER_PRO_KONTO) return "voll";
        const id = randomUUID();
        const zeitpunkt = jetzt();
        await tx.insert(bewertung).values({ id, userId, stand, revision: 1, erstelltAm: zeitpunkt, aktualisiertAm: zeitpunkt });
        return { id, revision: 1 };
      });
    },

    /**
     * Saves only if the stored revision still equals `revision`, so a tab with an
     * older copy cannot overwrite changes made elsewhere.
     */
    async aktualisiere(userId: string, id: string, stand: BewertungStand, revision: number): Promise<SpeicherErgebnis> {
      const bytes = groesse(stand);
      return db.transaction(async (tx): Promise<SpeicherErgebnis> => {
        await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
        const [vorhanden] = await tx.select({ revision: bewertung.revision }).from(bewertung).where(eigene(userId, id)).limit(1);
        if (!vorhanden) return "nicht-gefunden";
        if (vorhanden.revision !== revision) return "konflikt";
        const [{ belegt }] = await tx.select({ belegt: belegterSpeicher }).from(bewertung).where(and(eq(bewertung.userId, userId), ne(bewertung.id, id)));
        if (belegt + bytes > MAX_SPEICHER_PRO_KONTO) return "voll";
        const [neu] = await tx.update(bewertung)
          .set({ stand, revision: sql`${bewertung.revision} + 1`, aktualisiertAm: jetzt() })
          .where(and(eigene(userId, id), eq(bewertung.revision, revision)))
          .returning({ revision: bewertung.revision });
        // An admin may have deleted it in the meantime; admin deletions do not take the lock.
        return neu ? { revision: neu.revision } : "nicht-gefunden";
      });
    },

    async loesche(userId: string, id: string): Promise<boolean> {
      const geloescht = await db.delete(bewertung).where(eigene(userId, id)).returning({ id: bewertung.id });
      return geloescht.length > 0;
    },
  };
}

export type Bewertungen = ReturnType<typeof erstelleBewertungen>;
