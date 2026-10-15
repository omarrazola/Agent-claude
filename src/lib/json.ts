/**
 * Extrae un objeto JSON de la respuesta de un agente.
 * Acepta JSON puro, un bloque ```json ... ``` o el texto entre la primera { y la última }.
 */
export function extractJson<T = Record<string, unknown>>(text: string): T {
  const attempts: string[] = [text.trim()];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) attempts.push(fence[1].trim());
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) attempts.push(text.slice(first, last + 1));

  for (const candidate of attempts) {
    try {
      const value = JSON.parse(candidate);
      if (value && typeof value === "object") return value as T;
    } catch {
      // probamos el siguiente formato
    }
  }
  throw new Error("La respuesta del agente no contiene JSON válido.");
}

/** Convierte el formato de documento de Atlassian (ADF) o un string en texto plano. */
export function adfToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(adfToText).join("");
  if (typeof value === "object") {
    const node = value as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text") return node.text ?? "";
    const inner = adfToText(node.content ?? []);
    const block = ["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(node.type ?? "");
    const bullet = node.type === "listItem" ? "- " : "";
    return block ? `${bullet}${inner.trim()}\n` : inner;
  }
  return "";
}
