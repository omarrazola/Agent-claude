import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { RunState, StepId } from "../types.js";

/**
 * Almacén en disco: output/runs/<clave>/state.json y un JSON por agente y versión.
 * Para producción se puede sustituir por una base de datos manteniendo estas funciones.
 */
const runDir = (key: string) => path.join(config.paths.output, "runs", safe(key));
const safe = (key: string) => key.replace(/[^A-Za-z0-9_-]/g, "_");

export async function saveRun(run: RunState): Promise<void> {
  run.updatedAt = new Date().toISOString();
  await mkdir(runDir(run.key), { recursive: true });
  await writeFile(path.join(runDir(run.key), "state.json"), JSON.stringify(run, null, 2));
}

export async function loadRun(key: string): Promise<RunState | null> {
  try {
    return JSON.parse(await readFile(path.join(runDir(key), "state.json"), "utf8")) as RunState;
  } catch {
    return null;
  }
}

export async function saveStepOutput(key: string, version: number, step: StepId, output: unknown): Promise<void> {
  await mkdir(runDir(key), { recursive: true });
  await writeFile(path.join(runDir(key), `v${version}-${step}.json`), JSON.stringify(output, null, 2));
}

/** Evita ejecutar dos veces a la vez sobre el mismo ticket. */
const busy = new Set<string>();
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
  if (busy.has(key)) return null;
  busy.add(key);
  try {
    return await fn();
  } finally {
    busy.delete(key);
  }
}
