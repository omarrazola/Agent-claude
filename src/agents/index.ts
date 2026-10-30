import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import type { StepId } from "../types.js";

export interface AgentDef {
  id: StepId;
  name: string;
  /** Archivo en agents/prompts/ */
  prompt: string;
  /** Salidas de agentes anteriores que recibe. */
  needs: StepId[];
  /** Material de referencia de Uber Base DS que se le adjunta (rutas relativas a design-system/). */
  references: string[];
  maxTokens: number;
  /** Modelo propio; si no se indica, usa CLAUDE_MODEL. */
  model?: string;
}

export const AGENTS: AgentDef[] = [
  {
    id: "brief",
    name: "Analista de brief",
    prompt: "01-brief.md",
    needs: [],
    references: [],
    maxTokens: 3000,
  },
  {
    id: "context",
    name: "Agente de contexto",
    prompt: "02-context.md",
    needs: ["brief"],
    references: ["components/README.md", "tokens/base.tokens.json"],
    maxTokens: 4000,
  },
  {
    id: "ux",
    name: "Arquitecto UX",
    prompt: "03-ux.md",
    needs: ["brief", "context"],
    references: ["components/README.md"],
    maxTokens: 6000,
  },
  {
    id: "copy",
    name: "Redactor UX",
    prompt: "04-copy.md",
    needs: ["brief", "ux"],
    references: ["guidelines/tono-de-voz.md"],
    maxTokens: 5000,
  },
  {
    id: "ui",
    name: "Agente de UI",
    prompt: "05-ui.md",
    needs: ["brief", "ux", "copy", "context"],
    references: ["css/base.css", "components/README.md"],
    maxTokens: 8192,
  },
  {
    id: "qa",
    name: "Revisor QA",
    prompt: "06-qa.md",
    needs: ["ux", "ui"],
    references: ["css/base.css", "guidelines/accesibilidad.md"],
    maxTokens: 8192,
  },
  {
    id: "delivery",
    name: "Agente de entrega",
    prompt: "07-delivery.md",
    needs: ["brief", "context", "ux", "qa"],
    references: [],
    maxTokens: 3000,
  },
];

/** Pasos que se relanzan cuando la diseñadora pide cambios. */
export const ITERATION_STEPS: StepId[] = ["ux", "copy", "ui", "qa", "delivery"];

export const agentById = (id: StepId): AgentDef => {
  const agent = AGENTS.find((a) => a.id === id);
  if (!agent) throw new Error(`Agente desconocido: ${id}`);
  return agent;
};

export async function loadPrompt(file: string): Promise<string> {
  return readFile(path.join(config.paths.prompts, file), "utf8");
}

export async function loadReference(relPath: string): Promise<string> {
  return readFile(path.join(config.paths.designSystem, relPath), "utf8");
}
