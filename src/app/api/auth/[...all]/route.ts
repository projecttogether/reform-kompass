import { AnfrageFehler, leseBegrenztesJson } from "@/lib/anfrage";
import { getKontoDienste } from "@/lib/konto-dienste";
import { fehler } from "@/lib/konto-http";

// Better Auth endpoints: email one-time codes, sessions, and sign-out.
async function handler(req: Request) {
  const dienste = getKontoDienste();
  if (!dienste) return fehler(404, "KONTEN_INAKTIV", "Konten sind hier nicht aktiviert.");
  if (req.method !== "POST") return dienste.auth.handler(req);
  try {
    const body = await leseBegrenztesJson(req, 16 * 1024);
    const headers = new Headers(req.headers);
    headers.delete("content-length");
    return dienste.auth.handler(new Request(req, { headers, body: JSON.stringify(body) }));
  } catch (error) {
    if (error instanceof AnfrageFehler) return fehler(error.status, error.status === 413 ? "ZU_GROSS" : "UNGUELTIG", error.message);
    throw error;
  }
}

export { handler as GET, handler as POST };
