// Plugin de Figma para renderizar el prototipo fiel del Agente Uber Base dentro de una Section
figma.showUI(__html__, { width: 340, height: 380, title: "Uber Base Auto-Design Agent" });

figma.ui.onmessage = async (msg) => {
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
