import { config } from "../config.js";

function authHeader(): string {
  return "Basic " + Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString("base64");
}

async function jiraFetch(pathname: string, init: RequestInit): Promise<void> {
  if (!config.jira.baseUrl || !config.jira.email || !config.jira.apiToken) {
    throw new Error("Faltan JIRA_BASE_URL, JIRA_EMAIL o JIRA_API_TOKEN en .env");
  }
  const res = await fetch(`${config.jira.baseUrl}${pathname}`, {
    ...init,
    headers: { Authorization: authHeader(), Accept: "application/json", "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`Jira respondió ${res.status}: ${await res.text()}`);
}

/** Comentario en texto plano (API v2, que acepta texto sin formato ADF). */
export async function addJiraComment(issueKey: string, body: string): Promise<void> {
  await jiraFetch(`/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function transitionJiraIssue(issueKey: string, transitionId: string): Promise<void> {
  if (!transitionId) return;
  await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, {
    method: "POST",
    body: JSON.stringify({ transition: { id: transitionId } }),
  });
}
