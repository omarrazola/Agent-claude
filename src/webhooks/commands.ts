import { BOT_MARK } from "../config.js";

export type Command = { type: "changes"; request: string } | { type: "approve" } | null;

/**
 * Lee los comandos que la diseñadora escribe en un comentario del ticket:
 *   /agentes cambios: <lo que quiere cambiar>
 *   /agentes aprobar
 * Ignora los comentarios de los propios agentes.
 */
export function parseCommand(text: string): Command {
  const clean = text.trim();
  if (!clean || clean.startsWith(BOT_MARK)) return null;

  const changes = clean.match(/^\/agentes\s+cambios\s*:?\s*([\s\S]+)$/i);
  if (changes && changes[1].trim()) return { type: "changes", request: changes[1].trim() };

  if (/^\/agentes\s+aprobar\b/i.test(clean)) return { type: "approve" };
  return null;
}
