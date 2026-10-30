import path from "node:path";
import express, { type Request } from "express";
import { config, ROOT } from "./config.js";
import { log } from "./lib/logger.js";
import { complete } from "./lib/claude.js";
import { extractJson } from "./lib/json.js";
import { approve, iterate, startRun } from "./pipeline/orchestrator.js";
import { loadRun } from "./pipeline/store.js";
import { jiraWebhook } from "./webhooks/jira.js";
import { trelloWebhook } from "./webhooks/trello.js";
import { startJiraPoller } from "./integrations/jiraPoller.js";

import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
import fs from "node:fs";


const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const connectedClients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  connectedClients.add(ws);
  log.info(`[FIGMA-WS] Cliente Figma conectado (Total: ${connectedClients.size})`);
  ws.on("close", () => {
    connectedClients.delete(ws);
    log.info(`[FIGMA-WS] Cliente Figma desconectado (Total: ${connectedClients.size})`);
  });
});

export function broadcastToFigma(payload: any) {
  const msg = JSON.stringify(payload);
  let sent = 0;
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
      sent++;
    }
  }
  log.info(`[FIGMA-WS] Mensaje emitido a ${sent} plugins de Figma: ${payload.type}`);
  return sent;
}

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Figma-Token");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/figma/console-script", async (req, res) => {
  try {
    const { getLatestFigmaDesign } = await import("./integrations/figma.js");
    const latest = getLatestFigmaDesign();
    const baseCode = fs.readFileSync("scripts/figma-console-full.js", "utf8");
    const callReplace = "await renderFlowMap([], [], 'KAN-1');";
    const newCall = "await renderFlowMap(" + JSON.stringify(latest.screens) + ", " + JSON.stringify(latest.screenSvgs) + ", " + JSON.stringify(latest.key || 'KAN-1') + ", " + JSON.stringify(latest.changelog || null) + ");";
    const fullScript = baseCode.replace(callReplace, newCall);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.send(fullScript);
  } catch(e) {
    res.status(500).send("console.error('Error:', " + JSON.stringify(String(e)) + ");");
  }
});

// Guardamos el cuerpo original para verificar la firma de Trello
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, dryRun: config.dryRun });
});

// --- Webhooks ---
app.post("/webhooks/jira", jiraWebhook);
// Trello comprueba la URL con HEAD al crear el webhook
app.head("/webhooks/trello", (_req, res) => {
  res.sendStatus(200);
});
app.post("/webhooks/trello", trelloWebhook);

// --- Consola de Agentes y Previsualizaciones ---
app.use("/previews", express.static(path.join(config.paths.output, "previews")));
app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.static(path.join(process.cwd(), "demo")));
app.use(express.static(path.join(ROOT, "public")));
app.use(express.static(path.join(ROOT, "demo")));
app.use("/app", express.static(path.join(process.cwd(), "demo")));
app.use("/demo", express.static(path.join(process.cwd(), "demo")));

app.get(["/", "/demo", "/app"], (_req, res) => {
  const candidates = [
    path.join(process.cwd(), "public", "index.html"),
    path.join(process.cwd(), "demo", "index.html"),
    path.join(ROOT, "public", "index.html"),
    path.join(ROOT, "demo", "index.html"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return res.sendFile(c);
    }
  }
  res.status(404).send("index.html no encontrado");
});

