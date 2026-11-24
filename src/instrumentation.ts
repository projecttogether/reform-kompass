// Runs once per server start. Logs the content folder and the AI configuration, applies database migrations and
// schedules the removal of accounts whose 30-day restore window has passed. Without
// account configuration it only logs which settings are missing.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { meldeInhalte } = await import("./lib/inhalte");
  meldeInhalte();
  const { meldeKiEinstellungen } = await import("./lib/ai-config");
  meldeKiEinstellungen();
  const { starteKontoDienste } = await import("./lib/konto-start");
  await starteKontoDienste();
}
