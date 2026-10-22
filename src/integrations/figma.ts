import { config } from "../config.js";
import { log } from "../lib/logger.js";
import type { RunState, ScreenFile } from "../types.js";

const defaultFullFlowScreens = [
  {
    step: 1,
    shortName: "1 · Selección de servicio",
    stateType: "happy_path",
    stateBadge: "HAPPY PATH",
    stateDesc: "Selección nominal de servicio con precio cerrado garantizado",
    hint: "Elige entre UberX, Comfort o Black",
    navTitle: "Viaje",
    mainTitle: "Elige tu vehículo",
    mainSubtitle: "Tarifas cerradas garantizadas y tiempos de recogida en vivo",
    showMap: false,
    items: [
      { name: "UberX · 4 plazas", desc: "Llegada en 3 min · Coche estándar", price: "14,20 €" },
      { name: "Uber Comfort · 4 plazas", desc: "Llegada en 4 min · Espacio extra y silencio", price: "18,50 €" },
      { name: "Uber Black · Chófer", desc: "Llegada en 6 min · Chófer profesional", price: "27,80 €" }
    ],
    cta: "Continuar con UberX",
    ctaVariant: "primary"
  },
  {
    step: 2,
    shortName: "2 · Corner Case: Alta demanda y desvío",
    stateType: "corner_case",
    stateBadge: "CORNER CASE",
    stateDesc: "Condición atípica de alta demanda con punto de encuentro sugerido a 50m",
    hint: "Aviso anticipado para evitar retenciones de tráfico",
    navTitle: "Aviso de ruta",
    mainTitle: "Zona con alta demanda de tráfico",
    mainSubtitle: "Para evitar 10 min de atasco, camina 50m al punto exprés",
    showMap: true,
    items: [
      { name: "Punto de encuentro optimizado", desc: "Acércate al Parking Exprés (carril B)", price: "-10 min" }
    ],
    cta: "Aceptar nuevo punto de encuentro",
    ctaVariant: "primary"
  },
  {
    step: 3,
    shortName: "3 · Confirmación y autorización",
    stateType: "happy_path",
    stateBadge: "HAPPY PATH",
    stateDesc: "Revisión nominal de detalles, punto de encuentro y autorización",
    hint: "Resumen previo al servicio",
    navTitle: "Confirmación",
    mainTitle: "Revisa los detalles del viaje",
    mainSubtitle: "Tarifa fijada de 14,20 € sin recargos imprevistos",
    showMap: false,
    items: [
      { name: "Punto de recogida", desc: "Aeropuerto de Valencia · Parking Exprés", price: "" },
      { name: "Destino", desc: "Plaza del Ayuntamiento, 1", price: "" },
      { name: "Método de pago", desc: "Tarjeta Visa terminada en •••• 4242", price: "14,20 €" }
    ],
    cta: "Confirmar viaje",
    ctaVariant: "primary"
  },
  {
    step: 4,
    shortName: "4 · Caso de Error: Fallo y recuperación",
    stateType: "error",
    stateBadge: "CASO DE ERROR",
    stateDesc: "Simulación de tarjeta declinada con recuperación instantánea usando Uber Cash sin dead-ends",
    hint: "Resolución guiada de incidencia de cobro",
    navTitle: "Incidencia",
    mainTitle: "No se pudo procesar tu tarjeta",
    mainSubtitle: "Tu banco ha rechazado la operación. Puedes cambiar a Uber Cash sin perder el vehículo.",
    showMap: false,
    items: [
      { name: "Uber Cash (Saldo: 18,50 €)", desc: "Pagar con saldo prepago · Instantáneo", price: "14,20 €" },
      { name: "Tarjeta Mastercard •••• 9812", desc: "Usar método de pago secundario guardado", price: "" }
    ],
    cta: "Reintentar y pagar con Uber Cash",
    ctaVariant: "negative"
  },
  {
    step: 5,
    shortName: "5 · Conductor en camino y PIN",
    stateType: "happy_path",
    stateBadge: "HAPPY PATH",
    stateDesc: "Flujo recuperado con éxito: conductor asignado, seguimiento GPS en tiempo real y código PIN",
    hint: "Servicio activo y seguro",
    navTitle: "En camino",
    mainTitle: "Carlos está a 2 minutos",
    mainSubtitle: "Dirígete al punto de recogida y muestra tu PIN de seguridad (7492)",
    showMap: true,
    items: [
      { name: "PIN de seguridad: 7492", desc: "Compártelo con Carlos antes de subir al vehículo", price: "" },
      { name: "Toyota Corolla · 4821 LKY", desc: "Conductor: Carlos M. (★ 4.95)", price: "2 min" }
    ],
    cta: "Contactar con el conductor",
    ctaVariant: "primary"
  }
];

let latestScreens: any[] = defaultFullFlowScreens;
let latestRunKey = "KAN-1";

export function setLatestFigmaDesign(key: string, screens: any[]) {
  latestRunKey = key;
  if (Array.isArray(screens) && screens.length > 0) {
    latestScreens = screens.map((scr, idx) => ({
      step: scr.step || (idx + 1),
      shortName: scr.shortName || scr.mainTitle || `Pantalla ${idx + 1}`,
      stateType: scr.stateType || "happy_path",
      stateBadge: scr.stateBadge || (scr.stateType === "error" ? "CASO DE ERROR" : scr.stateType === "corner_case" ? "CORNER CASE" : "HAPPY PATH"),
      stateDesc: scr.stateDesc || "",
      navTitle: scr.navTitle || "",
      mainTitle: scr.mainTitle || scr.shortName || "Pantalla de Producto",
      mainSubtitle: scr.mainSubtitle || "",
      showMap: Boolean(scr.showMap),
      items: Array.isArray(scr.items) ? scr.items.map((it: any) => ({
        name: it.title || it.name || "Opción",
        desc: it.subtitle || it.desc || "",
        price: it.price || ""
      })) : [],
      cta: scr.cta || "Continuar",
      ctaVariant: scr.ctaVariant || "primary"
    }));
  }
}

export function getLatestFigmaDesign() {
  return {
    key: latestRunKey || "KAN-1",
    fileKey: config.figma.fileKey,
    fileUrl: config.figma.fileUrl,
    screens: latestScreens.length > 0 ? latestScreens : defaultFullFlowScreens
  };
}

export async function pushToFigma(run: RunState, files: ScreenFile[]): Promise<string | null> {
  setLatestFigmaDesign(run.key, files);
  const fileKey = config.figma.fileKey || "dcKVRyGjsYiK3Cl1iBHeXc";
  log.info(`[FIGMA] Diseño preparado para archivo Figma: ${config.figma.fileUrl} (${files.length} pantallas)`);

  if (!config.figma.accessToken) {
    return config.figma.fileUrl;
  }

  try {
    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}/comments`, {
      method: "POST",
      headers: {
        "X-Figma-Token": config.figma.accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `🤖 [Agente Uber Base] Flujo completado para ${run.key} (v${run.version}). ${files.length} pantallas generadas: ${run.previewUrl || ""}`,
        client_meta: { node_id: "0:1" }
      })
    });
    if (res.ok) {
      log.info(`[FIGMA] Comentario publicado en archivo ${fileKey}`);
    } else {
      log.warn(`[FIGMA] API Figma status ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    log.error(`[FIGMA] Error al conectar con Figma:`, err);
  }

  return config.figma.fileUrl;
}
