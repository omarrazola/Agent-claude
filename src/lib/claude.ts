import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { config, ROOT } from "../config.js";
import { log } from "./logger.js";

let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new Error("Falta ANTHROPIC_API_KEY en el archivo .env");
  }
  anthropicClient ??= new Anthropic({ apiKey: config.anthropicApiKey });
  return anthropicClient;
}

function getGeminiClient(): GoogleGenAI {
  if (!config.geminiApiKey) {
    throw new Error("Falta GEMINI_API_KEY o GOOGLE_API_KEY en el archivo .env");
  }
  geminiClient ??= new GoogleGenAI({ apiKey: config.geminiApiKey });
  return geminiClient;
}

export interface CompleteOptions {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
}

/**
 * Llama al proveedor LLM configurado (Gemini, Claude o Mock para demostración local).
 */
export async function complete({ system, user, model, maxTokens = 8000 }: CompleteOptions): Promise<string> {
  const provider = config.provider;

  // 1. Proveedor Gemini (Google Antigravity nativo)
  if (provider === "gemini") {
    const ai = getGeminiClient();
    const geminiModel = model && model.startsWith("gemini") ? model : config.geminiModel;
    try {
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: user,
        config: {
          systemInstruction: system,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      });
      return response.text ?? "{}";
    } catch (err) {
      log.error(`Error llamando a Gemini (${geminiModel}):`, err);
      throw err;
    }
  }

  // 2. Proveedor Anthropic (Claude)
  if (provider === "anthropic") {
    const claudeModel = model && model.startsWith("claude") ? model : config.model;
    const effectiveTokens = Math.min(maxTokens, 8192);
    const message = await getAnthropicClient()
      .messages.stream({
        model: claudeModel,
        max_tokens: effectiveTokens,
        system,
        messages: [{ role: "user", content: user }],
      })
      .finalMessage();

    if (message.stop_reason === "max_tokens") {
      throw new Error(`La respuesta se cortó al llegar a ${effectiveTokens} tokens.`);
    }
    return message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  }

  // 3. Proveedor Mock (modo offline / prueba sin gastar créditos en Antigravity)
  return getMockResponse(system, user);
}

