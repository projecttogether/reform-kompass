"use client";

import { KATEGORIEN, FRAGEN, getFrageText, generiereEinschaetzung, type Kategorie } from "@/lib/reifegrad-model";
import { gruppiereKatalog } from "@/lib/massnahmenkatalog";
import { ergebnis, type BewertungStand } from "@/lib/bewertung";

/**
 * The assessment a PDF describes. The export derives the score and the answer wording
 * for the assessed level itself, as saved assessments do, so callers cannot pass stale
 * or mismatched values.
 */
export type ExportStand = Pick<BewertungStand, "kontext" | "antworten" | "katalog">;

function h2rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function scoreColor(pct: number): string {
  if (pct < 30) return "#dc2626";
  if (pct < 50) return "#ea580c";
  if (pct < 70) return "#ca8a04";
  if (pct < 85) return "#16a34a";
  return "#0284c7";
}

function heute() {
  return new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

async function loadFontBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function svgToPng(svgUrl: string, pxW: number, pxH: number): Promise<string> {
  const resp = await fetch(svgUrl);
  const svgText = await resp.text();
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = pxW;
    canvas.height = pxH;
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject(new Error("no canvas")); return; }
    const img = new Image();
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, pxW, pxH);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("svg load failed")); };
    img.src = url;
  });
}

