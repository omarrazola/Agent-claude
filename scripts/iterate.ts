/**
 * Pide cambios a los agentes sobre un ticket ya procesado.
 *
 *   npm run iterate -- ALB-482 "Pon primero la tarifa no reembolsable"
 */
import { config } from "../src/config.js";
import { log } from "../src/lib/logger.js";
import { iterate } from "../src/pipeline/orchestrator.js";

config.dryRun = true;

const [key, ...rest] = process.argv.slice(2);
const request = rest.join(" ").trim();
if (!key || !request) {
  log.error('Uso: npm run iterate -- <CLAVE> "<cambio que quieres>"');
  process.exit(1);
}

const run = await iterate(key, request);
if (run) log.info(`${run.key} v${run.version}: ${run.status} · ${run.previewUrl ?? ""}`);
