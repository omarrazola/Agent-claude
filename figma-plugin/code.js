// Plugin de Figma para renderizar el prototipo fiel del Agente Uber Base
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
    const total = screenSvgs.length;
    const startX = Math.round(figma.viewport.center.x - ((total * (375 + spacing)) / 2));
    const startY = Math.round(figma.viewport.center.y - 400);

    for (let idx = 0; idx < total; idx++) {
      const scr = screenSvgs[idx];
      try {
        const node = figma.createNodeFromSvg(scr.svg);
        node.name = (scr.step || (idx + 1)) + ". " + (scr.name || ("Pantalla " + (idx + 1)));
        node.x = startX + idx * (375 + spacing);
        node.y = startY;
        figma.currentPage.appendChild(node);
        createdNodes.push(node);
      } catch (err) {
        console.error("Error creando nodo SVG en Figma:", err);
      }
    }

    if (createdNodes.length > 0) {
      figma.viewport.scrollAndZoomIntoView(createdNodes);
      figma.notify(`✨ ${createdNodes.length} pantallas oficiales de ${ticketKey} renderizadas en Figma.`);
    }
  }
};
