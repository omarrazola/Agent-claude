import { config } from "../config.js";

const API = "https://api.trello.com/1";

function withAuth(url: URL): URL {
  if (!config.trello.apiKey || !config.trello.token) {
    throw new Error("Faltan TRELLO_API_KEY o TRELLO_TOKEN en .env");
  }
  url.searchParams.set("key", config.trello.apiKey);
  url.searchParams.set("token", config.trello.token);
  return url;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  shortLink: string;
  url: string;
  labels: { name: string }[];
  attachments?: { name: string }[];
}

export async function getTrelloCard(cardId: string): Promise<TrelloCard> {
  const url = withAuth(new URL(`${API}/cards/${cardId}`));
  url.searchParams.set("fields", "name,desc,shortLink,url,labels");
  url.searchParams.set("attachments", "true");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Trello respondió ${res.status}: ${await res.text()}`);
  return (await res.json()) as TrelloCard;
}

export async function addTrelloComment(cardId: string, text: string): Promise<void> {
  const url = withAuth(new URL(`${API}/cards/${cardId}/actions/comments`));
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Trello respondió ${res.status}: ${await res.text()}`);
}

export async function moveTrelloCard(cardId: string, listId: string): Promise<void> {
  if (!listId) return;
  const url = withAuth(new URL(`${API}/cards/${cardId}`));
  url.searchParams.set("idList", listId);
  const res = await fetch(url, { method: "PUT" });
  if (!res.ok) throw new Error(`Trello respondió ${res.status}: ${await res.text()}`);
}
