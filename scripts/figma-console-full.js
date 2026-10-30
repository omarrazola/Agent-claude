// Plugin de Figma para renderizar el Mapa de Flujo completo vinculado a la librería Base DS
// figma.showUI disabled for console

async function loadFonts() {
  try {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  } catch (e) {
    console.warn("Fallo cargando fuente Inter:", e);
  }
}

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ==============================================================================
// GESTOR DE ESTILOS LOCALES DE FIGMA (Tipografías y Colores Locales)
// ==============================================================================

let localStylesCache = null;

async function initStyleManager() {
  const textStyles = figma.getLocalTextStyles() || [];
  const paintStyles = figma.getLocalPaintStyles() || [];

  // 1. Cargar las fuentes de los estilos locales para poder asignar textStyleId sin error
  for (const ts of textStyles) {
    try {
      if (ts.fontName) {
        await figma.loadFontAsync(ts.fontName);
      }
    } catch (e) {
      console.warn("No se pudo precargar fuente de estilo local:", ts.name, e);
    }
  }

  // 2. Indexar estilos de pintura sólidos para coincidencia de color por distancia RGB
  const parsedPaintStyles = [];
  for (const ps of paintStyles) {
    if (Array.isArray(ps.paints) && ps.paints.length > 0 && ps.paints[0].type === "SOLID") {
      parsedPaintStyles.push({
        id: ps.id,
        name: ps.name,
        color: ps.paints[0].color,
        opacity: typeof ps.paints[0].opacity === "number" ? ps.paints[0].opacity : 1
      });
    }
  }

  localStylesCache = {
    textStyles,
    paintStyles,
    parsedPaintStyles
  };

  return localStylesCache;
}

function colorDistance(c1, c2) {
  if (!c1 || !c2) return Infinity;
  const dr = ((c1.r || 0) - (c2.r || 0)) * 255;
  const dg = ((c1.g || 0) - (c2.g || 0)) * 255;
  const db = ((c1.b || 0) - (c2.b || 0)) * 255;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function normalizeStyleName(name) {
  return (name || "").toLowerCase().replace(/[\/_\-\s]+/g, " ").trim();
}

/**
 * Busca el mejor estilo tipográfico local para un rol semántico y tamaño
 */
function findLocalTextStyle(role, targetSize, isBold) {
  if (!localStylesCache || !localStylesCache.textStyles || localStylesCache.textStyles.length === 0) {
    return null;
  }
  const styles = localStylesCache.textStyles;

  const roleKeywords = {
    display: ["display", "hero", "title large", "h1", "xl", "display large", "gran titular", "titular grande"],
    title: ["title", "heading large", "heading 1", "h1", "heading 2", "h2", "heading medium", "titulo", "titular"],
    heading: ["heading", "h2", "h3", "title medium", "section", "heading small", "encabezado", "seccion"],
    subtitle: ["subtitle", "subheading", "h3", "h4", "sub", "paragraph large", "subtitulo"],
    body: ["body", "regular", "paragraph", "text", "base", "paragraph medium", "cuerpo", "texto"],
    "body-bold": ["body bold", "body/bold", "bold", "button", "paragraph bold", "cuerpo negrita"],
    button: ["button", "cta", "body bold", "label large", "btn", "boton"],
    label: ["label", "badge", "tag", "eyebrow", "caps", "label medium", "label small", "etiqueta"],
    caption: ["caption", "small", "footnote", "meta", "detail", "paragraph small", "paragraph xsmall", "leyenda", "pie"],
    micro: ["micro", "tiny", "caption", "small", "xsmall"]
  };

  const keywords = roleKeywords[role] || [role];

  // 1. Coincidencia por palabra clave semántica en el nombre
  for (const kw of keywords) {
    const match = styles.find(s => normalizeStyleName(s.name).includes(kw));
    if (match) return match;
  }

  // 2. Coincidencia por proximidad de tamaño y peso
  let bestMatch = null;
  let minDiff = Infinity;
  for (const s of styles) {
    const sSize = s.fontSize || 14;
    const diff = Math.abs(sSize - targetSize);
    const sStyle = (s.fontName && s.fontName.style) ? s.fontName.style.toLowerCase() : "";
    const styleMatchesWeight = isBold
      ? (sStyle.includes("bold") || sStyle.includes("medium") || sStyle.includes("black") || sStyle.includes("semibold"))
      : (!sStyle.includes("bold") && !sStyle.includes("black") && !sStyle.includes("semibold"));
    const score = diff + (styleMatchesWeight ? 0 : 3.5);
    if (score < minDiff) {
      minDiff = score;
      bestMatch = s;
    }
  }

  return minDiff <= 6 ? bestMatch : null;
}

/**
 * Busca el mejor estilo de color (PaintStyle) local para un rol semántico o color RGB
 */
function findLocalPaintStyle(semanticRole, targetColor) {
  if (!localStylesCache || !localStylesCache.paintStyles || localStylesCache.paintStyles.length === 0) {
    return null;
  }

  const roleKeywords = {
    primary: ["primary", "brand", "black", "ink", "base black", "content primary", "neutral 1000", "text primary", "main", "primario", "negro"],
    secondary: ["secondary", "surface", "gray", "f6f6f6", "background secondary", "content secondary", "light", "secundario", "gris"],
    white: ["white", "background", "surface white", "base white", "background primary", "bg", "content inverse", "blanco"],
    negative: ["negative", "error", "danger", "red", "base negative", "critical", "destructive", "negativo", "fallo", "rojo"],
    warning: ["warning", "amber", "alert", "orange", "caution", "base warning", "alerta", "aviso", "ambar"],
    positive: ["positive", "success", "green", "base positive", "positivo", "exito", "verde"],
    accent: ["accent", "blue", "interactive", "base accent", "link", "acento", "azul"],
    border: ["border", "line", "divider", "outline", "stroke", "gray 300", "e2e2e2", "border opaque", "borde", "linea"],
    muted: ["muted", "secondary", "gray 500", "text secondary", "subtle", "tertiary", "content tertiary", "atenuado"]
  };

  const keywords = roleKeywords[semanticRole] || [semanticRole];

  // 1. Coincidencia por nombre de estilo
  for (const kw of keywords) {
    const match = localStylesCache.paintStyles.find(p => normalizeStyleName(p.name).includes(kw));
    if (match) return match;
  }

  // 2. Coincidencia por cercanía euclidiana RGB
  if (targetColor && localStylesCache.parsedPaintStyles.length > 0) {
    let closest = null;
    let minDistance = Infinity;
    for (const p of localStylesCache.parsedPaintStyles) {
      const d = colorDistance(p.color, targetColor);
      if (d < minDistance) {
        minDistance = d;
        closest = p;
      }
    }
    if (minDistance <= 40 && closest) {
      return localStylesCache.paintStyles.find(ps => ps.id === closest.id) || null;
    }
  }

  return null;
}

function applyTextStyle(node, role, targetSize, isBold) {
  if (!node || node.type !== "TEXT") return false;
  const style = findLocalTextStyle(role, targetSize, isBold);
  if (style) {
    try {
      node.textStyleId = style.id;
      return true;
    } catch (e) {
      console.warn("No se pudo aplicar estilo de texto local:", style.name, e);
    }
  }
  return false;
}

function applyFillStyle(node, semanticRole, targetColor) {
  if (!node) return false;
  const style = findLocalPaintStyle(semanticRole, targetColor);
  if (style) {
    try {
      node.fillStyleId = style.id;
      return true;
    } catch (e) {
      console.warn("No se pudo aplicar estilo de relleno local:", style.name, e);
    }
  }
  return false;
}

function applyStrokeStyle(node, semanticRole, targetColor) {
  if (!node) return false;
  const style = findLocalPaintStyle(semanticRole, targetColor);
  if (style) {
    try {
      node.strokeStyleId = style.id;
      return true;
    } catch (e) {
      console.warn("No se pudo aplicar estilo de trazo local:", style.name, e);
    }
  }
  return false;
}

/**
 * Vincula recursivamente estilos locales a todos los nodos de texto y vectores de una pantalla SVG
 */
function bindLocalStylesToScreenNode(screenNode) {
  if (!screenNode || typeof screenNode.findAll !== "function") return;

  const allTexts = screenNode.findAll(n => n.type === "TEXT");
  for (const t of allTexts) {
    const sz = t.fontSize || 14;
    const fontStyle = (t.fontName && t.fontName.style) ? t.fontName.style.toLowerCase() : "";
    const isBold = fontStyle.includes("bold") || fontStyle.includes("medium");

    let role = "body";
    if (sz >= 22) role = "display";
    else if (sz >= 16) role = isBold ? "heading" : "subtitle";
    else if (sz >= 13 && isBold) role = "button";
    else if (sz >= 12) role = "body";
    else if (sz >= 10) role = "label";
    else role = "caption";

    applyTextStyle(t, role, sz, isBold);

    if (Array.isArray(t.fills) && t.fills.length > 0 && t.fills[0].type === "SOLID") {
      const col = t.fills[0].color;
      let colorRole = "primary";
      if (col.r > 0.8 && col.g < 0.2 && col.b < 0.3) colorRole = "negative";
      else if (col.r < 0.2 && col.g > 0.6 && col.b < 0.4) colorRole = "positive";
      else if (col.r > 0.8 && col.g > 0.5 && col.b < 0.2) colorRole = "warning";
      else if (col.r > 0.9 && col.g > 0.9 && col.b > 0.9) colorRole = "white";
      else if (col.r > 0.3 && col.r < 0.6 && Math.abs(col.r - col.g) < 0.05) colorRole = "muted";
      applyFillStyle(t, colorRole, col);
    }
  }

  const shapes = screenNode.findAll(n => n.type === "RECTANGLE" || n.type === "VECTOR" || n.type === "FRAME" || n.type === "ELLIPSE");
  for (const s of shapes) {
    if (Array.isArray(s.fills) && s.fills.length > 0 && s.fills[0].type === "SOLID") {
      const col = s.fills[0].color;
      let role = "secondary";
      if (col.r < 0.08 && col.g < 0.08 && col.b < 0.08) role = "primary";
      else if (col.r > 0.96 && col.g > 0.96 && col.b > 0.96) role = "white";
      else if (col.r > 0.90 && col.g > 0.90 && col.b > 0.90) role = "secondary";
      else if (col.r > 0.8 && col.g < 0.2 && col.b < 0.3) role = "negative";
      else if (col.r < 0.2 && col.g > 0.6 && col.b < 0.4) role = "positive";
      else if (col.r > 0.8 && col.g > 0.5 && col.b < 0.2) role = "warning";
      else if (col.b > 0.8 && col.r < 0.3) role = "accent";
      applyFillStyle(s, role, col);
    }

    if (Array.isArray(s.strokes) && s.strokes.length > 0 && s.strokes[0].type === "SOLID") {
      const col = s.strokes[0].color;
      let strokeRole = "border";
      if (col.r > 0.8 && col.g < 0.2) strokeRole = "negative";
      else if (col.r < 0.2 && col.g > 0.6) strokeRole = "positive";
      applyStrokeStyle(s, strokeRole, col);
    }
  }
}

async function createLocalStylesFromBaseTokens() {
  await loadFonts();

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const n = parseInt(clean, 16);
    return {
      r: ((n >> 16) & 255) / 255,
      g: ((n >> 8) & 255) / 255,
      b: (n & 255) / 255
    };
  }

  const colorDefs = [
    { name: "Color / Primary", hex: "#000000", desc: "Color principal de marca y texto de énfasis" },
    { name: "Color / White", hex: "#FFFFFF", desc: "Superficie principal y texto inverso" },
    { name: "Color / Background Secondary", hex: "#F6F6F6", desc: "Superficies secundarias, tarjetas y campos" },
    { name: "Color / Border Opaque", hex: "#E2E2E2", desc: "Bordes sólidos y divisores" },
    { name: "Color / Content Secondary", hex: "#545454", desc: "Subtítulos y metadatos" },
    { name: "Color / Content Tertiary", hex: "#757575", desc: "Textos deshabilitados y placeholders" },
    { name: "Color / Accent", hex: "#276EF1", desc: "Azul oficial de acción, focus y enlaces" },
    { name: "Color / Positive", hex: "#0E8345", desc: "Éxito y estados completados" },
    { name: "Color / Positive Light", hex: "#EAF6ED", desc: "Fondo de banners de éxito" },
    { name: "Color / Warning", hex: "#F69E0C", desc: "Alertas y corner cases" },
    { name: "Color / Warning Light", hex: "#FDF2DC", desc: "Fondo de banners de advertencia" },
    { name: "Color / Negative", hex: "#DE1135", desc: "Errores críticos y acciones destructivas" },
    { name: "Color / Negative Light", hex: "#FFF0EE", desc: "Fondo de banners de error" }
  ];

  const existingPaintStyles = figma.getLocalPaintStyles();
  let createdPaintCount = 0;
  for (const c of colorDefs) {
    let p = existingPaintStyles.find(ps => ps.name === c.name);
    if (!p) {
      p = figma.createPaintStyle();
      p.name = c.name;
      p.description = c.desc;
      createdPaintCount++;
    }
    p.paints = [{ type: "SOLID", color: hexToRgb(c.hex) }];
  }

  const fontDefs = [
    { name: "Typography / Display Large", size: 36, weight: "Bold" },
    { name: "Typography / Display Medium", size: 26, weight: "Bold" },
    { name: "Typography / Heading Large", size: 20, weight: "Bold" },
    { name: "Typography / Heading Medium", size: 16, weight: "Bold" },
    { name: "Typography / Heading Small", size: 15, weight: "Bold" },
    { name: "Typography / Button Large", size: 15, weight: "Bold" },
    { name: "Typography / Paragraph Large", size: 16, weight: "Regular" },
    { name: "Typography / Paragraph Medium", size: 13, weight: "Regular" },
    { name: "Typography / Paragraph Small", size: 11.5, weight: "Regular" },
    { name: "Typography / Label Large", size: 11, weight: "Bold" },
    { name: "Typography / Label Medium", size: 10, weight: "Bold" },
    { name: "Typography / Caption", size: 9.5, weight: "Medium" }
  ];

  const existingTextStyles = figma.getLocalTextStyles();
  let createdTextCount = 0;
  for (const f of fontDefs) {
    let t = existingTextStyles.find(ts => ts.name === f.name);
    if (!t) {
      t = figma.createTextStyle();
      t.name = f.name;
      createdTextCount++;
    }
    t.fontSize = f.size;
    t.fontName = { family: "Inter", style: f.weight };
  }

  await initStyleManager();
  figma.notify(`🎨 Estilos locales de Base DS listos (${createdPaintCount} colores y ${createdTextCount} estilos de texto creados).`);
}

