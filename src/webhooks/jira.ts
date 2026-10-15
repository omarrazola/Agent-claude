import type { Request, Response } from "express";
import { config } from "../config.js";
import { adfToText } from "../lib/json.js";
import { log } from "../lib/logger.js";
import { approve, iterate, startRun } from "../pipeline/orchestrator.js";
import type { Ticket } from "../types.js";
import { parseCommand } from "./commands.js";

interface JiraIssue {
  key: string;
  fields: {
    summary?: string;
    description?: unknown;
    labels?: string[];
    reporter?: { displayName?: string };
    attachment?: { filename?: string }[];
  };
}

interface JiraWebhookBody {
  webhookEvent?: string;
  issue?: JiraIssue;
  comment?: { body?: unknown };
  changelog?: { items?: { field?: string; toString?: string | null }[] };
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function normalizeJiraIssue(issue: JiraIssue): Ticket {
  return {
    source: "jira",
    key: issue.key,
    externalId: issue.key,
    title: issue.fields.summary ?? "(sin título)",
    description: adfToText(issue.fields.description).trim(),
    labels: issue.fields.labels ?? [],
    reporter: issue.fields.reporter?.displayName,
    url: config.jira.baseUrl ? `${config.jira.baseUrl}/browse/${issue.key}` : undefined,
    attachments: (issue.fields.attachment ?? []).map((a) => a.filename ?? "").filter(Boolean),
  };
}

function hasTriggerLabel(labels: string[] = []): boolean {
  const trigger = norm(config.jira.triggerLabel);
  return labels.some((l) => norm(l) === trigger);
}

/** Decide qué hacer con un evento de Jira. Devuelve una descripción de la acción (útil para pruebas y logs). */
export async function handleJiraEvent(body: JiraWebhookBody): Promise<string> {
  const issue = body.issue;
  if (!issue?.key) return "sin incidencia";

  switch (body.webhookEvent) {
    case "jira:issue_created": {
      if (!hasTriggerLabel(issue.fields.labels)) return "sin etiqueta de diseño";
      await startRun(normalizeJiraIssue(issue));
      return "ejecución iniciada";
    }
    case "jira:issue_updated": {
      const labelAdded = body.changelog?.items?.some(
        (i) => i.field === "labels" && hasTriggerLabel((i.toString ?? "").split(" ")),
      );
      if (!labelAdded) return "actualización ignorada";
      await startRun(normalizeJiraIssue(issue));
      return "ejecución iniciada (etiqueta añadida)";
    }
    case "comment_created": {
      const cmd = parseCommand(adfToText(body.comment?.body));
      if (!cmd) return "comentario sin comando";
      if (cmd.type === "changes") await iterate(issue.key, cmd.request);
      else await approve(issue.key);
      return `comando: ${cmd.type}`;
    }
    default:
      return `evento ignorado: ${body.webhookEvent}`;
  }
}

export function jiraWebhook(req: Request, res: Response): void {
  if (config.jira.webhookToken && req.query.token !== config.jira.webhookToken) {
    res.status(401).json({ error: "token no válido" });
    return;
  }
  // Respondemos enseguida y trabajamos en segundo plano
  res.status(202).json({ ok: true });
  handleJiraEvent(req.body as JiraWebhookBody)
    .then((action) => log.info(`Jira: ${action}`))
    .catch((err) => log.error("Jira: error procesando el evento", err));
}
