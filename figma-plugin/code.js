// Plugin de Figma para renderizar prototipos generados por el Agente
figma.showUI(__html__, { width: 340, height: 380, title: "Uber Base Auto-Design Agent" });

figma.ui.onmessage = async (msg) => {
  if (msg.type === "RENDER_SCREENS") {
    const screens = msg.screens || [];
    const ticketKey = msg.key || "KAN-1";
    if (screens.length === 0) {
      figma.notify("⚠️ No hay pantallas para pintar aún. Lanza el agente en la web.");
      return;
    }

    try {
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      await figma.loadFontAsync({ family: "Inter", style: "Medium" });
      await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    } catch (e) {
      console.warn("Fallo cargando Inter, probando fallback:", e);
      await figma.loadFontAsync({ family: "Roboto", style: "Regular" }).catch(() => {});
    }

    const createdFrames = [];
    const spacing = 50;
    const startX = Math.round(figma.viewport.center.x - ((screens.length * (375 + spacing)) / 2));
    const startY = Math.round(figma.viewport.center.y - 400);

    // Creamos una sección contenedora o las pantallas ordenadas
    screens.forEach((scr, idx) => {
      const frame = figma.createFrame();
      frame.name = (scr.step || (idx + 1)) + ". " + (scr.shortName || scr.mainTitle || ("Pantalla " + (idx + 1)));
      frame.resize(375, 812);
      frame.x = startX + idx * (375 + spacing);
      frame.y = startY;
      frame.cornerRadius = 36;
      frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      frame.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
      frame.strokeWeight = 2;
      frame.clipsContent = true;

      // Barra superior / status bar
      const statusBar = figma.createText();
      statusBar.characters = "9:41";
      statusBar.fontSize = 13;
      statusBar.fontName = { family: "Inter", style: "Bold" };
      statusBar.x = 28;
      statusBar.y = 16;
      frame.appendChild(statusBar);

      // Badge de estado (Happy Path / Error / Corner Case)
      const badgeFrame = figma.createFrame();
      badgeFrame.cornerRadius = 6;
      badgeFrame.x = 24;
      badgeFrame.y = 48;
      badgeFrame.resize(110, 24);

      const isErr = scr.stateType === "error";
      const isWarn = scr.stateType === "corner_case";
      badgeFrame.fills = [{
        type: "SOLID",
        color: isErr ? { r: 0.99, g: 0.94, b: 0.95 } : (isWarn ? { r: 0.99, g: 0.96, b: 0.90 } : { r: 0.92, g: 0.97, b: 0.93 })
      }];

      const badgeText = figma.createText();
      badgeText.characters = (scr.stateBadge || (isErr ? "ERROR" : isWarn ? "CORNER CASE" : "HAPPY PATH")).toUpperCase();
      badgeText.fontSize = 10;
      badgeText.fontName = { family: "Inter", style: "Bold" };
      badgeText.fills = [{
        type: "SOLID",
        color: isErr ? { r: 0.87, g: 0.07, b: 0.21 } : (isWarn ? { r: 0.96, g: 0.62, b: 0.05 } : { r: 0.05, g: 0.51, b: 0.27 })
      }];
      badgeText.x = 8;
      badgeText.y = 6;
      badgeFrame.appendChild(badgeText);
      frame.appendChild(badgeFrame);

      // Titular de la pantalla
      const title = figma.createText();
      title.characters = scr.mainTitle || scr.shortName || "Pantalla de Producto";
      title.fontSize = 20;
      title.fontName = { family: "Inter", style: "Bold" };
      title.x = 24;
      title.y = 82;
      title.resize(327, 28);
      frame.appendChild(title);

      // Subtítulo
      let currY = 114;
      if (scr.mainSubtitle) {
        const sub = figma.createText();
        sub.characters = scr.mainSubtitle;
        sub.fontSize = 13;
        sub.fontName = { family: "Inter", style: "Regular" };
        sub.fills = [{ type: "SOLID", color: { r: 0.4, g: 0.4, b: 0.4 } }];
        sub.x = 24;
        sub.y = currY;
        sub.resize(327, 36);
        frame.appendChild(sub);
        currY += 44;
      }

      // Visual / Tarjeta de Contenido
      if (scr.showMap) {
        const mapBox = figma.createFrame();
        mapBox.resize(327, 180);
        mapBox.x = 24;
        mapBox.y = currY;
        mapBox.cornerRadius = 16;
        mapBox.fills = [{ type: "SOLID", color: { r: 0.12, g: 0.13, b: 0.15 } }];
        
        const mapLabel = figma.createText();
        mapLabel.characters = "🗺️ Mapa en vivo · Uber Base";
        mapLabel.fontSize = 12;
        mapLabel.fontName = { family: "Inter", style: "Medium" };
        mapLabel.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        mapLabel.x = 16;
        mapLabel.y = 16;
        mapBox.appendChild(mapLabel);

        frame.appendChild(mapBox);
        currY += 194;
      }

      // Tarjetas o elementos (vehículos / opciones)
      const sampleItems = Array.isArray(scr.items) && scr.items.length > 0 ? scr.items : [
        { name: "Opción Principal", desc: "Tiempo de espera optimizado", price: "12,50 €" }
      ];

      sampleItems.slice(0, 3).forEach((item, itemIdx) => {
        const card = figma.createFrame();
        card.resize(327, 62);
        card.x = 24;
        card.y = currY + itemIdx * 70;
        card.cornerRadius = 12;
        card.fills = [{ type: "SOLID", color: { r: 0.97, g: 0.97, b: 0.97 } }];
        card.strokes = [{ type: "SOLID", color: { r: 0.92, g: 0.92, b: 0.92 } }];

        const itemName = figma.createText();
        itemName.characters = item.name || ("Opción " + (itemIdx + 1));
        itemName.fontSize = 14;
        itemName.fontName = { family: "Inter", style: "Bold" };
        itemName.x = 16;
        itemName.y = 14;
        card.appendChild(itemName);

        if (item.desc) {
          const itemDesc = figma.createText();
          itemDesc.characters = item.desc;
          itemDesc.fontSize = 11;
          itemDesc.fontName = { family: "Inter", style: "Regular" };
          itemDesc.fills = [{ type: "SOLID", color: { r: 0.45, g: 0.45, b: 0.45 } }];
          itemDesc.x = 16;
          itemDesc.y = 34;
          card.appendChild(itemDesc);
        }

        if (item.price) {
          const price = figma.createText();
          price.characters = item.price;
          price.fontSize = 14;
          price.fontName = { family: "Inter", style: "Bold" };
          price.x = 245;
          price.y = 22;
          card.appendChild(price);
        }

        frame.appendChild(card);
      });

      // Botón CTA Principal
      const btn = figma.createFrame();
      btn.resize(327, 54);
      btn.x = 24;
      btn.y = 724;
      btn.cornerRadius = 999; // Base pill style
      btn.layoutMode = "HORIZONTAL";
      btn.primaryAxisAlignItems = "CENTER";
      btn.counterAxisAlignItems = "CENTER";
      const isCtaNeg = isErr || scr.ctaVariant === "negative";
      btn.fills = [{
        type: "SOLID",
        color: isCtaNeg ? { r: 0.87, g: 0.07, b: 0.21 } : { r: 0, g: 0, b: 0 }
      }];

      const btnText = figma.createText();
      btnText.characters = scr.cta || "Continuar";
      btnText.fontName = { family: "Inter", style: "Bold" };
      btnText.fontSize = 15;
      btnText.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
      btn.appendChild(btnText);
      frame.appendChild(btn);

      figma.currentPage.appendChild(frame);
      createdFrames.push(frame);
    });

    if (createdFrames.length > 0) {
      figma.viewport.scrollAndZoomIntoView(createdFrames);
      figma.notify(`✨ ${createdFrames.length} pantallas de ${ticketKey} pintadas en Figma con tokens de Uber Base`);
    }
  }
};