/** Genera respuestas simuladas fieles al sistema de diseño para pruebas sin API key. */
async function getMockResponse(system: string, _user: string): Promise<string> {
  const sys = system.toLowerCase();

  if (sys.includes("agente 1 ·") || sys.includes("01-brief")) {
    return JSON.stringify({
      objective: "Aumentar la tasa de conversión de reservas directas en dispositivos móviles.",
      metric: "Tasa de conversión móvil (% reservas completadas / visitas) y reducción de llamadas a recepción.",
      scope: [
        "Rediseño del listado de habitaciones con precio total visible",
        "Comparador de tarifa flexible y no reembolsable en la misma ficha",
        "Checkout optimizado y simplificado en móvil",
        "Integración de canje de puntos Albora Club"
      ],
      outOfScope: ["Pasarela de pago bancaria externa", "Proceso de check-in en mostrador", "Versión de escritorio"],
      platform: "web-movil",
      deadline: "2026-10-30",
      type: "mejora",
      priority: "alta",
      estimatedScreens: 4,
      openQuestions: [
        "¿Se permite pago mixto (puntos Albora Club + tarjeta) en una misma reserva?",
        "¿La tasa turística se cobra al reservar online o en recepción del hotel?"
      ],
      summary: "Optimización integral del flujo de reserva directa en web móvil para Hoteles Albora, reduciendo fricción y aumentando transparencia de precios."
    });
  }

  if (sys.includes("agente 2 ·") || sys.includes("02-context")) {
    return JSON.stringify({
      findings: [
        { text: "El 71 % de las reservas directas se inician en móvil pero la conversión es la mitad que en desktop.", source: "ticket" },
        { text: "Las llamadas a recepción señalan confusión con las condiciones de tarifas flexibles vs no reembolsables.", source: "ticket" },
        { text: "Mostrar el precio total desglosado desde el listado reduce el abandono en el checkout.", source: "buenas-practicas" },
        { text: "El canje de puntos debe mostrar el descuento en euros de forma inmediata.", source: "a-validar" }
      ],
      reusableComponents: [
        { name: "RoomCard", use: "Listado de resultados con imagen, precio por noche y total" },
        { name: "RateOption", use: "Comparativa de tarifas flexible y no reembolsable" },
        { name: "AmenityList", use: "Servicios incluidos en la habitación" },
        { name: "PointsToggle", use: "Interruptor para aplicar puntos Albora Club" },
        { name: "PriceSummary", use: "Desglose claro de importes e impuestos" }
      ],
      missingComponents: [
        { name: "Stepper", why: "Indicador visual de progreso en el checkout de 3 pasos" }
      ],
      relatedTickets: [],
      risks: [
        "Dependencia de la API de fidelización Albora Club para validación de saldo de puntos en tiempo real."
      ]
    });
  }

  if (sys.includes("agente 3 ·") || sys.includes("03-ux")) {
    return JSON.stringify({
      flow: ["resultados", "ficha-habitacion", "checkout", "confirmacion"],
      screens: [
        {
          id: "resultados",
          title: "Resultados de búsqueda",
          goal: "Permitir elegir habitación con total claridad de precio",
          sections: [
            { name: "Filtros y resumen", components: ["SearchSummary", "Chip"], notes: "Fechas y número de huéspedes visibles" },
            { name: "Listado", components: ["RoomCard"], notes: "Precio total de la estancia destacado" }
          ],
          primaryAction: "Elegir habitación"
        },
        {
          id: "ficha-habitacion",
          title: "Ficha y tarifas",
          goal: "Comparar tarifas y seleccionar régimen sin salir de la vista",
          sections: [
            { name: "Galería y características", components: ["AmenityList"], notes: "M2, vistas y cama" },
            { name: "Opciones de tarifa", components: ["RateOption"], notes: "Flexible vs No reembolsable" }
          ],
          primaryAction: "Continuar a reserva"
        },
        {
          id: "checkout",
          title: "Datos y pago",
          goal: "Completar la reserva en un único paso sin fricción",
          sections: [
            { name: "Datos del huésped", components: ["Input"], notes: "Campos indispensables únicamente" },
            { name: "Puntos Albora Club", components: ["PointsToggle"], notes: "Descuento aplicado en directo" },
            { name: "Resumen de precio", components: ["PriceSummary"], notes: "Total final transparente" }
          ],
          primaryAction: "Confirmar y pagar"
        },
        {
          id: "confirmacion",
          title: "Reserva confirmada",
          goal: "Tranquilizar al huésped con su localizador y detalles clave",
          sections: [
            { name: "Éxito y localizador", components: ["Confirmation"], notes: "Envío a correo electrónico confirmado" }
          ],
          primaryAction: "Ver mi reserva"
        }
      ],
      userStories: [
        "Como huésped móvil, quiero ver el precio final total desde el primer momento para evitar sorpresas al final.",
        "Como huésped, quiero ver claramente la diferencia entre tarifa flexible y no reembolsable antes de elegir.",
        "Como socio de Albora Club, quiero aplicar mis puntos con un solo toque y ver reflejado el descuento."
      ],
      acceptanceCriteria: [
        "El precio total de la estancia se visualiza en cada tarjeta de habitación.",
        "Las condiciones de cancelación se explican en menos de 2 líneas por tarifa.",
        "El formulario de checkout no supera los 5 campos obligatorios."
      ],
      decisions: [
        "Se unifican los pasos de datos personales y pago en un único formulario fluido con Stepper."
      ]
    });
  }

  if (sys.includes("agente 4 ·") || sys.includes("04-copy")) {
    return JSON.stringify({
      strings: {
        resultados: {
          title: "Habitaciones disponibles",
          subtitle: "Albora Palma · 12–15 oct · 2 personas",
          priceNote: "Precio total estancia (impuestos incluidos)",
          primaryCta: "Ver tarifas"
        },
        "ficha-habitacion": {
          title: "Doble Superior con Vistas al Mar",
          flexibleTitle: "Tarifa Flexible",
          flexibleDesc: "Cancela gratis hasta 48 h antes de tu llegada.",
          nonRefundableTitle: "Tarifa Reducida",
          nonRefundableDesc: "15 % de descuento directo. No admite cambios ni devoluciones.",
          primaryCta: "Reservar esta habitación"
        },
        checkout: {
          title: "Completa tu reserva",
          pointsPrompt: "¿Tienes puntos Albora Club?",
          pointsSubtext: "Dispones de 4.200 puntos (equivale a 42,00 € de descuento).",
          primaryCta: "Confirmar reserva segura"
        },
        confirmacion: {
          title: "¡Reserva confirmada!",
          subtext: "Hemos enviado los detalles y el bono a tu correo.",
          locatorLabel: "Localizador",
          primaryCta: "Añadir a mi calendario"
        }
      },
      errors: {
        email: "Introduce un correo electrónico válido (ejemplo: nombre@correo.com)",
        phone: "Indica un teléfono de contacto para emergencias"
      },
      notes: [
        "Tono cercano, mediterráneo y transparente conforme al manual de marca de Albora."
      ]
    });
  }

  const sampleScreensDir = path.join(ROOT, "screens", "ALB-482");
  const readScreen = async (file: string) => {
    try {
      return await readFile(path.join(sampleScreensDir, file), "utf8");
    } catch {
      return `<!doctype html><html lang="es"><head><title>${file}</title></head><body><h1>${file}</h1></body></html>`;
    }
  };

  const sampleFiles = [
    { path: "resultados.html", html: await readScreen("resultados.html") },
    { path: "ficha-habitacion.html", html: await readScreen("ficha-habitacion.html") },
    { path: "checkout.html", html: await readScreen("checkout.html") },
    { path: "confirmacion.html", html: await readScreen("confirmacion.html") },
  ];

  if (sys.includes("agente 5 ·") || sys.includes("05-ui")) {
    return JSON.stringify({
      files: sampleFiles,
      componentsUsed: ["TopBar", "SearchSummary", "RoomCard", "AmenityList", "RateOption", "Input", "PointsToggle", "PriceSummary", "Button", "Confirmation"],
      notes: ["Pantallas codificadas con diseño mobile-first y clases del sistema de diseño Albora DS."]
    });
  }

  if (sys.includes("agente 6 ·") || sys.includes("06-qa")) {
    return JSON.stringify({
      checks: [
        { name: "Contraste AA", status: "ok", detail: "Todos los textos superan la relación 4.5:1 exigida por WCAG 2.1 AA." },
        { name: "Tokens Albora DS", status: "ok", detail: "Uso exclusivo de variables --al-* y clases al-* de albora.css." },
        { name: "Áreas táctiles", status: "ok", detail: "Todos los botones y enlaces interactivos tienen mínimo 44 px de altura." },
        { name: "Coherencia de datos", status: "ok", detail: "Fechas, noches (3) y total (624,00 €) coinciden exactamente entre pantallas." }
      ],
      acceptance: [
        { criterion: "Precio total visible en resultados", met: true },
        { criterion: "Comparación de tarifas en la misma ficha", met: true },
        { criterion: "Canje de puntos Albora Club en checkout", met: true }
      ],
      fixes: [
        "Añadido aria-label a los controles interactivos y confirmada navegación móvil."
      ],
      warnings: [],
      files: sampleFiles
    });
  }

  if (sys.includes("agente 7 ·") || sys.includes("07-delivery")) {
    return JSON.stringify({
      summary: "Propuesta v0 para ALB-482 generada con éxito con 4 pantallas optimizadas para móvil.",
      comment: "🤖 Propuesta v0 lista para revisión\n\nResumen\n- 4 pantallas generadas: resultados, ficha con comparador de tarifas, checkout con puntos y confirmación.\n- Componentes Albora DS utilizados: RoomCard, AmenityList, RateOption, PointsToggle, PriceSummary y Stepper.\n- Accesibilidad: 100 % compliant WCAG AA (contraste, etiquetas accesibles y áreas táctiles ≥ 44px).\n\nPreguntas abiertas para negocio\n- ¿Se permite pago mixto (puntos Albora Club + tarjeta)?\n- ¿La tasa turística se cobra al reservar o en el hotel?\n\nPrevisualización: output/previews/ALB-482/v0/index.html\n\nPara pedir cambios, comenta: /agentes cambios: <lo que quieres cambiar>\nPara aprobar: /agentes aprobar"
    });
  }

  return JSON.stringify({ ok: true });
}
