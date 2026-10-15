import { config } from "../config.js";
import { log } from "../lib/logger.js";
import type { RunState } from "../types.js";
import { addJiraComment, transitionJiraIssue } from "./jira.js";
import { addTrelloComment, moveTrelloCard } from "./trello.js";

/**
 * Punto único para escribir en la herramienta de origen.
 * En DRY_RUN imprime lo que haría en lugar de llamar a Jira o Trello.
 */
export const tracker = {
  async comment(run: RunState, text: string): Promise<void> {
    if (config.dryRun) {
      log.info(`[DRY_RUN] Comentario en ${run.ticket.source} ${run.key}:\n${"-".repeat(60)}\n${text}\n${"-".repeat(60)}`);
      return;
    }
    if (run.ticket.source === "jira") await addJiraComment(run.ticket.externalId, text);
    else await addTrelloComment(run.ticket.externalId, text);
  },

  async moveToReview(run: RunState): Promise<void> {
    if (config.dryRun) return log.info(`[DRY_RUN] ${run.key} → Revisión diseño`);
    if (run.ticket.source === "jira") await transitionJiraIssue(run.ticket.externalId, config.jira.transitionReviewId);
    else await moveTrelloCard(run.ticket.externalId, config.trello.reviewListId);
  },

  async moveToDev(run: RunState): Promise<void> {
    if (config.dryRun) return log.info(`[DRY_RUN] ${run.key} → Listo para desarrollo`);
    if (run.ticket.source === "jira") await transitionJiraIssue(run.ticket.externalId, config.jira.transitionDevId);
    else await moveTrelloCard(run.ticket.externalId, config.trello.devListId);
  },
};
