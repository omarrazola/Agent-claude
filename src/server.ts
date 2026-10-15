import path from "node:path";
import express, { type Request } from "express";
import { config, ROOT } from "./config.js";
import { log } from "./lib/logger.js";
import { approve, iterate } from "./pipeline/orchestrator.js";
import { loadRun } from "./pipeline/store.js";
import { jiraWebhook } from "./webhooks/jira.js";
import { trelloWebhook } from "./webhooks/trello.js";

const app = express();

// Guardamos el cuerpo original para verificar la firma de Trello
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, dryRun: config.dryRun });
});

// --- Webhooks ---
app.post("/webhooks/jira", jiraWebhook);
// Trello comprueba la URL con HEAD al crear el webhook
app.head("/webhooks/trello", (_req, res) => {
  res.sendStatus(200);
});
app.post("/webhooks/trello", trelloWebhook);

// --- Previsualizaciones y Demo ---
app.use("/previews", express.static(path.join(config.paths.output, "previews")));
app.use("/demo", express.static(path.join(ROOT, "demo")));
app.get("/", (_req, res) => res.redirect("/demo"));

// --- API interna (para un panel propio o pruebas) ---
app.get("/api/runs/:key", async (req, res) => {
  const run = await loadRun(req.params.key);
  if (!run) {
    res.status(404).json({ error: "no encontrado" });
    return;
  }
  res.json(run);
});

app.post("/api/runs/:key/iterate", async (req, res) => {
  const request = String(req.body?.request ?? "").trim();
  if (!request) {
    res.status(400).json({ error: "Falta 'request' con el cambio que quieres hacer" });
    return;
  }
  res.status(202).json({ ok: true });
  iterate(req.params.key, request).catch((err) => log.error("Iteración fallida", err));
});

app.post("/api/runs/:key/approve", async (req, res) => {
  try {
    const run = await approve(req.params.key);
    res.json({ ok: true, status: run?.status });
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(config.port, () => {
  log.info(`Albora Design Agents escuchando en http://localhost:${config.port}`);
  log.info(config.dryRun ? "DRY_RUN activo: no se escribirá en Jira ni en Trello." : "Modo real: se escribirá en Jira y Trello.");
});
