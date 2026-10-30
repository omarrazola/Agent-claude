// Script de Figma para renderizar el Flujo de Orquestación de Agentes
// Puedes ejecutarlo directamente desde la Consola de Figma (Plugins > Development > Open Console)
// o a través del plugin oficial del proyecto.

(async function renderOrchestrationFlow() {
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  } catch (e) {
    console.warn("Fallo cargando fuente Inter:", e);
  }

  function makeText(str, size, weight, color, wrapWidth) {
    const t = figma.createText();
    t.characters = str || "";
    t.fontSize = size;
    t.fontName = { family: "Inter", style: weight || "Regular" };
    if (color) t.fills = [{ type: "SOLID", color }];
    if (wrapWidth) {
      t.resize(wrapWidth, 20);
      t.textAutoResize = "HEIGHT";
    }
    return t;
  }

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const bigint = parseInt(clean, 16);
    return {
      r: ((bigint >> 16) & 255) / 255,
      g: ((bigint >> 8) & 255) / 255,
      b: (bigint & 255) / 255,
    };
  }

  function createVectorGroupFromSvg(svgString, name, parentNode) {
    const tempFrame = figma.createNodeFromSvg(svgString);
    const children = [];
    while (tempFrame.children.length > 0) {
      const child = tempFrame.children[0];
      child.x += tempFrame.x;
      child.y += tempFrame.y;
      parentNode.appendChild(child);
      children.push(child);
    }
    tempFrame.remove();
    if (children.length > 0) {
      try {
        const group = figma.group(children, parentNode);
        group.name = name || "Líneas de Flujo";
        return group;
      } catch (e) {
        console.warn("No se pudo agrupar:", e);
      }
    }
    return null;
  }

  const sectionName = "🤖 Flujo de Orquestación · Albora Design Agents";
  const old = figma.currentPage.findOne((n) => n.name === sectionName);
  if (old) old.remove();

  const sec = figma.createSection();
  sec.name = sectionName;
  const secW = 2700;
  const secH = 1450;
  const secX = Math.round(figma.viewport.center.x - secW / 2);
  const secY = Math.round(figma.viewport.center.y - secH / 2);
  sec.x = secX;
  sec.y = secY;

  if (typeof sec.resizeWithoutConstraints === "function") {
    sec.resizeWithoutConstraints(secW, secH);
  } else if (typeof sec.resize === "function") {
    sec.resize(secW, secH);
  }

  // Header superior
  const hTitle = makeText("ARQUITECTURA Y FLUJO DE ORQUESTACIÓN DE AGENTES", 26, "Bold", { r: 0, g: 0, b: 0 });
  hTitle.x = 60; hTitle.y = 50; sec.appendChild(hTitle);

  const hSub = makeText("Pipeline autónomo secuencial (7 pasos) con integración de Design System y bucle de iteración humana (Human-in-the-Loop)", 13.5, "Regular", { r: 0.35, g: 0.35, b: 0.35 });
  hSub.x = 60; hSub.y = 92; sec.appendChild(hSub);

  // Helper para crear tarjetas estilizadas
  function createCard({ title, badge, badgeColor, badgeBg, width, items, borderColor, bg = "#FFFFFF", subtitle }) {
    const card = figma.createFrame();
    card.name = title;
    card.layoutMode = "VERTICAL";
    card.primaryAxisSizingMode = "AUTO";
    card.counterAxisSizingMode = "FIXED";
    card.resize(width, 100);
    card.paddingLeft = 18; card.paddingRight = 18;
    card.paddingTop = 16; card.paddingBottom = 18;
    card.itemSpacing = 10;
    card.cornerRadius = 14;
    card.fills = [{ type: "SOLID", color: hexToRgb(bg) }];
    card.strokes = [{ type: "SOLID", color: hexToRgb(borderColor || "#E2E2E2") }];
    card.strokeWeight = 1.5;

    // Header de tarjeta
    const head = figma.createFrame();
    head.layoutMode = "HORIZONTAL";
    head.primaryAxisAlignItems = "SPACE_BETWEEN";
    head.counterAxisAlignItems = "CENTER";
    head.layoutAlign = "STRETCH";
    head.fills = [];

    const titleTxt = makeText(title, 14.5, "Bold", { r: 0.05, g: 0.05, b: 0.05 }, width - 140);
    titleTxt.layoutAlign = "STRETCH";
    head.appendChild(titleTxt);

    if (badge) {
      const bFrame = figma.createFrame();
      bFrame.paddingLeft = 8; bFrame.paddingRight = 8;
      bFrame.paddingTop = 4; bFrame.paddingBottom = 4;
      bFrame.cornerRadius = 6;
      bFrame.fills = [{ type: "SOLID", color: hexToRgb(badgeBg || "#F3F4F6") }];
      bFrame.layoutMode = "HORIZONTAL";
      const bTxt = makeText(badge, 9.5, "Bold", hexToRgb(badgeColor || "#374151"));
      bFrame.appendChild(bTxt);
      head.appendChild(bFrame);
    }
    card.appendChild(head);

    if (subtitle) {
      const subTxt = makeText(subtitle, 11, "Medium", { r: 0.45, g: 0.45, b: 0.45 }, width - 36);
      subTxt.layoutAlign = "STRETCH";
      card.appendChild(subTxt);
    }

    if (Array.isArray(items) && items.length > 0) {
      const listFrame = figma.createFrame();
      listFrame.layoutMode = "VERTICAL";
      listFrame.primaryAxisSizingMode = "AUTO";
      listFrame.layoutAlign = "STRETCH";
      listFrame.itemSpacing = 6;
      listFrame.fills = [];

      items.forEach((it) => {
        const row = figma.createFrame();
        row.layoutMode = "HORIZONTAL";
        row.primaryAxisAlignItems = "MIN";
        row.counterAxisAlignItems = "MIN";
        row.itemSpacing = 6;
        row.layoutAlign = "STRETCH";
        row.fills = [];

        const bullet = makeText(it.icon || "•", 10.5, "Bold", hexToRgb(it.color || "#4B5563"));
        row.appendChild(bullet);

        const rowTxt = makeText(it.text, 10, it.bold ? "Bold" : "Regular", hexToRgb(it.textColor || "#1F2937"), width - 64);
        rowTxt.layoutAlign = "STRETCH";
        row.appendChild(rowTxt);

        listFrame.appendChild(row);
      });
      card.appendChild(listFrame);
    }

    return card;
  }

  // --- 1. COLUMNA 1: DISPARADORES & ENTRADA (X: 60) ---
  const col1X = 60;
  const col1W = 380;
  const col1Title = makeText("1. ENTRADA Y DISPARADORES", 14, "Bold", hexToRgb("#4F46E5"));
  col1Title.x = col1X; col1Title.y = 150; sec.appendChild(col1Title);

  const cardJira = createCard({
    title: "Jira Software Webhook",
    badge: "EVENTO",
    badgeBg: "#EEF2FF",
    badgeColor: "#4338CA",
    width: col1W,
    subtitle: "Petición creada con etiqueta «diseño»",
    borderColor: "#C7D2FE",
    items: [
      { text: "Evento issue_created / issue_updated", icon: "⚡" },
      { text: "Filtro estricto por etiquetas del proyecto", icon: "🔍" },
      { text: "Autenticación segura con firma de payload", icon: "🔒" },
    ],
  });
  cardJira.x = col1X; cardJira.y = 190; sec.appendChild(cardJira);

  const cardTrello = createCard({
    title: "Trello Board Webhook",
    badge: "EVENTO",
    badgeBg: "#ECFDF5",
    badgeColor: "#065F46",
    width: col1W,
    subtitle: "Tarjeta movida a lista «Diseño · Nuevo»",
    borderColor: "#A7F3D0",
    items: [
      { text: "Webhook HEAD/POST en src/webhooks/trello.ts", icon: "⚡" },
      { text: "Verificación criptográfica HMAC-SHA1", icon: "🛡️" },
    ],
  });
  cardTrello.x = col1X; cardTrello.y = 360; sec.appendChild(cardTrello);

  const cardCli = createCard({
    title: "CLI & Local Runner",
    badge: "MANUAL",
    badgeBg: "#F3F4F6",
    badgeColor: "#374151",
    width: col1W,
    subtitle: "npm run demo:local / scripts/run-local.ts",
    borderColor: "#D1D5DB",
    items: [
      { text: "Ejecución simulada o con fixtures locales", icon: "💻" },
      { text: "Ideal para tests unitarios y demos de cliente", icon: "🧪" },
    ],
  });
  cardCli.x = col1X; cardCli.y = 510; sec.appendChild(cardCli);

  const cardNorm = createCard({
    title: "Normalizador de Ticket",
    badge: "GATEWAY",
    badgeBg: "#FEF3C7",
    badgeColor: "#92400E",
    width: col1W,
    subtitle: "src/server.ts & src/pipeline/orchestrator.ts",
    borderColor: "#FDE68A",
    items: [
      { text: "Convierte cualquier origen a Ticket canónico", icon: "🔄", bold: true },
      { text: "Gestión de concurrencia: withLock(ticket.key)", icon: "🔐" },
      { text: "Inicializa RunState (v0, status: running)", icon: "📁" },
    ],
  });
  cardNorm.x = col1X; cardNorm.y = 660; sec.appendChild(cardNorm);

  // --- 2. COLUMNA 2: CADENA DE 7 AGENTES (X: 490 a 1980) ---
  const col2X = 490;
  const col2Title = makeText("2. PIPELINE SECUENCIAL DE LOS 7 AGENTES (ORQUESTADOR)", 14, "Bold", hexToRgb("#0F172A"));
  col2Title.x = col2X; col2Title.y = 150; sec.appendChild(col2Title);

  // Fila superior: Agentes 1, 2, 3, 4
  const aW = 340;
  const gapX = 30;

  // Agente 1: Brief
  const a1X = col2X;
  const a1Card = createCard({
    title: "1. Analista de Brief",
    badge: "01-brief.md",
    badgeBg: "#F3F4F6",
    badgeColor: "#111827",
    width: aW,
    subtitle: "Extracción y orden de requisitos",
    borderColor: "#E5E7EB",
    items: [
      { text: "Entrada: Ticket normalizado", icon: "📥", bold: true },
      { text: "Salida JSON: objective, metric, scope", icon: "📤" },
      { text: "Define outOfScope y platform (web/móvil)", icon: "🎯" },
      { text: "Convierte dudas en openQuestions", icon: "❓" },
    ],
  });
  a1Card.x = a1X; a1Card.y = 190; sec.appendChild(a1Card);

  // Agente 2: Contexto
  const a2X = a1X + aW + gapX;
  const a2Card = createCard({
    title: "2. Agente de Contexto",
    badge: "02-context.md",
    badgeBg: "#EFF6FF",
    badgeColor: "#1E40AF",
    width: aW,
    subtitle: "Alineación con Albora DS",
    borderColor: "#BFDBFE",
    items: [
      { text: "Entrada: Brief + components/README.md", icon: "📥", bold: true },
      { text: "Tokens: tokens/base.tokens.json", icon: "🎨" },
      { text: "Salida JSON: reusableComponents", icon: "📤" },
      { text: "Detecta componentes faltantes (missing)", icon: "⚠️" },
    ],
  });
  a2Card.x = a2X; a2Card.y = 190; sec.appendChild(a2Card);

  // Agente 3: Arquitecto UX
  const a3X = a2X + aW + gapX;
  const a3Card = createCard({
    title: "3. Arquitecto UX",
    badge: "03-ux.md",
    badgeBg: "#F5F3FF",
    badgeColor: "#5B21B6",
    width: aW,
    subtitle: "Estructura de viaje y pantallas",
    borderColor: "#DDD6FE",
    items: [
      { text: "Entrada: Brief + Contexto", icon: "📥", bold: true },
      { text: "Salida JSON: flow, screens, userStories", icon: "📤" },
      { text: "Criterios de aceptación funcionales", icon: "📋" },
      { text: "Define Happy Path, Error & Corner cases", icon: "🗺️" },
    ],
  });
  a3Card.x = a3X; a3Card.y = 190; sec.appendChild(a3Card);

  // Agente 4: Redactor UX
  const a4X = a3X + aW + gapX;
  const a4Card = createCard({
    title: "4. Redactor UX",
    badge: "04-copy.md",
    badgeBg: "#FDF2F8",
    badgeColor: "#9D174D",
    width: aW,
    subtitle: "Voz, personalidad y microcopy",
    borderColor: "#FBCFE8",
    items: [
      { text: "Entrada: Flujo UX + Brief", icon: "📥", bold: true },
      { text: "Guía: guidelines/tono-de-voz.md", icon: "🗣️" },
      { text: "Salida JSON: strings por cada pantalla", icon: "📤" },
      { text: "Microcopys directos, amables y claros", icon: "✍️" },
    ],
  });
  a4Card.x = a4X; a4Card.y = 190; sec.appendChild(a4Card);

  // Fila inferior: Agentes 5, 6, Preview Generator, Agente 7 (Y: 530)
  const row2Y = 530;

  // Agente 5: UI
  const a5X = a1X;
  const a5Card = createCard({
    title: "5. Agente de UI",
    badge: "05-ui.md",
    badgeBg: "#FEF2F2",
    badgeColor: "#991B1B",
    width: aW,
    subtitle: "Generación de pantallas en HTML/CSS",
    borderColor: "#FECACA",
    items: [
      { text: "Entrada: UX + Copy + Contexto", icon: "📥", bold: true },
      { text: "Estilos: css/base.css (solo tokens DS)", icon: "🎨" },
      { text: "Salida JSON: files (HTML de pantallas)", icon: "📤" },
      { text: "Jerarquía visual, CTA prominente y grids", icon: "📱" },
    ],
  });
  a5Card.x = a5X; a5Card.y = row2Y; sec.appendChild(a5Card);

  // Agente 6: QA
  const a6X = a5X + aW + gapX;
  const a6Card = createCard({
    title: "6. Revisor QA",
    badge: "06-qa.md",
    badgeBg: "#ECFDF5",
    badgeColor: "#065F46",
    width: aW,
    subtitle: "Auditoría de accesibilidad y diseño",
    borderColor: "#A7F3D0",
    items: [
      { text: "Entrada: Pantallas UI + Reglas Albora", icon: "📥", bold: true },
      { text: "Valida WCAG 2.1 AA y áreas táctiles", icon: "♿" },
      { text: "Salida JSON: checks, fixes, files", icon: "📤" },
      { text: "Aplica correcciones automáticas de código", icon: "🛠️", bold: true },
    ],
  });
  a6Card.x = a6X; a6Card.y = row2Y; sec.appendChild(a6Card);

  // Módulo Preview & Figma
  const prevX = a6X + aW + gapX;
  const prevCard = createCard({
    title: "Previsualización & Figma",
    badge: "INTEGRACIÓN",
    badgeBg: "#EFF6FF",
    badgeColor: "#1D4ED8",
    width: aW,
    subtitle: "writePreview() & pushToFigma()",
    borderColor: "#BFDBFE",
    items: [
      { text: "Elige pantallas finales (pickScreens)", icon: "🎯", bold: true },
      { text: "Genera preview estático en /previews/KEY/vX", icon: "🌐" },
      { text: "Sincroniza Canvas en Figma vía WebSocket", icon: "🎨" },
      { text: "Asigna previewUrl al historial de la ejecución", icon: "🔗" },
    ],
  });
  prevCard.x = prevX; prevCard.y = row2Y; sec.appendChild(prevCard);

  // Agente 7: Entrega
  const a7X = prevX + aW + gapX;
  const a7Card = createCard({
    title: "7. Agente de Entrega",
    badge: "07-delivery.md",
    badgeBg: "#F0FDF4",
    badgeColor: "#166534",
    width: aW,
    subtitle: "Handover y comentario formal",
    borderColor: "#BBF7D0",
    items: [
      { text: "Entrada: Brief + Contexto + UX + QA + Preview", icon: "📥", bold: true },
      { text: "Salida JSON: summary, comment para ticket", icon: "📤" },
      { text: "Resume decisiones clave y enlaces directos", icon: "📝" },
      { text: "Prepara la revisión humana de la diseñadora", icon: "🤝" },
    ],
  });
  a7Card.x = a7X; a7Card.y = row2Y; sec.appendChild(a7Card);

  // --- 3. COLUMNA 3: SUPERVISIÓN HUMANA & ITERACIÓN (X: 2010) ---
  const col3X = 2010;
  const col3W = 430;
  const col3Title = makeText("3. ENTREGA & SUPERVISIÓN HUMANA (HITL)", 14, "Bold", hexToRgb("#047857"));
  col3Title.x = col3X; col3Title.y = 150; sec.appendChild(col3Title);

  const cardTicketPub = createCard({
    title: "Publicación en Jira / Trello",
    badge: "TRACKER",
    badgeBg: "#EFF6FF",
    badgeColor: "#1D4ED8",
    width: col3W,
    subtitle: "tracker.comment() + tracker.moveToReview()",
    borderColor: "#93C5FD",
    items: [
      { text: "Publica comentario con enlace a la propuesta", icon: "💬" },
      { text: "Mueve el ticket a columna «En revisión»", icon: "🏷️" },
      { text: "Guarda RunState final con status: 'review'", icon: "💾" },
    ],
  });
  cardTicketPub.x = col3X; cardTicketPub.y = 190; sec.appendChild(cardTicketPub);

  const cardHuman = createCard({
    title: "Diseñadora UI/UX Revisa",
    badge: "HUMAN-IN-THE-LOOP",
    badgeBg: "#FEF3C7",
    badgeColor: "#B45309",
    width: col3W,
    subtitle: "Inspección crítica humana de diseño y negocio",
    borderColor: "#FCD34D",
    items: [
      { text: "Prueba navegación interactiva en preview", icon: "👁️", bold: true },
      { text: "Comprueba adaptación de componentes y copy", icon: "🔍" },
      { text: "LOS AGENTES NUNCA APRUEBAN DIRECTAMENTE", icon: "⛔", bold: true, color: "#DC2626" },
    ],
  });
  cardHuman.x = col3X; cardHuman.y = 350; sec.appendChild(cardHuman);

  const cardIter = createCard({
    title: "Bucle de Cambios (/agentes cambios:)",
    badge: "ITERACIÓN v1 ➔ v2",
    badgeBg: "#FFFBEB",
    badgeColor: "#D97706",
    width: col3W,
    subtitle: "iterate(key, request) en orchestrator.ts",
    borderColor: "#F59E0B",
    bg: "#FFFDF5",
    items: [
      { text: "Diseñadora comenta en ticket lo que desea cambiar", icon: "💬" },
      { text: "Relanza SOLO ITERATION_STEPS (UX, Copy, UI, QA, Entrega)", icon: "⚡", bold: true },
      { text: "Preserva v0 y genera v1 manteniendo trazabilidad", icon: "📚" },
    ],
  });
  cardIter.x = col3X; cardIter.y = 520; sec.appendChild(cardIter);

  const cardApprove = createCard({
    title: "Aprobación (/agentes aprobar)",
    badge: "FINALIZACIÓN",
    badgeBg: "#ECFDF5",
    badgeColor: "#047857",
    width: col3W,
    subtitle: "approve(key) en orchestrator.ts",
    borderColor: "#10B981",
    bg: "#F0FDF4",
    items: [
      { text: "Mueve ticket a «Listo para desarrollo» (moveToDev)", icon: "🚀", bold: true },
      { text: "Adjunta specs finales JSON y enlace consolidado", icon: "📦" },
      { text: "Entrega oficial del handover a ingeniería", icon: "✨" },
    ],
  });
  cardApprove.x = col3X; cardApprove.y = 710; sec.appendChild(cardApprove);

  // --- 4. CONECTORES Y DIBUJO DE FLUJO (SVG OVERLAY) ---
  const svgConnectors = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${secW}" height="${secH}" viewBox="0 0 ${secW} ${secH}">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#4B5563"/>
        </marker>
        <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#2563EB"/>
        </marker>
        <marker id="arrow-amber" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#D97706"/>
        </marker>
        <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#059669"/>
        </marker>
      </defs>

      <!-- De Triggers a Normalizador -->
      <path d="M ${col1X + col1W} 260 L 460 260 L 460 740 L ${col1X + col1W} 740" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-dasharray="4,4"/>
      <path d="M ${col1X + col1W} 430 L 460 430" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-dasharray="4,4"/>
      <path d="M ${col1X + col1W} 570 L 460 570" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-dasharray="4,4"/>

      <!-- Del Normalizador a Agente 1 (Brief) -->
      <path d="M ${col1X + col1W} 740 L 475 740 L 475 270 L ${a1X} 270" fill="none" stroke="#2563EB" stroke-width="2.5" marker-end="url(#arrow-blue)"/>

      <!-- Flujo superior entre Agentes 1 -> 2 -> 3 -> 4 -->
      <path d="M ${a1X + aW} 270 L ${a2X} 270" fill="none" stroke="#2563EB" stroke-width="2.5" marker-end="url(#arrow-blue)"/>
      <path d="M ${a2X + aW} 270 L ${a3X} 270" fill="none" stroke="#2563EB" stroke-width="2.5" marker-end="url(#arrow-blue)"/>
      <path d="M ${a3X + aW} 270 L ${a4X} 270" fill="none" stroke="#2563EB" stroke-width="2.5" marker-end="url(#arrow-blue)"/>

      <!-- De Agente 4 bajando hacia Fila 2 (Agente 5 UI) -->
      <path d="M ${a4X + aW * 0.5} 390 L ${a4X + aW * 0.5} 460 L ${a5X + aW * 0.5} 460 L ${a5X + aW * 0.5} ${row2Y}" fill="none" stroke="#2563EB" stroke-width="2.5" marker-end="url(#arrow-blue)"/>

      <!-- Fila inferior entre Agentes 5 -> 6 -> Preview -> 7 -->
      <path d="M ${a5X + aW} ${row2Y + 80} L ${a6X} ${row2Y + 80}" fill="none" stroke="#2563EB" stroke-width="2.5" marker-end="url(#arrow-blue)"/>
      <path d="M ${a6X + aW} ${row2Y + 80} L ${prevX} ${row2Y + 80}" fill="none" stroke="#059669" stroke-width="2.5" marker-end="url(#arrow-green)"/>
      <path d="M ${prevX + aW} ${row2Y + 80} L ${a7X} ${row2Y + 80}" fill="none" stroke="#2563EB" stroke-width="2.5" marker-end="url(#arrow-blue)"/>

      <!-- De Agente 7 hacia Columna 3 (TicketPub) -->
      <path d="M ${a7X + aW} ${row2Y + 80} L 1990 ${row2Y + 80} L 1990 260 L ${col3X} 260" fill="none" stroke="#2563EB" stroke-width="2.5" marker-end="url(#arrow-blue)"/>

      <!-- Conexión vertical en Columna 3: Publicación -> Diseñadora -->
      <path d="M ${col3X + col3W * 0.5} 320 L ${col3X + col3W * 0.5} 350" fill="none" stroke="#4B5563" stroke-width="2.5" marker-end="url(#arrow)"/>

      <!-- Diseñadora -> Bucle de Iteración (Ámbar) -->
      <path d="M ${col3X + col3W * 0.3} 475 L ${col3X + col3W * 0.3} 520" fill="none" stroke="#D97706" stroke-width="2.5" marker-end="url(#arrow-amber)"/>

      <!-- Bucle de Iteración RETORNA a Agente 3 (UX) -->
      <path d="M ${col3X} 610 L 1970 610 L 1970 490 L ${a3X + aW * 0.5} 490 L ${a3X + aW * 0.5} 390" fill="none" stroke="#D97706" stroke-width="3" stroke-dasharray="6,4" marker-end="url(#arrow-amber)"/>

      <!-- Diseñadora -> Aprobación (Verde) -->
      <path d="M ${col3X + col3W * 0.75} 475 L ${col3X + col3W * 0.75} 710" fill="none" stroke="#059669" stroke-width="2.5" marker-end="url(#arrow-green)"/>
    </svg>
  `;

  try {
    createVectorGroupFromSvg(svgConnectors, "Líneas de Orquestación", sec);
  } catch (err) {
    console.warn("Fallo insertando conectores SVG:", err);
  }

  // Scroll y zoom al conjunto
  figma.viewport.scrollAndZoomIntoView([sec]);
  figma.notify("✅ Flujo de Orquestación de Agentes renderizado con éxito en Figma");
})();
