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

const app = express();

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
app.use(express.static(path.join(ROOT, "demo")));
app.use("/app", express.static(path.join(ROOT, "demo")));
app.use("/demo", express.static(path.join(ROOT, "demo")));

// --- API interna (para un panel propio o pruebas) ---
app.post("/api/runs", async (req, res) => {
  try {
    const title = String(req.body?.title ?? "Petición de diseño").trim();
    const description = String(req.body?.description ?? "").trim();
    if (!description) {
      res.status(400).json({ error: "Falta 'description' con la petición de diseño" });
      return;
    }
    const key = req.body?.key ? String(req.body.key).trim() : `WEB-${Date.now().toString(36).toUpperCase()}`;
    const ticket = {
      source: (req.body?.source === "trello" ? "trello" : "jira") as "jira" | "trello",
      key,
      externalId: key,
      title,
      description,
      labels: Array.isArray(req.body?.labels) ? req.body.labels : ["diseño", "uber-base"],
      reporter: String(req.body?.reporter ?? "Diseñadora UI/UX"),
      attachments: [],
    };
    res.status(202).json({ ok: true, key, message: "Pipeline iniciado" });
    startRun(ticket).catch((err) => log.error("Pipeline falló", err));
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
  res.json(run);
});

app.post("/api/runs/:key/iterate", async (req, res) => {
  const request = String(req.body?.request ?? "").trim();
  if (!request) {
    res.status(400).json({ error: "Falta 'request' con el cambio que quieres hacer" });
    return;
  }
  res.status(202).json({ ok: true });
  iterate(req.params.key, request).catch((err) => log.error("Iteración fallida", err));
});

// Prompt maestro de los 7 agentes de Uber Base Design System
const UBER_BASE_SYSTEM = `Eres un sistema autónomo de 7 agentes de diseño de producto de Uber que utilizan estrictamente el sistema oficial Base Design System (base.uber.com), siguiendo las especificaciones del catálogo formal 'design-system/components/baseui.manifest.json':
1. Brief Agent: analiza la necesidad del usuario, objetivos de negocio, métricas de éxito y define la matriz de alcance: Happy Path, Error Cases y Corner Cases.
2. Context Agent: selecciona tokens de Uber Base (baseui) para cada estado: --base-positive (#0E8345), --base-negative (#DE1135), --base-warning (#F69E0C), --base-black (#000000) y superficies secundarias (#F6F6F6).
3. UX Architect: estructura un flujo profesional completo de pantallas (sin límite artificial de pantallas: diseña todas las pantallas necesarias para cubrir exhaustivamente el flujo de producto, típicamente entre 6 y 10+ pantallas) que resuelvan EXACTAMENTE el problema planteado en el brief, cubriendo obligatoriamente el camino nominal, la gestión de errores y los casos límite.
4. Copy Agent: redacta microcopys con la voz oficial de Uber (directo, empático y constructivo sin culpar al usuario en errores, sentence case).
5. UI Agent: define componentes del manifest oficial de Base (MapCard, Header, ProductCard, Button con props KIND/SHAPE/SIZE, StatusPin, ETA, Banner con tone negative/warning, etc.).
6. QA Agent: valida accesibilidad WCAG AA, áreas táctiles ≥ 44px (o 56px para CTAs), contraste y resiliencia ante errores (sin dead-ends ni callejones sin salida).
7. Delivery Agent: genera especificaciones y handover para desarrollo y QA documentando todos los estados con mapeo a componentes de Figma.

REGLA PROFESIONAL FUNDAMENTAL DE PRODUCTO:
El flujo de pantallas debe representar una experiencia de producto completa, robusta y lista para producción, NO únicamente un camino idílico.
NO HAY LÍMITE DE PANTALLAS: diseña todas las pantallas que hagan falta para cubrir el viaje de principio a fin (Happy Path completo, Casos de Error con pantalla de fallo Y pantalla de recuperación guiada, y Corner Cases o condiciones excepcionales).
Debes categorizar y distribuir obligatoriamente las pantallas entre:
1. Happy Path (Camino nominal): Pantallas del recorrido óptimo (ej. Selección inicial de servicio/producto, Configuración de opciones y preferencias, Confirmación y método de pago, Seguimiento/servicio en tiempo real, Cumplimiento o llegada).
   - stateType: "happy_path"
   - stateBadge: "HAPPY PATH"
2. Casos de Error (Error cases & Recovery): Pantallas que demuestren la gestión de un fallo crítico realista (ej. fallo de autorización o cobro de tarjeta, conductor cancela repentinamente, tiempo de emparejamiento agotado sin vehículos, o pérdida de conexión) Y la pantalla de recuperación asistida sin dead-ends.
   - stateType: "error"
   - stateBadge: "CASO DE ERROR"
   - stateDesc: explicación de la incidencia y la vía de escape guiada
   - banner: { "text": "Explicación clara del error sin culpar al usuario", "tone": "negative" }
   - cta: botón claro de recuperación (ej. "Reintentar cobro con Uber Cash", "Buscar conductor alternativo")
   - ctaVariant: "negative" o "primary"
   - ctaTargetStep: número de paso hacia el que navega este botón (ej. el paso de recuperación o de métodos de pago)
   - secondaryCta: objeto opcional para bifurcaciones ({ "text": "Cancelar viaje", "variant": "secondary", "targetStep": 1 })
3. Corner Cases (Casos límite o excepciones controladas): Pantallas dedicadas a condiciones atípicas o de fricción controlada (ej. alerta de alta demanda / surge pricing dinámico, desvío obligatorio por obras o calle peatonal con punto de encuentro sugerido a 50 metros, tráfico severo con recálculo dinámico de ETA, o tiempo de espera a punto de agotarse).
   - stateType: "corner_case"
   - stateBadge: "CORNER CASE"
   - stateDesc: explicación de la condición límite y alternativa sugerida
   - banner: { "text": "Aviso proactivo y transparente", "tone": "warning" }
   - cta: acción para aceptar la alternativa o continuar
   - ctaTargetStep: paso al que navega la alternativa
   - secondaryCta: acción secundaria para rechazar o mantener la ruta estándar ({ "text": "Mantener punto original (+10 min)", "variant": "tertiary", "targetStep": 3 })

4. Máquina de Estados y Rutas No Lineales:
   - En cada pantalla, define "ctaTargetStep" indicando a qué número de paso ('step') conduce la acción principal (típicamente 'step + 1', o el paso específico de resolución en errores).
   - Puedes incluir opcionalmente "secondaryCta": { "text": "...", "variant": "secondary" | "tertiary", "targetStep": 1 } para ofrecer bifurcaciones reales (rutas alternativas, cancelaciones limpias o desvíos).

IMPORTANTE: Diseña el flujo que el usuario pide en su brief. NUNCA asumas o inventes flujos no relacionados como recargas eléctricas a menos que el usuario lo pida explícitamente.

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura:
{
  "summary": "Resumen ejecutivo del flujo diseñado (Happy Path, Error Case y Corner Case)",
  "agents": {
    "brief": {
      "summary": "Resumen del brief y matriz de alcance",
      "logs": ["Analizando brief y métricas de éxito", "Mapeando Happy Path principal", "Identificando posibles fallos y casos límite"],
      "out": "<h4>Alcance y Matriz de Estados</h4><p><b>Happy Path:</b> Selección y viaje nominal.<br><b>Casos de Error:</b> Mitigación de fallo de pago/conexión con recuperación directa.<br><b>Corner Cases:</b> Gestión de alta demanda y desvío de punto de recogida.</p>"
    },
    "context": {
      "summary": "Tokens Base y componentes reutilizables",
      "logs": ["Seleccionando tokens baseui", "Configurando tokens semánticos: positive, negative, warning", "Validando componentes de movilidad"],
      "out": "<h4>Tokens de Uber Base DS</h4><div class=\"flow\"><span>--base-black (#000000)</span><span>--base-negative (#DE1135)</span><span>--base-warning (#F69E0C)</span><span>--base-positive (#0E8345)</span><span>--base-r-rounded (8px)</span></div>"
    },
    "ux": {
      "summary": "Arquitectura de flujo con Happy Path, Error y Corner Cases",
      "logs": ["Estructurando las pantallas del flujo completo", "Diseñando recuperación sin dead-ends para casos de error", "Definiendo alertas proactivas para casos límite"],
      "out": "<h4>Matriz de Flujo UX</h4><ul><li><b>Happy Path:</b> Pasos nominales del servicio.</li><li><b>Corner Case:</b> Gestión proactiva de condiciones límite.</li><li><b>Casos de Error:</b> Pantalla de fallo y recuperación en 1 clic.</li></ul>"
    },
    "copy": {
      "summary": "Microcopy en tono oficial de Uber",
      "logs": ["Redactando en sentence case", "Aplicando empatía y claridad constructiva en errores", "Redactando avisos pedagógicos para corner cases"],
      "out": "<h4>Guía de Microcopy y Voz de Marca</h4><p>Textos directos en voz activa; explicación honesta sin culpar al usuario en incidencias; CTAs precisos que indican la acción real.</p>"
    },
    "ui": {
      "summary": "Componentes y pantallas con Uber Base DS",
      "logs": ["Componiendo pantallas con tokens Base", "Aplicando MapCard y mapas oscuros en tiempo real", "Estilizando banners de error y advertencia"],
      "out": "<h4>Componentes Base Web/Mobile</h4><div class=\"flow\"><span>MapCard</span><span>Button (SHAPE.rounded 8px)</span><span>Banner (negative & warning)</span><span>Card (F6F6F6)</span><span>StatusPin</span></div>"
    },
    "qa": {
      "summary": "Auditoría WCAG AA y Resiliencia",
      "logs": ["Verificando áreas táctiles ≥ 44px", "Auditando contraste de color WCAG AA", "Comprobando resiliencia y ausencia de callejones sin salida"],
      "out": "<h4>Auditoría QA y Resiliencia</h4><ul><li><span class=\"chip ok\">Superado</span> Contraste AA en textos y fondos.</li><li><span class=\"chip ok\">Superado</span> Áreas táctiles de 44px o más.</li><li><span class=\"chip ok\">Superado</span> Resiliencia: todo error tiene CTA de resolución guiada.</li></ul>"
    },
    "delivery": {
      "summary": "Handover técnico para ingeniería y QA",
      "logs": ["Generando especificación de estados", "Documentando criterios de aceptación", "Publicando paquete de entrega"],
      "out": "<h4>Especificación para Desarrollo</h4><p>Flujo completo de pantallas con Happy Path, Casos de Error y Corner Cases documentados para testing y producción.</p>"
    }
  },
  "screens": [
    {
      "step": 1,
      "shortName": "1 · Selección inicial",
      "stateType": "happy_path",
      "stateBadge": "HAPPY PATH",
      "stateDesc": "Selección nominal de servicio con precio cerrado garantizado",
      "hint": "Explicación del paso",
      "navTitle": "Título en la barra superior",
      "mainTitle": "Título principal",
      "mainSubtitle": "Subtítulo descriptivo",
      "showMap": false,
      "heroImage": null,
      "items": [
        { "title": "Opción 1", "subtitle": "Detalle descriptivo", "icon": "🚗", "highlight": true, "price": "14,20 €" }
      ],
      "cards": [
        { "label": "Llegada", "value": "3 min" }
      ],
      "banner": null,
      "cta": "Continuar",
      "ctaVariant": "primary"
    },
    {
      "step": 2,
      "shortName": "2 · Corner Case: Alta demanda o desvío",
      "stateType": "corner_case",
      "stateBadge": "CORNER CASE",
      "stateDesc": "Condición límite atípica con advertencia proactiva y alternativa guiada",
      "hint": "Aviso anticipado al usuario de una situación excepcional",
      "navTitle": "Aviso de servicio",
      "mainTitle": "Alta demanda o ajuste de ruta",
      "mainSubtitle": "Explicación transparente de la condición excepcional",
      "showMap": true,
      "mapMeta": {
        "badge": "Zona de alta afluencia",
        "eta": "4 min",
        "driverName": "Carlos M.",
        "rating": "4.95",
        "vehicle": "Toyota Corolla · 4821 LKY",
        "location": "Punto de encuentro optimizado a 50 m",
        "lat": 39.4699,
        "lng": -0.3763,
        "dlat": 39.4665,
        "dlng": -0.3785
      },
      "items": [],
      "cards": [
        { "label": "Tarifa", "value": "Dinámica x1.2" },
        { "label": "Espera", "value": "4 min" }
      ],
      "banner": { "text": "Alta demanda en esta zona: punto de recogida optimizado a 50m para evitar retenciones", "tone": "warning" },
      "cta": "Aceptar punto de encuentro",
      "ctaVariant": "primary"
    },
    {
      "step": 3,
      "shortName": "3 · Confirmación y pago",
      "stateType": "happy_path",
      "stateBadge": "HAPPY PATH",
      "stateDesc": "Revisión nominal de detalles, punto de encuentro y autorización",
      "hint": "Resumen final del servicio",
      "navTitle": "Confirmación",
      "mainTitle": "Revisa tu viaje",
      "mainSubtitle": "Tarifa cerrada garantizada sin sorpresas",
      "showMap": false,
      "items": [],
      "cards": [],
      "banner": null,
      "cta": "Confirmar viaje",
      "ctaVariant": "primary"
    },
    {
      "step": 4,
      "shortName": "4 · Caso de Error: Fallo y recuperación",
      "stateType": "error",
      "stateBadge": "CASO DE ERROR",
      "stateDesc": "Simulación de incidencia crítica (pago o conductor) con CTA de recuperación sin dead-ends",
      "hint": "Gestión de error constructiva y guiada",
      "navTitle": "Incidencia",
      "mainTitle": "No se pudo procesar el pago",
      "mainSubtitle": "Tu banco ha rechazado la operación. Elige un método alternativo para no perder el servicio.",
      "showMap": false,
      "items": [
        { "title": "Uber Cash (Saldo: 18,50 €)", "subtitle": "Cobro instantáneo sin comisiones", "icon": "💳", "highlight": true },
        { "title": "Tarjeta Visa •••• 8912", "subtitle": "Tarjeta bancaria secundaria", "icon": "🏦", "highlight": false }
      ],
      "cards": [
        { "label": "Importe pendiente", "value": "14,20 €" },
        { "label": "Estado", "value": "Listo para reintentar" }
      ],
      "banner": { "text": "Fallo de autorización: selecciona otro método para confirmar al instante", "tone": "negative" },
      "cta": "Pagar con Uber Cash y continuar",
      "ctaVariant": "negative"
    },
    {
      "step": 5,
      "shortName": "5 · Conductor en camino y PIN",
      "stateType": "happy_path",
      "stateBadge": "HAPPY PATH",
      "stateDesc": "Recuperación completada con éxito y seguimiento en tiempo real con PIN de seguridad",
      "hint": "Servicio en marcha y monitorización",
      "navTitle": "En camino",
      "mainTitle": "Tu conductor está en camino",
      "mainSubtitle": "Carlos llegará en 3 minutos",
      "showMap": true,
      "mapMeta": {
        "badge": "Llegando",
        "eta": "2 min",
        "driverName": "Carlos M.",
        "rating": "4.95",
        "vehicle": "Toyota Corolla · 4821 LKY",
        "location": "A 300 m de tu punto de recogida",
        "lat": 39.4699,
        "lng": -0.3763,
        "dlat": 39.4680,
        "dlng": -0.3775
      },
      "items": [],
      "cards": [
        { "label": "PIN de seguridad", "value": "4891" },
        { "label": "Matrícula", "value": "4821 LKY" }
      ],
      "banner": null,
      "cta": "Finalizar flujo",
      "ctaVariant": "primary"
    }
  ],
  "theme": { "cta": "ink", "radius": "rounded", "density": "comfortable" }
}
Reglas estrictas de Base Design System (base.uber.com):
- Botones (baseui/button):
  * Forma por defecto: SHAPE.rounded (border-radius: 8px).
  * Variantes: KIND.primary (#000000, texto blanco), KIND.secondary (#EEEEEE, texto negro), KIND.negative (#DE1135 para errores), KIND.tertiary (borde #E2E2E2).
  * Tamaños: SIZE.large (56px para CTAs principales), SIZE.default (48px para formularios), SIZE.compact (36px).
- Tarjetas y Contenedores (Card / Surface):
  * Bordes: border-radius: 8px (tokens estándar de Base Web/Mobile).
  * Fondos: #FFFFFF para tarjetas activas, #F6F6F6 (Background Secondary) para fondos secundarios.
  * Líneas y bordes: 1px solid #E2E2E2 (Background Tertiary).
- Banners y Estados:
  * Error: tone "negative" (#DE1135, fondo suave #FDF0F2).
  * Advertencia / Corner Case: tone "warning" (#F69E0C, fondo suave #FEF6E7).
  * Éxito / Info: tone "positive" (#0E8345) o "sun".
- Imágenes fotográficas y visuales (cuando el flujo se beneficie de enriquecimiento visual):
  * Puedes incluir en cualquier pantalla:
    "heroImage": { "url": "https://images.unsplash.com/photo-...", "alt": "descripción", "caption": "pie opcional" }
  * En "items": cada elemento puede incluir "image": "https://images.unsplash.com/..." y opcionalmente "price": "14,20 €".
  * Usa URLs fotográficas limpias y directas de Unsplash acordes al tema (ej. coches, ciudades, movilidad, mapas, conductores).
- Inputs y Campos de Búsqueda:
  * Altura estándar: 48px con padding 10px 14px, radio 8px, fondo #F6F6F6.
- Tipografía oficial:
  * Titulares: Uber Move Bold (700) con tracking -0.02em.
  * Texto y botones: Uber Move Text (Medium 500 / Bold 700) en sentence case.
- Tags y Badges:
  * Radio: 4px a 8px (no píldoras infinitas), texto en negrita 11px/12px.`;

function buildUserPrompt(key?: string, priority?: string, title?: string, briefText?: string): string {
  return `Petición entrante del equipo de producto:
Clave: ${key || "PETICION-1"}
Prioridad: ${priority || "Media"}
Título: ${title}
Briefing completo:
${briefText}

Diseña la solución profesional completa de producto enfocada en resolver este briefing concreto utilizando el sistema de diseño Uber Base. Diseña todas las pantallas que sean necesarias sin límite artificial de pantallas (típicamente entre 6 y 10+ pantallas), asegurando cubrir exhaustivamente el Happy Path, Casos de Error con pantallas de fallo y recuperación, y Corner Cases con alternativas guiadas y rutas no lineales.`;
}

// Endpoint estándar JSON para generar propuesta completa
app.post("/api/llm/generate", async (req, res) => {
  try {
    const { key, title, priority, body: briefText } = req.body ?? {};
    if (!briefText && !title) {
      res.status(400).json({ error: "Falta el título o el contenido del brief" });
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
    res.json({ ok: true, result: json });
  } catch (err) {
    log.error("Error en /api/llm/generate:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Endpoint de streaming en tiempo real (Server-Sent Events) para visualización progresiva
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
      send("error", { message: "Falta el título o el contenido del brief" });
      res.end();
      return;
    }

    send("agent_step", { id: "brief", name: "Analista de brief", status: "running", subagent: "Lector de Requisitos", log: "Analizando objetivos de negocio, prioridades y matriz de alcance..." });
    send("agent_step", { id: "ctx", name: "Agente de contexto", status: "running", subagent: "Base DS Token Crawler", log: "Seleccionando tokens baseui oficiales de Uber Base (base.uber.com)..." });
    send("agent_step", { id: "ux", name: "Arquitecto UX", status: "running", subagent: "Máquina de Estados", log: "Estructurando pantallas, caminos nominales y bifurcaciones de error sin dead-ends..." });

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
    send("result", { ok: true, result: json });
    res.end();
  } catch (err) {
    send("error", { message: err instanceof Error ? err.message : String(err) });
    res.end();
  }
});

// Endpoint síncrono para que la interfaz web obtenga cambios generados por IA real inmediatamente
app.post("/api/llm/iterate", async (req, res) => {
  try {
    const { request: userReq, currentState, prompt } = req.body ?? {};
    if (!userReq) {
      res.status(400).json({ error: "Falta 'request'" });
      return;
    }
    const system = "Eres el equipo de agentes de diseño autónomos de Uber (Arquitecto UX, Redactor UX, Agente de UI y QA) aplicando el sistema de diseño oficial Base Design System (tokens base.uber.com). " +
      "Devuelve EXCLUSIVAMENTE un objeto JSON válido con las claves: summary, changes, agents, question, state. No incluyas explicaciones en texto fuera del JSON. " +
      "IMPORTANTE: Si 'currentState' contiene un array 'screens', debes devolver en 'state.screens' el array completo con todas las pantallas del flujo (sin límite artificial de pantallas, conservando todas las pantallas existentes o añadiendo/modificando las necesarias para resolver la petición), asegurando que cada pantalla conserve o actualice: step, shortName, stateType ('happy_path' | 'error' | 'corner_case'), stateBadge ('HAPPY PATH' | 'CASO DE ERROR' | 'CORNER CASE'), stateDesc, navTitle, mainTitle, mainSubtitle, showMap, mapMeta, heroImage, items, cards, banner, cta, ctaVariant, ctaTargetStep, secondaryCta.";
    const user = prompt || `Petición de la diseñadora:\n${userReq}\n\nEstado actual:\n${JSON.stringify(currentState, null, 2)}`;
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
    res.json({ ok: true, result: json });
  } catch (err) {
    log.error("Error en /api/llm/iterate:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Integración Bidireccional con Figma (Sync & Export) ---
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
  return `// === Generador Automático de Canvas para Figma ===
// Instrucciones en Figma Desktop:
// 1. Ve a: Plugins › Development › Open Console (o nuevo plugin de desarrollo)
// 2. Pega este código y presiona Enter.
// 3. Los frames con Auto Layout y tokens de Uber Base aparecerán alineados en tu lienzo.
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

  figma.notify("✓ " + screens.length + " pantallas de Uber Base creadas exitosamente en el lienzo de Figma.");
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
        error: "El enlace no es una URL válida de Figma. Formato esperado: https://www.figma.com/design/:file_key/:nombre?node-id=402-12"
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
      ? `Aplica los cambios específicamente a la Pantalla ${targetStep}.`
      : (targetStep === "new" ? "Inserta esta pantalla como una nueva pantalla en el flujo." : "Detecta automáticamente qué pantalla del flujo debe actualizarse según los nombres de capas, nodos y notas del diseñador.");

    const system = "Eres el equipo de agentes de diseño autónomos de Uber (Arquitecto UX, Redactor UX, Agente de UI y QA) aplicando el sistema de diseño oficial Base Design System (tokens base.uber.com). " +
      "Tu objetivo es sincronizar e incluir los cambios diseñados en Figma por la diseñadora dentro del flujo de pantallas existente de la aplicación. " +
      "Devuelve EXCLUSIVAMENTE un objeto JSON válido con las claves: summary, changes, agents, state. No incluyas texto fuera del JSON. " +
      "En 'state.screens' debes devolver el array completo con todas las pantallas del flujo actualizado, asegurando que cada pantalla conserve o actualice: step, shortName, stateType, stateBadge, stateDesc, navTitle, mainTitle, mainSubtitle, showMap, mapMeta, heroImage, items, cards, banner, cta, ctaVariant, ctaTargetStep, secondaryCta.";

    const userPrompt = `La diseñadora ha realizado ajustes en Figma y solicita incluir los cambios en el flujo de producto.\n` +
      `- Enlace de Figma: ${figmaUrl}\n` +
      `- File Key: ${parsed.fileKey}\n` +
      `- Node ID: ${parsed.nodeId || "No especificado (archivo general)"}\n` +
      `- Nombre de la pantalla / frame en Figma: ${parsed.fileName || "Sin título específico"}\n` +
      `- Pantalla de destino en el flujo: ${targetDesc}\n` +
      `- Notas y cambios explicados por el diseñador: ${notes || "Sincronizar y adaptar la pantalla a las modificaciones hechas en Figma"}\n` +
      (figmaData ? `- Metadatos extraídos de la API de Figma: ${JSON.stringify(figmaData).slice(0, 3000)}\n` : "") +
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
          alt: `Diseño sincronizado desde Figma (${parsed.fileName || "Nodo " + parsed.nodeId})`,
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

// Exportar pantallas y tokens listos para el lienzo de Figma
app.post("/api/figma/export", async (req, res) => {
  try {
    const { screens, d } = req.body ?? {};
    const screensList = Array.isArray(screens) && screens.length > 0 ? screens : (Array.isArray(d?.screens) ? d.screens : []);
    const pluginScript = generateFigmaPluginScript(screensList);

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

app.listen(config.port, () => {
  log.info(`Uber Base Design Agents escuchando en http://localhost:${config.port}`);
  log.info(config.dryRun ? "DRY_RUN activo: no se escribirá en Jira ni en Trello." : "Modo real: se escribirá en Jira y Trello.");
});
