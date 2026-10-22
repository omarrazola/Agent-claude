import { config } from "../config.js";
import { log } from "../lib/logger.js";
import type { RunState, ScreenFile } from "../types.js";

let latestScreens: any[] = [];
let latestRunKey = "";

export function setLatestFigmaDesign(key: string, screens: any[]) {
  latestRunKey = key;
  latestScreens = screens;
}

export function getLatestFigmaDesign() {
  return {
    key: latestRunKey,
    fileKey: config.figma.fileKey,
    fileUrl: config.figma.fileUrl,
    screens: latestScreens
  };
}

/**
 * Punto de conexión con el archivo de Figma:
 * https://www.figma.com/design/dcKVRyGjsYiK3Cl1iBHeXc/Untitled?node-id=0-1
 */
export async function pushToFigma(run: RunState, files: ScreenFile[]): Promise<string | null> {
  setLatestFigmaDesign(run.key, files);
  const fileKey = config.figma.fileKey || "dcKVRyGjsYiK3Cl1iBHeXc";
  log.info(`[FIGMA] Diseño preparado para archivo Figma: ${config.figma.fileUrl} (${files.length} pantallas)`);

  if (!config.figma.accessToken) {
    return config.figma.fileUrl;
  }

  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/comments`, {
      method: "POST",
      headers: {
        "X-Figma-Token": config.figma.accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `🤖 [Agente Uber Base] Flujo completado para ${run.key} (v${run.version}). ${files.length} pantallas generadas: ${run.previewUrl || ""}`,
        client_meta: { node_id: "0:1" }
      })
    });
    if (res.ok) {
      log.info(`[FIGMA] Comentario publicado en archivo ${fileKey}`);
    } else {
      log.warn(`[FIGMA] API Figma status ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    log.error(`[FIGMA] Error al conectar con Figma:`, err);
  }

  return config.figma.fileUrl;
}
