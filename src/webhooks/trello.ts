import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { config } from "../config.js";
import { getTrelloCard } from "../integrations/trello.js";
import { log } from "../lib/logger.js";
import { approve, iterate, startRun } from "../pipeline/orchestrator.js";
import type { Ticket } from "../types.js";
import { parseCommand } from "./commands.js";

interface TrelloAction {
  type?: string;
  data?: {
    text?: string;
    card?: { id: string; name?: string; shortLink?: string; desc?: string };
    list?: { name?: string };
    listAfter?: { name?: string };
  };
  memberCreator?: { fullName?: string };
}

export const trelloKey = (shortLink: string) => `TR-${shortLink}`;

/** Ticket a partir de la acción. Si hay credenciales, completa la descripción leyendo la tarjeta. */
export async function normalizeTrelloAction(action: TrelloAction): Promise<Ticket | null> {
  const card = action.data?.card;
  if (!card?.id) return null;
  const base: Ticket = {
    source: "trello",
    key: trelloKey(card.shortLink ?? card.id.slice(-8)),
    externalId: card.id,
    title: card.name ?? "(sin título)",
    description: card.desc ?? "",
    labels: [],
    reporter: action.memberCreator?.fullName,
    attachments: [],
  };
  if (!config.trello.apiKey || !config.trello.token) return base;
  try {
    const full = await getTrelloCard(card.id);
    return {
      ...base,
      key: trelloKey(full.shortLink),
      title: full.name,
      description: full.desc,
      labels: full.labels.map((l) => l.name).filter(Boolean),
      url: full.url,
      attachments: (full.attachments ?? []).map((a) => a.name),
    };
  } catch (err) {
    log.warn("No se pudo leer la tarjeta de Trello; se usa la información del webhook.", err);
    return base;
  }
}

const isTriggerList = (name?: string) => !!name && name.trim() === config.trello.triggerListName;

export async function handleTrelloAction(action: TrelloAction): Promise<string> {
  const card = action.data?.card;
  if (!card?.id) return "sin tarjeta";

  const enteredTrigger =
    (action.type === "createCard" && isTriggerList(action.data?.list?.name)) ||
    (action.type === "updateCard" && isTriggerList(action.data?.listAfter?.name));

  if (enteredTrigger) {
    const ticket = await normalizeTrelloAction(action);
    if (!ticket) return "tarjeta no válida";
    await startRun(ticket);
    return "ejecución iniciada";
  }

  if (action.type === "commentCard") {
    const cmd = parseCommand(action.data?.text ?? "");
    if (!cmd) return "comentario sin comando";
    const key = trelloKey(card.shortLink ?? card.id.slice(-8));
    if (cmd.type === "changes") await iterate(key, cmd.request);
    else await approve(key);
    return `comando: ${cmd.type}`;
  }

  return `acción ignorada: ${action.type}`;
}

/** Firma de Trello: base64(HMAC-SHA1(secreto, cuerpo + URL de callback)). */
function validSignature(req: Request): boolean {
  if (!config.trello.appSecret) return true; // sin secreto configurado (solo para pruebas locales)
  const header = req.header("x-trello-webhook") ?? "";
  const raw = (req as Request & { rawBody?: string }).rawBody ?? "";
  const callbackUrl = `${config.publicBaseUrl}/webhooks/trello`;
  const expected = createHmac("sha1", config.trello.appSecret).update(raw + callbackUrl).digest("base64");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function trelloWebhook(req: Request, res: Response): void {
  if (!validSignature(req)) {
    res.status(401).json({ error: "firma no válida" });
    return;
  }
  res.status(202).json({ ok: true });
  const action = (req.body as { action?: TrelloAction }).action ?? {};
  handleTrelloAction(action)
    .then((result) => log.info(`Trello: ${result}`))
    .catch((err) => log.error("Trello: error procesando la acción", err));
}