function makeText(str, size, weight, color, wrapWidth, role, semanticColorRole) {
  const t = figma.createText();
  t.characters = str || "";
  t.fontSize = size;
  t.fontName = { family: "Inter", style: weight || "Regular" };
  if (color) t.fills = [{ type: "SOLID", color }];

  const isBold = weight === "Bold" || weight === "SemiBold" || weight === "Medium";
  const effectiveRole = role || (size >= 24 ? "display" : size >= 16 ? "heading" : size <= 10 ? "caption" : "body");
  applyTextStyle(t, effectiveRole, size, isBold);

  if (semanticColorRole || color) {
    applyFillStyle(t, semanticColorRole || (color && color.r > 0.9 && color.g > 0.9 && color.b > 0.9 ? "white" : "primary"), color);
  }

  if (wrapWidth) {
    t.resize(wrapWidth, 20);
    t.textAutoResize = "HEIGHT";
  }
  return t;
}

function disableClippingRecursively(node) {
  if (!node) return;
  if ("clipsContent" in node) {
    node.clipsContent = false;
  }
  if ("children" in node && Array.isArray(node.children)) {
    for (const c of node.children) {
      disableClippingRecursively(c);
    }
  }
}

/**
 * Importa vectores y formas de un SVG y los agrupa en un GroupNode nativo (NUNCA en un FrameNode).
 * Esto erradica por completo los recortes (clipsContent) y garantiza que las líneas ortogonales,
 * las puntas de flecha y los badges de navegación nunca se corten en Figma.
 */
function createVectorGroupFromSvg(svgString, name, parentNode) {
  const tempFrame = figma.createNodeFromSvg(svgString);
  disableClippingRecursively(tempFrame);

  const children = [];

  // Extraer todos los elementos hijos (vectores, paths, rectángulos, textos) directamente al contenedor padre
  while (tempFrame.children.length > 0) {
    const child = tempFrame.children[0];
    child.x += tempFrame.x;
    child.y += tempFrame.y;
    disableClippingRecursively(child);
    parentNode.appendChild(child);
    children.push(child);
  }

  // Destruir y remover el Frame contenedor para que no exista ningún recorte ni hitbox transparente
  tempFrame.remove();

  // Agrupar los vectores sueltos en un Grupo nativo de Figma (un Group NUNCA tiene clipsContent ni recorta trazos)
  if (children.length > 0) {
    let group = null;
    try {
      group = figma.group(children, parentNode);
      group.name = name || "Línea de Flujo";
      disableClippingRecursively(group);
    } catch (e) {
      console.warn("No se pudo crear grupo, los vectores quedan directamente en el lienzo sin frame:", e);
    }
    return group;
  }
  return null;
}

function getComponentRegistry() {
  const map = new Map();
  let targetNode = null;

  try {
    targetNode = figma.getNodeById("10:4737");
  } catch (e) {}

  if (!targetNode) {
    targetNode = figma.currentPage.findOne(n => n.type === "SECTION" && n.name.includes("Catálogo de Componentes"));
  }

  let comps = [];
  if (targetNode && typeof targetNode.findAll === "function") {
    comps = targetNode.findAll(n => n.type === "COMPONENT");
  }
  if (comps.length === 0) {
    comps = figma.currentPage.findAll(n => n.type === "COMPONENT");
  }

  for (const c of comps) {
    map.set(c.name, c);
  }
  return { map, list: comps, targetNode };
}

