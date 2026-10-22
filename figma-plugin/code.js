// Plugin de Figma para renderizar el prototipo y la librería de componentes del Agente Uber Base
figma.showUI(__html__, { width: 340, height: 420, title: "Uber Base Auto-Design Agent" });

async function createComponentLibrary() {
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  } catch (e) {
    console.warn("Fallo cargando Inter para la librería:", e);
  }

  const sectionName = "💎 Uber Base DS · Librería de Componentes";
  const old = figma.currentPage.findOne(n => n.type === "SECTION" && n.name === sectionName);
  if (old) old.remove();

  const sec = figma.createSection();
  sec.name = sectionName;
  const secW = 1580;
  const secH = 1080;
  const secX = Math.round(figma.viewport.center.x - (secW / 2));
  const secY = Math.round(figma.viewport.center.y + 550);
  sec.x = secX;
  sec.y = secY;

  if (typeof sec.resizeWithoutConstraints === "function") {
    sec.resizeWithoutConstraints(secW, secH);
  } else if (typeof sec.resize === "function") {
    sec.resize(secW, secH);
  }
  figma.currentPage.appendChild(sec);

  function makeText(str, size, weight, color) {
    const t = figma.createText();
    t.characters = str;
    t.fontSize = size;
    t.fontName = { family: "Inter", style: weight || "Regular" };
    if (color) t.fills = [{ type: "SOLID", color }];
    return t;
  }

  // Título e Intro dentro de la Sección
  const title = makeText("Uber Base Design System (baseui v18)", 26, "Bold", { r: 0, g: 0, b: 0 });
  title.x = 50; title.y = 40; sec.appendChild(title);

  const sub = makeText("Librería oficial de componentes autónomos del Agente · Listos para usar en tus flujos", 13, "Regular", { r: 0.4, g: 0.4, b: 0.4 });
  sub.x = 50; sub.y = 78; sec.appendChild(sub);

  let curY = 120;

  // 1. FILA: BOTONES (Pill y Rounded)
  const lblBtn = makeText("1. BOTONES (BUTTONS) · FORMAS PILL (9999px) Y ROUNDED (8px)", 11, "Bold", { r: 0.15, g: 0.43, b: 0.95 });
  lblBtn.x = 50; lblBtn.y = curY; sec.appendChild(lblBtn);
  curY += 24;

  const btnDefs = [
    { name: "Button / Primary / Pill", label: "Continuar ➔", bg: { r: 0, g: 0, b: 0 }, fg: { r: 1, g: 1, b: 1 }, rx: 999, w: 200, h: 52 },
    { name: "Button / Primary / Rounded", label: "Continuar ➔", bg: { r: 0, g: 0, b: 0 }, fg: { r: 1, g: 1, b: 1 }, rx: 8, w: 200, h: 52 },
    { name: "Button / Negative / Pill", label: "Reintentar cobro ↺", bg: { r: 0.87, g: 0.07, b: 0.21 }, fg: { r: 1, g: 1, b: 1 }, rx: 999, w: 210, h: 52 },
    { name: "Button / Positive / Pill", label: "Aceptar viaje ✓", bg: { r: 0.05, g: 0.51, b: 0.27 }, fg: { r: 1, g: 1, b: 1 }, rx: 999, w: 200, h: 52 },
    { name: "Button / Secondary / Rounded", label: "Opciones secundarias", bg: { r: 0.93, g: 0.93, b: 0.93 }, fg: { r: 0, g: 0, b: 0 }, rx: 8, w: 200, h: 48 },
    { name: "Button / Tertiary / Outline", label: "Cancelar", bg: { r: 1, g: 1, b: 1 }, fg: { r: 0, g: 0, b: 0 }, stroke: { r: 0.88, g: 0.88, b: 0.88 }, rx: 8, w: 160, h: 48 }
  ];

  let btnX = 50;
  btnDefs.forEach(b => {
    const comp = figma.createComponent();
    comp.name = b.name;
    comp.layoutMode = "HORIZONTAL";
    comp.primaryAxisAlignItems = "CENTER";
    comp.counterAxisAlignItems = "CENTER";
    comp.resize(b.w, b.h);
    comp.cornerRadius = b.rx;
    comp.fills = [{ type: "SOLID", color: b.bg }];
    if (b.stroke) {
      comp.strokes = [{ type: "SOLID", color: b.stroke }];
      comp.strokeWeight = 1;
    }
    const txt = makeText(b.label, 14, "Bold", b.fg);
    comp.appendChild(txt);

    sec.appendChild(comp);
    comp.x = btnX; comp.y = curY;
    btnX += b.w + 20;
  });

  curY += 76;

  // 2. FILA: ETIQUETAS DE ESTADO (TAGS Y BADGES)
  const lblBadges = makeText("2. ETIQUETAS DE ESTADO (TAGS & BADGES) · HAPPY PATH, CORNER CASE, ERROR", 11, "Bold", { r: 0.15, g: 0.43, b: 0.95 });
  lblBadges.x = 50; lblBadges.y = curY; sec.appendChild(lblBadges);
  curY += 24;

  const badgeDefs = [
    { name: "Badge / Happy Path", label: "HAPPY PATH", bg: { r: 0.92, g: 0.97, b: 0.93 }, fg: { r: 0.05, g: 0.51, b: 0.27 } },
    { name: "Badge / Corner Case", label: "CORNER CASE", bg: { r: 0.99, g: 0.96, b: 0.90 }, fg: { r: 0.96, g: 0.62, b: 0.05 } },
    { name: "Badge / Error", label: "CASO DE ERROR", bg: { r: 0.99, g: 0.94, b: 0.95 }, fg: { r: 0.87, g: 0.07, b: 0.21 } },
    { name: "Badge / ETA", label: "⏱️ 3 min", bg: { r: 0, g: 0, b: 0 }, fg: { r: 1, g: 1, b: 1 } },
    { name: "Badge / Rating", label: "★ 4.95", bg: { r: 0.96, g: 0.96, b: 0.96 }, fg: { r: 0, g: 0, b: 0 } }
  ];

  let badgeX = 50;
  badgeDefs.forEach(bd => {
    const comp = figma.createComponent();
    comp.name = bd.name;
    comp.layoutMode = "HORIZONTAL";
    comp.primaryAxisAlignItems = "CENTER";
    comp.counterAxisAlignItems = "CENTER";
    comp.paddingLeft = 14; comp.paddingRight = 14; comp.paddingTop = 6; comp.paddingBottom = 6;
    comp.cornerRadius = 6;
    comp.fills = [{ type: "SOLID", color: bd.bg }];
    const txt = makeText(bd.label, 11, "Bold", bd.fg);
    comp.appendChild(txt);

    sec.appendChild(comp);
    comp.x = badgeX; comp.y = curY;
    badgeX += comp.width + 18;
  });

  curY += 56;

  // 3. FILA: BANNERS INFORMATIVOS
  const lblBanner = makeText("3. BANNERS Y NOTIFICACIONES (BANNERS)", 11, "Bold", { r: 0.15, g: 0.43, b: 0.95 });
  lblBanner.x = 50; lblBanner.y = curY; sec.appendChild(lblBanner);
  curY += 24;

  const bannerDefs = [
    { name: "Banner / Warning (Corner Case)", text: "⚡ Alta afluencia en terminal: punto de encuentro optimizado a 50m", bg: { r: 0.99, g: 0.96, b: 0.90 }, stroke: { r: 0.96, g: 0.62, b: 0.05 }, fg: { r: 0.85, g: 0.50, b: 0.02 } },
    { name: "Banner / Error (Incidencia)", text: "⚠️ Tarjeta declinada por la entidad: cambia de método para mantener reserva", bg: { r: 0.99, g: 0.94, b: 0.95 }, stroke: { r: 0.87, g: 0.07, b: 0.21 }, fg: { r: 0.87, g: 0.07, b: 0.21 } },
    { name: "Banner / Info (Sistema)", text: "ℹ️ Reserva confirmada con Uber Base Design System oficial", bg: { r: 0.94, g: 0.96, b: 0.99 }, stroke: { r: 0.15, g: 0.43, b: 0.95 }, fg: { r: 0.15, g: 0.43, b: 0.95 } }
  ];

  let banX = 50;
  bannerDefs.forEach(bn => {
    const comp = figma.createComponent();
    comp.name = bn.name;
    comp.layoutMode = "HORIZONTAL";
    comp.counterAxisAlignItems = "CENTER";
    comp.resize(460, 42);
    comp.paddingLeft = 14; comp.paddingRight = 14;
    comp.cornerRadius = 8;
    comp.fills = [{ type: "SOLID", color: bn.bg }];
    comp.strokes = [{ type: "SOLID", color: bn.stroke }];
    comp.strokeWeight = 1.5;
    const txt = makeText(bn.text, 11.5, "Medium", bn.fg);
    comp.appendChild(txt);

    sec.appendChild(comp);
    comp.x = banX; comp.y = curY;
    banX += 480;
  });

  curY += 68;

  // 4. FILA: TARJETAS DE VEHÍCULOS
  const lblCards = makeText("4. TARJETAS DE VEHÍCULOS Y SERVICIOS (VEHICLE CARDS)", 11, "Bold", { r: 0.15, g: 0.43, b: 0.95 });
  lblCards.x = 50; lblCards.y = curY; sec.appendChild(lblCards);
  curY += 24;

  const cardDefs = [
    { name: "Card / Vehicle / UberX (Selected)", icon: "🚗", title: "UberX · 4 plazas", sub: "Llegada en 3 min · Coche estándar", price: "14,20 €", isSelected: true },
    { name: "Card / Vehicle / Comfort", icon: "🚘", title: "Uber Comfort · 4 plazas", sub: "Llegada en 4 min · Espacio extra y silencio", price: "18,50 €", isSelected: false },
    { name: "Card / Vehicle / Black", icon: "🖤", title: "Uber Black · Chófer", sub: "Llegada en 6 min · Chófer profesional", price: "27,80 €", isSelected: false }
  ];

  let cardX = 50;
  cardDefs.forEach(cd => {
    const comp = figma.createComponent();
    comp.name = cd.name;
    comp.resize(340, 64);
    comp.cornerRadius = 10;
    comp.fills = [{ type: "SOLID", color: cd.isSelected ? { r: 1, g: 1, b: 1 } : { r: 0.98, g: 0.98, b: 0.98 } }];
    comp.strokes = [{ type: "SOLID", color: cd.isSelected ? { r: 0, g: 0, b: 0 } : { r: 0.88, g: 0.88, b: 0.88 } }];
    comp.strokeWeight = cd.isSelected ? 2 : 1;

    const icBox = figma.createFrame();
    icBox.resize(36, 36); icBox.x = 12; icBox.y = 14; icBox.cornerRadius = 8;
    icBox.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
    const icText = makeText(cd.icon, 18); icText.x = 9; icText.y = 7; icBox.appendChild(icText);
    comp.appendChild(icBox);

    const tTitle = makeText(cd.title, 13.5, "Bold", { r: 0, g: 0, b: 0 }); tTitle.x = 60; tTitle.y = 14; comp.appendChild(tTitle);
    const tSub = makeText(cd.sub, 11, "Regular", { r: 0.45, g: 0.45, b: 0.45 }); tSub.x = 60; tSub.y = 35; comp.appendChild(tSub);

    const tPrice = makeText(cd.price, 14, "Bold", { r: 0, g: 0, b: 0 }); tPrice.x = 265; tPrice.y = 22; comp.appendChild(tPrice);

    sec.appendChild(comp);
    comp.x = cardX; comp.y = curY;
    cardX += 360;
  });

  curY += 90;

  // 5. FILA: FICHAS DE TELEMETRÍA (METRIC CHIPS)
  const lblMetrics = makeText("5. FICHAS DE TELEMETRÍA Y SEGURIDAD (METRIC CHIPS)", 11, "Bold", { r: 0.15, g: 0.43, b: 0.95 });
  lblMetrics.x = 50; lblMetrics.y = curY; sec.appendChild(lblMetrics);
  curY += 24;

  const metricDefs = [
    { name: "Card / Metric / PIN", label: "PIN DE SEGURIDAD", val: "7492" },
    { name: "Card / Metric / Matrícula", label: "MATRÍCULA", val: "4821 LKY" },
    { name: "Card / Metric / ETA", label: "TIEMPO ESTIMADO", val: "3 min" },
    { name: "Card / Metric / Total", label: "TARIFA TOTAL", val: "14,20 €" }
  ];

  let metX = 50;
  metricDefs.forEach(md => {
    const comp = figma.createComponent();
    comp.name = md.name;
    comp.resize(160, 56);
    comp.cornerRadius = 8;
    comp.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
    const lb = makeText(md.label, 9.5, "Medium", { r: 0.45, g: 0.45, b: 0.45 }); lb.x = 14; lb.y = 10; comp.appendChild(lb);
    const vl = makeText(md.val, 15, "Bold", { r: 0, g: 0, b: 0 }); vl.x = 14; vl.y = 26; comp.appendChild(vl);

    sec.appendChild(comp);
    comp.x = metX; comp.y = curY;
    metX += 180;
  });

  curY += 80;

  // 6. FILA: TOKENS DE COLOR
  const lblTokens = makeText("6. TOKENS DE COLOR OFICIALES (UBER BASE TOKENS)", 11, "Bold", { r: 0.15, g: 0.43, b: 0.95 });
  lblTokens.x = 50; lblTokens.y = curY; sec.appendChild(lblTokens);
  curY += 24;

  const tokenDefs = [
    { name: "Token / Black", hex: "#000000", color: { r: 0, g: 0, b: 0 }, textDark: false },
    { name: "Token / White", hex: "#FFFFFF", color: { r: 1, g: 1, b: 1 }, textDark: true, stroke: { r: 0.88, g: 0.88, b: 0.88 } },
    { name: "Token / Secondary", hex: "#F6F6F6", color: { r: 0.96, g: 0.96, b: 0.96 }, textDark: true },
    { name: "Token / Accent Blue", hex: "#276EF1", color: { r: 0.15, g: 0.43, b: 0.95 }, textDark: false },
    { name: "Token / Positive", hex: "#0E8345", color: { r: 0.05, g: 0.51, b: 0.27 }, textDark: false },
    { name: "Token / Negative", hex: "#DE1135", color: { r: 0.87, g: 0.07, b: 0.21 }, textDark: false },
    { name: "Token / Warning", hex: "#F69E0C", color: { r: 0.96, g: 0.62, b: 0.05 }, textDark: false }
  ];

  let tokX = 50;
  tokenDefs.forEach(tk => {
    const comp = figma.createComponent();
    comp.name = tk.name;
    comp.resize(110, 80);
    comp.cornerRadius = 8;
    comp.fills = [{ type: "SOLID", color: tk.color }];
    if (tk.stroke) {
      comp.strokes = [{ type: "SOLID", color: tk.stroke }];
      comp.strokeWeight = 1;
    }
    const fg = tk.textDark ? { r: 0, g: 0, b: 0 } : { r: 1, g: 1, b: 1 };
    const hx = makeText(tk.hex, 11, "Bold", fg); hx.x = 10; hx.y = 44; comp.appendChild(hx);
    const nm = makeText(tk.name.split("/")[1].trim(), 9.5, "Medium", fg); nm.x = 10; nm.y = 60; comp.appendChild(nm);

    sec.appendChild(comp);
    comp.x = tokX; comp.y = curY;
    tokX += 126;
  });

  figma.viewport.scrollAndZoomIntoView([sec]);
  figma.notify("💎 Librería oficial de componentes Uber Base DS creada en Figma con éxito.");
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "CREATE_COMPONENT_LIBRARY") {
    await createComponentLibrary();
    return;
  }

  if (msg.type === "RENDER_SCREENS") {
    const screenSvgs = msg.screenSvgs || [];
    const ticketKey = msg.key || "KAN-1";

    if (screenSvgs.length === 0) {
      figma.notify("⚠️ No hay pantallas para pintar aún. Lanza el agente en la web.");
      return;
    }

    const createdNodes = [];
    const spacing = 60;
    const pad = 60;
    const frameW = 375;
    const frameH = 812;
    const total = screenSvgs.length;
    const sectionW = pad * 2 + total * frameW + (total - 1) * spacing;
    const sectionH = pad * 2 + frameH + 40;

    const startX = Math.round(figma.viewport.center.x - (sectionW / 2));
    const startY = Math.round(figma.viewport.center.y - (sectionH / 2));

    const sectionName = `${ticketKey} · Prototipo Flujo Completo (Uber Base DS)`;
    const existingSection = figma.currentPage.findOne(node => node.type === "SECTION" && node.name === sectionName);
    if (existingSection) {
      existingSection.remove();
    }

    // Crear Section oficial de Figma
    const section = figma.createSection();
    section.name = sectionName;
    section.x = startX;
    section.y = startY;

    if (typeof section.resizeWithoutConstraints === "function") {
      section.resizeWithoutConstraints(sectionW, sectionH);
    } else if (typeof section.resize === "function") {
      section.resize(sectionW, sectionH);
    }

    figma.currentPage.appendChild(section);

    for (let idx = 0; idx < total; idx++) {
      const scr = screenSvgs[idx];
      try {
        const node = figma.createNodeFromSvg(scr.svg);
        node.name = (scr.step || (idx + 1)) + ". " + (scr.name || ("Pantalla " + (idx + 1)));

        section.appendChild(node);
        node.x = pad + idx * (frameW + spacing);
        node.y = pad;

        createdNodes.push(node);
      } catch (err) {
        console.error("Error creando nodo SVG en Figma:", err);
      }
    }

    if (createdNodes.length > 0) {
      figma.viewport.scrollAndZoomIntoView([section]);
      figma.notify(`✨ Sección "${section.name}" creada con ${createdNodes.length} pantallas.`);
    }
  }
};
