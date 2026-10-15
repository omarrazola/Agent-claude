import { AGENTS, ITERATION_STEPS, agentById } from "../agents/index.js";
import { runAgent } from "../agents/runner.js";
import { config } from "../config.js";
import { pushToFigma } from "../integrations/figma.js";
import { writePreview } from "../integrations/preview.js";
import { tracker } from "../integrations/tracker.js";
import { log } from "../lib/logger.js";
import type { RunState, ScreenFile, StepId, Ticket } from "../types.js";
import { loadRun, saveRun, saveStepOutput, withLock } from "./store.js";

/** Primera ejecución completa cuando llega una petición nueva. */
export async function startRun(ticket: Ticket): Promise<RunState | null> {
  return withLock(ticket.key, async () => {
    const existing = await loadRun(ticket.key);
    if (existing && existing.status !== "failed") {
      log.info(`${ticket.key} ya tiene una ejecución (${existing.status}); se ignora.`);
      return existing;
    }
    const run: RunState = {
      key: ticket.key,
      ticket,
      version: 0,
      status: "running",
      outputs: {},
      history: [{ version: 0, at: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    };
    await saveRun(run);
    return runSteps(run, AGENTS.map((a) => a.id));
  });
}

/** Nueva versión a partir de una petición de cambio de la diseñadora. */
export async function iterate(key: string, request: string): Promise<RunState | null> {
  return withLock(key, async () => {
    const run = await loadRun(key);
    if (!run) throw new Error(`No hay ninguna ejecución para ${key}`);
    if (run.status === "approved") {
      await tracker.comment(run, `${"🤖"} ${key} ya está aprobado. Reabre la revisión antes de pedir cambios.`);
      return run;
    }
    run.version += 1;
    run.status = "running";
    run.history.push({ version: run.version, at: new Date().toISOString(), request });
    await saveRun(run);
    return runSteps(run, ITERATION_STEPS, request);
  });
}

/** Aprobación humana: mueve a desarrollo y deja constancia en el ticket. */
export async function approve(key: string): Promise<RunState | null> {
  return withLock(key, async () => {
    const run = await loadRun(key);
    if (!run) throw new Error(`No hay ninguna ejecución para ${key}`);
    run.status = "approved";
    await saveRun(run);
    await tracker.comment(
      run,
      `${"🤖"} Versión v${run.version} aprobada y enviada a desarrollo.\n` +
        `Previsualización: ${run.previewUrl ?? "—"}\n` +
        `Especificación: output/runs/${run.key}/v${run.version}-*.json`,
    );
    await tracker.moveToDev(run);
    log.step(key, `aprobada v${run.version}`);
    return run;
  });
}

async function runSteps(run: RunState, steps: StepId[], feedback?: string): Promise<RunState> {
  try {
    for (const step of steps) {
      const agent = agentById(step);
      log.step(run.key, `${agent.name}…`);

      const extra: Record<string, unknown> = { version: `v${run.version}` };
      if (step === "delivery") {
        extra.previewUrl = run.previewUrl;
        extra.dryRun = config.dryRun;
        extra.history = run.history;
      }

      const output = await runAgent(agent, run, {
        feedback: step === "delivery" ? undefined : feedback,
        extra,
      });
      run.outputs[step] = output;
      await saveStepOutput(run.key, run.version, step, output);
      await saveRun(run);

      // Tras QA ya hay pantallas definitivas para esta versión
      if (step === "qa") {
        const files = pickScreens(run);
        run.previewUrl = await writePreview(run.key, run.version, files);
        run.history[run.history.length - 1].previewUrl = run.previewUrl;
        await pushToFigma(run, files);
        await saveRun(run);
        log.step(run.key, `previsualización: ${run.previewUrl}`);
      }
    }

    const delivery = run.outputs.delivery as { comment?: string } | undefined;
    const comment = delivery?.comment?.trim() || `Propuesta v${run.version} lista para revisión: ${run.previewUrl}`;
    await tracker.comment(run, comment.startsWith("🤖") ? comment : `🤖 ${comment}`);
    await tracker.moveToReview(run);

    run.status = "review";
    run.error = undefined;
    await saveRun(run);
    log.step(run.key, `v${run.version} lista para revisión`);
    return run;
  } catch (err) {
    run.status = "failed";
    run.error = err instanceof Error ? err.message : String(err);
    await saveRun(run);
    log.error(`${run.key} falló: ${run.error}`);
    throw err;
  }
}

/** Usa las pantallas corregidas por QA si las hay; si no, las del agente de UI. */
function pickScreens(run: RunState): ScreenFile[] {
  const fromQa = (run.outputs.qa as { files?: ScreenFile[] } | undefined)?.files;
  const fromUi = (run.outputs.ui as { files?: ScreenFile[] } | undefined)?.files;
  const files = fromQa?.length ? fromQa : fromUi ?? [];
  return files.filter((f) => typeof f?.path === "string" && typeof f?.html === "string");
}