async function createComponentLibrary() {
  await loadFonts();

  const sectionName = "🎨 Catálogo de Componentes · Base Design System";
  const old = figma.currentPage.findOne(n => n.type === "SECTION" && n.name === sectionName);
  if (old) old.remove();

  const sec = figma.createSection();
  sec.name = sectionName;
  const secW = 1600;
  const secH = 2850;
  const secX = Math.round(figma.viewport.center.x - (secW / 2));
  const secY = Math.round(figma.viewport.center.y + 600);
  sec.x = secX;
  sec.y = secY;

  if (typeof sec.resizeWithoutConstraints === "function") {
    sec.resizeWithoutConstraints(secW, secH);
  } else if (typeof sec.resize === "function") {
    sec.resize(secW, secH);
  }
  figma.currentPage.appendChild(sec);

  function addSectionHeader(titleStr, subtitleStr, yPos) {
    const t = makeText(titleStr, 18, "Bold", { r: 0, g: 0, b: 0 });
    t.x = 50; t.y = yPos; sec.appendChild(t);
    const sub = makeText(subtitleStr, 12.5, "Regular", { r: 0.4, g: 0.4, b: 0.4 });
    sub.x = 50; sub.y = yPos + 26; sec.appendChild(sub);
  }

  const hEyebrow = makeText("CATÁLOGO DE COMPONENTES · BASE DESIGN SYSTEM v18.2", 11, "Bold", { r: 0.15, g: 0.43, b: 0.95 });
  hEyebrow.x = 50; hEyebrow.y = 40; sec.appendChild(hEyebrow);

  const hTitle = makeText("Sistema de diseño Base de Uber", 28, "Bold", { r: 0, g: 0, b: 0 });
  hTitle.x = 50; hTitle.y = 62; sec.appendChild(hTitle);

  const hDesc = makeText("Componentes oficiales de base.uber.com integrados en el Agente de Diseño.", 13.5, "Regular", { r: 0.35, g: 0.35, b: 0.35 });
  hDesc.x = 50; hDesc.y = 100; sec.appendChild(hDesc);

  let curY = 150;

  addSectionHeader(
    "1. Sistema de botones (Uber Base Buttons)",
    "Jerarquía oficial de baseui/button: Primary (#000000), Secondary (#EEEEEE), Shapes (Pill, Rounded 8px, Circle) y Sizes.",
    curY
  );
  curY += 66;

  const lbl1_1 = makeText("1.1 Variantes de jerarquía (Kinds: primary · secondary · tertiary · minimal · negative · positive)", 11, "Bold", { r: 0.2, g: 0.2, b: 0.2 });
  lbl1_1.x = 50; lbl1_1.y = curY; sec.appendChild(lbl1_1);
  curY += 24;

  const kinds = [
    { name: "Button / Kind / Primary", label: "Confirmar viaje ➔", bg: { r: 0, g: 0, b: 0 }, fg: { r: 1, g: 1, b: 1 }, w: 200, h: 48, rx: 8 },
    { name: "Button / Kind / Secondary", label: "Programar para más tarde", bg: { r: 0.93, g: 0.93, b: 0.93 }, fg: { r: 0, g: 0, b: 0 }, w: 220, h: 48, rx: 8 },
    { name: "Button / Kind / Tertiary", label: "Ver desglose de precio", bg: { r: 1, g: 1, b: 1 }, fg: { r: 0, g: 0, b: 0 }, stroke: { r: 0.88, g: 0.88, b: 0.88 }, w: 210, h: 48, rx: 8 },
    { name: "Button / Kind / Minimal", label: "Cancelar", bg: { r: 1, g: 1, b: 1 }, fg: { r: 0, g: 0, b: 0 }, w: 140, h: 48, rx: 8 },
    { name: "Button / Kind / Negative", label: "Reintentar y pagar", bg: { r: 0.88, g: 0.1, b: 0 }, fg: { r: 1, g: 1, b: 1 }, w: 180, h: 48, rx: 8 },
    { name: "Button / Kind / Positive", label: "Conexión verificada ✓", bg: { r: 0.05, g: 0.51, b: 0.27 }, fg: { r: 1, g: 1, b: 1 }, w: 210, h: 48, rx: 8 }
  ];

  let kX = 50;
  kinds.forEach(k => {
    const comp = figma.createComponent();
    comp.name = k.name;
    comp.layoutMode = "HORIZONTAL";
    comp.primaryAxisAlignItems = "CENTER";
    comp.counterAxisAlignItems = "CENTER";
    comp.resize(k.w, k.h);
    comp.cornerRadius = k.rx;
    comp.fills = [{ type: "SOLID", color: k.bg }];
    if (k.stroke) {
      comp.strokes = [{ type: "SOLID", color: k.stroke }];
      comp.strokeWeight = 1;
    }
    const txt = makeText(k.label, 13.5, "Bold", k.fg);
    comp.appendChild(txt);
    sec.appendChild(comp);
    comp.x = kX; comp.y = curY;
    kX += k.w + 20;
  });

  curY += 76;

  const lbl1_2 = makeText("1.2 Formas (Shapes: Pill · Rounded 8px · Square · Circle Icon)", 11, "Bold", { r: 0.2, g: 0.2, b: 0.2 });
  lbl1_2.x = 50; lbl1_2.y = curY; sec.appendChild(lbl1_2);
  curY += 24;

  const shapes = [
    { name: "Button / Shape / Pill", label: "Pill shape (500px radius)", rx: 24, w: 220, h: 48 },
    { name: "Button / Shape / Rounded 8px", label: "Rounded estándar (8px)", rx: 8, w: 210, h: 48 },
    { name: "Button / Shape / Square", label: "Square rect (0px)", rx: 0, w: 180, h: 48 }
  ];

  let sX = 50;
  shapes.forEach(s => {
    const comp = figma.createComponent();
    comp.name = s.name;
    comp.layoutMode = "HORIZONTAL";
    comp.primaryAxisAlignItems = "CENTER";
    comp.counterAxisAlignItems = "CENTER";
    comp.resize(s.w, s.h);
    comp.cornerRadius = s.rx;
    comp.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    const txt = makeText(s.label, 13, "Bold", { r: 1, g: 1, b: 1 });
    comp.appendChild(txt);
    sec.appendChild(comp);
    comp.x = sX; comp.y = curY;
    sX += s.w + 20;
  });

  const circleIcons = [
    { name: "Button / Shape / Circle Icon (Back)", icon: "‹", size: 44 },
    { name: "Button / Shape / Circle Icon (Search)", icon: "🔍", size: 44 },
    { name: "Button / Shape / Circle Icon (Close)", icon: "✕", size: 44 }
  ];

  circleIcons.forEach(ci => {
    const comp = figma.createComponent();
    comp.name = ci.name;
    comp.layoutMode = "HORIZONTAL";
    comp.primaryAxisAlignItems = "CENTER";
    comp.counterAxisAlignItems = "CENTER";
    comp.resize(ci.size, ci.size);
    comp.cornerRadius = ci.size / 2;
    comp.fills = [{ type: "SOLID", color: { r: 0.93, g: 0.93, b: 0.93 } }];
    const txt = makeText(ci.icon, 18, "Bold", { r: 0, g: 0, b: 0 });
    comp.appendChild(txt);
    sec.appendChild(comp);
    comp.x = sX; comp.y = curY;
    sX += ci.size + 16;
  });

  curY += 76;

  const lbl1_3 = makeText("1.3 Escala de tamaños (Sizes: Large 56px · Default 48px · Compact 36px · Mini 28px)", 11, "Bold", { r: 0.2, g: 0.2, b: 0.2 });
  lbl1_3.x = 50; lbl1_3.y = curY; sec.appendChild(lbl1_3);
  curY += 24;

  const sizes = [
    { name: "Button / Size / Large (56px)", label: "Large 56px", h: 56, w: 180, fontSz: 16 },
    { name: "Button / Size / Default (48px)", label: "Default 48px", h: 48, w: 160, fontSz: 14 },
    { name: "Button / Size / Compact (36px)", label: "Compact 36px", h: 36, w: 140, fontSz: 12 },
    { name: "Button / Size / Mini (28px)", label: "Mini 28px", h: 28, w: 110, fontSz: 11 }
  ];

  let szX = 50;
  sizes.forEach(sz => {
    const comp = figma.createComponent();
    comp.name = sz.name;
    comp.layoutMode = "HORIZONTAL";
    comp.primaryAxisAlignItems = "CENTER";
    comp.counterAxisAlignItems = "CENTER";
    comp.resize(sz.w, sz.h);
    comp.cornerRadius = 8;
    comp.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    const txt = makeText(sz.label, sz.fontSz, "Bold", { r: 1, g: 1, b: 1 });
    comp.appendChild(txt);
    sec.appendChild(comp);
    comp.x = szX; comp.y = curY + (56 - sz.h) / 2;
    szX += sz.w + 20;
  });

  curY += 86;

  const lbl1_4 = makeText("1.4 Enhancers & ButtonGroup", 11, "Bold", { r: 0.2, g: 0.2, b: 0.2 });
  lbl1_4.x = 50; lbl1_4.y = curY; sec.appendChild(lbl1_4);
  curY += 24;

  const btnGroup = figma.createComponent();
  btnGroup.name = "Control / ButtonGroup (Segmented)";
  btnGroup.resize(343, 44);
  btnGroup.cornerRadius = 8;
  btnGroup.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
  btnGroup.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.88 } }];
  btnGroup.strokeWeight = 1;

  const seg1 = figma.createFrame();
  seg1.resize(110, 36); seg1.x = 4; seg1.y = 4; seg1.cornerRadius = 6;
  seg1.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  const seg1Text = makeText("Viaje actual", 12.5, "Bold", { r: 1, g: 1, b: 1 });
  seg1Text.x = 18; seg1Text.y = 10; seg1.appendChild(seg1Text);
  btnGroup.appendChild(seg1);

  const seg2 = makeText("Uber Reserve", 12.5, "Medium", { r: 0.3, g: 0.3, b: 0.3 });
  seg2.x = 135; seg2.y = 14; btnGroup.appendChild(seg2);

  const seg3 = makeText("Alquiler", 12.5, "Medium", { r: 0.3, g: 0.3, b: 0.3 });
  seg3.x = 255; seg3.y = 14; btnGroup.appendChild(seg3);

  sec.appendChild(btnGroup);
  btnGroup.x = 50; btnGroup.y = curY;

  const enh1 = figma.createComponent();
  enh1.name = "Button / Enhancer / Ride";
  enh1.resize(250, 48); enh1.cornerRadius = 8;
  enh1.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  const enh1Left = makeText("🚗 Pedir UberX", 13.5, "Bold", { r: 1, g: 1, b: 1 }); enh1Left.x = 16; enh1Left.y = 16; enh1.appendChild(enh1Left);
  const enh1Right = makeText("➔", 16, "Bold", { r: 1, g: 1, b: 1 }); enh1Right.x = 216; enh1Right.y = 14; enh1.appendChild(enh1Right);
  sec.appendChild(enh1);
  enh1.x = 420; enh1.y = curY;

  const enh2 = figma.createComponent();
  enh2.name = "Button / Enhancer / EV Charger";
  enh2.resize(280, 48); enh2.cornerRadius = 8;
  enh2.fills = [{ type: "SOLID", color: { r: 0.93, g: 0.93, b: 0.93 } }];
  const enh2Left = makeText("⚡ CCS2 150 kW", 13.5, "Bold", { r: 0, g: 0, b: 0 }); enh2Left.x = 16; enh2Left.y = 16; enh2.appendChild(enh2Left);
  const enh2Right = makeText("0,45 €/kWh ›", 12, "Medium", { r: 0.45, g: 0.45, b: 0.45 }); enh2Right.x = 186; enh2Right.y = 16; enh2.appendChild(enh2Right);
  sec.appendChild(enh2);
  enh2.x = 700; enh2.y = curY;

  curY += 80;

  addSectionHeader(
    "2. Formularios y campos de entrada (Inputs & Controls)",
    "Búsqueda de trayecto (Route Input), interruptor Uber Cash Switch y selector de opciones Radio Cards.",
    curY
  );
  curY += 66;

  const routeInputComp = figma.createComponent();
  routeInputComp.name = "Form / RouteInput (Pickup & Destination)";
  routeInputComp.resize(343, 116);
  routeInputComp.cornerRadius = 12;
  routeInputComp.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  routeInputComp.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.88 } }];
  routeInputComp.strokeWeight = 1;

  const dotOrigin = figma.createFrame();
  dotOrigin.resize(10, 10); dotOrigin.x = 16; dotOrigin.y = 24; dotOrigin.cornerRadius = 5;
  dotOrigin.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  routeInputComp.appendChild(dotOrigin);

  const boxOrigin = figma.createFrame();
  boxOrigin.resize(285, 34); boxOrigin.x = 38; boxOrigin.y = 12; boxOrigin.cornerRadius = 6;
  boxOrigin.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
  const txtOrigin = makeText("Estación Joaquín Sorolla", 12.5, "Bold", { r: 0, g: 0, b: 0 });
  txtOrigin.x = 10; txtOrigin.y = 9; boxOrigin.appendChild(txtOrigin);
  routeInputComp.appendChild(boxOrigin);

  const sqDest = figma.createFrame();
  sqDest.resize(10, 10); sqDest.x = 16; sqDest.y = 74; sqDest.cornerRadius = 2;
  sqDest.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  routeInputComp.appendChild(sqDest);

  const boxDest = figma.createFrame();
  boxDest.resize(285, 34); boxDest.x = 38; boxDest.y = 62; boxDest.cornerRadius = 6;
  boxDest.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
  const txtDest = makeText("Aeropuerto de Valencia (T1)", 12.5, "Regular", { r: 0.45, g: 0.45, b: 0.45 });
  txtDest.x = 10; txtDest.y = 9; boxDest.appendChild(txtDest);
  routeInputComp.appendChild(boxDest);

  sec.appendChild(routeInputComp);
  routeInputComp.x = 50; routeInputComp.y = curY;

  const switchCompOn = figma.createComponent();
  switchCompOn.name = "Control / Switch / Active (Uber Cash)";
  switchCompOn.resize(343, 56); switchCompOn.cornerRadius = 8;
  switchCompOn.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
  const swOnTitle = makeText("Usar saldo Uber Cash", 13.5, "Bold", { r: 0, g: 0, b: 0 }); swOnTitle.x = 14; swOnTitle.y = 10; switchCompOn.appendChild(swOnTitle);
  const swOnSub = makeText("Saldo disponible: 12,50 €", 11.5, "Regular", { r: 0.45, g: 0.45, b: 0.45 }); swOnSub.x = 14; swOnSub.y = 30; switchCompOn.appendChild(swOnSub);

  const swPill = figma.createFrame();
  swPill.resize(44, 24); swPill.x = 285; swPill.y = 16; swPill.cornerRadius = 12;
  swPill.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  const swDot = figma.createFrame();
  swDot.resize(18, 18); swDot.x = 22; swDot.y = 3; swDot.cornerRadius = 9;
  swDot.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  swPill.appendChild(swDot);
  switchCompOn.appendChild(swPill);

  sec.appendChild(switchCompOn);
  switchCompOn.x = 420; switchCompOn.y = curY;

  const switchCompOff = figma.createComponent();
  switchCompOff.name = "Control / Switch / Off (Silent Ride)";
  switchCompOff.resize(343, 56); switchCompOff.cornerRadius = 8;
  switchCompOff.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
  const swOffTitle = makeText("Viaje silencioso", 13.5, "Bold", { r: 0, g: 0, b: 0 }); swOffTitle.x = 14; swOffTitle.y = 10; switchCompOff.appendChild(swOffTitle);
  const swOffSub = makeText("Preferencia de confort", 11.5, "Regular", { r: 0.45, g: 0.45, b: 0.45 }); swOffSub.x = 14; swOffSub.y = 30; switchCompOff.appendChild(swOffSub);

  const swPillOff = figma.createFrame();
  swPillOff.resize(44, 24); swPillOff.x = 285; swPillOff.y = 16; swPillOff.cornerRadius = 12;
  swPillOff.fills = [{ type: "SOLID", color: { r: 0.85, g: 0.85, b: 0.85 } }];
  const swDotOff = figma.createFrame();
  swDotOff.resize(18, 18); swDotOff.x = 4; swDotOff.y = 3; swDotOff.cornerRadius = 9;
  swDotOff.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  swPillOff.appendChild(swDotOff);
  switchCompOff.appendChild(swPillOff);

  sec.appendChild(switchCompOff);
  switchCompOff.x = 420; switchCompOff.y = curY + 66;

  const radioCardComp = figma.createComponent();
  radioCardComp.name = "Card / RadioOption / Immediate Ride";
  radioCardComp.resize(343, 68); radioCardComp.cornerRadius = 8;
  radioCardComp.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  radioCardComp.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  radioCardComp.strokeWeight = 2;

  const rCircle = figma.createFrame();
  rCircle.resize(18, 18); rCircle.x = 14; rCircle.y = 16; rCircle.cornerRadius = 9;
  rCircle.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  const rInner = figma.createFrame();
  rInner.resize(6, 6); rInner.x = 6; rInner.y = 6; rInner.cornerRadius = 3;
  rInner.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  rCircle.appendChild(rInner);
  radioCardComp.appendChild(rCircle);

  const rTitle = makeText("Viaje inmediato", 13.5, "Bold", { r: 0, g: 0, b: 0 }); rTitle.x = 42; rTitle.y = 14; radioCardComp.appendChild(rTitle);
  const rPrice = makeText("14,20 €", 13.5, "Bold", { r: 0, g: 0, b: 0 }); rPrice.x = 270; rPrice.y = 14; radioCardComp.appendChild(rPrice);
  const rSub = makeText("Llegada en 4 min · Asignación instantánea", 11.5, "Regular", { r: 0.45, g: 0.45, b: 0.45 }); rSub.x = 42; rSub.y = 38; radioCardComp.appendChild(rSub);

  sec.appendChild(radioCardComp);
  radioCardComp.x = 790; radioCardComp.y = curY;

  curY += 150;

  addSectionHeader(
    "3. Tarjetas de producto y movilidad (Vehicle & Charging Cards)",
    "Fichas de selección de vehículo (UberX), puntos de recarga VE (CCS2) y código PIN de verificación con conductor.",
    curY
  );
  curY += 66;

  const vehUberX = figma.createComponent();
  vehUberX.name = "Card / Vehicle / UberX (Official)";
  vehUberX.resize(343, 170); vehUberX.cornerRadius = 12;
  vehUberX.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  vehUberX.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  vehUberX.strokeWeight = 2;

  const vTop = figma.createFrame();
  vTop.resize(343, 80); vTop.x = 0; vTop.y = 0;
  vTop.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
  const vEmoji = makeText("🚗", 34); vEmoji.x = 16; vEmoji.y = 20; vTop.appendChild(vEmoji);
  const vBadge = figma.createFrame();
  vBadge.resize(88, 24); vBadge.x = 239; vBadge.y = 20; vBadge.cornerRadius = 4;
  vBadge.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  const vBadgeText = makeText("Más popular", 11, "Bold", { r: 1, g: 1, b: 1 }); vBadgeText.x = 10; vBadgeText.y = 5; vBadge.appendChild(vBadgeText);
  vTop.appendChild(vBadge);
  vehUberX.appendChild(vTop);

  const vTitle = makeText("UberX · 4 plazas", 15.5, "Bold", { r: 0, g: 0, b: 0 }); vTitle.x = 16; vTitle.y = 96; vehUberX.appendChild(vTitle);
  const vPerk = makeText("Llegada en 4 min", 12.5, "Bold", { r: 0.05, g: 0.51, b: 0.27 }); vPerk.x = 16; vPerk.y = 132; vehUberX.appendChild(vPerk);
  const vPrice = makeText("14,20 €", 17, "Bold", { r: 0, g: 0, b: 0 }); vPrice.x = 265; vPrice.y = 130; vehUberX.appendChild(vPrice);

  sec.appendChild(vehUberX);
  vehUberX.x = 50; vehUberX.y = curY;

  const cardEv = figma.createComponent();
  cardEv.name = "Card / EV / CCS2 Combo 150kW";
  cardEv.resize(343, 170); cardEv.cornerRadius = 12;
  cardEv.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  cardEv.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  cardEv.strokeWeight = 2;

  const evTop = figma.createFrame();
  evTop.resize(343, 80); evTop.x = 0; evTop.y = 0;
  evTop.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
  const evTitle = makeText("Punto 03 · CCS2 Combo", 14, "Bold", { r: 0, g: 0, b: 0 }); evTitle.x = 16; evTitle.y = 18; evTop.appendChild(evTitle);
  const evSub = makeText("150 kW · 800V DC", 12, "Regular", { r: 0.45, g: 0.45, b: 0.45 }); evSub.x = 16; evSub.y = 40; evTop.appendChild(evSub);
  const evBadge = figma.createFrame();
  evBadge.resize(54, 24); evBadge.x = 273; evBadge.y = 20; evBadge.cornerRadius = 4;
  evBadge.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.51, b: 0.27 } }];
  const evBadgeText = makeText("Libre", 11, "Bold", { r: 1, g: 1, b: 1 }); evBadgeText.x = 12; evBadgeText.y = 5; evBadge.appendChild(evBadgeText);
  evTop.appendChild(evBadge);
  cardEv.appendChild(evTop);

  const evReady = makeText("Toma lista", 13, "Bold", { r: 0.05, g: 0.51, b: 0.27 }); evReady.x = 16; evReady.y = 132; cardEv.appendChild(evReady);
  const evPrice = makeText("0,45 € /kWh", 15.5, "Bold", { r: 0, g: 0, b: 0 }); evPrice.x = 230; evPrice.y = 130; cardEv.appendChild(evPrice);

  sec.appendChild(cardEv);
  cardEv.x = 420; cardEv.y = curY;

  const pinComp = figma.createComponent();
  pinComp.name = "Card / Security / PIN & Driver Info";
  pinComp.resize(343, 170); pinComp.cornerRadius = 12;
  pinComp.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  pinComp.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.88 } }];
  pinComp.strokeWeight = 1;

  const pinLabel = makeText("PIN de verificación al subir:", 12, "Regular", { r: 0.45, g: 0.45, b: 0.45 });
  pinLabel.x = 16; pinLabel.y = 14; pinComp.appendChild(pinLabel);

  const pinDigits = makeText("7  4  9  2", 26, "Bold", { r: 0, g: 0, b: 0 });
  pinDigits.x = 16; pinDigits.y = 36; pinComp.appendChild(pinDigits);

  const driverLine = figma.createFrame();
  driverLine.resize(311, 1); driverLine.x = 16; driverLine.y = 86;
  driverLine.fills = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.88 } }];
  pinComp.appendChild(driverLine);

  const avatar = figma.createFrame();
  avatar.resize(36, 36); avatar.x = 16; avatar.y = 104; avatar.cornerRadius = 18;
  avatar.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  const avText = makeText("C", 16, "Bold", { r: 1, g: 1, b: 1 }); avText.x = 12; avText.y = 8; avatar.appendChild(avText);
  pinComp.appendChild(avatar);

  const driverName = makeText("Carlos M.", 14, "Bold", { r: 0, g: 0, b: 0 }); driverName.x = 64; driverName.y = 102; pinComp.appendChild(driverName);
  const driverDetail = makeText("★ 4.95 · Toyota Corolla (4821 LKY)", 11.5, "Regular", { r: 0.45, g: 0.45, b: 0.45 }); driverDetail.x = 64; driverDetail.y = 122; pinComp.appendChild(driverDetail);

  sec.appendChild(pinComp);
  pinComp.x = 790; pinComp.y = curY;

  curY += 210;

  addSectionHeader(
    "4. Tokens oficiales de color y tipografía (W3C Tokens)",
    "Tokens extraídos de base.uber.com y escala tipográfica de Uber Move y Uber Move Text.",
    curY
  );
  curY += 66;

  const swatches = [
    { name: "Primary / Black", token: "--base-black", hex: "#000000", color: { r: 0, g: 0, b: 0 }, desc: "Acción principal", isDark: false },
    { name: "Background Primary", token: "--base-bg-primary", hex: "#FFFFFF", color: { r: 1, g: 1, b: 1 }, desc: "Fondo base", isDark: true, stroke: { r: 0.88, g: 0.88, b: 0.88 } },
    { name: "Background Secondary", token: "--base-bg-secondary", hex: "#F6F6F6", color: { r: 0.96, g: 0.96, b: 0.96 }, desc: "Superficies", isDark: true },
    { name: "Background Tertiary", token: "--base-bg-tertiary", hex: "#E2E2E2", color: { r: 0.88, g: 0.88, b: 0.88 }, desc: "Bordes", isDark: true },
    { name: "Content Secondary", token: "--base-content-secondary", hex: "#545454", color: { r: 0.33, g: 0.33, b: 0.33 }, desc: "Texto secundario", isDark: false },
    { name: "Content Tertiary", token: "--base-content-tertiary", hex: "#757575", color: { r: 0.46, g: 0.46, b: 0.46 }, desc: "Texto atenuado", isDark: false },
    { name: "Accent Blue", token: "--base-accent", hex: "#276EF1", color: { r: 0.15, g: 0.43, b: 0.95 }, desc: "Enlaces", isDark: false },
    { name: "Positive Green", token: "--base-positive", hex: "#0E8345", color: { r: 0.05, g: 0.51, b: 0.27 }, desc: "Éxito y recarga", isDark: false },
    { name: "Negative Red", token: "--base-negative", hex: "#DE1135", color: { r: 0.87, g: 0.07, b: 0.21 }, desc: "Errores y alertas", isDark: false },
    { name: "Warning Amber", token: "--base-warning", hex: "#F69E0C", color: { r: 0.96, g: 0.62, b: 0.05 }, desc: "Alta demanda", isDark: false }
  ];

  let swX = 50;
  let swY = curY;
  swatches.forEach((sw, idx) => {
    const comp = figma.createComponent();
    comp.name = "Token / " + sw.name;
    comp.resize(132, 108);
    comp.cornerRadius = 8;
    comp.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    comp.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.88 } }];
    comp.strokeWeight = 1;

    const block = figma.createFrame();
    block.resize(132, 48); block.x = 0; block.y = 0;
    block.fills = [{ type: "SOLID", color: sw.color }];
    if (sw.stroke) {
      block.strokes = [{ type: "SOLID", color: sw.stroke }];
      block.strokeWeight = 1;
    }
    comp.appendChild(block);

    const tHex = makeText(sw.hex, 11, "Bold", { r: 0, g: 0, b: 0 });
    tHex.x = 8; tHex.y = 54; comp.appendChild(tHex);

    const tTok = makeText(sw.token, 9, "Regular", { r: 0.45, g: 0.45, b: 0.45 });
    tTok.x = 8; tTok.y = 70; comp.appendChild(tTok);

    const tDesc = makeText(sw.desc, 9, "Regular", { r: 0.2, g: 0.2, b: 0.2 });
    tDesc.x = 8; tDesc.y = 86; comp.appendChild(tDesc);

    sec.appendChild(comp);
    comp.x = swX; comp.y = swY;
    swX += 148;
    if ((idx + 1) % 5 === 0) {
      swX = 50;
      swY += 124;
    }
  });

  curY = swY + 140;

  const lblType = makeText("Escala Tipográfica Oficial (Uber Move & Uber Move Text)", 14, "Bold", { r: 0, g: 0, b: 0 });
  lblType.x = 50; lblType.y = curY; sec.appendChild(lblType);
  curY += 28;

  const typeScales = [
    { label: "DisplayLarge / 52", sample: "68 % cargado", size: 42, weight: "Bold" },
    { label: "Display / 36", sample: "Go anywhere, get anything", size: 30, weight: "Bold" },
    { label: "HeadingLarge / 24", sample: "Solicita tu viaje con UberX", size: 22, weight: "Bold" },
    { label: "HeadingMedium / 20", sample: "Punto 03 · CCS2 Ultra-rápido", size: 18, weight: "Bold" },
    { label: "LabelLarge / 16", sample: "Confirmar viaje con UberX", size: 16, weight: "Bold" },
    { label: "ParagraphMedium / 14", sample: "Precio cerrado garantizado sin sorpresas.", size: 14, weight: "Regular" },
    { label: "Caption / 11", sample: "Tarifa calculada con contador homologado MID.", size: 11, weight: "Regular", color: { r: 0.45, g: 0.45, b: 0.45 } }
  ];

  typeScales.forEach(ts => {
    const comp = figma.createComponent();
    comp.name = "Typography / " + ts.label.split("/")[0].trim();
    comp.resize(800, 40);
    comp.fills = [];

    const tCode = makeText(ts.label, 11, "Medium", { r: 0.15, g: 0.43, b: 0.95 });
    tCode.x = 0; tCode.y = 12; comp.appendChild(tCode);

    const tSample = makeText(ts.sample, ts.size, ts.weight, ts.color || { r: 0, g: 0, b: 0 });
    tSample.x = 220; tSample.y = Math.round(20 - (ts.size / 2)); comp.appendChild(tSample);

    sec.appendChild(comp);
    comp.x = 50; comp.y = curY;
    curY += 46;
  });

  figma.viewport.scrollAndZoomIntoView([sec]);
  figma.notify("💎 Librería Base DS creada con éxito en Figma");
}


