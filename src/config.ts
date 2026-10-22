import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const env = (name: string, fallback = ""): string => process.env[name]?.trim() || fallback;

/** Raíz del repositorio (funciona tanto desde src/ con tsx como desde dist/). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const config = {
  port: Number(env("PORT", "8787")),
  publicBaseUrl: env("PUBLIC_BASE_URL", "http://localhost:8787").replace(/\/$/, ""),
  /** Si es true, no se escribe nada en Jira ni en Trello. */
  dryRun: env("DRY_RUN", "true") !== "false",

  provider: (() => {
    const explicit = env("LLM_PROVIDER");
    if (explicit === "mock") return "mock";
    if (explicit === "anthropic" && env("ANTHROPIC_API_KEY")) return "anthropic";
    if (explicit === "gemini" && (env("GEMINI_API_KEY") || env("GOOGLE_API_KEY"))) return "gemini";
    if (env("GEMINI_API_KEY") || env("GOOGLE_API_KEY")) return "gemini";
    if (env("ANTHROPIC_API_KEY")) return "anthropic";
    return "mock";
  })() as "gemini" | "anthropic" | "mock",
  anthropicApiKey: env("ANTHROPIC_API_KEY"),
  model: env("CLAUDE_MODEL", "claude-3-5-sonnet-20241022"),
  geminiApiKey: env("GEMINI_API_KEY") || env("GOOGLE_API_KEY"),
  geminiModel: env("GEMINI_MODEL", "gemini-3.5-flash-lite"),

  jira: {
    baseUrl: env("JIRA_BASE_URL").replace(/\/$/, ""),
    email: env("JIRA_EMAIL"),
    apiToken: env("JIRA_API_TOKEN"),
    webhookToken: env("JIRA_WEBHOOK_TOKEN"),
    triggerLabel: env("JIRA_TRIGGER_LABEL", "diseño"),
    transitionReviewId: env("JIRA_TRANSITION_REVIEW_ID"),
    transitionDevId: env("JIRA_TRANSITION_DEV_ID"),
  },

  trello: {
    apiKey: env("TRELLO_API_KEY"),
    token: env("TRELLO_TOKEN"),
    appSecret: env("TRELLO_APP_SECRET"),
    triggerListName: env("TRELLO_TRIGGER_LIST_NAME", "Diseño · Nuevo"),
    reviewListId: env("TRELLO_REVIEW_LIST_ID"),
    devListId: env("TRELLO_DEV_LIST_ID"),
  },

  figma: {
    accessToken: env("FIGMA_ACCESS_TOKEN"),
    fileKey: env("FIGMA_FILE_KEY", "dcKVRyGjsYiK3Cl1iBHeXc"),
    fileUrl: env("FIGMA_FILE_URL", "https://www.figma.com/design/dcKVRyGjsYiK3Cl1iBHeXc/Untitled?node-id=0-1"),
  },

  paths: {
    prompts: path.join(ROOT, "agents", "prompts"),
    designSystem: path.join(ROOT, "design-system"),
    output: path.join(ROOT, "output"),
  },
};

/** Marca con la que empiezan los comentarios de los agentes (para no responderse a sí mismos). */
export const BOT_MARK = "🤖";
