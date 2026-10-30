import { config } from "../config.js";
import { log } from "../lib/logger.js";
import type { RunState, ScreenFile } from "../types.js";

function escapeXml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderScreenSvg(scr: any, idx: number, total: number): string {
  const isErr = scr.stateType === "error";
  const isCorner = scr.stateType === "corner_case";
  const stateColor = isErr ? "#DE1135" : (isCorner ? "#F69E0C" : "#0E8345");
  const stateBg = isErr ? "#FDF0F2" : (isCorner ? "#FEF6E7" : "#EBF7EE");
  const badgeText = scr.stateBadge || (isErr ? "CASO DE ERROR" : (isCorner ? "CORNER CASE" : "HAPPY PATH"));

  let contentY = 118;
  let bodyElements = "";

  // 1. Map container
  if (scr.showMap) {
    const mm = scr.mapMeta || {};
    bodyElements += `
      <!-- Map Container -->
      <g id="Map_Canvas">
        <rect x="20" y="${contentY}" width="335" height="165" rx="12" fill="#141414" stroke="#262626" stroke-width="1"/>
        <line x1="20" y1="${contentY + 50}" x2="355" y2="${contentY + 50}" stroke="#1F1F1F" stroke-width="1"/>
        <line x1="20" y1="${contentY + 110}" x2="355" y2="${contentY + 110}" stroke="#1F1F1F" stroke-width="1"/>
        <line x1="120" y1="${contentY}" x2="120" y2="${contentY + 165}" stroke="#1F1F1F" stroke-width="1"/>
        <line x1="240" y1="${contentY}" x2="240" y2="${contentY + 165}" stroke="#1F1F1F" stroke-width="1"/>
        <!-- Route Line (Uber Blue) -->
        <path d="M 50 ${contentY + 125} Q 150 ${contentY + 95} 210 ${contentY + 50} T 305 ${contentY + 40}" fill="none" stroke="#276EF1" stroke-width="4" stroke-dasharray="6,4"/>
        <circle cx="50" cy="${contentY + 125}" r="6" fill="#276EF1"/>
        <circle cx="305" cy="${contentY + 40}" r="7" fill="#000000" stroke="#FFFFFF" stroke-width="2"/>
        <!-- Vehicle icon -->
        <g transform="translate(190, ${contentY + 55})">
          <circle cx="16" cy="16" r="18" fill="rgba(39, 110, 241, 0.3)"/>
          <circle cx="16" cy="16" r="14" fill="#000000"/>
          <text x="16" y="21" text-anchor="middle" font-size="14">🚗</text>
        </g>
        <!-- ETA Badge -->
        <rect x="30" y="${contentY + 12}" width="125" height="26" rx="6" fill="${stateColor}"/>
        <text x="92" y="${contentY + 29}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#FFFFFF">${escapeXml(mm.badge || (isErr ? "Incidencia" : "En ruta"))}</text>
        <!-- ETA Time -->
        <rect x="275" y="${contentY + 12}" width="68" height="26" rx="6" fill="rgba(0,0,0,0.85)"/>
        <text x="309" y="${contentY + 29}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#FFFFFF">${escapeXml(mm.eta || "3 min")}</text>
        <!-- Driver Info Bar -->
        <rect x="28" y="${contentY + 126}" width="319" height="30" rx="6" fill="rgba(0,0,0,0.88)"/>
        <text x="40" y="${contentY + 146}" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="600" fill="#FFFFFF">${escapeXml(mm.driverName || "Carlos M.")} · ★ ${escapeXml(mm.rating || "4.95")}</text>
        <text x="335" y="${contentY + 146}" text-anchor="end" font-family="Inter, -apple-system, sans-serif" font-size="11" fill="#AFAFAF">${escapeXml(mm.vehicle || "Toyota Corolla")}</text>
      </g>
    `;
    contentY += 178;
  }

  // 2. Main Title and Subtitle
  bodyElements += `
    <text x="24" y="${contentY + 22}" font-family="Inter, -apple-system, sans-serif" font-size="20" font-weight="800" fill="#000000">${escapeXml(scr.mainTitle || scr.shortName || "Pantalla")}</text>
  `;
  contentY += 32;

  if (scr.mainSubtitle) {
    bodyElements += `
      <text x="24" y="${contentY + 14}" font-family="Inter, -apple-system, sans-serif" font-size="12.5" font-weight="400" fill="#545454">${escapeXml(scr.mainSubtitle)}</text>
    `;
    contentY += 26;
  }

  // 3. Banner
  if (scr.banner && scr.banner.text) {
    bodyElements += `
      <g id="Banner">
        <rect x="20" y="${contentY}" width="335" height="40" rx="8" fill="${stateBg}" stroke="${stateColor}" stroke-width="1.5"/>
        <text x="34" y="${contentY + 25}" font-family="Inter, -apple-system, sans-serif" font-size="11.5" font-weight="600" fill="${stateColor}">${escapeXml(scr.banner.text.slice(0, 52))}</text>
      </g>
    `;
    contentY += 48;
  }

  // 4. Items / Vehicle Cards
  const items = Array.isArray(scr.items) && scr.items.length > 0 ? scr.items : [];
  if (items.length > 0) {
    items.slice(0, 3).forEach((it: any) => {
      const isHl = Boolean(it.highlight);
      const strokeCol = isHl ? (isErr ? "#DE1135" : "#000000") : "#E2E2E2";
      const strokeW = isHl ? "2" : "1";
      const bgCol = isHl ? "#FFFFFF" : "#FAFAFA";
      const iconText = it.icon || (isErr ? "💳" : (scr.showMap ? "📍" : "🚗"));

      bodyElements += `
        <g id="Item_Card" transform="translate(20, ${contentY})">
          <rect width="335" height="58" rx="10" fill="${bgCol}" stroke="${strokeCol}" stroke-width="${strokeW}"/>
          <!-- Icon box -->
          <rect x="12" y="11" width="36" height="36" rx="8" fill="${stateBg}"/>
          <text x="30" y="35" text-anchor="middle" font-size="18">${escapeXml(iconText)}</text>
          <!-- Item Title -->
          <text x="58" y="27" font-family="Inter, -apple-system, sans-serif" font-size="13.5" font-weight="700" fill="#000000">${escapeXml(it.title || it.name || "Opción")}</text>
          <!-- Item Subtitle -->
          <text x="58" y="44" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="400" fill="#545454">${escapeXml(it.subtitle || it.desc || "")}</text>
          <!-- Price -->
          ${it.price ? `<text x="320" y="35" text-anchor="end" font-family="Inter, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#000000">${escapeXml(it.price)}</text>` : ""}
        </g>
      `;
      contentY += 66;
    });
  }

  // 5. Metric Cards (PIN, Matrícula, ETA)
  const cards = Array.isArray(scr.cards) && scr.cards.length > 0 ? scr.cards : [];
  if (cards.length > 0) {
    bodyElements += `<g id="Metric_Cards" transform="translate(20, ${contentY})">`;
    const colW = (335 - 10) / 2;
    cards.slice(0, 2).forEach((c: any, cIdx: number) => {
      const cX = cIdx * (colW + 10);
      bodyElements += `
        <rect x="${cX}" y="0" width="${colW}" height="54" rx="8" fill="#F6F6F6"/>
        <text x="${cX + colW / 2}" y="20" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="500" fill="#757575">${escapeXml(c.label)}</text>
        <text x="${cX + colW / 2}" y="42" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="15" font-weight="800" fill="#000000">${escapeXml(c.value)}</text>
      `;
    });
    bodyElements += `</g>`;
    contentY += 62;
  }

  // 6. Bottom CTA Button (Fixed at y=724)
  const ctaBg = (isErr || scr.ctaVariant === "negative") ? "#DE1135" : "#000000";
  let ctaLabel = scr.cta || (idx < total - 1 ? "Continuar" : "Finalizar");
  if (/simul/i.test(ctaLabel)) {
    ctaLabel = isErr ? "Reintentar" : (idx < total - 1 ? "Continuar" : "Finalizar");
  }
  const ctaIcon = isErr ? "↺" : "➔";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 375 812" width="375" height="812">
    <!-- Frame Background with Phone Bezel -->
    <rect width="375" height="812" rx="36" fill="#FFFFFF" stroke="#000000" stroke-width="4"/>
    
    <!-- iOS Status Bar -->
    <text x="32" y="32" font-family="Inter, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#000000">9:41</text>
    <text x="343" y="32" text-anchor="end" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="700" fill="#000000">●●● 5G</text>

    <!-- Header: Uber Logo & Step Counter -->
    <text x="24" y="66" font-family="Inter, -apple-system, sans-serif" font-size="20" font-weight="900" fill="#000000">Uber</text>
    <text x="351" y="66" text-anchor="end" font-family="Inter, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#545454">${escapeXml(scr.navTitle || ("Paso " + (idx + 1)))} · ${idx + 1}/${total}</text>

    <!-- Step Progress Dots (Official Uber Base mobile) -->
    <g id="Step_Dots" transform="translate(24, 76)">
      ${Array.from({ length: total }).map((_, i) => {
        const dotW = Math.round((327 - (total - 1) * 6) / total);
        const dotX = i * (dotW + 6);
        const dotCol = i <= idx ? "#000000" : "#E2E2E2";
        return `<rect x="${dotX}" y="0" width="${dotW}" height="3" rx="1.5" fill="${dotCol}"/>`;
      }).join("")}
    </g>

    <!-- State Badge Tag -->
    <rect x="24" y="86" width="112" height="22" rx="5" fill="${stateBg}"/>
    <text x="80" y="101" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="10" font-weight="800" fill="${stateColor}">${escapeXml(badgeText)}</text>

    <!-- Dynamic Content Body -->
    ${bodyElements}

    <!-- Bottom Action Button (Uber Base DS Official Button) -->
    <g id="CTA_Button" transform="translate(20, 732)">
      <rect width="335" height="48" rx="8" fill="${ctaBg}"/>
      <text x="167.5" y="30" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#FFFFFF">${escapeXml(ctaLabel)} ${ctaIcon}</text>
    </g>
  </svg>`;
}

const defaultFullFlowScreens = [
  {
    step: 1,
    shortName: "1 · Selección de servicio",
    stateType: "happy_path",
    stateBadge: "HAPPY PATH",
    stateDesc: "Selección nominal de servicio con precio cerrado garantizado",
    functionality: "Cotización instantánea en vivo y selección de gama (UberX, Comfort, Black)",
    designJustification: "Elimina la incertidumbre tarifaria mostrando el precio final cerrado antes de reservar para elevar la tasa de conversión.",
    hint: "Elige entre UberX, Comfort o Black",
    navTitle: "Viaje",
    mainTitle: "Elige tu vehículo",
    mainSubtitle: "Tarifas cerradas garantizadas y tiempos de recogida en vivo",
    showMap: false,
    items: [
      { title: "UberX · 4 plazas", subtitle: "Llegada en 3 min · Coche estándar", icon: "🚗", highlight: true, price: "14,20 €" },
      { title: "Uber Comfort · 4 plazas", subtitle: "Llegada en 4 min · Espacio extra y silencio", icon: "🚘", highlight: false, price: "18,50 €" },
      { title: "Uber Black · Chófer", subtitle: "Llegada en 6 min · Chófer profesional", icon: "🖤", highlight: false, price: "27,80 €" }
    ],
    cards: [
      { label: "Tiempo estimado", value: "3 min" },
      { label: "Punto de recogida", value: "Terminal 1" }
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
    functionality: "Detección proactiva de retención de tráfico y sugerencia de punto exprés peatonal",
    designJustification: "Anticipa la fricción antes de que el usuario la experimente, ahorrando 10 minutos de atasco mediante una caminata guiada de 50m.",
    hint: "Aviso anticipado para evitar retenciones de tráfico",
    navTitle: "Aviso de ruta",
    mainTitle: "Zona con alta demanda de tráfico",
    mainSubtitle: "Para evitar 10 min de atasco, camina 50m al punto exprés",
    showMap: true,
    mapMeta: {
      badge: "Punto exprés a 50 m",
      eta: "2 min",
      driverName: "Carlos M.",
      rating: "4.95",
      vehicle: "Toyota Corolla · 4821 LKY"
    },
    items: [
      { title: "Punto de encuentro optimizado", subtitle: "Acércate al Parking Exprés (carril B)", icon: "📍", highlight: true }
    ],
    cards: [
      { label: "Ahorro de tiempo", value: "-10 min" },
      { label: "Distancia a pie", value: "50 m" }
    ],
    banner: { text: "Alta afluencia en terminal: punto de encuentro optimizado", tone: "warning" },
    cta: "Aceptar nuevo punto de encuentro",
    ctaVariant: "primary"
  },
  {
    step: 3,
    shortName: "3 · Confirmación y autorización",
    stateType: "happy_path",
    stateBadge: "HAPPY PATH",
    stateDesc: "Revisión nominal de detalles, punto de encuentro y autorización",
    functionality: "Desglose transparente del itinerario, punto de recogida y método de pago",
    designJustification: "Genera certidumbre previa a la transacción económica, garantizando consentimiento explícito y reduciendo reclamaciones posteriores.",
    hint: "Resumen previo al servicio",
    navTitle: "Confirmación",
    mainTitle: "Revisa los detalles del viaje",
    mainSubtitle: "Tarifa fijada de 14,20 € sin recargos imprevistos",
    showMap: false,
    items: [
      { title: "Punto de recogida", subtitle: "Aeropuerto de Valencia · Parking Exprés", icon: "📍", highlight: false },
      { title: "Destino", subtitle: "Plaza del Ayuntamiento, 1", icon: "🏁", highlight: false },
      { title: "Método de pago", subtitle: "Tarjeta Visa terminada en •••• 4242", icon: "💳", highlight: true, price: "14,20 €" }
    ],
    cards: [
      { label: "Total viaje", value: "14,20 €" },
      { label: "Uber Cash", value: "12,50 € disp." }
    ],
    cta: "Confirmar viaje",
    ctaVariant: "primary"
  },
  {
    step: 4,
    shortName: "4 · Caso de Error: Fallo y recuperación",
    stateType: "error",
    stateBadge: "CASO DE ERROR",
    stateDesc: "Tarjeta declinada con recuperación instantánea usando Uber Cash sin dead-ends",
    functionality: "Gestión transparente de declinación bancaria con rescate automático vía Uber Cash",
    designJustification: "Erradica el abandono de compra (cero callejones sin salida); no culpa al usuario y ofrece un método alternativo preautorizado en 1 clic.",
    hint: "Resolución guiada de incidencia de cobro",
    navTitle: "Incidencia",
    mainTitle: "No se pudo procesar tu tarjeta",
    mainSubtitle: "Tu banco ha rechazado la operación. Puedes cambiar a Uber Cash sin perder el vehículo.",
    showMap: false,
    items: [
      { title: "Uber Cash (Saldo: 18,50 €)", subtitle: "Pagar 14,20 € con saldo prepago · Instantáneo", icon: "💳", highlight: true, price: "14,20 €" },
      { title: "Tarjeta Mastercard •••• 9812", subtitle: "Usar método de pago secundario guardado", icon: "🏦", highlight: false }
    ],
    cards: [
      { label: "Importe", value: "14,20 €" },
      { label: "Estado", value: "Listo para reintentar" }
    ],
    banner: { text: "Tarjeta declinada por la entidad: cambia de método", tone: "negative" },
    cta: "Reintentar y pagar con Uber Cash",
    ctaVariant: "negative"
  },
  {
    step: 5,
    shortName: "5 · Conductor en camino y PIN",
    stateType: "happy_path",
    stateBadge: "HAPPY PATH",
    stateDesc: "Flujo recuperado con éxito: conductor asignado, seguimiento GPS en tiempo real y código PIN",
    functionality: "Seguimiento satelital en vivo del vehículo asignado y verificación física bidireccional por PIN",
    designJustification: "Reduce la ansiedad del usuario mediante telemetría en tiempo real y garantiza seguridad física verificando conductor y matrícula antes de subir.",
    hint: "Servicio activo y seguro",
    navTitle: "En camino",
    mainTitle: "Carlos está a 2 minutos",
    mainSubtitle: "Dirígete al punto de recogida y muestra tu PIN de seguridad (7492)",
    showMap: true,
    mapMeta: {
      badge: "En camino hacia ti",
      eta: "2 min",
      driverName: "Carlos M.",
      rating: "4.95",
      vehicle: "Toyota Corolla · 4821 LKY"
    },
    items: [
      { title: "PIN de seguridad", subtitle: "Compártelo con Carlos antes de subir al vehículo", icon: "🔒", highlight: true }
    ],
    cards: [
      { label: "PIN", value: "7492" },
      { label: "Matrícula", value: "4821 LKY" }
    ],
    cta: "Contactar con el conductor",
    ctaVariant: "primary"
  }
];

let latestScreens: any[] = defaultFullFlowScreens;
let latestRunKey = "KAN-1";
let latestChangelog: any = null;

let customTargetUrl: string = config.figma.fileUrl || "https://www.figma.com/design/dcKVRyGjsYiK3Cl1iBHeXc/Untitled?node-id=0-1";
let customFileKey: string = config.figma.fileKey || "dcKVRyGjsYiK3Cl1iBHeXc";

export function setFigmaTarget(url: string) {
  if (!url || typeof url !== "string") return;
  customTargetUrl = url.trim();
  const match = customTargetUrl.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    customFileKey = match[1];
  }
}

export function getFigmaTarget() {
  return {
    fileUrl: customTargetUrl,
    fileKey: customFileKey
  };
}

export function setLatestFigmaDesign(key: string, screens: any[], changelog?: any) {
  latestRunKey = key;
  if (Array.isArray(screens) && screens.length > 0) {
    if (screens[0] && typeof screens[0].html === "string" && !screens[0].mainTitle) {
      return;
    }
    latestScreens = screens;
  }
  if (changelog !== undefined) {
    latestChangelog = changelog;
  }
}

export function getLatestFigmaDesign() {
  const activeScreens = latestScreens.length > 0 ? latestScreens : defaultFullFlowScreens;
  const total = activeScreens.length;

  const screenSvgs = activeScreens.map((scr, idx) => ({
    step: scr.step || (idx + 1),
    name: scr.shortName || scr.mainTitle || `Pantalla ${idx + 1}`,
    svg: renderScreenSvg(scr, idx, total)
  }));

  return {
    key: latestRunKey || "KAN-1",
    fileKey: customFileKey || config.figma.fileKey,
    fileUrl: customTargetUrl || config.figma.fileUrl,
    screens: activeScreens,
    screenSvgs,
    changelog: latestChangelog
  };
}

export async function pushToFigma(run: RunState, files: ScreenFile[]): Promise<string | null> {
  const uiScreens = (run.outputs.ui as any)?.screens;
  if (Array.isArray(uiScreens) && uiScreens.length > 0) {
    const lastHistory = run.history && run.history.length > 0 ? run.history[run.history.length - 1] : null;
    const changelogInfo = {
      version: run.version,
      request: lastHistory?.request || "",
      summary: (run.outputs.delivery as any)?.summary || (run.outputs.brief as any)?.summary || "",
      changes: (run.outputs.delivery as any)?.changes || []
    };
    setLatestFigmaDesign(run.key, uiScreens, changelogInfo);
  }
  const fileKey = customFileKey || config.figma.fileKey || "dcKVRyGjsYiK3Cl1iBHeXc";
  const fileUrl = customTargetUrl || config.figma.fileUrl;
  log.info(`[FIGMA] Diseño preparado para archivo Figma: ${fileUrl} (${files.length} pantallas)`);

  if (!config.figma.accessToken) {
    return fileUrl;
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