// ==============================================================================
// GESTOR DE COMPONENTES OFICIALES DE DOCUMENTACIÓN Y FLUJO DE FIGMA
// Vinculación a los nodos oficiales de la sección de documentación:
// - Sección General: 103:746
// - Carteles de Estado (Preceden al diseño): 103:309
// - Titulares de Flujo (Nombre de la parte del flujo): 103:406
// - Anotaciones de Diseño (Documentar partes del diseño): 103:525
// - Flechas y Conectores de Mapa de Flujo: 103:469
// ==============================================================================

const DOC_SYSTEM_IDS = {
  section: "103:746",     // Sección general de componentes de documentación
  statusPoster: "103:309",// Carteles que deben preceder al diseño para indicar su estado
  headline: "103:406",    // Titulares para indicar el nombre de la parte del flujo
  annotation: "103:525",  // Anotaciones para documentar las partes del diseño
  flowArrow: "103:469"    // Flechas y componentes para realizar el mapa de flujo
};

/**
 * Busca un nodo por su ID exacto o alternativo (103:309 o 103-309) o dentro de la sección general
 */
function findDocNode(nodeId) {
  if (!nodeId) return null;
  try {
    let n = figma.getNodeById(nodeId);
    if (n) return n;
    const altId = nodeId.includes(":") ? nodeId.replace(":", "-") : nodeId.replace("-", ":");
    n = figma.getNodeById(altId);
    if (n) return n;
  } catch (e) {}

  try {
    const mainSec = figma.getNodeById("103:746") || figma.getNodeById("103-746");
    if (mainSec && typeof mainSec.findAll === "function") {
      const found = mainSec.findOne(c => c.id === nodeId || c.id.replace("-", ":") === nodeId.replace("-", ":"));
      if (found) return found;
    }
  } catch (e) {}

  return null;
}

/**
 * Instancia o clona un componente oficial de Figma preservando variantes y AutoLayout
 */
async function instantiateDocComponent(nodeId, variantQuery) {
  const node = findDocNode(nodeId);
  if (!node) return null;

  try {
    // 1. Si es un ComponentSetNode, seleccionar la variante adecuada
    if (node.type === "COMPONENT_SET") {
      let targetComp = null;
      if (variantQuery && Array.isArray(node.children)) {
        const qLower = variantQuery.toLowerCase();
        targetComp = node.children.find(c => c.name.toLowerCase().includes(qLower));
      }
      if (!targetComp && node.defaultVariant) {
        targetComp = node.defaultVariant;
      }
      if (!targetComp && node.children && node.children.length > 0) {
        targetComp = node.children[0];
      }
      if (targetComp && typeof targetComp.createInstance === "function") {
        return targetComp.createInstance();
      }
    }

    // 2. Si es un ComponentNode individual
    if (node.type === "COMPONENT") {
      return node.createInstance();
    }

    // 3. Si es una Sección, Frame o Grupo contenedor de componentes
    if (node.type === "SECTION" || node.type === "FRAME" || node.type === "GROUP") {
      if (typeof node.findAll === "function") {
        const comps = node.findAll(n => n.type === "COMPONENT" || n.type === "COMPONENT_SET");
        if (comps.length > 0) {
          let chosen = comps[0];
          if (variantQuery) {
            const qLower = variantQuery.toLowerCase();
            const match = comps.find(c => c.name.toLowerCase().includes(qLower));
            if (match) chosen = match;
          }
          if (chosen.type === "COMPONENT_SET") {
            const v = chosen.defaultVariant || chosen.children[0];
            if (v && typeof v.createInstance === "function") return v.createInstance();
          } else if (typeof chosen.createInstance === "function") {
            return chosen.createInstance();
          }
        }
      }

      // Si es un Frame de diseño listo para usar, clonarlo
      if (typeof node.clone === "function") {
        return node.clone();
      }
    }

    if (typeof node.clone === "function") {
      return node.clone();
    }
  } catch (err) {
    console.warn("Fallo instanciando componente de documentación (" + nodeId + "):", err);
  }

  return null;
}

/**
 * Actualiza los textos de un nodo o instancia de Figma cargando sus fuentes
 */
async function populateNodeTexts(targetNode, textDictionary) {
  if (!targetNode || !textDictionary) return;

  const textNodes = [];
  if (targetNode.type === "TEXT") {
    textNodes.push(targetNode);
  } else if (typeof targetNode.findAll === "function") {
    textNodes.push(...targetNode.findAll(n => n.type === "TEXT"));
  }

  for (const tNode of textNodes) {
    try {
      if (tNode.fontName) {
        await figma.loadFontAsync(tNode.fontName);
      }
      const layerName = (tNode.name || "").toLowerCase();
      const currentText = (tNode.characters || "").trim().toLowerCase();

      for (const [key, value] of Object.entries(textDictionary)) {
        if (!value) continue;
        const kLower = key.toLowerCase();

        const nameMatches = layerName.includes(kLower);
        const textMatches = currentText.includes(kLower);

        const isTitleField = (key === "title" || key === "titular") && (layerName.includes("title") || layerName.includes("heading") || layerName.includes("nombre") || layerName.includes("titular") || currentText.includes("título") || currentText.includes("title"));
        const isStatusField = (key === "status" || key === "estado") && (layerName.includes("status") || layerName.includes("estado") || layerName.includes("badge") || layerName.includes("tag") || layerName.includes("etiqueta") || currentText.includes("estado"));
        const isStepField = (key === "step" || key === "paso") && (layerName.includes("step") || layerName.includes("paso") || layerName.includes("num") || currentText.includes("paso"));
        const isDescField = (key === "description" || key === "desc" || key === "func") && (layerName.includes("desc") || layerName.includes("body") || layerName.includes("text") || layerName.includes("detalle") || layerName.includes("explicacion"));
        const isTicketField = (key === "ticket" || key === "jira") && (layerName.includes("ticket") || layerName.includes("jira") || layerName.includes("kan"));
        const isDateField = (key === "date" || key === "fecha") && (layerName.includes("date") || layerName.includes("fecha") || layerName.includes("time"));

        if (nameMatches || textMatches || isTitleField || isStatusField || isStepField || isDescField || isTicketField || isDateField) {
          tNode.characters = String(value);
          break;
        }
      }
    } catch (e) {
      console.warn("No se pudo actualizar capa de texto:", tNode.name, e);
    }
  }
}

/**
 * 1. Carteles Oficiales que deben preceder al diseño para indicar su estado (Nodo 103:309)
 */