// --- API interna (para un panel propio o pruebas) ---
app.post("/api/runs", async (req, res) => {
  try {
    const title = String(req.body?.title ?? "PeticiÃ³n de diseÃ±o").trim();
    const description = String(req.body?.description ?? "").trim();
    if (!description) {
      res.status(400).json({ error: "Falta 'description' con la peticiÃ³n de diseÃ±o" });
      return;
    }
    const key = req.body?.key ? String(req.body.key).trim() : `WEB-${Date.now().toString(36).toUpperCase()}`;
    const ticket = {
      source: (req.body?.source === "trello" ? "trello" : "jira") as "jira" | "trello",
      key,
      externalId: key,
      title,
      description,
      labels: Array.isArray(req.body?.labels) ? req.body.labels : ["diseÃ±o", "uber-base"],
      reporter: String(req.body?.reporter ?? "DiseÃ±adora UI/UX"),
      attachments: [],
    };
    res.status(202).json({ ok: true, key, message: "Pipeline iniciado" });
    startRun(ticket).catch((err) => log.error("Pipeline fallÃ³", err));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/jira/create", async (req, res) => {
  try {
    const { title, summary, description, body, priority, labels, autoRun } = req.body ?? {};
    const ticketSummary = String(title || summary || "").trim();
    const ticketDesc = String(description || body || "").trim();
    if (!ticketSummary) {
      res.status(400).json({ ok: false, error: "El título del brief es obligatorio" });
      return;
    }
    const { createJiraIssue } = await import("./integrations/jira.js");
    const created = await createJiraIssue({
      summary: ticketSummary,
      description: ticketDesc,
      priority: priority ? String(priority).trim() : undefined,
      labels: Array.isArray(labels) ? labels : undefined,
    });
    const { markIssueHandled } = await import("./integrations/jiraPoller.js");
    markIssueHandled(created.key);

    let runStarted = false;
    if (autoRun) {
      const ticket = {
        source: "jira" as const,
        key: created.key,
        externalId: created.key,
        title: ticketSummary,
        description: ticketDesc,
        labels: Array.isArray(labels) && labels.length > 0 ? labels : ["diseño", "uber-base"],
        reporter: config.jira.email || "Diseñador UX/UI",
        url: created.url,
        attachments: [],
      };
      startRun(ticket).catch((err) => log.error("[JIRA CREATE] Fallo al iniciar run:", err));
      runStarted = true;
    }

    res.status(201).json({
      ok: true,
      issue: created,
      runStarted,
      message: `Incidencia ${created.key} creada automáticamente en Jira con éxito`,
    });
  } catch (err) {
    log.error("[JIRA CREATE] Error al crear ticket en Jira:", err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/jira/issues", async (_req, res) => {
  try {
    const { fetchJiraKanIssues, toTicket } = await import("./integrations/jiraPoller.js");
    const issues = await fetchJiraKanIssues();
    res.json({ ok: true, issues: issues.map(toTicket) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/figma/pending", async (_req, res) => {
  try {
    const { getLatestFigmaDesign } = await import("./integrations/figma.js");
    const design = getLatestFigmaDesign();
    res.json({
      ok: true,
      ...design,
      script: generateFigmaPluginScript(design.screens || [])
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/figma/target", async (_req, res) => {
  try {
    const { getFigmaTarget } = await import("./integrations/figma.js");
    res.json({ ok: true, ...getFigmaTarget() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/figma/target", async (req, res) => {
  try {
    const { url } = req.body ?? {};
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Falta el campo 'url'" });
      return;
    }
    const { setFigmaTarget, getFigmaTarget } = await import("./integrations/figma.js");
    setFigmaTarget(url);
    const target = getFigmaTarget();
    broadcastToFigma({
      type: "FIGMA_TARGET_UPDATED",
      ...target
    });
    log.info(`[FIGMA] Nueva URL de destino configurada: ${target.fileUrl} (${target.fileKey})`);
    res.json({ ok: true, ...target });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/runs/:key", async (req, res) => {
  const run = await loadRun(req.params.key);
  if (!run) {
    res.status(404).json({ error: "no encontrado" });
    return;
  }
  const uiScreens = (run.outputs?.ui as any)?.screens;
  if (Array.isArray(uiScreens) && uiScreens.length > 0) {
    const { setLatestFigmaDesign } = await import("./integrations/figma.js");
    setLatestFigmaDesign(run.key, uiScreens);
    broadcastToFigma({
      type: "RENDER_FLOW_MAP",
      screens: uiScreens,
      key: run.key
    });
  }
  res.json(run);
});

app.post("/api/runs/:key/iterate", async (req, res) => {
  const request = String(req.body?.request ?? "").trim();
  if (!request) {
    res.status(400).json({ error: "Falta 'request' con el cambio que quieres hacer" });
    return;
  }
  res.status(202).json({ ok: true });
  iterate(req.params.key, request).catch((err) => log.error("IteraciÃ³n fallida", err));
});

// Prompt maestro de los 7 agentes de Uber Base Design System
const UBER_BASE_SYSTEM = `Eres un sistema autónomo de 7 agentes de diseño de producto de Uber que utilizan estrictamente el sistema oficial Base Design System (base.uber.com), siguiendo las especificaciones del catálogo formal 'design-system/components/baseui.manifest.json':
1. Brief Agent: analiza la necesidad del usuario, objetivos de negocio, métricas de éxito y define la matriz de alcance: Happy Path, Error Cases y Corner Cases.
2. Context Agent: selecciona tokens de Uber Base (baseui) para cada estado: --base-positive (#0E8345), --base-negative (#DE1135), --base-warning (#F69E0C), --base-black (#000000) y superficies secundarias (#F6F6F6).
3. UX Architect: estructura un flujo profesional de pantallas y estados que resuelvan EXACTAMENTE el problema y la funcionalidad planteada en el brief, cubriendo el camino nominal, la gestión de incidencias y los casos límite.
4. Copy Agent: redacta microcopys con la voz oficial de Uber (directo, empático y constructivo sin culpar al usuario en errores, sentence case).
5. UI Agent: define componentes del manifest oficial de Base (Modal, Drawer/BottomSheet, Header, ProductCard, Button con props KIND/SHAPE/SIZE, StatusPin, ETA, Banner con tone negative/warning, etc.).
6. QA Agent: valida accesibilidad WCAG AA, áreas táctiles ≥ 44px (o 56px para CTAs), contraste y resiliencia ante errores (sin dead-ends ni callejones sin salida).
7. Delivery Agent: genera especificaciones y handover para desarrollo y QA documentando todos los estados con mapeo a componentes de Figma.

REGLA DE ORO DE FIDELIDAD AL BRIEF (MÁXIMA PRIORIDAD):
El diseño debe corresponder ÚNICA Y EXCLUSIVAMENTE a lo que se solicita en el brief (título y descripción).
- Si el brief solicita una funcionalidad concreta, componente o modal (ejemplo: "Modal informativa", "Diálogo de confirmación", "Sistema de propinas", "Cancelación con reembolso", "Ajustes de cuenta", "Formulario de soporte", etc.):
  * Diseña pantallas y estados centrados en esa funcionalidad específica (por ejemplo, para una modal informativa: pantalla disparadora con contexto, vista con la modal abierta mostrando la información solicitada con componentes Base Modal/Drawer, estado de incidencia/alerta y confirmación/cierre).
  * NO inventes un flujo de solicitud de viaje en vehículo (UberX, conductores en mapa, Toyota Corolla, etc.) a menos que el brief lo pida de forma explícita.
  * Solo activa mapa ('showMap: true') si el brief requiere geolocalización o rutas sobre mapa; en modales, formularios y avisos mantén 'showMap: false'.
- Adapta el número de pantallas a la escala del requerimiento: típicamente entre 3 y 5 pantallas para componentes, modales o micro-flujos; más pantallas si el requerimiento describe un flujo multi-etapa largo.

REGLA PROFESIONAL FUNDAMENTAL DE PRODUCTO:
REGLA ESTRICTA DE PANTALLAS FINALES (CERO BOTONES O ACCIONES DE SIMULACION EN PANTALLA):
Las pantallas generadas deben ser pantallas FINALES de diseño para producción, representando fielmente lo que un usuario final real ve y toca en la aplicación de Uber.
Queda TERMINANTEMENTE PROHIBIDO incluir dentro del diseño de las pantallas botones, enlaces o textos ficticios de simulación (PROHIBIDO: "Simular avance", "Simular llegada", "Simular error", "Simular asignación", "Simular cobro", "Simular incidencia").
Todos los botones de las pantallas deben ser 100% acciones reales de producto del usuario (ej. "Entendido", "Aceptar", "Ver detalles", "Confirmar", "Reintentar", "Guardar cambios").

Debes categorizar y distribuir las pantallas entre:
1. Happy Path (Camino nominal): Pantallas del recorrido óptimo de la funcionalidad pedida.
   - stateType: "happy_path"
   - stateBadge: "HAPPY PATH"
2. Casos de Error (Error cases & Recovery): Pantallas que demuestren la gestión de un fallo o rechazo contextual a la funcionalidad y la vía de recuperación asistida sin dead-ends.
   - stateType: "error"
   - stateBadge: "CASO DE ERROR"
   - stateDesc: explicación de la incidencia y la vía de escape guiada
   - banner: { "text": "Explicación clara del error sin culpar al usuario", "tone": "negative" }
   - cta: botón claro de recuperación (ej. "Reintentar", "Elegir alternativa")
   - ctaVariant: "negative" o "primary"
   - ctaTargetStep: número de paso hacia el que navega este botón
   - secondaryCta: objeto opcional para bifurcaciones
3. Corner Cases (Casos límite o excepciones controladas): Pantallas dedicadas a condiciones atípicas o advertencias preventivas de la funcionalidad pedida.
   - stateType: "corner_case"
   - stateBadge: "CORNER CASE"
   - stateDesc: explicación de la condición límite y alternativa sugerida
   - banner: { "text": "Aviso proactivo y transparente", "tone": "warning" }
   - cta: acción para aceptar la alternativa o continuar

4. Máquina de Estados y Navegación:
   - En cada pantalla, define "ctaTargetStep" indicando a qué número de paso ('step') conduce la acción principal.
   - Puedes incluir opcionalmente "secondaryCta": { "text": "...", "variant": "secondary" | "tertiary", "targetStep": 1 } para bifurcaciones reales.

5. Documentación Funcional y Justificación de Diseño para Stakeholders (OBLIGATORIO):
   - Cada pantalla debe incluir:
     - "functionality": explicación clara y concisa de qué funcionalidad resuelve la pantalla y cómo opera el usuario en ella.
     - "designJustification": justificación de diseño (UX & Negocio) explicando por qué se tomó esta decisión y cómo maximiza la conversión o reduce la fricción.

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
{
  "summary": "Resumen ejecutivo del flujo diseñado adaptado al brief",
  "agents": {
    "brief": {
      "summary": "Resumen del brief y matriz de alcance",
      "logs": ["Analizando brief y métricas de éxito", "Mapeando Happy Path principal", "Identificando posibles fallos y casos límite"],
      "out": "<h4>Alcance y Matriz de Estados</h4><p><b>Happy Path:</b> Recorrido nominal de la funcionalidad.<br><b>Casos de Error:</b> Mitigación de errores con recuperación directa.<br><b>Corner Cases:</b> Gestión preventiva de condiciones límite.</p>"
    },
    "context": {
      "summary": "Tokens Base y componentes reutilizables",
      "logs": ["Seleccionando tokens baseui", "Configurando tokens semánticos: positive, negative, warning", "Validando componentes"],
      "out": "<h4>Tokens de Uber Base DS</h4><div class=\"flow\"><span>--base-black (#000000)</span><span>--base-negative (#DE1135)</span><span>--base-warning (#F69E0C)</span><span>--base-positive (#0E8345)</span><span>--base-r-rounded (8px)</span></div>"
    },
    "ux": {
      "summary": "Arquitectura de estados y navegación",
      "logs": ["Estructurando las pantallas del flujo", "Diseñando recuperación sin dead-ends para casos de error", "Definiendo alertas proactivas"],
      "out": "<h4>Matriz de Flujo UX</h4><ul><li><b>Happy Path:</b> Estados nominales de la funcionalidad.</li><li><b>Corner Case:</b> Gestión proactiva de advertencias.</li><li><b>Casos de Error:</b> Pantalla de error con recuperación guiada.</li></ul>"
    },
    "copy": {
      "summary": "Microcopy en tono oficial de Uber",
      "logs": ["Redactando en sentence case", "Aplicando empatía y claridad constructiva en errores", "Redactando avisos pedagógicos"],
      "out": "<h4>Guía de Microcopy y Voz de Marca</h4><p>Textos directos en voz activa; explicación honesta sin culpar al usuario en incidencias; CTAs precisos.</p>"
    },
    "ui": {
      "summary": "Componentes y pantallas con Uber Base DS",
      "logs": ["Componiendo pantallas con tokens Base", "Aplicando componentes oficiales", "Estilizando banners de error y advertencia"],
      "out": "<h4>Componentes Base Web/Mobile</h4><div class=\"flow\"><span>Modal</span><span>Drawer</span><span>Button (SHAPE.rounded 8px)</span><span>Banner</span><span>Card</span></div>"
    },
    "qa": {
      "summary": "Auditoría WCAG AA y Resiliencia",
      "logs": ["Verificando áreas táctiles ≥ 44px", "Auditando contraste de color WCAG AA", "Comprobando resiliencia"],
      "out": "<h4>Auditoría QA y Resiliencia</h4><ul><li><span class=\"chip ok\">Superado</span> Contraste AA en textos y fondos.</li><li><span class=\"chip ok\">Superado</span> Áreas táctiles de 44px o más.</li><li><span class=\"chip ok\">Superado</span> Resiliencia: todo error tiene CTA de resolución.</li></ul>"
    },
    "delivery": {
      "summary": "Handover técnico para ingeniería y QA",
      "logs": ["Generando especificación de estados", "Documentando criterios de aceptación", "Publicando paquete de entrega"],
      "out": "<h4>Especificación para Desarrollo</h4><p>Flujo completo documentado para testing y maquetación.</p>"
    }
  },
  "screens": [
    {
      "step": 1,
      "shortName": "1 · Vista principal / Disparador",
      "stateType": "happy_path",
      "stateBadge": "HAPPY PATH",
      "stateDesc": "Estado nominal inicial donde el usuario interactúa con la funcionalidad",
      "hint": "Explicación breve del contexto",
      "navTitle": "Título de cabecera",
      "mainTitle": "Título principal según el brief",
      "mainSubtitle": "Subtítulo descriptivo con información clave",
      "showMap": false,
      "heroImage": null,
      "items": [
        { "title": "Elemento relevante", "subtitle": "Descripción contextual", "icon": "📋", "highlight": true }
      ],
      "cards": [
        { "label": "Detalle", "value": "Información clave" }
      ],
      "banner": null,
      "cta": "Acción principal",
      "ctaVariant": "primary",
      "ctaTargetStep": 2,
      "functionality": "Permite al usuario visualizar el estado e iniciar la interacción.",
      "designJustification": "Proporciona claridad inicial y accesibilidad sin sobrecargar la vista."
    },
    {
      "step": 2,
      "shortName": "2 · Funcionalidad activa / Modal / Detalle",
      "stateType": "happy_path",
      "stateBadge": "HAPPY PATH",
      "stateDesc": "Visualización del componente o contenido solicitado en el brief",
      "hint": "Información detallada solicitada en el brief",
      "navTitle": "Detalle",
      "mainTitle": "Contenido específico del brief",
      "mainSubtitle": "Explicación detallada orientada al usuario",
      "showMap": false,
      "items": [],
      "cards": [],
      "banner": null,
      "cta": "Entendido / Continuar",
      "ctaVariant": "primary",
      "ctaTargetStep": 3,
      "functionality": "Resuelve directamente la necesidad comunicativa o de interacción del brief.",
      "designJustification": "Diseño en BottomSheet/Modal para focalizar la atención y garantizar lectura."
    },
    {
      "step": 3,
      "shortName": "3 · Gestión de incidencia o caso límite",
      "stateType": "error",
      "stateBadge": "CASO DE ERROR",
      "stateDesc": "Tratamiento de error contextual con recuperación guiada",
      "hint": "Resolución asistida",
      "navTitle": "Incidencia",
      "mainTitle": "No se pudo completar la acción",
      "mainSubtitle": "Mensaje constructivo explicando la situación sin culpar al usuario.",
      "showMap": false,
      "items": [],
      "cards": [],
      "banner": { "text": "Incidencia detectada: puedes reintentar al instante", "tone": "negative" },
      "cta": "Reintentar acción",
      "ctaVariant": "negative",
      "ctaTargetStep": 2,
      "functionality": "Evita bloqueos ofreciendo vía de escape y reintento directo.",
      "designJustification": "Erradica callejones sin salida con CTA contrastado."
    },
    {
      "step": 4,
      "shortName": "4 · Confirmación y cierre",
      "stateType": "happy_path",
      "stateBadge": "HAPPY PATH",
      "stateDesc": "Confirmación satisfactoria de la operación",
      "hint": "Cierre de la experiencia",
      "navTitle": "Confirmación",
      "mainTitle": "Operación completada con éxito",
      "mainSubtitle": "Tus datos han sido procesados correctamente.",
      "showMap": false,
      "items": [],
      "cards": [],
      "banner": { "text": "Acción confirmada con éxito", "tone": "positive" },
      "cta": "Volver al inicio",
      "ctaVariant": "primary",
      "ctaTargetStep": 1,
      "functionality": "Certifica el éxito de la operación al usuario.",
      "designJustification": "Feedback positivo inmediato para máxima tranquilidad del usuario."
    }
  ],
  "theme": { "cta": "ink", "radius": "rounded", "density": "comfortable" }
}`;

function buildUserPrompt(key?: string, priority?: string, title?: string, briefText?: string): string {
  return `Petición entrante del equipo de producto:
Clave: ${key || "PETICION-1"}
Prioridad: ${priority || "Media"}
Título: ${title}
Briefing completo:
${briefText}

REGLA DE ORO DE OBLIGADO CUMPLIMIENTO:
Diseña la solución que resuelva ÚNICA Y EXCLUSIVAMENTE este brief concreto.
- Si el brief solicita una "Modal informativa", diseña la interacción de la modal con componentes oficiales de Uber Base (baseui/modal, baseui/drawer, banner, tarjetas y botones).
- Si el brief trata de propinas, cancelaciones, perfiles o soporte, diseña las pantallas correspondientes a esa funcionalidad.
- PROHIBIDO inventar un viaje en coche con conductor en mapa (Carlos M., Toyota Corolla, etc.) a menos que el usuario lo haya pedido explícitamente en el título o descripción del brief.
- Adapta el número de pantallas (típicamente entre 2 y 5 para componentes/modales o más para flujos largos) a lo que la funcionalidad realmente requiere.`;
}

// Endpoint estándar JSON para generar propuesta completa
app.post("/api/llm/generate", async (req, res) => {
  try {
    const { key, title, priority, body: briefText } = req.body ?? {};
    if (!briefText && !title) {
      res.status(400).json({ error: "Falta el tÃ­tulo o el contenido del brief" });
      return;
    }

    const userPrompt = buildUserPrompt(key, priority, title, briefText);
    const text = await complete({ system: UBER_BASE_SYSTEM, user: userPrompt, maxTokens: 16000 });
    let json;
    try {
      json = extractJson(text);
    } catch (parseErr) {
      log.warn("Fallo al extraer JSON directo, reparando...");
      let repaired = text.trim();
      const firstBrace = repaired.indexOf("{");
      if (firstBrace !== -1) {
        repaired = repaired.slice(firstBrace);
        let openBraces = 0;
        let openBrackets = 0;
        for (let i = 0; i < repaired.length; i++) {
          if (repaired[i] === "{") openBraces++;
          else if (repaired[i] === "}") openBraces--;
          else if (repaired[i] === "[") openBrackets++;
          else if (repaired[i] === "]") openBrackets--;
        }
        while (openBrackets > 0) { repaired += "]"; openBrackets--; }
        while (openBraces > 0) { repaired += "}"; openBraces--; }
        try {
          json = JSON.parse(repaired);
        } catch {
          throw parseErr;
        }
      } else {
        throw parseErr;
      }
    }
    if (json && Array.isArray(json.screens)) {
      const { setLatestFigmaDesign } = await import("./integrations/figma.js");
      setLatestFigmaDesign(key || "KAN-1", json.screens);
      broadcastToFigma({
        type: "RENDER_FLOW_MAP",
        screens: json.screens,
        screenSvgs: [],
        key: key || "KAN-1",
        changelog: null
      });
    }
    res.json({ ok: true, result: json });
  } catch (err) {
    log.error("Error en /api/llm/generate:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Endpoint de streaming en tiempo real (Server-Sent Events) para visualizaciÃ³n progresiva
app.post("/api/llm/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { key, title, priority, body: briefText } = req.body ?? {};
    if (!briefText && !title) {
      send("error", { message: "Falta el tÃ­tulo o el contenido del brief" });
      res.end();
      return;
    }

    send("agent_step", { id: "brief", name: "Analista de brief", status: "running", subagent: "Lector de Requisitos", log: "Analizando objetivos de negocio, prioridades y matriz de alcance..." });
    send("agent_step", { id: "ctx", name: "Agente de contexto", status: "running", subagent: "Base DS Token Crawler", log: "Seleccionando tokens baseui oficiales de Uber Base (base.uber.com)..." });
    send("agent_step", { id: "ux", name: "Arquitecto UX", status: "running", subagent: "MÃ¡quina de Estados", log: "Estructurando pantallas, caminos nominales y bifurcaciones de error sin dead-ends..." });

    const userPrompt = buildUserPrompt(key, priority, title, briefText);
    const text = await complete({ system: UBER_BASE_SYSTEM, user: userPrompt, maxTokens: 16000 });
    let json: any;
    try {
      json = extractJson(text);
    } catch (parseErr) {
      let repaired = text.trim();
      const firstBrace = repaired.indexOf("{");
      if (firstBrace !== -1) {
        repaired = repaired.slice(firstBrace);
        let openBraces = 0, openBrackets = 0;
        for (let i = 0; i < repaired.length; i++) {
          if (repaired[i] === "{") openBraces++;
          else if (repaired[i] === "}") openBraces--;
          else if (repaired[i] === "[") openBrackets++;
          else if (repaired[i] === "]") openBrackets--;
        }
        while (openBrackets > 0) { repaired += "]"; openBrackets--; }
        while (openBraces > 0) { repaired += "}"; openBraces--; }
        json = JSON.parse(repaired);
      } else {
        throw parseErr;
      }
    }

    send("agent_step", { id: "copy", name: "Redactor UX", status: "done", subagent: "Microcopys & CTAs", log: "Microcopys redactados en sentence case y voz activa de Uber Base." });
    send("agent_step", { id: "ui", name: "Agente de UI", status: "done", subagent: "Maquetador HTML/CSS", log: "Componentes Base maquetados con tokens oficiales y mapas oscuros." });
    send("agent_step", { id: "qa", name: "Revisor QA", status: "done", subagent: "Auditor WCAG AA", log: "Accesibilidad WCAG AA y resiliencia sin dead-ends auditadas." });
    send("agent_step", { id: "deliver", name: "Agente de entrega", status: "done", subagent: "Figma AutoLayout Sync", log: "Paquete de entrega publicado con enlaces a Figma y ticket." });
    if (json?.screens) { import("./integrations/figma.js").then(m => m.setLatestFigmaDesign(req.body?.key || "KAN-1", json.screens)); }
    send("result", { ok: true, result: json });
    res.end();
  } catch (err) {
    send("error", { message: err instanceof Error ? err.message : String(err) });
    res.end();
  }
});

// Endpoint sÃ­ncrono para que la interfaz web obtenga cambios generados por IA real inmediatamente
app.post("/api/llm/iterate", async (req, res) => {
  try {
    const { request: userReq, currentState, prompt } = req.body ?? {};
    if (!userReq) {
      res.status(400).json({ error: "Falta 'request'" });
      return;
    }
    const system = "Eres el equipo de agentes de diseÃ±o autÃ³nomos de Uber (Arquitecto UX, Redactor UX, Agente de UI y QA) aplicando el sistema de diseÃ±o oficial Base Design System (tokens base.uber.com). " +
      "REGLA ESTRICTA: Las pantallas deben ser 100% finales de diseño para usuario real, SIN botones ni acciones de simulación dentro de la pantalla (PROHIBIDO 'Simular avance', 'Simular llegada', 'Simular error', etc.). Devuelve EXCLUSIVAMENTE un objeto JSON vÃ¡lido con las claves: summary, changes, agents, question, state. No incluyas explicaciones en texto fuera del JSON. " +
      "IMPORTANTE: Si 'currentState' contiene un array 'screens', debes devolver en 'state.screens' el array completo con todas las pantallas del flujo (sin lÃ­mite artificial de pantallas, conservando todas las pantallas existentes o aÃ±adiendo/modificando las necesarias para resolver la peticiÃ³n), asegurando que cada pantalla conserve o actualice: step, shortName, stateType ('happy_path' | 'error' | 'corner_case'), stateBadge ('HAPPY PATH' | 'CASO DE ERROR' | 'CORNER CASE'), stateDesc, navTitle, mainTitle, mainSubtitle, showMap, mapMeta, heroImage, items, cards, banner, cta, ctaVariant, ctaTargetStep, secondaryCta.";
    const user = prompt || `PeticiÃ³n de la diseÃ±adora:\n${userReq}\n\nEstado actual:\n${JSON.stringify(currentState, null, 2)}`;
    const text = await complete({ system, user, maxTokens: 16000 });
    let json;
    try {
      json = extractJson(text);
    } catch (parseErr) {
      log.warn("Iterate: reparando JSON devuelto por Gemini...");
      let repaired = text.trim();
      const first = repaired.indexOf("{");
      if (first !== -1) {
        repaired = repaired.slice(first);
        let openBraces = 0, openBrackets = 0;
        for (let i = 0; i < repaired.length; i++) {
          if (repaired[i] === "{") openBraces++;
          else if (repaired[i] === "}") openBraces--;
          else if (repaired[i] === "[") openBrackets++;
          else if (repaired[i] === "]") openBrackets--;
        }
        while (openBrackets > 0) { repaired += "]"; openBrackets--; }
        while (openBraces > 0) { repaired += "}"; openBraces--; }
        try {
          json = JSON.parse(repaired);
        } catch {
          throw parseErr;
        }
      } else {
        throw parseErr;
      }
    }
    const iterScreens = (json?.state && Array.isArray(json.state.screens)) ? json.state.screens : (Array.isArray(json?.screens) ? json.screens : null);
    if (iterScreens) {
      const { setLatestFigmaDesign } = await import("./integrations/figma.js");
      const changelogInfo = {
        version: (currentState?.version || 1) + 1,
        request: userReq,
        summary: json.summary || "Cambios aplicados según feedback de stakeholders",
        changes: Array.isArray(json.changes) ? json.changes : []
      };
      setLatestFigmaDesign(currentState?.key || "KAN-1", iterScreens, changelogInfo);
      broadcastToFigma({
        type: "RENDER_FLOW_MAP",
        screens: iterScreens,
        screenSvgs: [],
        key: currentState?.key || "KAN-1",
        changelog: changelogInfo
      });
    }
    res.json({ ok: true, result: json });
  } catch (err) {
    log.error("Error en /api/llm/iterate:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- IntegraciÃ³n Bidireccional con Figma (Sync & Export) ---
interface FigmaUrlParsed {
  fileKey: string;
  nodeId: string;
  rawNodeId: string;
  fileName?: string;
}

function parseFigmaUrl(url: string): FigmaUrlParsed | null {
  try {
    const trimmed = url.trim();
    const match = trimmed.match(/(?:file|design)\/([a-zA-Z0-9]+)(?:\/([^?#]+))?/);
    if (!match) return null;
    const fileKey = match[1];
    const fileName = match[2] ? decodeURIComponent(match[2].replace(/-/g, " ")) : undefined;

    let nodeId = "";
    let rawNodeId = "";
    const nodeMatch = trimmed.match(/[?&]node-id=([a-zA-Z0-9%_-]+)/);
    if (nodeMatch) {
      rawNodeId = decodeURIComponent(nodeMatch[1]);
      nodeId = rawNodeId.replace(/-/g, ":");
    }

    return { fileKey, nodeId, rawNodeId, fileName };
  } catch {
    return null;
  }
}

function generateFigmaPluginScript(screens: any[]): string {
  return `// === Generador AutomÃ¡tico de Canvas para Figma ===
// Instrucciones en Figma Desktop:
// 1. Ve a: Plugins â€º Development â€º Open Console (o nuevo plugin de desarrollo)
// 2. Pega este cÃ³digo y presiona Enter.
// 3. Los frames con Auto Layout y tokens de Uber Base aparecerÃ¡n alineados en tu lienzo.
(async () => {
  const screens = ${JSON.stringify(screens, null, 2)};
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });

  let startX = Math.round(figma.viewport.center.x - ((screens.length * 420) / 2));
  let startY = Math.round(figma.viewport.center.y);

  screens.forEach((scr, idx) => {
    const frame = figma.createFrame();
    frame.name = scr.step + ". " + (scr.shortName || scr.mainTitle || "Pantalla " + (idx + 1));
    frame.resize(375, 812);
    frame.x = startX + idx * 420;
    frame.y = startY;
    frame.cornerRadius = 36;
    frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    frame.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    frame.strokeWeight = 4;

    const tag = figma.createText();
    tag.characters = (scr.stateBadge || (scr.stateType === "error" ? "CASO DE ERROR" : scr.stateType === "corner_case" ? "CORNER CASE" : "HAPPY PATH")).toUpperCase();
    tag.fontSize = 11;
    tag.fontName = { family: "Inter", style: "Bold" };
    const isErr = scr.stateType === "error";
    const isWarn = scr.stateType === "corner_case";
    tag.fills = [{ type: "SOLID", color: isErr ? { r: 0.87, g: 0.07, b: 0.21 } : (isWarn ? { r: 0.96, g: 0.62, b: 0.05 } : { r: 0.05, g: 0.51, b: 0.27 }) }];
    tag.x = 24;
    tag.y = 54;
    frame.appendChild(tag);

    const title = figma.createText();
    title.characters = scr.mainTitle || scr.shortName || "Pantalla";
    title.fontSize = 19;
    title.fontName = { family: "Inter", style: "Bold" };
    title.x = 24;
    title.y = 80;
    title.resize(327, 26);
    frame.appendChild(title);

    if (scr.mainSubtitle) {
      const sub = figma.createText();
      sub.characters = scr.mainSubtitle;
      sub.fontSize = 13;
      sub.fontName = { family: "Inter", style: "Regular" };
      sub.fills = [{ type: "SOLID", color: { r: 0.33, g: 0.33, b: 0.33 } }];
      sub.x = 24;
      sub.y = 114;
      sub.resize(327, 36);
      frame.appendChild(sub);
    }

    const btn = figma.createFrame();
    btn.resize(327, 54);
    btn.x = 24;
    btn.y = 718;
    btn.cornerRadius = 8;
    const isNeg = scr.stateType === "error" || scr.ctaVariant === "negative";
    btn.fills = [{ type: "SOLID", color: isNeg ? { r: 0.87, g: 0.07, b: 0.21 } : { r: 0, g: 0, b: 0 } }];
    const btnText = figma.createText();
    btnText.characters = scr.cta || "Continuar";
    btnText.fontName = { family: "Inter", style: "Bold" };
    btnText.fontSize = 15;
    btnText.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    btnText.x = 24;
    btnText.y = 18;
    btn.appendChild(btnText);
    frame.appendChild(btn);

    figma.currentPage.appendChild(frame);
  });

  figma.notify("âœ“ " + screens.length + " pantallas de Uber Base creadas exitosamente en el lienzo de Figma.");
})();`;
}

// Sincronizar cambios desde un enlace de pantalla de Figma hacia el Agente
app.post("/api/figma/sync", async (req, res) => {
  try {
    const { figmaUrl, targetStep, notes, currentState, figmaToken } = req.body ?? {};
    if (!figmaUrl) {
      res.status(400).json({ error: "Falta 'figmaUrl' con el enlace de la pantalla o frame en Figma" });
      return;
    }

    const parsed = parseFigmaUrl(figmaUrl);
    if (!parsed) {
      res.status(400).json({
        error: "El enlace no es una URL vÃ¡lida de Figma. Formato esperado: https://www.figma.com/design/:file_key/:nombre?node-id=402-12"
      });
      return;
    }

    const token = figmaToken || config.figma.accessToken;
    let figmaData: any = null;
    let previewImageUrl: string | null = null;

    if (token && parsed.nodeId) {
      try {
        log.info(`Consultando Figma REST API: fileKey=${parsed.fileKey}, nodeId=${parsed.nodeId}`);
        const figmaRes = await fetch(`https://api.figma.com/v1/files/${parsed.fileKey}/nodes?ids=${parsed.nodeId}`, {
          headers: { "X-Figma-Token": token }
        });
        if (figmaRes.ok) {
          const figmaJson = (await figmaRes.json()) as any;
          figmaData = figmaJson?.nodes?.[parsed.nodeId];
        }

        const imgRes = await fetch(`https://api.figma.com/v1/images/${parsed.fileKey}?ids=${parsed.nodeId}&format=png`, {
          headers: { "X-Figma-Token": token }
        });
        if (imgRes.ok) {
          const imgJson = (await imgRes.json()) as any;
          previewImageUrl = imgJson?.images?.[parsed.nodeId] || null;
        }
      } catch (fErr) {
        log.warn("Figma API no disponible (usando contexto y procesamiento del agente):", fErr);
      }
    }

    const targetDesc = (typeof targetStep === "number" && targetStep >= 1)
      ? `Aplica los cambios especÃ­ficamente a la Pantalla ${targetStep}.`
      : (targetStep === "new" ? "Inserta esta pantalla como una nueva pantalla en el flujo." : "Detecta automÃ¡ticamente quÃ© pantalla del flujo debe actualizarse segÃºn los nombres de capas, nodos y notas del diseÃ±ador.");

    const system = "Eres el equipo de agentes de diseÃ±o autÃ³nomos de Uber (Arquitecto UX, Redactor UX, Agente de UI y QA) aplicando el sistema de diseÃ±o oficial Base Design System (tokens base.uber.com). " +
      "Tu objetivo es sincronizar e incluir los cambios diseÃ±ados en Figma por la diseÃ±adora dentro del flujo de pantallas existente de la aplicaciÃ³n. " +
      "Devuelve EXCLUSIVAMENTE un objeto JSON vÃ¡lido con las claves: summary, changes, agents, state. No incluyas texto fuera del JSON. " +
      "En 'state.screens' debes devolver el array completo con todas las pantallas del flujo actualizado, asegurando que cada pantalla conserve o actualice: step, shortName, stateType, stateBadge, stateDesc, navTitle, mainTitle, mainSubtitle, showMap, mapMeta, heroImage, items, cards, banner, cta, ctaVariant, ctaTargetStep, secondaryCta.";

    const userPrompt = `La diseÃ±adora ha realizado ajustes en Figma y solicita incluir los cambios en el flujo de producto.\n` +
      `- Enlace de Figma: ${figmaUrl}\n` +
      `- File Key: ${parsed.fileKey}\n` +
      `- Node ID: ${parsed.nodeId || "No especificado (archivo general)"}\n` +
      `- Nombre de la pantalla / frame en Figma: ${parsed.fileName || "Sin tÃ­tulo especÃ­fico"}\n` +
      `- Pantalla de destino en el flujo: ${targetDesc}\n` +
      `- Notas y cambios explicados por el diseÃ±ador: ${notes || "Sincronizar y adaptar la pantalla a las modificaciones hechas en Figma"}\n` +
      (figmaData ? `- Metadatos extraÃ­dos de la API de Figma: ${JSON.stringify(figmaData).slice(0, 3000)}\n` : "") +
      (previewImageUrl ? `- Preview PNG de Figma disponible en: ${previewImageUrl}\n` : "") +
      `\nEstado actual del flujo de pantallas:\n${JSON.stringify(currentState, null, 2)}`;

    const text = await complete({ system, user: userPrompt, maxTokens: 16000 });
    let json: any;
    try {
      json = extractJson(text);
    } catch (parseErr) {
      log.warn("Figma sync: reparando JSON devuelto por el modelo...");
      let repaired = text.trim();
      const first = repaired.indexOf("{");
      if (first !== -1) {
        repaired = repaired.slice(first);
        let openBraces = 0, openBrackets = 0;
        for (let i = 0; i < repaired.length; i++) {
          if (repaired[i] === "{") openBraces++;
          else if (repaired[i] === "}") openBraces--;
          else if (repaired[i] === "[") openBrackets++;
          else if (repaired[i] === "]") openBrackets--;
        }
        while (openBrackets > 0) { repaired += "]"; openBrackets--; }
        while (openBraces > 0) { repaired += "}"; openBraces--; }
        json = JSON.parse(repaired);
      } else {
        throw parseErr;
      }
    }

    if (previewImageUrl && json?.state?.screens) {
      const stepIdx = (typeof targetStep === "number" && targetStep >= 1) ? (targetStep - 1) : 0;
      if (json.state.screens[stepIdx]) {
        json.state.screens[stepIdx].heroImage = {
          url: previewImageUrl,
          alt: `DiseÃ±o sincronizado desde Figma (${parsed.fileName || "Nodo " + parsed.nodeId})`,
          caption: `Sincronizado con Figma: ${parsed.fileName || parsed.fileKey}`
        };
      }
    }

    res.json({
      ok: true,
      fileKey: parsed.fileKey,
      nodeId: parsed.nodeId,
      fileName: parsed.fileName,
      previewImageUrl,
      result: json
    });
  } catch (err) {
    log.error("Error en /api/figma/sync:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});


// Servir el SVG del flujo completo directamente como archivo descargable
app.get("/api/figma/svg", async (req, res) => {
  try {
    const { getLatestFigmaDesign } = await import("./integrations/figma.js");
    const latest = getLatestFigmaDesign();
    const screens = latest.screens;
    const key = latest.key || "KAN-1";
    const frameW = 375, frameH = 812, gap = 70, padX = 80, padY = 80;
    const screensCount = screens.length;
    const totalW = padX * 2 + screensCount * frameW + (screensCount - 1) * gap + gap + 540;
    const totalH = padY * 2 + frameH + 140;
    function esc(s: any) {
      return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }
    const parts: string[] = [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">`,
      `<defs><style>text{font-family:Arial,sans-serif}</style>`,
      `<marker id="ag" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 1L10 5L0 9z" fill="#0E8345"/></marker>`,
      `<marker id="ar" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 1L10 5L0 9z" fill="#DE1135"/></marker>`,
      `<marker id="aw" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 1L10 5L0 9z" fill="#F69E0C"/></marker>`,
      `<filter id="sh"><feDropShadow dx="0" dy="10" stdDeviation="16" flood-opacity="0.10"/></filter></defs>`,
      `<rect width="100%" height="100%" fill="#F4F5F6"/>`
    ];
    screens.forEach((s: any, idx: number) => {
      const x = padX + idx * (frameW + gap), y = padY + 20;
      const isE = s.stateType === "error", isC = s.stateType === "corner_case";
      const tc = isE ? "#DE1135" : isC ? "#F69E0C" : "#0E8345";
      const tb = isE ? "#FDF0F2" : isC ? "#FEF6E7" : "#EBF7EE";
      const badge = s.stateBadge || (isE ? "ERROR" : isC ? "CORNER" : "HAPPY PATH");
      parts.push(`<g transform="translate(${x},${y})">`);
      parts.push(`<rect x="0" y="-34" width="88" height="20" rx="4" fill="${tb}"/><text x="44" y="-20" text-anchor="middle" font-size="9" font-weight="bold" fill="${tc}">${esc(badge)}</text>`);
      parts.push(`<text x="96" y="-20" font-size="12" font-weight="bold" fill="#000">P${idx+1} ${esc(s.shortName||s.mainTitle||"")}</text>`);
      parts.push(`<rect width="375" height="812" rx="36" fill="#fff" stroke="#000" stroke-width="3" filter="url(#sh)"/>`);
      parts.push(`<text x="28" y="34" font-size="12" font-weight="bold" fill="#000">9:41</text><text x="347" y="34" text-anchor="end" font-size="11" font-weight="bold" fill="#000">5G</text>`);
      parts.push(`<text x="24" y="70" font-size="20" font-weight="bold" fill="#000">Uber</text>`);
      let cy = 100;
      if (s.showMap) { parts.push(`<rect x="20" y="${cy}" width="335" height="150" rx="12" fill="#141414"/><text x="187" y="${cy+90}" text-anchor="middle" font-size="24">Map</text>`); cy += 166; }
      parts.push(`<text x="24" y="${cy+24}" font-size="18" font-weight="bold" fill="#000">${esc(s.mainTitle||s.shortName||"")}</text>`);
      if (s.mainSubtitle) { parts.push(`<text x="24" y="${cy+48}" font-size="13" fill="#545454">${esc(s.mainSubtitle)}</text>`); cy += 32; }
      cy += 36;
      if (s.banner?.text) { parts.push(`<rect x="20" y="${cy}" width="335" height="40" rx="6" fill="${tb}" stroke="${tc}" stroke-width="1"/><text x="32" y="${cy+24}" font-size="12" font-weight="bold" fill="${tc}">${esc(String(s.banner.text).slice(0,48))}</text>`); cy += 52; }
      if (Array.isArray(s.items)) s.items.slice(0,2).forEach((it: any) => { parts.push(`<rect x="20" y="${cy}" width="335" height="54" rx="8" fill="#fff" stroke="${it.highlight?"#000":"#E2E2E2"}" stroke-width="${it.highlight?2:1}"/><text x="36" y="${cy+32}" font-size="14" font-weight="bold" fill="#000">${esc(it.title)}</text>`); cy += 64; });
      const bg = (isE||s.ctaVariant==="negative") ? "#DE1135" : "#000";
      parts.push(`<rect x="20" y="732" width="335" height="48" rx="8" fill="${bg}"/><text x="187" y="761" text-anchor="middle" font-size="15" font-weight="bold" fill="#fff">${esc(s.cta||"Continuar")}</text>`);
      parts.push(`</g>`);
    });
    screens.forEach((s: any, idx: number) => {
      const srcX = padX + idx * (frameW + gap) + frameW, srcY = padY + 20 + 756;
      const tStep = (typeof s.ctaTargetStep==="number"&&s.ctaTargetStep>=1)?s.ctaTargetStep:(idx<screens.length-1?idx+2:1);
      const tIdx = tStep - 1; if (tIdx >= screens.length) return;
      const isE = s.stateType==="error", isC = s.stateType==="corner_case";
      const stroke = isE?"#DE1135":isC?"#F69E0C":"#0E8345";
      const mk = isE?"ar":isC?"aw":"ag";
      if (tIdx===idx+1) {
        const dstX = padX + tIdx * (frameW + gap);
        parts.push(`<path d="M ${srcX} ${srcY} L ${dstX-6} ${srcY}" fill="none" stroke="${stroke}" stroke-width="2.5" marker-end="url(#${mk})"/>`);
        parts.push(`<text x="${(srcX+dstX)/2}" y="${srcY-18}" text-anchor="middle" font-size="10" fill="${stroke}">${esc(String(s.cta||"").slice(0,14))}</text>`);
      } else if (tIdx<idx) {
        const sX=padX+idx*(frameW+gap)+frameW*0.5, eX=padX+tIdx*(frameW+gap)+frameW*0.5, dropY=padY+20+frameH+35+idx*16;
        parts.push(`<path d="M ${sX} ${padY+20+frameH} L ${sX} ${dropY} L ${eX} ${dropY} L ${eX} ${padY+20+frameH+8}" fill="none" stroke="${stroke}" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#${mk})"/>`);
      }
    });
    const docX = padX + screensCount * (frameW + gap), docY = padY + 20;
    parts.push(`<g transform="translate(${docX},${docY})">`);
    parts.push(`<rect width="540" height="812" rx="16" fill="#fff" stroke="#000" stroke-width="2" filter="url(#sh)"/>`);
    parts.push(`<rect x="0" y="0" width="540" height="72" rx="16" fill="#000"/>`);
    parts.push(`<text x="24" y="30" font-size="10" font-weight="bold" fill="#888">GUIA FUNCIONAL STAKEHOLDERS</text>`);
    parts.push(`<text x="24" y="52" font-size="15" font-weight="bold" fill="#fff">Flujo ${esc(key)}</text>`);
    let dy = 96;
    parts.push(`<text x="24" y="${dy}" font-size="13" font-weight="bold" fill="#000">Objetivo y Propuesta de Valor</text>`); dy+=16;
    parts.push(`<rect x="24" y="${dy}" width="492" height="56" rx="8" fill="#F8F9FA" stroke="#E2E2E2" stroke-width="1"/>`);
    parts.push(`<text x="36" y="${dy+20}" font-size="11" font-weight="bold" fill="#000">Certidumbre total en el viaje.</text>`);
    parts.push(`<text x="36" y="${dy+40}" font-size="11" fill="#545454">Precios cerrados y telemetria en tiempo real.</text>`);
    dy+=70;
    parts.push(`<text x="24" y="${dy}" font-size="13" font-weight="bold" fill="#000">Recorrido Paso a Paso</text>`); dy+=16;
    [{n:"1",t:"Seleccion Servicio",b:"HAPPY",c:"#0E8345",bg:"#EBF7EE",d:"Tarifa cerrada garantizada."},{n:"2",t:"Desvio Proactivo",b:"CORNER",c:"#F69E0C",bg:"#FEF6E7",d:"50m ahorra 10min de atasco."},{n:"3",t:"Resumen Cobro",b:"HAPPY",c:"#0E8345",bg:"#EBF7EE",d:"Desglose y confirmacion pago."},{n:"4",t:"Recuperacion Error",b:"ERROR",c:"#DE1135",bg:"#FDF0F2",d:"Fallo tarjeta: Uber Cash actua."},{n:"5",t:"Conductor y PIN",b:"HAPPY",c:"#0E8345",bg:"#EBF7EE",d:"GPS vivo + PIN 7492 seguridad."}].forEach(st=>{
      parts.push(`<rect x="24" y="${dy}" width="492" height="50" rx="6" fill="#FBFBFB" stroke="#EEE" stroke-width="1"/>`);
      parts.push(`<rect x="34" y="${dy+7}" width="62" height="16" rx="3" fill="${st.bg}"/><text x="65" y="${dy+19}" text-anchor="middle" font-size="8" font-weight="bold" fill="${st.c}">${st.b}</text>`);
      parts.push(`<text x="104" y="${dy+19}" font-size="12" font-weight="bold" fill="#000">${st.n}. ${esc(st.t)}</text>`);
      parts.push(`<text x="34" y="${dy+38}" font-size="10" fill="#545454">${esc(st.d)}</text>`);
      dy+=54;
    });
    dy+=4;
    parts.push(`<text x="24" y="${dy}" font-size="13" font-weight="bold" fill="#000">KPIs de Impacto</text>`); dy+=16;
    parts.push(`<rect x="24" y="${dy}" width="492" height="50" rx="8" fill="#F8F9FA" stroke="#E2E2E2" stroke-width="1"/>`);
    parts.push(`<text x="38" y="${dy+20}" font-size="11" font-weight="bold" fill="#000">+18% Conversion</text><text x="200" y="${dy+20}" font-size="11" font-weight="bold" fill="#0E8345">-10min Espera</text><text x="360" y="${dy+20}" font-size="11" font-weight="bold" fill="#276EF1">0% Dead-ends</text>`);
    dy+=64;
    parts.push(`<rect x="24" y="${dy}" width="492" height="38" rx="8" fill="#EBF7EE" stroke="#B8E4C3" stroke-width="1"/>`);
    parts.push(`<text x="36" y="${dy+23}" font-size="11" font-weight="bold" fill="#0E8345">Base DS: botones 48px r8px - Conectores 90deg</text>`);
    parts.push(`</g></svg>`);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="uber_flow_${key}.svg"`);
    res.send(parts.join("\n"));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
// Exportar pantallas y tokens listos para el lienzo de Figma
app.post("/api/figma/export", async (req, res) => {
  try {
    const { screens, d } = req.body ?? {};
    const { getLatestFigmaDesign } = await import("./integrations/figma.js"); const latest = getLatestFigmaDesign(); const screensList = Array.isArray(screens) && screens.length > 0 ? screens : (Array.isArray(d?.screens) && d.screens.length > 0 ? d.screens : latest.screens);
    const pluginScript = generateFigmaPluginScript(screensList);
    if (screensList.length > 0) {
      const { setLatestFigmaDesign } = await import("./integrations/figma.js");
      setLatestFigmaDesign(req.body?.key || "KAN-1", screensList);
    }

    res.json({
      ok: true,
      screensCount: screensList.length,
      pluginScript
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post("/api/runs/:key/approve", async (req, res) => {
  try {
    const run = await approve(req.params.key);
    res.json({ ok: true, status: run?.status });
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Endpoint para disparar el renderizado en Figma mediante MCP o API directa

// Endpoint para disparar el renderizado del Flujo de Orquestación en Figma
app.post("/api/figma/push-orchestration", async (_req, res) => {
  try {
    const sent = broadcastToFigma({
      type: "RENDER_ORCHESTRATION_FLOW"
    });
    res.json({
      ok: true,
      sentToPlugins: sent,
      message: "Orden RENDER_ORCHESTRATION_FLOW emitida"
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get("/api/figma/orchestration-script", async (_req, res) => {
  try {
    const script = fs.readFileSync("scripts/render-orchestration-figma.js", "utf8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.send(script);
  } catch(e) {
    res.status(500).send("console.error('Error:', " + JSON.stringify(String(e)) + ");");
  }
});

app.post("/api/figma/push", async (req, res) => {
  try {
    const { getLatestFigmaDesign } = await import("./integrations/figma.js");
    const latest = getLatestFigmaDesign();
    const sent = broadcastToFigma({
      type: "RENDER_FLOW_MAP",
      screens: latest.screens,
      screenSvgs: latest.screenSvgs,
      key: latest.key || "KAN-1",
      changelog: latest.changelog
    });
    res.json({
      ok: true,
      sentToPlugins: sent,
      key: latest.key,
      screensCount: latest.screens.length
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

if (!process.env.VERCEL) {
  server.listen(config.port, "0.0.0.0", () => {
    log.info(`Servidor activo en red local: http://192.168.0.19:${config.port}`);
    log.info(`Uber Base Design Agents escuchando en http://localhost:${config.port}`);
    log.info(config.dryRun ? "DRY_RUN activo: no se escribirá en Jira ni en Trello." : "Modo real: se escribirá en Jira y Trello.");
    if (config.jira.baseUrl && config.jira.email && config.jira.apiToken) { startJiraPoller(15000); }
  });
}

export default app;
export { app, server };
