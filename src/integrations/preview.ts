import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { ScreenFile } from "../types.js";

/**
 * Escribe las pantallas de una versión en output/previews/<clave>/v<n>/,
 * copia albora.css al lado y genera un índice. El servidor las sirve en /previews.
 * Devuelve la URL pública del índice.
 */
const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "_");

export async function writePreview(key: string, version: number, files: ScreenFile[]): Promise<string> {
  const safeKey = safe(key);
  const dir = path.join(config.paths.output, "previews", safeKey, `v${version}`);
  await mkdir(dir, { recursive: true });
  await copyFile(path.join(config.paths.designSystem, "css", "albora.css"), path.join(dir, "albora.css"));

  const names: string[] = [];
  for (const file of files) {
    let name = path.basename(file.path).replace(/[^A-Za-z0-9._-]/g, "-");
    if (!name.endsWith(".html")) name += ".html";
    names.push(name);
    await writeFile(path.join(dir, name), file.html);
  }

  const links = names
    .map((n) => `<li><a href="${n}">${n.replace(/\.html$/, "")}</a></li>`)
    .join("\n");
  await writeFile(
    path.join(dir, "index.html"),
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${key} · v${version}</title><link rel="stylesheet" href="albora.css"></head>` +
      `<body class="al-page"><main class="al-sec"><h1 class="al-h">${key} · v${version}</h1><ul>${links}</ul></main></body></html>`,
  );

  return `${config.publicBaseUrl}/previews/${encodeURIComponent(safeKey)}/v${version}/`;
}