async function exportPDF(stand: ExportStand, erklaerungen: Record<string, string>, produktname: string, vollbericht: boolean) {
  const { kontext, antworten, katalog } = stand;
  const score = ergebnis(stand);
  const mod = await import("jspdf").catch(() => import("jspdf"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JsPDF = (mod as any).jsPDF ?? (mod as any).default;
  const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Load brand font (Rubik only)
  let hasRubik = false;
  try {
    const [reg, bold] = await Promise.all([
      loadFontBase64("/fonts/Rubik-Regular.ttf"),
      loadFontBase64("/fonts/Rubik-Bold.ttf"),
    ]);
    doc.addFileToVFS("Rubik-Regular.ttf", reg);
    doc.addFont("Rubik-Regular.ttf", "Rubik", "normal");
    doc.addFileToVFS("Rubik-Bold.ttf", bold);
    doc.addFont("Rubik-Bold.ttf", "Rubik", "bold");
    hasRubik = true;
  } catch { /* Helvetica fallback */ }

  // Load logo
  let logoPng: string | null = null;
  try { logoPng = await svgToPng("/marke/logo-dunkel.svg", 1284, 576); } catch { /* no logo */ }

  const FONT = hasRubik ? "Rubik" : "helvetica";
  const W = 210;
  const M = 15;
  const CW = W - M * 2;
  let y = 0;

  const setC = (hex: string) => { const [r, g, b] = h2rgb(hex); doc.setTextColor(r, g, b); };
  const setF = (hex: string) => { const [r, g, b] = h2rgb(hex); doc.setFillColor(r, g, b); };
  const setD = (hex: string) => { const [r, g, b] = h2rgb(hex); doc.setDrawColor(r, g, b); };
  const rb = (bold = false) => doc.setFont(FONT, bold ? "bold" : "normal");

  let isFirstPage = true;

  function needBreak(h: number) {
    if (y + h > 277) {
      doc.addPage();
      isFirstPage = false;
      y = M; // top margin on new pages
    }
  }

  function bar(x: number, yb: number, w: number, pct: number, color: string) {
    setF("#e4e8f2"); doc.rect(x, yb, w, 3, "F");
    if (pct > 0) { setF(color); doc.rect(x, yb, Math.max(w * pct / 100, 1), 3, "F"); }
  }

  // Logo top right — only on first page
  function pageHeader() {
    if (isFirstPage) {
      if (logoPng) {
        doc.addImage(logoPng, "PNG", W - M - 52.6, 8, 52.6, 23.6);
      } else {
        rb(true); doc.setFontSize(10); setC("#A087FE");
        doc.text(produktname, W - M, 14, { align: "right" });
      }
    }
    if (isFirstPage) y = 14; // logo height; subsequent pages keep their y
  }

  // Main section heading (large, with grey underline)
  function mainHeading(title: string) {
    needBreak(16);
    rb(true); doc.setFontSize(15); setC("#111827");
    doc.text(title, M, y);
    y += 3;
    setD("#d1d5db"); doc.setLineWidth(0.5);
    doc.line(M, y, M + CW, y);
    y += 8;
  }

  // Sub-heading (smaller, NO underline)
  function subHeading(title: string) {
    needBreak(12);
    rb(true); doc.setFontSize(12); setC("#111827");
    doc.text(title, M, y);
    y += 7;
  }

  // ── PAGE HEADER + COVER ─────────────────────────────────
  pageHeader();

  // Label (small, grey — no allcaps)
  rb(); doc.setFontSize(7.5); setC("#9ca3af");
  doc.text(`${produktname} · ${vollbericht ? "Vollständiger Bericht" : "Auswertung"}`, M, y);
  y += 8;

  // Kommune (largest font)
  rb(true); doc.setFontSize(24); setC("#111827");
  doc.text(kontext.orgName || "Ihre Kommune", M, y);
  y += 8;

  // Position + Funktion
  const sub = [kontext.positionFachbereich, kontext.funktion].filter(Boolean).join(" · ");
  if (sub) {
    rb(); doc.setFontSize(9); setC("#6b7280");
    doc.text(sub, M, y);
    y += 5;
  }

  // Datum
  rb(); doc.setFontSize(8.5); setC("#9ca3af");
  doc.text(heute(), M, y);
  y += 6;

  // Thick dark divider
  setF("#00125A"); doc.rect(M, y, CW, 1.5, "F");
  y += 16; // FIX 1: more space after thick divider

  // ── HAUPTÜBERSCHRIFT ────────────────────────────────────
  mainHeading("Ergebnis der Modernisierungsreifegradbewertung");

  // ── SCORE SECTION IN BOX ────────────────────────────────
  const pctColor = scoreColor(score.prozent);
  const einschaetzung = generiereEinschaetzung(score);
  const BM = M + 6; // box inner left margin
  const BCW = CW - 12; // box content width

  // Render all text first, then draw box border with exact measured height
  rb(); doc.setFontSize(9.5);
  const einschaetzungLines: string[] = doc.splitTextToSize(einschaetzung, BCW);
  // Actual jsPDF line height: lineHeightFactor(1.15) * fontSize / scaleFactor(pt→mm)
  const ELH = (1.15 * 9.5) / 2.8346;

  const boxTop = y;
  // Draw background fill with generous estimate (nearly white, so slight overshoot is invisible)
  setF("#f8f9fc"); doc.setDrawColor(248, 249, 252); doc.setLineWidth(0);
  doc.rect(M, y, CW, 6 + 7 + 5 + 8 + einschaetzungLines.length * ELH + 3 + 5 + 3, "F");
  y += 6; // top padding

  // "52% ist Ihr Modernisierungsreifegrad" — 13pt, smaller than mainHeading 15pt
  rb(true); doc.setFontSize(13);
  setC(pctColor);
  doc.text(`${score.prozent}%`, BM, y);
  const pctW = doc.getTextWidth(`${score.prozent}%`);
  setC("#111827");
  doc.text(" ist Ihr Modernisierungsreifegrad", BM + pctW, y);
  y += 7;

  // "Das sind X von Y erreichbaren Punkten"
  rb(); doc.setFontSize(9.5); setC("#374151");
  doc.text(
    doc.splitTextToSize(`Das sind ${score.gesamtScore} von ${score.maxScore} erreichbaren Punkten`, BCW),
    BM, y
  );
  y += 5;

  // Balken
  bar(BM, y, BCW, score.prozent, pctColor);
  y += 8;

  // Gesamteinschätzung
  rb(); doc.setFontSize(9.5); setC("#1f2937");
  doc.text(einschaetzungLines, BM, y);
  y += einschaetzungLines.length * ELH + 3; // ein Absatz zur Fragen-Zeile

  // Anzahl beantworteter Fragen
  rb(); doc.setFontSize(8.5); setC("#9ca3af");
  doc.text(`${score.beantworteteFragen} von ${score.gesamtFragen} Fragen beantwortet`, BM, y);
  y += 3; // bottom padding — box endet hier

  // Draw box border with exact height (text already rendered above, border drawn on top — no fill to avoid covering text)
  setD("#dce3f2"); doc.setLineWidth(0.5);
  doc.roundedRect(M, boxTop, CW, y - boxTop, 3, 3, "D");

  y += 8; // spacing after box

  // ── ERGEBNIS NACH BEREICHEN (Sub-Heading, kein Strich) ──
  subHeading("Ergebnis nach Bereichen");

  for (const kat of Object.keys(KATEGORIEN) as Kategorie[]) {
    const ks = score.kategorieScores[kat];
    if (!ks) continue;
    const nichtBeantwortet = ks.beantwortet === 0;
    const kColor = nichtBeantwortet ? "#9ca3af" : scoreColor(ks.prozent);
    const erkl = nichtBeantwortet
      ? "Keine Fragen in diesem Bereich beantwortet — keine Auswertung möglich."
      : (erklaerungen[kat] || KATEGORIEN[kat].beschreibung);
    rb(); doc.setFontSize(9);
    const erklLines: string[] = doc.splitTextToSize(erkl, CW - 10);
    needBreak(16 + erklLines.length * 4.8);

    // Kategorie-Label + Prozent oder "–"
    rb(true); doc.setFontSize(10.5); setC("#111827");
    const labelLines: string[] = doc.splitTextToSize(KATEGORIEN[kat].label, CW - 20);
    doc.text(labelLines, M, y);
    setC(kColor);
    doc.text(nichtBeantwortet ? "–" : `${ks.prozent}%`, M + CW, y, { align: "right" });
    y += labelLines.length * 5.5 - 0.5;

    if (!nichtBeantwortet) {
      bar(M, y, CW, ks.prozent, kColor);
    }
    y += 7;

    if (erklLines.length) {
      rb(); doc.setFontSize(9); setC(nichtBeantwortet ? "#9ca3af" : "#374151");
      doc.text(erklLines, M, y + 2);
      y += erklLines.length * 4.8 + 6;
    } else {
      y += 4;
    }
  }

  // ── VOLLBERICHT: MASSNAHMENKATALOG ──────────────────────
  if (vollbericht && katalog) {
    doc.addPage(); isFirstPage = false; y = M; pageHeader(); y += 6;
    mainHeading("Modernisierungs-Maßnahmenkatalog");

    const GC: Record<string, string> = {
      "eigen-niedrig": "#16a34a", "eigen-hoch": "#2563eb",
      "fremd-niedrig": "#d97706", "fremd-hoch": "#ea580c",
    };

    for (const gruppe of gruppiereKatalog(katalog)) {
      if (!gruppe.massnahmen.length) continue;
      needBreak(14);
      const gc = GC[gruppe.id] ?? "#374151";

      rb(true); doc.setFontSize(10.5); setC(gc);
      doc.text(gruppe.label, M, y);
      y += 7;

      for (const m of gruppe.massnahmen) {
        rb(); doc.setFontSize(9.5);
        const titelLines: string[] = doc.splitTextToSize(`${m.titel} (${m.bereich})`, CW - 9);
        const descLines: string[] = doc.splitTextToSize(m.beschreibung, CW - 9);
        const beitragLines: string[] = (m.verantwortung === "fremd" && m.eigener_beitrag)
          ? doc.splitTextToSize(`Eigener Beitrag: ${m.eigener_beitrag}`, CW - 9) : [];
        const h = titelLines.length * 4.8 + descLines.length * 4.3 + beitragLines.length * 4.3 + 8;
        needBreak(h);

        const [r, g, b] = h2rgb(gc);
        doc.setFillColor(r, g, b);
        doc.rect(M, y - 1, 2.5, h - 2, "F");

        rb(true); doc.setFontSize(9.5); setC("#111827");
        doc.text(titelLines, M + 6, y + 3.5);
        let my = y + 3.5 + titelLines.length * 4.8;

        rb(); doc.setFontSize(9); setC("#374151");
        doc.text(descLines, M + 6, my);
        my += descLines.length * 4.3;

        if (beitragLines.length) {
          doc.setFontSize(8.5); setC("#6b7280");
          doc.text(beitragLines, M + 6, my + 1);
          my += beitragLines.length * 4.3;
        }
        y = my + 6;
      }
      y += 3;
    }
  }

  // ── VOLLBERICHT: FRAGEN ─────────────────────────────────
  if (vollbericht) {
    doc.addPage(); isFirstPage = false; y = M; pageHeader(); y += 6;
    mainHeading("Ihre Antworten zu den Reifegradfragen");

    for (const frage of FRAGEN) {
      const idx = antworten[frage.id];
      const answered = idx !== undefined;
      rb(); doc.setFontSize(9);
      const metaLines: string[] = doc.splitTextToSize(
        `Frage ${frage.nummer} · ${frage.teilLabel} · ${frage.titel}`, CW
      );
      // Antwortnummer: gleiche Größe und Farbe wie Antworttext
      const antwortText = answered ? `${idx + 1}. ${getFrageText(frage, kontext.ebene).optionen[idx]}` : "Übersprungen";
      const aLines: string[] = doc.splitTextToSize(antwortText, CW - 2);
      needBreak(metaLines.length * 4.8 + aLines.length * 4.8 + 7);

      rb(true); doc.setFontSize(9); setC("#374151");
      doc.text(metaLines, M, y);
      y += metaLines.length * 4.8 + 1;

      rb(); doc.setFontSize(9); setC(answered ? "#111827" : "#9ca3af");
      doc.text(aLines, M + 2, y);
      y += aLines.length * 4.8;

      setD("#e5e7eb"); doc.setLineWidth(0.3);
      doc.line(M, y + 2, M + CW, y + 2);
      y += 7;
    }
  }

  const filename = vollbericht
    ? `Reifegrad-Vollbericht-${kontext.orgName.replace(/\s+/g, "-")}.pdf`
    : `Reifegrad-Ergebnis-${kontext.orgName.replace(/\s+/g, "-")}.pdf`;

  doc.save(filename);
}

/** Result PDF: score, level and category explanations. */
export async function exportiereErgebnis(stand: ExportStand, erklaerungen: Record<string, string>, produktname: string) {
  await exportPDF(stand, erklaerungen, produktname, false);
}

/** Full report: the result, the action catalogue if there is one, and every answer in the wording of the assessed level. */
export async function exportiereVollbericht(stand: ExportStand, erklaerungen: Record<string, string>, produktname: string) {
  await exportPDF(stand, erklaerungen, produktname, true);
}
