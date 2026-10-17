import { config } from "../config.js";
import { log } from "../lib/logger.js";
import type { RunState, ScreenFile } from "../types.js";

/**
 * Punto de enganche para llevar las pantallas a Figma.
 *
 * La API REST de Figma permite leer archivos y comentar, pero no crear diseños.
 * Para crear la página «<clave> · v<n>» con componentes de la librería de Uber Base DS
 * se recomienda un agente con el conector MCP de Figma (Claude Agent SDK), que sí
 * puede escribir en el archivo usando los componentes publicados.
 *
 * Mientras no esté configurado, esta función no hace nada.
 */
export async function pushToFigma(run: RunState, files: ScreenFile[]): Promise<string | null> {
  if (!config.figma.accessToken || !config.figma.fileKey) return null;
  log.warn(
    `Figma configurado pero sin implementar: se enviarían ${files.length} pantallas de ${run.key} v${run.version} ` +
      `al archivo ${config.figma.fileKey}. Ver docs/setup.md, sección Figma.`,
  );
  return null;
}