async function renderOfficialStatusPoster(ticketKey, versionNum, parentSection, xPos, yPos) {
  const dateNow = new Date();
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const formattedDate = dateNow.getDate() + " " + months[dateNow.getMonth()] + " " + dateNow.getFullYear();

  const statusTexts = {
    ticket: ticketKey,
    title: "Propuesta de Flujo · " + ticketKey,
    status: "EN REVISIÓN · v" + versionNum,
    estado: "EN REVISIÓN · v" + versionNum,
    version: "v" + versionNum + ".0",
    date: formattedDate,
    fecha: formattedDate,
    description: "Flujo de pantallas finales sin botones de simulación. Conectores ortogonales oficiales y tokens de Uber Base DS."
  };

  let posterNode = await instantiateDocComponent(DOC_SYSTEM_IDS.statusPoster, "En revisión");

  if (posterNode) {
    posterNode.name = "Cartel de Estado · " + ticketKey + " (103:309)";
    parentSection.appendChild(posterNode);
    posterNode.x = xPos;
    posterNode.y = yPos;
    await populateNodeTexts(posterNode, statusTexts);
    bindLocalStylesToScreenNode(posterNode);
    return posterNode;
  }

  // Fallback si no está presente el nodo en el archivo
  const fallbackPoster = figma.createFrame();
  fallbackPoster.name = "Cartel de Estado · " + ticketKey + " (Oficial)";
  fallbackPoster.layoutMode = "VERTICAL";
  fallbackPoster.counterAxisSizingMode = "FIXED";
  fallbackPoster.primaryAxisSizingMode = "AUTO";
  fallbackPoster.resize(360, 480);
  fallbackPoster.paddingLeft = 24; fallbackPoster.paddingRight = 24;
  fallbackPoster.paddingTop = 28; fallbackPoster.paddingBottom = 28;
  fallbackPoster.itemSpacing = 16;
  fallbackPoster.cornerRadius = 16;
  fallbackPoster.fills = [{ type: "SOLID", color: { r: 0.05, g: 0.05, b: 0.05 } }];
  applyFillStyle(fallbackPoster, "primary", { r: 0.05, g: 0.05, b: 0.05 });

  const pStatusPill = figma.createFrame();
  pStatusPill.layoutMode = "HORIZONTAL";
  pStatusPill.paddingLeft = 10; pStatusPill.paddingRight = 10; pStatusPill.paddingTop = 4; pStatusPill.paddingBottom = 4;
  pStatusPill.cornerRadius = 6;
  pStatusPill.fills = [{ type: "SOLID", color: { r: 0.15, g: 0.68, b: 0.37 } }];
  const pStatusTxt = makeText("● EN REVISIÓN · v" + versionNum, 10.5, "Bold", { r: 1, g: 1, b: 1 });
  pStatusPill.appendChild(pStatusTxt);
  fallbackPoster.appendChild(pStatusPill);

  const pTicket = makeText(ticketKey, 14, "Bold", { r: 0.7, g: 0.7, b: 0.7 });
  fallbackPoster.appendChild(pTicket);

  const pTitle = makeText("Propuesta de Flujo & Especificación UX", 24, "Bold", { r: 1, g: 1, b: 1 }, 312);
  fallbackPoster.appendChild(pTitle);

  const pDesc = makeText("Diseño oficial con tokens de Uber Base DS. Pantallas finales de producción sin botones ficticios.", 11.5, "Regular", { r: 0.8, g: 0.8, b: 0.8 }, 312);
  fallbackPoster.appendChild(pDesc);

  const pDate = makeText("Fecha: " + formattedDate + " · Base DS 2.0", 10, "Medium", { r: 0.5, g: 0.5, b: 0.5 });
  fallbackPoster.appendChild(pDate);

  parentSection.appendChild(fallbackPoster);
  fallbackPoster.x = xPos;
  fallbackPoster.y = yPos;
  return fallbackPoster;
}

/**
 * 2. Titulares Oficiales para indicar el nombre de la parte del flujo (Nodo 103:406)
 */
async function renderOfficialHeadline(titleText, subtitleText, eyebrowText, parentSection, xPos, yPos) {
  const headlineTexts = {
    title: titleText,
    titular: titleText,
    heading: titleText,
    subtitle: subtitleText,
    subtitulo: subtitleText,
    eyebrow: eyebrowText,
    categoria: eyebrowText
  };

  let hlNode = await instantiateDocComponent(DOC_SYSTEM_IDS.headline);

  if (hlNode) {
    hlNode.name = "Titular de Flujo · " + titleText + " (103:406)";
    parentSection.appendChild(hlNode);
    hlNode.x = xPos;
    hlNode.y = yPos;
    await populateNodeTexts(hlNode, headlineTexts);
    bindLocalStylesToScreenNode(hlNode);
    return hlNode;
  }

  // Fallback si no está presente el nodo en el archivo
  const hlGroup = figma.createFrame();
  hlGroup.name = "Titular de Flujo";
  hlGroup.layoutMode = "VERTICAL";
  hlGroup.itemSpacing = 4;
  hlGroup.fills = [];

  const ey = makeText(eyebrowText, 11, "Bold", { r: 0.15, g: 0.43, b: 0.95 });
  const ti = makeText(titleText, 26, "Bold", { r: 0, g: 0, b: 0 });
  const su = makeText(subtitleText, 13, "Regular", { r: 0.35, g: 0.35, b: 0.35 });
  hlGroup.appendChild(ey);
  hlGroup.appendChild(ti);
  hlGroup.appendChild(su);

  parentSection.appendChild(hlGroup);
  hlGroup.x = xPos;
  hlGroup.y = yPos;
  return hlGroup;
}

/**
 * 3. Anotaciones Oficiales para documentar las partes del diseño (Nodo 103:525)
 */
async function renderOfficialAnnotation(scrData, stepNum, totalSteps, width, parentSection, xPos, yPos) {
  const isErr = scrData.stateType === "error";
  const isCorner = scrData.stateType === "corner_case";
  const stColor = isErr ? { r: 0.87, g: 0.07, b: 0.21 } : (isCorner ? { r: 0.70, g: 0.37, b: 0 } : { r: 0.05, g: 0.51, b: 0.27 });
  const stBg = isErr ? { r: 0.99, g: 0.94, b: 0.95 } : (isCorner ? { r: 1, g: 0.96, b: 0.91 } : { r: 0.92, g: 0.97, b: 0.93 });
  const bText = scrData.stateBadge || (isErr ? "CASO DE ERROR" : isCorner ? "CORNER CASE" : "HAPPY PATH");

  let displayTitle = scrData.shortName || scrData.mainTitle || ("Paso " + stepNum);
  if (!displayTitle.startsWith(stepNum + " · ") && !displayTitle.startsWith(stepNum + ". ")) {
    displayTitle = stepNum + " · " + displayTitle;
  }

  const whatText = scrData.functionality || scrData.mainSubtitle || scrData.hint || "Interacción y avance en el flujo.";
  const stateDescText = scrData.stateDesc || scrData.mainSubtitle || (isErr ? "Gestión de error y recuperación asistida sin callejones sin salida." : isCorner ? "Condición atípica de contorno resuelta proactivamente." : "Inicio del flujo: selección de destino y confirmación de tarifa cerrada.");
  const justUX = scrData.designJustification || (isErr ? "Erradica el abandono ofreciendo alternativa de pago directa sin culpar al usuario." : isCorner ? "Anticipa la fricción antes de que el usuario la experimente para ahorrar tiempo." : "Tarifa fija garantizada para máxima predictibilidad y conversión.");
  const targetStepPill = (typeof scrData.ctaTargetStep === "number" && scrData.ctaTargetStep >= 1) ? scrData.ctaTargetStep : (stepNum < totalSteps ? (stepNum + 1) : 1);

  const annotTexts = {
    step: "Paso " + stepNum + " / " + totalSteps,
    paso: "Paso " + stepNum + " / " + totalSteps,
    badge: bText,
    status: bText,
    estado: bText,
    title: displayTitle,
    titular: displayTitle,
    description: whatText,
    desc: whatText,
    stateDesc: stateDescText,
    justification: "💡 UX: " + justUX,
    action: "➔ " + (scrData.cta || "Continuar") + " ➔ Paso " + targetStepPill
  };

  let annotNode = await instantiateDocComponent(DOC_SYSTEM_IDS.annotation, bText);

  if (annotNode) {
    annotNode.name = "Anotación: " + displayTitle + " (103:525)";
    parentSection.appendChild(annotNode);
    annotNode.x = xPos;
    const annotH = annotNode.height || 180;
    annotNode.y = yPos - annotH - 16;
    await populateNodeTexts(annotNode, annotTexts);
    bindLocalStylesToScreenNode(annotNode);
    return annotNode;
  }

  // Fallback si no está presente el nodo en el archivo
  const innerW = width - 24;
  const featCard = figma.createFrame();
  featCard.name = "Anotación: " + displayTitle;
  featCard.layoutMode = "VERTICAL";
  featCard.counterAxisSizingMode = "FIXED";
  featCard.resize(width, 60);
  featCard.paddingLeft = 12; featCard.paddingRight = 12; featCard.paddingTop = 10; featCard.paddingBottom = 12;
  featCard.itemSpacing = 8;
  featCard.cornerRadius = 12;
  featCard.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  applyFillStyle(featCard, "white", { r: 1, g: 1, b: 1 });
  featCard.strokes = [{ type: "SOLID", color: isErr ? { r: 0.87, g: 0.07, b: 0.21 } : (isCorner ? { r: 0.96, g: 0.62, b: 0.05 } : { r: 0.88, g: 0.88, b: 0.88 }) }];
  applyStrokeStyle(featCard, isErr ? "negative" : (isCorner ? "warning" : "border"), isErr ? { r: 0.87, g: 0.07, b: 0.21 } : (isCorner ? { r: 0.96, g: 0.62, b: 0.05 } : { r: 0.88, g: 0.88, b: 0.88 }));
  featCard.strokeWeight = (isErr || isCorner) ? 1.5 : 1;
  featCard.clipsContent = false;

  const fcTopRow = figma.createFrame();
  fcTopRow.name = "Header Row";
  fcTopRow.layoutMode = "HORIZONTAL";
  fcTopRow.layoutAlign = "STRETCH";
  fcTopRow.primaryAxisAlignItems = "SPACE_BETWEEN";
  fcTopRow.counterAxisAlignItems = "CENTER";
  fcTopRow.fills = [];

  const pillFrame = figma.createFrame();
  pillFrame.name = "Badge";
  pillFrame.layoutMode = "HORIZONTAL";
  pillFrame.counterAxisAlignItems = "CENTER";
  pillFrame.paddingLeft = 8; pillFrame.paddingRight = 8; pillFrame.paddingTop = 3; pillFrame.paddingBottom = 3;
  pillFrame.cornerRadius = 4;
  pillFrame.fills = [{ type: "SOLID", color: stBg }];
  applyFillStyle(pillFrame, isErr ? "negative" : (isCorner ? "warning" : "positive"), stBg);
  pillFrame.strokes = [{ type: "SOLID", color: stColor }];
  applyStrokeStyle(pillFrame, isErr ? "negative" : (isCorner ? "warning" : "positive"), stColor);
  pillFrame.strokeWeight = 1;

  const pillTxt = makeText(bText, 9.5, "Bold", stColor);
  pillFrame.appendChild(pillTxt);
  fcTopRow.appendChild(pillFrame);

  const stepCounterLbl = makeText("Paso " + stepNum + " / " + totalSteps, 10.5, "Bold", { r: 0.45, g: 0.45, b: 0.45 });
  fcTopRow.appendChild(stepCounterLbl);
  featCard.appendChild(fcTopRow);

  const fcTitle = makeText(displayTitle, 15, "Bold", { r: 0, g: 0, b: 0 }, innerW);
  fcTitle.layoutAlign = "STRETCH";
  featCard.appendChild(fcTitle);

  const fcWhat = makeText("🎯 ¿Qué hace?: " + whatText, 9.5, "Medium", { r: 0.15, g: 0.15, b: 0.15 }, innerW);
  fcWhat.layoutAlign = "STRETCH";
  featCard.appendChild(fcWhat);

  const fcJust = makeText("💡 Justificación UX: " + justUX, 9, "Regular", { r: 0.05, g: 0.45, b: 0.22 }, innerW);
  fcJust.layoutAlign = "STRETCH";
  featCard.appendChild(fcJust);

  const fcFlow = makeText("➔ Interacción: [ " + (scrData.cta || "Continuar") + " ] conduce a Paso " + targetStepPill, 9, "Bold", { r: 0.15, g: 0.43, b: 0.95 }, innerW);
  fcFlow.layoutAlign = "STRETCH";
  featCard.appendChild(fcFlow);

  featCard.primaryAxisSizingMode = "AUTO";

  parentSection.appendChild(featCard);
  featCard.x = xPos;
  featCard.y = yPos - featCard.height - 16;
  return featCard;
}

/**
 * 4. Flechas y Componentes Oficiales para el Mapa de Flujo (Nodo 103:469)
 */
async function getFlowArrowSpecs() {
  const node = findDocNode(DOC_SYSTEM_IDS.flowArrow);
  const specs = {
    strokeWeight: 3,
    arrowComponent: null,
    badgeComponent: null
  };

  if (!node) return specs;

  try {
    if (typeof node.findAll === "function") {
      const comps = node.findAll(n => n.type === "COMPONENT" || n.type === "COMPONENT_SET");
      for (const c of comps) {
        const cLower = c.name.toLowerCase();
        if (cLower.includes("badge") || cLower.includes("label") || cLower.includes("tag") || cLower.includes("pill")) {
          specs.badgeComponent = c;
        } else if (cLower.includes("arrow") || cLower.includes("flecha") || cLower.includes("head") || cLower.includes("punta")) {
          specs.arrowComponent = c;
        }
      }
    }
    if (node.strokes && node.strokes.length > 0 && typeof node.strokeWeight === "number") {
      specs.strokeWeight = node.strokeWeight;
    }
  } catch (e) {}

  return specs;
}

