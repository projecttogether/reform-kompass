import { fehlendeKontoEinstellungen, leseKontoEinstellungen } from "./konto-config";
import { getKontoDienste } from "./konto-dienste";
import { migriereDatenbank, verbindeDatenbank } from "./db";

const BEREINIGUNG_MS = 6 * 60 * 60 * 1000;
// Next.js serves no request until instrumentation finishes, so a slow or unreachable
// database must never hold up the assessment for longer than this.
const MAX_STARTWARTEZEIT_MS = 15_000;

async function migriere(datenbankUrl: string): Promise<boolean> {
  const db = verbindeDatenbank(datenbankUrl);
  try {
    await migriereDatenbank(db);
    console.info("Datenbankmigrationen angewendet.");
    return true;
  } catch (error) {
    // The assessment keeps working; account routes fail until the database is reachable.
    console.error("Datenbankmigration fehlgeschlagen:", error);
    return false;
  } finally {
    await db.$client.end().catch(() => {});
  }
}

function planeBereinigung() {
  const bereinige = async () => {
    try {
      const anzahl = await getKontoDienste()?.konten.bereinige();
      if (anzahl) console.info(`${anzahl} Konto/Konten nach Ablauf der Wiederherstellungsfrist gelöscht.`);
    } catch (error) {
      console.error("Kontobereinigung fehlgeschlagen:", error);
    }
  };
  void bereinige();
  setInterval(bereinige, BEREINIGUNG_MS).unref();
}

export async function starteKontoDienste() {
  const einstellungen = leseKontoEinstellungen();
  if (!einstellungen) {
    const fehlend = fehlendeKontoEinstellungen();
    // Only warn when a database is configured, i.e. accounts were meant to be on.
    if (!fehlend.includes("DATABASE_URL")) console.warn(`Konten deaktiviert. Fehlende Einstellungen: ${fehlend.join(", ")}`);
    return;
  }
  // Retries in the background until the database is reachable, then schedules cleanup.
  const migration = (async () => {
    for (let versuch = 0; ; versuch++) {
      if (await migriere(einstellungen.datenbankUrl)) {
        planeBereinigung();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(60_000, 5_000 * 2 ** versuch)).unref());
    }
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const zeitAbgelaufen = new Promise<"zeit">((resolve) => { timer = setTimeout(() => resolve("zeit"), MAX_STARTWARTEZEIT_MS); });
  if (await Promise.race([migration, zeitAbgelaufen]) === "zeit") {
    console.error("Datenbankmigration nach 15 Sekunden nicht abgeschlossen; der Server startet ohne sie und migriert im Hintergrund weiter.");
  }
  clearTimeout(timer);
}
