/**
 * Ejecuta la cadena completa de agentes con un webhook de ejemplo, sin escribir en Jira ni en Trello.
 *
 *   npm run demo:local                                  (Jira)
 *   npm run demo:trello                                 (Trello)
 *   npx tsx scripts/run-local.ts fixtures/mi-evento.json
 */
import { readFile } from "node:fs/promises";
import { config } from "../src/config.js";
import { log } from "../src/lib/logger.js";
import { startRun } from "../src/pipeline/orchestrator.js";
import type { Ticket } from "../src/types.js";
import { normalizeJiraIssue } from "../src/webhooks/jira.js";
import { normalizeTrelloAction } from "../src/webhooks/trello.js";

config.dryRun = true;

const file = process.argv[2] ?? "fixtures/jira-issue-created.json";
const payload = JSON.parse(await readFile(file, "utf8"));

let ticket: Ticket | null = null;
if (payload.webhookEvent && payload.issue) ticket = normalizeJiraIssue(payload.issue);
else if (payload.action) ticket = await normalizeTrelloAction(payload.action);

if (!ticket) {
  log.error(`No reconozco el formato de ${file}. Debe ser un webhook de Jira o de Trello.`);
  process.exit(1);
}

log.info(`Ticket ${ticket.key} (${ticket.source}): ${ticket.title}`);
const run = await startRun(ticket);
if (run) {
  log.info(`Estado: ${run.status} · versión v${run.version}`);
  log.info(`Salidas: output/runs/${run.key}/`);
  log.info(`Pantallas: output/previews/${run.key}/v${run.version}/ (o ${run.previewUrl} con el servidor arrancado)`);
}
