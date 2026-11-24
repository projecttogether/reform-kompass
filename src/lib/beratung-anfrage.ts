import { z } from "zod";
import { AnfrageFehler, leseBegrenztesJson } from "./anfrage";
import { KATEGORIEN, EBENEN, type Ebene } from "./reifegrad-model";
import { MAX_KI_NACHRICHTEN, MAX_KI_NACHRICHT_ZEICHEN, MAX_KI_VERLAUF_ZEICHEN } from "./ki-verlauf";

export const MAX_KI_ANFRAGE_BYTES = 128 * 1024;
const text = z.string().trim().max(300);
const antworten = z.record(z.string(), z.unknown());
const ebene = z.enum(Object.keys(EBENEN) as [Ebene, ...Ebene[]]);
const kontext = { orgName: text.min(1), orgTyp: text.default("Kommune"), funktion: text.default(""), positionFachbereich: text.default("") };
const assessment = z.object({ antworten: antworten.default({}), ebene: ebene.default("gesamtverwaltung") }).default({ antworten: {}, ebene: "gesamtverwaltung" });
const verlauf = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(MAX_KI_NACHRICHT_ZEICHEN) }))
  .max(MAX_KI_NACHRICHTEN).refine((messages) => messages.reduce((n, m) => n + m.content.length, 0) <= MAX_KI_VERLAUF_ZEICHEN);

export const chatAnfrage = z.object({ ...kontext, assessment, messages: verlauf.refine((messages) => messages.length > 0 && messages.at(-1)?.role === "user") });
export const katalogAnfrage = z.object({ ...kontext, assessment, chatHistory: verlauf.default([]), nurAktualisieren: z.boolean().default(false), bisherigerKatalog: z.unknown().optional() });
export const erklaerungAnfrage = z.object({ ...kontext, antworten, ebene: ebene.default("gesamtverwaltung"), kategorie: z.enum(Object.keys(KATEGORIEN) as [keyof typeof KATEGORIEN, ...Array<keyof typeof KATEGORIEN>]) });

export async function leseKiAnfrage<T extends z.ZodType>(req: Request, schema: T): Promise<z.output<T> | Response> {
  try {
    const result = schema.safeParse(await leseBegrenztesJson(req, MAX_KI_ANFRAGE_BYTES));
    if (result.success) return result.data;
  } catch (error) {
    if (error instanceof AnfrageFehler && error.status === 413) return Response.json({ error: error.message }, { status: 413 });
  }
  return Response.json({ error: "Ungültige Beratungsanfrage." }, { status: 400 });
}