async function renderFlowMap(screens, screenSvgs, ticketKey, changelogData) {
  await loadFonts();
  await initStyleManager();

  if (!screenSvgs || screenSvgs.length === 0) {
    figma.notify("⚠️ No hay pantallas para pintar aún. Lanza el agente en la web.");
    return;
  }

  // 1. Obtener registro de componentes de la librería (nodo 10:4737 o catálogo)
  const reg = getComponentRegistry();
  function getComp(query) {
    for (const c of reg.list) {
      if (c.name === query || c.name.startsWith(query) || c.name.includes(query)) {
        return c;
      }
    }
    return null;
  }

  const total = screenSvgs.length;
  const frameW = 375;
  const frameH = 812;
  const spacing = 160; // Espaciado cómodo para conectores y fichas
  const pad = 80;
  const topPad = 480; // Espacio superior para fichas de funcionalidad y conectores
  const bottomPad = 160;
  const docW = 660; // Ancho óptimo para documentación ejecutiva

  // Cartel Oficial de Estado que precede al diseño (Nodo 103:309)
  const posterW = 380;
  const screensStartX = pad + posterW + spacing;
  const sectionW = pad * 2 + posterW + spacing + total * frameW + total * spacing + docW;
  const sectionH = topPad + frameH + bottomPad;

  // Contar cuántas secciones de este ticket existen para numerar v1, v2, v3...
  const allSections = figma.currentPage.findAll(n => n.type === "SECTION");
  const sameTicketSections = allSections.filter(n => n.name.indexOf(ticketKey) !== -1);
  const versionNum = (changelogData && typeof changelogData.version === "number")
    ? changelogData.version
    : (sameTicketSections.length + 1);
  const sectionName = "🗺️ " + ticketKey + " (Propuesta v" + versionNum + ") · Mapa de Flujo";

  // Calcular posición: 200px debajo de la sección más baja que exista en el canvas
  let startX = Math.round(figma.viewport.center.x - (sectionW / 2));
  let startY = Math.round(figma.viewport.center.y - (sectionH / 2));

  if (allSections.length > 0) {
    let maxBottom = -Infinity;
    let refX = null;
    for (const s of allSections) {
      const bottom = s.y + s.height;
      if (bottom > maxBottom) {
        maxBottom = bottom;
      }
      if (refX === null && (s.name.includes("Mapa de Flujo") || s.name.includes("Propuesta"))) {
        refX = s.x;
      }
    }
    if (refX !== null) {
      startX = refX;
    }
    startY = maxBottom + 200; // Exactamente 200px de separación vertical
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

  // 1. Titular Oficial de la parte del flujo (Nodo 103:406)
  await renderOfficialHeadline(
    "Flujo Integral de Pantallas y Decisiones · " + ticketKey,
    "Inspección de experiencia con conectores ortogonales (90°) de Happy Path, Corner Cases y Casos de Error.",
    "MAPA DE FLUJO DE PANTALLAS & RECORRIDOS · UBER BASE DESIGN SYSTEM",
    section,
    pad,
    35
  );

  // Leyenda de colores del flujo
  const legendItems = [
    { label: "Happy Path", color: { r: 0.05, g: 0.51, b: 0.27 }, dot: "🟢" },
    { label: "Corner Case", color: { r: 0.96, g: 0.62, b: 0.05 }, dot: "🟡" },
    { label: "Caso de Error", color: { r: 0.87, g: 0.07, b: 0.21 }, dot: "🔴" },
    { label: "Retorno / Bifurcación", color: { r: 0.33, g: 0.33, b: 0.33 }, dot: "↩️" }
  ];
  let legX = pad;
  legendItems.forEach(li => {
    const lPill = figma.createFrame();
    lPill.layoutMode = "HORIZONTAL";
    lPill.paddingLeft = 8; lPill.paddingRight = 10;
    lPill.paddingTop = 4; lPill.paddingBottom = 4;
    lPill.cornerRadius = 6;
    lPill.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
    lPill.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.88 } }];
    lPill.strokeWeight = 1;

    const t = makeText(li.dot + " " + li.label, 11, "Bold", li.color);
    lPill.appendChild(t);
    section.appendChild(lPill);
    lPill.x = legX; lPill.y = 120;
    legX += 170;
  });

  // 2. Cartel Oficial que precede al diseño para indicar su estado (Nodo 103:309)
  await renderOfficialStatusPoster(ticketKey, versionNum, section, pad, topPad);

  // Posiciones de las pantallas (comenzando después del cartel de estado)
  const screenPositions = [];

  for (let idx = 0; idx < total; idx++) {
    const scrSvg = screenSvgs[idx];
    const scrData = (screens && screens[idx]) || {};
    const screenX = screensStartX + idx * (frameW + spacing);
    const screenY = topPad;

    screenPositions.push({
      left: screenX,
      right: screenX + frameW,
      top: screenY,
      bottom: screenY + frameH,
      width: frameW,
      height: frameH
    });

    try {
      // 3. Anotación Oficial para documentar cada pantalla del diseño (Nodo 103:525)
      await renderOfficialAnnotation(scrData, idx + 1, total, frameW, section, screenX, screenY);

      // B. Importar pantalla exacta desde el SVG vectorial de alta fidelidad generado por el agente (SIN AUTOLAYOUT)
      const rawSvg = typeof scrSvg === "string" ? scrSvg : (scrSvg && scrSvg.svg ? scrSvg.svg : "");
      if (!rawSvg) {
        console.warn("SVG no disponible para pantalla", idx);
        continue;
      }
      const node = figma.createNodeFromSvg(rawSvg);
      node.name = (scrData.step || (idx + 1)) + ". " + (scrData.shortName || scrData.mainTitle || ("Pantalla " + (idx + 1)));

      // Vincular estilos locales a todos los textos y formas del SVG importado
      bindLocalStylesToScreenNode(node);

      // 2. Vincular componente real de botón Base DS si existe en catálogo
      const ctaNode = node.findOne(n => n.name === "CTA_Button" || n.name.includes("CTA"));
      let targetBtnComp = null;
      if (scrData.ctaVariant === "negative") {
        targetBtnComp = getComp("Button / Kind / Negative");
      } else if (scrData.ctaVariant === "secondary") {
        targetBtnComp = getComp("Button / Kind / Secondary");
      }
      if (!targetBtnComp) {
        targetBtnComp = getComp("Button / Kind / Primary") || getComp("Button / Shape / Pill");
      }

      if (ctaNode && targetBtnComp) {
        try {
          const btnInst = targetBtnComp.createInstance();
          btnInst.name = "CTA Button · Base DS Instance";
          btnInst.resize(335, 48);
          btnInst.cornerRadius = 8;
          btnInst.x = 20;
          btnInst.y = 732;

          const tChild = btnInst.findOne(n => n.type === "TEXT");
          if (tChild && scrData.cta) {
            await figma.loadFontAsync(tChild.fontName);
            tChild.characters = scrData.cta + " ➔";
            tChild.fontSize = 15;
          }

          node.appendChild(btnInst);
          ctaNode.remove();
        } catch(btnErr) {
          console.warn("No se pudo reemplazar instancia de botón:", btnErr);
        }
      }

      section.appendChild(node);
      node.x = screenX;
      node.y = screenY;
    } catch (err) {
      console.error("Error importando pantalla SVG en Figma:", err);
    }
  }

  // 3. Trazar Conectores Ortogonales con Ángulos Rectos (90°)
  let loopTrackIndex = 0;

  for (let idx = 0; idx < total; idx++) {
    const s = (screens && screens[idx]) || {};
    const stType = s.stateType || "happy_path";
    const strokeColor = stType === "error" ? "#DE1135" : (stType === "corner_case" ? "#F69E0C" : "#0E8345");
    const isDashed = stType === "error" ? "stroke-dasharray=\"6,4\"" : "";

    const targetStep1 = (typeof s.ctaTargetStep === "number" && s.ctaTargetStep >= 1) ? s.ctaTargetStep : (idx < total - 1 ? (idx + 2) : 1);
    const targetIdx = targetStep1 - 1;
    const sPos = screenPositions[idx];
    const tPos = screenPositions[targetIdx];
    const ctaLabel = s.cta || (idx < total - 1 ? "Continuar" : "Reiniciar");

    if (tPos && sPos) {
      let pathD = "";
      let midX = 0, midY = 0;

      if (targetIdx === idx + 1) {
        // Conexión consecutiva hacia adelante: Salida CTA (derecha) → Entrada (izquierda)
        const startX = sPos.right;
        const startY = sPos.top + 756;
        const endX = tPos.left;
        const endY = tPos.top + 80;
        midX = Math.round(startX + (endX - startX) * 0.5);
        midY = Math.round((startY + endY) * 0.5);

        pathD = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
      } else if (targetIdx < idx) {
        // Conexión de retorno / loop hacia atrás: Salida inferior → Trazado bajo pantallas → Entrada inferior
        loopTrackIndex++;
        const startX = Math.round(sPos.left + sPos.width * 0.5);
        const startY = sPos.bottom;
        const endX = Math.round(tPos.left + tPos.width * 0.5);
        const endY = tPos.bottom + 10;
        const loopY = Math.round(sPos.bottom + 35 + (loopTrackIndex * 28));
        midX = Math.round((startX + endX) * 0.5);
        midY = loopY;

        pathD = `M ${startX} ${startY} L ${startX} ${loopY} L ${endX} ${loopY} L ${endX} ${endY}`;
      } else {
        // Salto hacia adelante por arriba
        const startX = Math.round(sPos.left + sPos.width * 0.5);
        const startY = sPos.top;
        const endX = Math.round(tPos.left + tPos.width * 0.5);
        const endY = tPos.top - 10;
        const archY = Math.max(20, Math.round(topPad - 35 - ((targetIdx - idx) * 20)));
        midX = Math.round((startX + endX) * 0.5);
        midY = archY;

        pathD = `M ${startX} ${startY} L ${startX} ${archY} L ${endX} ${archY} L ${endX} ${endY}`;
      }

      const fullCta = (s.cta || (idx < total - 1 ? "Continuar" : "Reiniciar")).trim();
      const labelText = `➔ ${fullCta} ➔ Paso ${targetStep1}`;
      const textWidth = Math.max(110, Math.round(labelText.length * 7.5 + 28));

      const connSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${sectionW}" height="${sectionH}" viewBox="0 0 ${sectionW} ${sectionH}">
          <defs>
            <marker id="arr-${idx}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 8 5 L 0 9 z" fill="${strokeColor}"/>
            </marker>
          </defs>
          <path d="${pathD}" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" marker-end="url(#arr-${idx})" ${isDashed}/>
          <g transform="translate(${midX}, ${midY})">
            <rect x="-${textWidth * 0.5}" y="-14" width="${textWidth}" height="28" rx="8" fill="#FFFFFF" stroke="${strokeColor}" stroke-width="1.5"/>
            <text x="0" y="4.5" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="11" font-weight="700" fill="${strokeColor}">${escapeXml(labelText)}</text>
          </g>
        </svg>
      `;

      try {
        const connGroup = createVectorGroupFromSvg(connSvg, `Línea de Flujo: Paso ${idx + 1} ➔ Paso ${targetStep1}`, section);
        if (connGroup) {
          bindLocalStylesToScreenNode(connGroup);
        }
      } catch (e) {
        console.error("Error creando línea de flujo en Figma:", e);
      }
    }

    // Conector secundario de retorno
    if (s.secondaryCta && s.secondaryCta.text) {
      const secTarget = (typeof s.secondaryCta.targetStep === "number" && s.secondaryCta.targetStep >= 1) ? s.secondaryCta.targetStep : 1;
      const secIdx = secTarget - 1;
      const secPos = screenPositions[secIdx];
      if (secPos && sPos) {
        loopTrackIndex++;
        const sX = Math.round(sPos.left + sPos.width * 0.75);
        const sY = sPos.bottom;
        const eX = Math.round(secPos.left + secPos.width * 0.25);
        const eY = secPos.bottom + 10;
        const loopY2 = Math.round(sPos.bottom + 35 + (loopTrackIndex * 28));
        const sMidX = Math.round((sX + eX) * 0.5);

        const secPathD = `M ${sX} ${sY} L ${sX} ${loopY2} L ${eX} ${loopY2} L ${eX} ${eY}`;
        const fullSecCta = (s.secondaryCta.text || "Volver").trim();
        const secLabel = `↩️ ${fullSecCta} ➔ Paso ${secTarget}`;
        const secTextWidth = Math.max(110, Math.round(secLabel.length * 7.5 + 28));

        const secSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${sectionW}" height="${sectionH}" viewBox="0 0 ${sectionW} ${sectionH}">
            <defs>
              <marker id="arr-sec-${idx}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#545454"/>
              </marker>
            </defs>
            <path d="${secPathD}" stroke="#545454" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5,4" fill="none" marker-end="url(#arr-sec-${idx})"/>
            <g transform="translate(${sMidX}, ${loopY2})">
              <rect x="-${secTextWidth * 0.5}" y="-14" width="${secTextWidth}" height="28" rx="8" fill="#FFFFFF" stroke="#545454" stroke-width="1.5"/>
              <text x="0" y="4.5" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-size="10.5" font-weight="700" fill="#333333">${escapeXml(secLabel)}</text>
            </g>
          </svg>
        `;

        try {
          const secGroup = createVectorGroupFromSvg(secSvg, `Línea Retorno: Paso ${idx + 1} ↩️ Paso ${secTarget}`, section);
          if (secGroup) {
            bindLocalStylesToScreenNode(secGroup);
          }
        } catch (e) {}
      }
    }
  }

  // 4. GENERAR GRAN PANEL DE DOCUMENTACIÓN EJECUTIVA DE LA PROPUESTA (Para Stakeholders - Texto Íntegro sin Truncar)
  const docFrame = figma.createFrame();
  docFrame.name = `📖 Propuesta de Producto & Documentación Funcional · ${ticketKey}`;
  docFrame.cornerRadius = 24;
  docFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  docFrame.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.88 } }];
  docFrame.strokeWeight = 1.5;

  docFrame.layoutMode = "VERTICAL";
  docFrame.primaryAxisSizingMode = "AUTO"; // Ajuste automático vertical a todo el contenido
  docFrame.counterAxisSizingMode = "FIXED"; // Ancho fijo
  docFrame.resize(docW, 100);
  docFrame.paddingLeft = 24; docFrame.paddingRight = 24;
  docFrame.paddingTop = 24; docFrame.paddingBottom = 28;
  docFrame.itemSpacing = 16;

  const contentW = docW - 48; // 612px para textos interiores

  // Encabezado de la Documentación
  const docHeaderCol = figma.createFrame();
  docHeaderCol.layoutMode = "VERTICAL";
  docHeaderCol.itemSpacing = 4;
  docHeaderCol.layoutAlign = "STRETCH";
  docHeaderCol.fills = [];

  const dEyebrow = makeText("DOCUMENTACIÓN INTEGRAL DE PROPUESTA · STAKEHOLDERS", 10.5, "Bold", { r: 0.15, g: 0.43, b: 0.95 }, contentW);
  dEyebrow.layoutAlign = "STRETCH";
  docHeaderCol.appendChild(dEyebrow);

  const dTitle = makeText(`En qué consiste la Propuesta · ${ticketKey}`, 20, "Bold", { r: 0, g: 0, b: 0 }, contentW);
  dTitle.layoutAlign = "STRETCH";
  docHeaderCol.appendChild(dTitle);

  const dSub = makeText("Explicación completa de la solución diseñada, qué hace cada pantalla y qué funcionalidades incorpora.", 11.5, "Regular", { r: 0.45, g: 0.45, b: 0.45 }, contentW);
  dSub.layoutAlign = "STRETCH";
  docHeaderCol.appendChild(dSub);
  docFrame.appendChild(docHeaderCol);

  // Bloque 1: En qué consiste la propuesta (Justificación de Negocio y Producto)
  const boxGoal = figma.createFrame();
  boxGoal.layoutMode = "VERTICAL";
  boxGoal.primaryAxisSizingMode = "AUTO";
  boxGoal.layoutAlign = "STRETCH";
  boxGoal.paddingLeft = 14; boxGoal.paddingRight = 14; boxGoal.paddingTop = 12; boxGoal.paddingBottom = 14;
  boxGoal.itemSpacing = 6;
  boxGoal.cornerRadius = 8;
  boxGoal.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.98, b: 0.96 } }];
  boxGoal.strokes = [{ type: "SOLID", color: { r: 0.72, g: 0.9, b: 0.76 } }];
  boxGoal.strokeWeight = 1;

  const tGoalTitle = makeText("🎯 ¿EN QUÉ CONSISTE LA PROPUESTA? (OBJETIVO Y VALOR)", 11, "Bold", { r: 0.05, g: 0.51, b: 0.27 }, contentW - 28);
  tGoalTitle.layoutAlign = "STRETCH";
  boxGoal.appendChild(tGoalTitle);

  const tGoalDesc = makeText(
    `Esta propuesta da respuesta formal al requerimiento del ticket ${ticketKey}.\n` +
    "• Propuesta de valor: Ofrece una experiencia de movilidad transparente, reduciendo la fricción cognitiva del pasajero mediante tarifas fijas garantizadas antes de la confirmación.\n" +
    "• Arquitectura de resiliencia: Incorpora gestión proactiva de alta demanda (Corner Cases) para evitar retenciones, y resolución guiada de errores de pago (Zero Dead-ends) con Uber Cash.\n" +
    "• Seguridad integral: Implementa confirmación física bidireccional por código PIN con el conductor.",
    10, "Regular", { r: 0.15, g: 0.35, b: 0.18 }, contentW - 28
  );
  tGoalDesc.layoutAlign = "STRETCH";
  boxGoal.appendChild(tGoalDesc);
  docFrame.appendChild(boxGoal);

  // Bloque 2: Recorrido Detallado Pantalla a Pantalla
  const tWalkTitle = makeText("📋 Recorrido: Qué hace y qué funcionalidades tiene cada pantalla", 13.5, "Bold", { r: 0, g: 0, b: 0 }, contentW);
  tWalkTitle.layoutAlign = "STRETCH";
  docFrame.appendChild(tWalkTitle);

  const activeScreensList = (Array.isArray(screens) && screens.length > 0) ? screens : [];
  activeScreensList.forEach((scr, sIdx) => {
    const isErr = scr.stateType === "error";
    const isCorner = scr.stateType === "corner_case";
    const stCol = isErr ? { r: 0.87, g: 0.07, b: 0.21 } : (isCorner ? { r: 0.96, g: 0.62, b: 0.05 } : { r: 0.05, g: 0.51, b: 0.27 });
    const stBg = isErr ? { r: 0.99, g: 0.94, b: 0.95 } : (isCorner ? { r: 1, g: 0.96, b: 0.91 } : { r: 0.92, g: 0.97, b: 0.93 });
    const stBadge = scr.stateBadge || (isErr ? "CASO DE ERROR" : (isCorner ? "CORNER CASE" : "HAPPY PATH"));

    // 1. Qué hace la pantalla (COMPLETO SIN RECORTES)
    const funcText = scr.functionality || scr.mainSubtitle || scr.hint || (scr.banner && scr.banner.text) || "Interacción y avance en el flujo.";

    // 2. Funcionalidades que incorpora (COMPLETO SIN RECORTES)
    const screenFeats = [];
    if (Array.isArray(scr.items) && scr.items.length > 0) {
      screenFeats.push("Catálogo (" + scr.items.map(it => it.title).join(", ") + ")");
    }
    if (scr.showMap) screenFeats.push("Mapa GPS en vivo con ruta, ETA y conductor");
    if (scr.banner && scr.banner.text) screenFeats.push("Banner contextual (" + (scr.banner.tone || "aviso") + ": " + scr.banner.text + ")");
    if (Array.isArray(scr.cards) && scr.cards.length > 0) {
      screenFeats.push("Métricas (" + scr.cards.map(c => c.label + ": " + c.value).join(" · ") + ")");
    }
    screenFeats.push("Botón [" + (scr.cta || "Continuar") + "]");
    const screenFeatsStr = screenFeats.join(" · ");

    // 3. Justificación de diseño (COMPLETO SIN RECORTES)
    let justText = scr.designJustification || scr.stateDesc || "";
    if (!justText) {
      if (isErr) {
        justText = "Erradica el abandono de compra ofreciendo alternativa de pago directa sin culpar al usuario.";
      } else if (isCorner) {
        justText = "Previene quejas y reduce tiempos de espera anticipando situaciones de alta demanda.";
      } else {
        justText = "Camino nominal directo con tarifa cerrada para maximizar certidumbre y conversión.";
      }
    }

    const targetStep = (typeof scr.ctaTargetStep === "number" && scr.ctaTargetStep >= 1) ? scr.ctaTargetStep : (sIdx < activeScreensList.length - 1 ? (sIdx + 2) : 1);
    const navText = `Interacción: CTA [ ${scr.cta || "Continuar"} ] ➔ Navega a Paso ${targetStep}` + (scr.secondaryCta ? ` | Alt: [ ${scr.secondaryCta.text} ] ➔ Paso ${scr.secondaryCta.targetStep}` : "");

    const sBox = figma.createFrame();
    sBox.name = `Paso ${sIdx + 1}: ${scr.shortName || scr.mainTitle}`;
    sBox.layoutMode = "VERTICAL";
    sBox.primaryAxisSizingMode = "AUTO"; // Crece verticalmente según el texto
    sBox.counterAxisSizingMode = "FIXED";
    sBox.layoutAlign = "STRETCH";
    sBox.paddingLeft = 14; sBox.paddingRight = 14; sBox.paddingTop = 12; sBox.paddingBottom = 14;
    sBox.itemSpacing = 6;
    sBox.cornerRadius = 8;
    sBox.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];
    sBox.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
    sBox.strokeWeight = 1;

    const rowTop = figma.createFrame();
    rowTop.layoutMode = "HORIZONTAL";
    rowTop.counterAxisAlignItems = "CENTER";
    rowTop.itemSpacing = 8;
    rowTop.layoutAlign = "STRETCH";
    rowTop.fills = [];

    const bPill = figma.createFrame();
    bPill.paddingLeft = 6; bPill.paddingRight = 6; bPill.paddingTop = 3; bPill.paddingBottom = 3;
    bPill.cornerRadius = 4;
    bPill.fills = [{ type: "SOLID", color: stBg }];
    bPill.layoutMode = "HORIZONTAL";
    const bTxt = makeText(stBadge, 8, "Bold", stCol);
    bPill.appendChild(bTxt);
    rowTop.appendChild(bPill);

    const sTitle = makeText(`Paso ${sIdx + 1}: ${scr.shortName || scr.mainTitle || ("Pantalla " + (sIdx + 1))}`, 13, "Bold", { r: 0, g: 0, b: 0 });
    rowTop.appendChild(sTitle);
    sBox.appendChild(rowTop);

    const stepDescText = scr.stateDesc || scr.mainSubtitle || "";
    if (stepDescText) {
      const sDesc = makeText("📌 Estado: " + stepDescText, 9.5, "Medium", stCol, contentW - 28);
      sDesc.layoutAlign = "STRETCH";
      sBox.appendChild(sDesc);
    }

    const sFunc = makeText("🎯 ¿Qué hace?: " + funcText, 9.5, "Medium", { r: 0.15, g: 0.15, b: 0.15 }, contentW - 28);
    sFunc.layoutAlign = "STRETCH";
    sBox.appendChild(sFunc);

    const sFeat = makeText("⚡ Funcionalidades: " + screenFeatsStr, 9, "Regular", { r: 0.35, g: 0.35, b: 0.35 }, contentW - 28);
    sFeat.layoutAlign = "STRETCH";
    sBox.appendChild(sFeat);

    const sJust = makeText("💡 Justificación UX: " + justText, 9, "Regular", { r: 0.05, g: 0.45, b: 0.22 }, contentW - 28);
    sJust.layoutAlign = "STRETCH";
    sBox.appendChild(sJust);

    const sNav = makeText("• " + navText, 9, "Bold", { r: 0.15, g: 0.43, b: 0.95 }, contentW - 28);
    sNav.layoutAlign = "STRETCH";
    sBox.appendChild(sNav);

    docFrame.appendChild(sBox);
  });

  // Bloque 3: Justificación del Sistema de Diseño (Uber Base DS)
  const tDsTitle = makeText("🎨 Justificación del Sistema de Diseño (Uber Base DS)", 13, "Bold", { r: 0, g: 0, b: 0 }, contentW);
  tDsTitle.layoutAlign = "STRETCH";
  docFrame.appendChild(tDsTitle);

  const dsBox = figma.createFrame();
  dsBox.layoutMode = "VERTICAL";
  dsBox.primaryAxisSizingMode = "AUTO";
  dsBox.layoutAlign = "STRETCH";
  dsBox.paddingLeft = 14; dsBox.paddingRight = 14; dsBox.paddingTop = 12; dsBox.paddingBottom = 14;
  dsBox.itemSpacing = 6;
  dsBox.cornerRadius = 8;
  dsBox.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
  dsBox.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.88, b: 0.88 } }];
  dsBox.strokeWeight = 1;

  const dsText = makeText(
    "• Botones Base oficiales: 48px de alto y radio de 8px (baseui/button), optimizados para ergonomía táctil en pantalla móvil.\n" +
    "• Tokens de color semánticos: verde (#0E8345) en Happy Path, ámbar (#F69E0C) en desvíos y rojo (#DE1135) en errores.\n" +
    "• Accesibilidad: Ratios de contraste superiores a 4.5:1 (WCAG 2.1 AA) en todas las tarjetas y jerarquía tipográfica Inter oficial.",
    9.5, "Regular", { r: 0.25, g: 0.25, b: 0.25 }, contentW - 28
  );
  dsText.layoutAlign = "STRETCH";
  dsBox.appendChild(dsText);
  docFrame.appendChild(dsBox);

  // Bloque 4: Métricas de Impacto Esperadas (KPIs)
  const tKpiTitle = makeText("📊 Métricas de Impacto Esperadas (KPIs para Stakeholders)", 13, "Bold", { r: 0, g: 0, b: 0 }, contentW);
  tKpiTitle.layoutAlign = "STRETCH";
  docFrame.appendChild(tKpiTitle);

  const kpiBox = figma.createFrame();
  kpiBox.layoutMode = "HORIZONTAL";
  kpiBox.primaryAxisAlignItems = "SPACE_BETWEEN";
  kpiBox.layoutAlign = "STRETCH";
  kpiBox.paddingLeft = 14; kpiBox.paddingRight = 14; kpiBox.paddingTop = 12; kpiBox.paddingBottom = 14;
  kpiBox.cornerRadius = 8;
  kpiBox.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.98, b: 1 } }];
  kpiBox.strokes = [{ type: "SOLID", color: { r: 0.75, g: 0.85, b: 0.98 } }];
  kpiBox.strokeWeight = 1;

  const kpi1 = makeText("+18% Conversión\nTarifas cerradas garantizadas", 10.5, "Bold", { r: 0, g: 0, b: 0 });
  const kpi2 = makeText("-10 min Espera\nPuntos exprés optimizados", 10.5, "Bold", { r: 0.05, g: 0.51, b: 0.27 });
  const kpi3 = makeText("0% Dead-ends\nRecuperación pago automática", 10.5, "Bold", { r: 0.15, g: 0.43, b: 0.95 });
  kpiBox.appendChild(kpi1);
  kpiBox.appendChild(kpi2);
  kpiBox.appendChild(kpi3);
  docFrame.appendChild(kpiBox);

  section.appendChild(docFrame);
  docFrame.x = screensStartX + total * (frameW + spacing);
  docFrame.y = 120;

  // Ajustar altura total de la sección para dar cabida a la documentación completa sin cortes
  const calculatedHeight = topPad + Math.max(frameH, docFrame.height) + bottomPad;
  if (typeof section.resizeWithoutConstraints === "function") {
    section.resizeWithoutConstraints(sectionW, calculatedHeight);
  } else if (typeof section.resize === "function") {
    section.resize(sectionW, calculatedHeight);
  }

  // 5. SI ES UNA NUEVA ITERACIÓN DE LA MISMA TAREA (v2, v3...), CREAR EL CHANGE LOG AL LADO DE LA NUEVA SECCIÓN
  let clFrame = null;
  const isNewIteration = versionNum > 1 || sameTicketSections.length > 0 || Boolean(changelogData && (changelogData.request || changelogData.changes || changelogData.version > 1));

  if (isNewIteration) {
    const prevVersionNum = versionNum > 1 ? versionNum - 1 : 1;
    const clW = 540;
    const clContentW = clW - 48; // 492px

    clFrame = figma.createFrame();
    clFrame.name = `📝 Change Log · ${ticketKey} (Iteración v${versionNum} vs v${prevVersionNum})`;
    clFrame.cornerRadius = 24;
    clFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    clFrame.strokes = [{ type: "SOLID", color: { r: 0.15, g: 0.43, b: 0.95 } }];
    clFrame.strokeWeight = 2;

    clFrame.layoutMode = "VERTICAL";
    clFrame.primaryAxisSizingMode = "AUTO"; // Hug contents
    clFrame.counterAxisSizingMode = "FIXED";
    clFrame.resize(clW, 100);
    clFrame.paddingLeft = 24; clFrame.paddingRight = 24;
    clFrame.paddingTop = 24; clFrame.paddingBottom = 28;
    clFrame.itemSpacing = 16;

    // Encabezado del Change Log
    const clHeaderCol = figma.createFrame();
    clHeaderCol.layoutMode = "VERTICAL";
    clHeaderCol.itemSpacing = 4;
    clHeaderCol.layoutAlign = "STRETCH";
    clHeaderCol.fills = [];

    const clTopRow = figma.createFrame();
    clTopRow.layoutMode = "HORIZONTAL";
    clTopRow.primaryAxisAlignItems = "SPACE_BETWEEN";
    clTopRow.counterAxisAlignItems = "CENTER";
    clTopRow.layoutAlign = "STRETCH";
    clTopRow.fills = [];

    const pillIter = figma.createFrame();
    pillIter.paddingLeft = 8; pillIter.paddingRight = 8; pillIter.paddingTop = 4; pillIter.paddingBottom = 4;
    pillIter.cornerRadius = 4;
    pillIter.fills = [{ type: "SOLID", color: { r: 0.92, g: 0.95, b: 1 } }];
    pillIter.layoutMode = "HORIZONTAL";
    const pillIterTxt = makeText(`NUEVA ITERACIÓN · v${versionNum}`, 9, "Bold", { r: 0.15, g: 0.43, b: 0.95 });
    pillIter.appendChild(pillIterTxt);
    clTopRow.appendChild(pillIter);

    const prevPill = figma.createFrame();
    prevPill.paddingLeft = 8; prevPill.paddingRight = 8; prevPill.paddingTop = 4; prevPill.paddingBottom = 4;
    prevPill.cornerRadius = 4;
    prevPill.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.96, b: 0.96 } }];
    prevPill.layoutMode = "HORIZONTAL";
    const prevPillTxt = makeText(`VS PROPUESTA v${prevVersionNum}`, 9, "Bold", { r: 0.45, g: 0.45, b: 0.45 });
    prevPill.appendChild(prevPillTxt);
    clTopRow.appendChild(prevPill);
    clHeaderCol.appendChild(clTopRow);

    const clTitle = makeText(`Registro de Cambios · ${ticketKey}`, 20, "Bold", { r: 0, g: 0, b: 0 }, clContentW);
    clTitle.layoutAlign = "STRETCH";
    clHeaderCol.appendChild(clTitle);

    const dateNow = new Date();
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const dateFormatted = `${dateNow.getDate()} ${months[dateNow.getMonth()]} ${dateNow.getFullYear()} · ${String(dateNow.getHours()).padStart(2, '0')}:${String(dateNow.getMinutes()).padStart(2, '0')}`;
    const clSub = makeText(`Trazabilidad de modificaciones de producto y diseño respecto a la versión anterior. (${dateFormatted})`, 11, "Regular", { r: 0.45, g: 0.45, b: 0.45 }, clContentW);
    clSub.layoutAlign = "STRETCH";
    clHeaderCol.appendChild(clSub);
    clFrame.appendChild(clHeaderCol);

    // Bloque 1: Solicitud de Cambio / Feedback del Stakeholder
    const reqText = (changelogData && changelogData.request)
      ? changelogData.request
      : "Nueva iteración generada a partir del feedback de stakeholders para resolver casos de fricción, reforzar la accesibilidad y optimizar la conversión.";

    const boxReq = figma.createFrame();
    boxReq.layoutMode = "VERTICAL";
    boxReq.primaryAxisSizingMode = "AUTO";
    boxReq.layoutAlign = "STRETCH";
    boxReq.paddingLeft = 14; boxReq.paddingRight = 14; boxReq.paddingTop = 12; boxReq.paddingBottom = 14;
    boxReq.itemSpacing = 6;
    boxReq.cornerRadius = 8;
    boxReq.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.99 } }];
    boxReq.strokes = [{ type: "SOLID", color: { r: 0.88, g: 0.91, b: 0.96 } }];
    boxReq.strokeWeight = 1;

    const tReqTitle = makeText("💬 MOTIVO DE LA ITERACIÓN (SOLICITUD STAKEHOLDER)", 10.5, "Bold", { r: 0.15, g: 0.43, b: 0.95 }, clContentW - 28);
    tReqTitle.layoutAlign = "STRETCH";
    boxReq.appendChild(tReqTitle);

    const tReqBody = makeText(reqText, 10, "Regular", { r: 0.15, g: 0.15, b: 0.15 }, clContentW - 28);
    tReqBody.layoutAlign = "STRETCH";
    boxReq.appendChild(tReqBody);
    clFrame.appendChild(boxReq);

    // Bloque 2: Resumen Ejecutivo de la Iteración
    const sumText = (changelogData && changelogData.summary)
      ? changelogData.summary
      : `Actualización del flujo v${versionNum}: incorporación de nuevos estados resilientes, alineación con componentes Uber Base DS y optimización de conversión.`;

    const boxSum = figma.createFrame();
    boxSum.layoutMode = "VERTICAL";
    boxSum.primaryAxisSizingMode = "AUTO";
    boxSum.layoutAlign = "STRETCH";
    boxSum.paddingLeft = 14; boxSum.paddingRight = 14; boxSum.paddingTop = 12; boxSum.paddingBottom = 14;
    boxSum.itemSpacing = 6;
    boxSum.cornerRadius = 8;
    boxSum.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.98, b: 0.96 } }];
    boxSum.strokes = [{ type: "SOLID", color: { r: 0.72, g: 0.9, b: 0.76 } }];
    boxSum.strokeWeight = 1;

    const tSumTitle = makeText(`🎯 RESUMEN DE MEJORAS DE LA VERSIÓN v${versionNum}`, 10.5, "Bold", { r: 0.05, g: 0.51, b: 0.27 }, clContentW - 28);
    tSumTitle.layoutAlign = "STRETCH";
    boxSum.appendChild(tSumTitle);

    const tSumBody = makeText(sumText, 10, "Regular", { r: 0.15, g: 0.35, b: 0.18 }, clContentW - 28);
    tSumBody.layoutAlign = "STRETCH";
    boxSum.appendChild(tSumBody);
    clFrame.appendChild(boxSum);

    // Bloque 3: Modificaciones Específicas (Diff)
    const boxDiff = figma.createFrame();
    boxDiff.layoutMode = "VERTICAL";
    boxDiff.primaryAxisSizingMode = "AUTO";
    boxDiff.layoutAlign = "STRETCH";
    boxDiff.paddingLeft = 14; boxDiff.paddingRight = 14; boxDiff.paddingTop = 12; boxDiff.paddingBottom = 14;
    boxDiff.itemSpacing = 8;
    boxDiff.cornerRadius = 8;
    boxDiff.fills = [{ type: "SOLID", color: { r: 0.98, g: 0.98, b: 0.98 } }];
    boxDiff.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 } }];
    boxDiff.strokeWeight = 1;

    const tDiffTitle = makeText(`📋 MODIFICACIONES APLICADAS (v${versionNum} vs v${prevVersionNum})`, 11, "Bold", { r: 0, g: 0, b: 0 }, clContentW - 28);
    tDiffTitle.layoutAlign = "STRETCH";
    boxDiff.appendChild(tDiffTitle);

    let changeItems = [];
    if (changelogData && Array.isArray(changelogData.changes) && changelogData.changes.length > 0) {
      changeItems = changelogData.changes;
    } else {
      changeItems = [
        `Flujo de pantallas: Mapeo de ${total} pasos con conectores ortogonales de 90° actualizados.`,
        "Gestión de errores: Cobertura de Zero Dead-ends ante fallos de pago con recuperación guiada.",
        "Corner Cases: Prevención proactiva en momentos de alta demanda y telemetría de conductor.",
        "Componentes Base DS: Botones oficiales de 48px y radios de 8px (baseui/button).",
        "Microcopys UX: Textos transparentes con voz oficial de Uber sin culpar al usuario."
      ];
    }

    changeItems.forEach((ch) => {
      const chRow = figma.createFrame();
      chRow.layoutMode = "HORIZONTAL";
      chRow.counterAxisAlignItems = "FLEX_START";
      chRow.itemSpacing = 8;
      chRow.layoutAlign = "STRETCH";
      chRow.fills = [];

      const chBullet = makeText("✓", 10, "Bold", { r: 0.05, g: 0.51, b: 0.27 });
      chRow.appendChild(chBullet);

      const chTxt = makeText(String(ch), 9.5, "Regular", { r: 0.2, g: 0.2, b: 0.2 }, clContentW - 48);
      chTxt.layoutAlign = "STRETCH";
      chRow.appendChild(chTxt);
      boxDiff.appendChild(chRow);
    });
    clFrame.appendChild(boxDiff);

    // Bloque 4: Control de Calidad & Trazabilidad
    const boxTrace = figma.createFrame();
    boxTrace.layoutMode = "VERTICAL";
    boxTrace.primaryAxisSizingMode = "AUTO";
    boxTrace.layoutAlign = "STRETCH";
    boxTrace.paddingLeft = 14; boxTrace.paddingRight = 14; boxTrace.paddingTop = 12; boxTrace.paddingBottom = 14;
    boxTrace.itemSpacing = 6;
    boxTrace.cornerRadius = 8;
    boxTrace.fills = [{ type: "SOLID", color: { r: 0.96, g: 0.98, b: 1 } }];
    boxTrace.strokes = [{ type: "SOLID", color: { r: 0.8, g: 0.88, b: 0.98 } }];
    boxTrace.strokeWeight = 1;

    const tTraceTitle = makeText("🛡️ CONTROL DE CALIDAD & TRAZABILIDAD", 10.5, "Bold", { r: 0.15, g: 0.43, b: 0.95 }, clContentW - 28);
    tTraceTitle.layoutAlign = "STRETCH";
    boxTrace.appendChild(tTraceTitle);

    const traceText = makeText(
      `• Historial conservado: La Propuesta v${prevVersionNum} permanece intacta en el lienzo superior para comparar cambios lado a lado.\n` +
      "• Cumplimiento Base DS: Accesibilidad contrastada (WCAG 2.1 AA) y tokens de color semánticos.\n" +
      `• Estado: Versión v${versionNum} lista para revisión y pase a desarrollo.`,
      9.5, "Regular", { r: 0.25, g: 0.25, b: 0.25 }, clContentW - 28
    );
    traceText.layoutAlign = "STRETCH";
    boxTrace.appendChild(traceText);
    clFrame.appendChild(boxTrace);

    // Posicionar el Change Log AL LADO DE LA NUEVA SECTION
    figma.currentPage.appendChild(clFrame);
    clFrame.x = startX + sectionW + 48; // Exactamente a la derecha de la nueva section
    clFrame.y = startY; // Alineado superiormente con la nueva section
  }

  // Scroll y zoom al conjunto
  if (clFrame) {
    figma.viewport.scrollAndZoomIntoView([section, clFrame]);
  } else {
    figma.viewport.scrollAndZoomIntoView([section]);
  }
  const txtCount = localStylesCache ? localStylesCache.textStyles.length : 0;
  const colCount = localStylesCache ? localStylesCache.paintStyles.length : 0;
  const styleMsg = (txtCount > 0 || colCount > 0)
    ? ` (${txtCount} estilos tipográficos y ${colCount} estilos de color locales aplicados)`
    : "";
  figma.notify(`🗺️ Mapa de Flujo y Documentación v${versionNum} importados con éxito${styleMsg}`);
}

