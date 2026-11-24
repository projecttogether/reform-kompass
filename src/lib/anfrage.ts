// Read a bounded body before JSON parsing. The stream is counted even when
// Content-Length is absent or false; reject before buffering the next chunk.
export class AnfrageFehler extends Error {
  constructor(public status: 400 | 413, message: string) { super(message); }
}

export async function leseBegrenztenText(req: Request, maxBytes: number): Promise<string> {
  const length = req.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > maxBytes) {
    await req.body?.cancel().catch(() => {});
    throw new AnfrageFehler(413, "Die Anfrage ist zu groß.");
  }
  const reader = req.body?.getReader();
  if (!reader) throw new AnfrageFehler(400, "Ungültiges JSON.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new AnfrageFehler(413, "Die Anfrage ist zu groß.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch { throw new AnfrageFehler(400, "Ungültiges JSON."); }
}

export async function leseBegrenztesJson(req: Request, maxBytes: number): Promise<unknown> {
  const text = await leseBegrenztenText(req, maxBytes);
  try { return JSON.parse(text); } catch { throw new AnfrageFehler(400, "Ungültiges JSON."); }
}
