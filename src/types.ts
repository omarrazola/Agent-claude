export type Source = "jira" | "trello";

/** Petición de diseño normalizada, venga de Jira o de Trello. */
export interface Ticket {
  source: Source;
  /** Clave legible: ALB-482 en Jira, TR-<shortLink> en Trello. */
  key: string;
  /** ID que usa la API de origen (clave en Jira, id de la tarjeta en Trello). */
  externalId: string;
  title: string;
  description: string;
  labels: string[];
  reporter?: string;
  url?: string;
  attachments: string[];
}

export type StepId = "brief" | "context" | "ux" | "copy" | "ui" | "qa" | "delivery";

export interface ScreenFile {
  /** Nombre de archivo, por ejemplo "checkout.html". */
  path: string;
  html: string;
}

export type RunStatus = "running" | "review" | "approved" | "failed";

export interface VersionEntry {
  version: number;
  at: string;
  /** Petición de cambio que originó esta versión (vacío en v0). */
  request?: string;
  previewUrl?: string;
}

export interface RunState {
  key: string;
  ticket: Ticket;
  version: number;
  status: RunStatus;
  /** Última salida de cada agente. Las anteriores quedan guardadas en disco por versión. */
  outputs: Partial<Record<StepId, unknown>>;
  history: VersionEntry[];
  previewUrl?: string;
  error?: string;
  updatedAt: string;
}