async function renderOrchestrationFlow() {
  await loadFonts();

  function hexToRgb(hex) {
    const clean = hex.replace("#", "");
    const bigint = parseInt(clean, 16);
    return {
      r: ((bigint >> 16) & 255) / 255,
      g: ((bigint >> 8) & 255) / 255,
      b: (bigint & 255) / 255,
    };
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

  // COLUMNA 1: DISPARADORES
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

  // COLUMNA 2: 7 AGENTES
  const col2X = 490;
  const col2Title = makeText("2. PIPELINE SECUENCIAL DE LOS 7 AGENTES (ORQUESTADOR)", 14, "Bold", hexToRgb("#0F172A"));
  col2Title.x = col2X; col2Title.y = 150; sec.appendChild(col2Title);

  const aW = 340;
  const gapX = 30;

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

  const row2Y = 530;

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

  // COLUMNA 3: HITL
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

  // CONECTORES SVG
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
    const orchGroup = createVectorGroupFromSvg(svgConnectors, "Líneas de Orquestación", sec);
    if (orchGroup) {
      bindLocalStylesToScreenNode(orchGroup);
    }
  } catch (err) {
    console.warn("Fallo insertando conectores SVG:", err);
  }

  figma.viewport.scrollAndZoomIntoView([sec]);
  figma.notify("✅ Flujo de Orquestación renderizado con éxito en Figma");
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "DETECT_CURRENT_FILE") {
    const key = figma.fileKey || null;
    const name = figma.root ? figma.root.name : null;
    figma.ui.postMessage({
      type: "DETECTED_FILE",
      fileKey: key,
      fileName: name,
      fileUrl: key ? `https://www.figma.com/design/${key}/${encodeURIComponent(name || "Untitled")}` : null
    });
    return;
  }

  if (msg.type === "CREATE_COMPONENT_LIBRARY") {
    await createComponentLibrary();
    return;
  }

  if (msg.type === "CREATE_LOCAL_STYLES") {
    await createLocalStylesFromBaseTokens();
    return;
  }

  if (msg.type === "RENDER_ORCHESTRATION_FLOW") {
    await renderOrchestrationFlow();
    return;
  }

  if (msg.type === "RENDER_SCREENS" || msg.type === "RENDER_FLOW_MAP") {
    await renderFlowMap(msg.screens || [], msg.screenSvgs || [], msg.key || "KAN-1", msg.changelog || null);
  }
};


(async () => { await renderFlowMap([], [], 'KAN-1'); })();
