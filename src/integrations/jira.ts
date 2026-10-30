import { config } from "../config.js";
import { log } from "../lib/logger.js";

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

export interface CreateJiraIssueParams {
  summary: string;
  description: string;
  projectKey?: string;
  issueType?: string;
  labels?: string[];
  priority?: string;
}

export interface JiraCreatedIssue {
  id: string;
  key: string;
  self: string;
  url: string;
}

function parseJiraErrorMessage(status: number, rawText: string, projectKey: string): string {
  try {
    const parsed = JSON.parse(rawText);
    const parts: string[] = [];
    if (Array.isArray(parsed.errorMessages) && parsed.errorMessages.length > 0) {
      parts.push(...parsed.errorMessages);
    }
    if (parsed.errors && typeof parsed.errors === "object") {
      for (const [key, val] of Object.entries(parsed.errors)) {
        parts.push(`${key}: ${val}`);
      }
    }
    const combined = parts.join(" | ") || rawText;

    if (
      status === 400 &&
      (combined.includes("目标项目不存在") ||
        combined.toLowerCase().includes("project does not exist") ||
        combined.includes("project"))
    ) {
      return `El proyecto de Jira '${projectKey}' no existe en tu instancia (${config.jira.baseUrl}) o tu usuario (${config.jira.email}) no tiene permisos para crear incidencias en él. Por favor añade o revisa JIRA_PROJECT_KEY=<CLAVE_DE_TU_PROYECTO> en tu archivo .env con la clave correcta del proyecto en Jira.`;
    }

    if (status === 401) {
      return `Error de autenticación con Jira (401). El token de API o el email (${config.jira.email}) no son válidos o han caducado. Genera un nuevo API Token en https://id.atlassian.com/manage-profile/security/api-tokens y actualiza JIRA_API_TOKEN en el archivo .env.`;
    }

    return `Jira respondió ${status}: ${combined}`;
  } catch {
    return `Jira respondió ${status}: ${rawText}`;
  }
}

/**
 * Crea una incidencia o brief de diseño en Jira de manera automática.
 */
export async function createJiraIssue(params: CreateJiraIssueParams): Promise<JiraCreatedIssue> {
  if (config.dryRun) {
    const mockKey = `KAN-${Math.floor(100 + Math.random() * 900)}`;
    log.info(`[DRY_RUN] Simulando creación de ticket en Jira: ${mockKey} - "${params.summary}"`);
    return {
      id: "mock-" + Date.now(),
      key: mockKey,
      self: `${config.jira.baseUrl || "https://jira.local"}/rest/api/2/issue/${mockKey}`,
      url: `${config.jira.baseUrl || "https://jira.local"}/browse/${mockKey}`,
    };
  }

  if (!config.jira.baseUrl || !config.jira.email || !config.jira.apiToken) {
    throw new Error("Faltan JIRA_BASE_URL, JIRA_EMAIL o JIRA_API_TOKEN en la configuración (.env)");
  }

  const projectKey = params.projectKey || config.jira.projectKey || "KAN";
  const triggerLabel = config.jira.triggerLabel || "diseño";
  const rawLabels = [triggerLabel, "uber-base", ...(params.labels || [])];
  // Normalizar etiquetas (en Jira las etiquetas no pueden tener espacios)
  const labels = Array.from(new Set(rawLabels.map(l => l.trim().replace(/\s+/g, "-")).filter(Boolean)));

  const fields: any = {
    project: { key: projectKey },
    summary: params.summary.trim(),
    description: (params.description || "(Sin descripción de brief)").trim(),
    issuetype: { name: params.issueType || "Tarea" },
    labels,
  };

  if (params.priority) {
    const p = params.priority.toLowerCase();
    let jiraPrio = "Medium";
    if (p.includes("muy alta") || p.includes("highest") || p.includes("crítica") || p.includes("critica")) {
      jiraPrio = "Highest";
    } else if (p.includes("alta") || p.includes("high")) {
      jiraPrio = "High";
    } else if (p.includes("baja") || p.includes("low") || p.includes("menor")) {
      jiraPrio = "Low";
    }
    fields.priority = { name: jiraPrio };
  }

  let res = await fetch(`${config.jira.baseUrl}/rest/api/2/issue`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Reintentar con id común o "Task" si el nombre del tipo falló
    if (errText.includes("issuetype")) {
      log.warn(`[JIRA] Falló el tipo 'Tarea', reintentando con ID '10003'...`);
      fields.issuetype = { id: "10003" };
      res = await fetch(`${config.jira.baseUrl}/rest/api/2/issue`, {
        method: "POST",
        headers: {
          Authorization: authHeader(),
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) {
        const retryErr = await res.text();
        throw new Error(parseJiraErrorMessage(res.status, retryErr, projectKey));
      }
    } else {
      throw new Error(parseJiraErrorMessage(res.status, errText, projectKey));
    }
  }

  const data = (await res.json()) as { id: string; key: string; self: string };
  const issueUrl = `${config.jira.baseUrl}/browse/${data.key}`;
  log.info(`[JIRA] Ticket creado automáticamente con éxito: ${data.key} (${issueUrl})`);

  return {
    id: data.id,
    key: data.key,
    self: data.self,
    url: issueUrl,
  };
}
