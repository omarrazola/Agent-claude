import { config } from "../config.js";
import { log } from "../lib/logger.js";
import { adfToText } from "../lib/json.js";
import { startRun } from "../pipeline/orchestrator.js";
import type { Ticket } from "../types.js";

const processedIssues = new Set<string>();

function authHeader(): string {
  return "Basic " + Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString("base64");
}

export async function fetchJiraKanIssues(): Promise<any[]> {
  const url = `${config.jira.baseUrl}/rest/api/3/search/jql`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jql: "project = KAN ORDER BY updated DESC",
      fields: ["summary", "description", "labels", "reporter", "attachment", "updated", "status"]
    })
  });

  if (!res.ok) {
    throw new Error(`Jira respondió ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.issues || [];
}

export function toTicket(issue: any): Ticket {
  return {
    source: "jira",
    key: issue.key,
    externalId: issue.key,
    title: issue.fields.summary ?? "(sin título)",
    description: adfToText(issue.fields.description).trim(),
    labels: issue.fields.labels ?? [],
    reporter: issue.fields.reporter?.displayName,
    url: `${config.jira.baseUrl}/browse/${issue.key}`,
    attachments: (issue.fields.attachment ?? []).map((a: any) => a.filename ?? "").filter(Boolean),
  };
}

export async function checkJiraUpdates() {
  try {
    const issues = await fetchJiraKanIssues();
    for (const issue of issues) {
      const updatedKey = `${issue.key}_${issue.fields.updated}`;
      if (processedIssues.has(updatedKey)) continue;

      const desc = adfToText(issue.fields.description).trim();
      // Si la tarea tiene título o descripción y no se ha procesado esta versión
      if (desc || issue.fields.summary) {
        log.info(`[JIRA POLLER] Nuevo brief detectado en ${issue.key}: "${issue.fields.summary}"`);
        processedIssues.add(updatedKey);
        const ticket = toTicket(issue);
        await startRun(ticket);
      }
    }
  } catch (err) {
    log.error("[JIRA POLLER] Error consultando Jira:", err);
  }
}

let pollerInterval: NodeJS.Timeout | null = null;

export function startJiraPoller(intervalMs = 15000) {
  if (pollerInterval) return;
  log.info(`[JIRA POLLER] Iniciado monitor automático para Jira KAN (${intervalMs / 1000}s)`);
  checkJiraUpdates();
  pollerInterval = setInterval(checkJiraUpdates, intervalMs);
}
