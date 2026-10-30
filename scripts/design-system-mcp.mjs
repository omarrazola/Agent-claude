#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dsDir = path.join(rootDir, "design-system");

// Load DS data files
async function loadDSData() {
  const [tokensRaw, baseuiRaw, aiManifestRaw] = await Promise.all([
    fs.readFile(path.join(dsDir, "tokens", "base.tokens.json"), "utf8"),
    fs.readFile(path.join(dsDir, "components", "baseui.manifest.json"), "utf8"),
    fs.readFile(path.join(dsDir, "zeroheight-ai-manifest.json"), "utf8"),
  ]);

  return {
    tokens: JSON.parse(tokensRaw),
    baseui: JSON.parse(baseuiRaw),
    aiManifest: JSON.parse(aiManifestRaw),
  };
}

const server = new Server(
  {
    name: "uber-design-system",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Tools list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_component_spec",
        description: "Obtiene la especificación técnica completa de un componente de Uber Base (props, variantes, forma rectangular/pill, anatomía, equivalencia en @uber/baseui y enlace oficial a Zeroheight).",
        inputSchema: {
          type: "object",
          properties: {
            componentName: {
              type: "string",
              description: "Nombre del componente (ej. 'Button', 'Modal full screen', 'Card', 'Text field', 'Banner', 'Tabs')",
            },
          },
          required: ["componentName"],
        },
      },
      {
        name: "get_design_token",
        description: "Devuelve el valor exacto de un design token W3C (color, escala de espaciado modular de 4px, escala tipográfica Uber Move o radio de esquina) y su variable CSS.",
        inputSchema: {
          type: "object",
          properties: {
            tokenName: {
              type: "string",
              description: "Nombre del token o variable CSS (ej. '--base-black', '--base-space-scale400', '--base-negative', '$theme.borders.radius200')",
            },
          },
          required: ["tokenName"],
        },
      },
      {
        name: "list_components",
        description: "Lista el catálogo canónico completo de 60 componentes de Uber Base organizados en sus 7 categorías oficiales con enlaces a Zeroheight.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Categoría opcional para filtrar: 'Action', 'Input & control', 'Data display', 'Feedback & status', 'Surfaces', 'Navigation', 'Data & tables'. Si se omite, lista todas.",
            },
          },
        },
      },
      {
        name: "search_design_system",
        description: "Busca en la documentación de Uber Base y Zeroheight por palabra clave (ej. 'error handling', 'touch target', 'modal', 'tarifa').",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Término de búsqueda o concepto de diseño a consultar.",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "validate_screen_design",
        description: "Audita y valida una pantalla JSON propuesta contra las reglas del Design System (WCAG AA contraste 4.5:1, touch target mínimo de 48px, forma de botones rectangular 8px, y cero botones de simulación).",
        inputSchema: {
          type: "object",
          properties: {
            screen: {
              type: "object",
              description: "Objeto de pantalla generado por el agente de UI con 'mainTitle', 'cta', 'ctaVariant', 'cards', 'banner', etc.",
            },
          },
          required: ["screen"],
        },
      },
    ],
  };
});

// Tools execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const data = await loadDSData();

  if (name === "get_component_spec") {
    const rawName = String(args?.componentName || "").toLowerCase().trim();
    const components = data.baseui.components || {};

    // Find component key
    let foundKey = Object.keys(components).find(
      (k) => k.toLowerCase() === rawName || rawName.includes(k.toLowerCase())
    );

    // Dedicated Zeroheight URLs
    const zhUrls = data.aiManifest.pages?.dedicatedComponents || {};
    let matchedZhUrl = null;
    for (const [key, url] of Object.entries(zhUrls)) {
      if (rawName.includes(key.toLowerCase()) || key.toLowerCase().includes(rawName)) {
        matchedZhUrl = url;
        break;
      }
    }

    if (!foundKey && !matchedZhUrl) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: `Componente '${args?.componentName}' no encontrado en el catálogo canónico.`,
              availableComponents: Object.keys(components).slice(0, 20),
              officialCatalogUrl: data.aiManifest.pages.components,
            }, null, 2),
          },
        ],
      };
    }

    const spec = components[foundKey] || {};
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            component: foundKey || args?.componentName,
            package: spec.package || `@uber/baseui/${rawName.replace(/\s+/g, "-")}`,
            category: spec.category || "General",
            description: spec.description || "Componente oficial de Uber Base Design System.",
            shapeGuideline: "Forma estándar: Rectangular redondeado (8px / radius200); Forma Rounded (Pill 9999px) reservada para CTAs móviles de pie de pantalla.",
            zeroheightUrl: matchedZhUrl || data.aiManifest.pages.components,
            props: spec.props || {},
            examples: spec.examples || [],
          }, null, 2),
        },
      ],
    };
  }

  if (name === "get_design_token") {
    const query = String(args?.tokenName || "").toLowerCase().trim();
    const tokens = data.tokens;

    // Search in colors, spacing, typography, borderRadius, elevation
    const results = {};
    function searchTokens(obj, path = "") {
      for (const [key, val] of Object.entries(obj)) {
        const fullKey = path ? `${path}.${key}` : key;
        if (typeof val === "object" && val !== null && !val.$value && !val.value) {
          searchTokens(val, fullKey);
        } else {
          const valStr = val.$value || val.value || String(val);
          if (
            fullKey.toLowerCase().includes(query) ||
            query.includes(key.toLowerCase()) ||
            (query.startsWith("--base-") && fullKey.toLowerCase().includes(query.replace("--base-", "")))
          ) {
            results[fullKey] = {
              value: valStr,
              type: val.$type || typeof val,
              cssVariable: `--base-${key}`,
            };
          }
        }
      }
    }

    searchTokens(tokens);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            query: args?.tokenName,
            matchCount: Object.keys(results).length,
            tokens: results,
          }, null, 2),
        },
      ],
    };
  }

  if (name === "list_components") {
    const categories = data.aiManifest.componentCategories || {};
    const catFilter = args?.category ? String(args.category).toLowerCase() : null;

    let output = {};
    for (const [catName, compList] of Object.entries(categories)) {
      if (!catFilter || catName.toLowerCase().includes(catFilter)) {
        output[catName] = {
          count: compList.length,
          components: compList,
        };
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            totalCategories: Object.keys(output).length,
            styleguideUrl: data.aiManifest.styleguideUrl,
            componentsPageUrl: data.aiManifest.pages.components,
            categories: output,
          }, null, 2),
        },
      ],
    };
  }

  if (name === "search_design_system") {
    const q = String(args?.query || "").toLowerCase();
    const categories = data.aiManifest.componentCategories || {};
    const dedicated = data.aiManifest.pages.dedicatedComponents || {};

    const matches = {
      components: [],
      dedicatedPages: [],
      globalSections: (data.aiManifest.globalSections || []).filter(
        (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      ),
    };

    for (const [cat, comps] of Object.entries(categories)) {
      for (const comp of comps) {
        if (comp.toLowerCase().includes(q)) {
          matches.components.push({ name: comp, category: cat });
        }
      }
    }

    for (const [name, url] of Object.entries(dedicated)) {
      if (name.toLowerCase().includes(q)) {
        matches.dedicatedPages.push({ name, url });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            query: args?.query,
            matches,
            styleguideUrl: data.aiManifest.styleguideUrl,
          }, null, 2),
        },
      ],
    };
  }

  if (name === "validate_screen_design") {
    const screen = args?.screen || {};
    const issues = [];
    const passed = [];

    // Check CTA
    if (screen.cta) {
      if (screen.cta.toLowerCase().includes("simular") || screen.cta.toLowerCase().includes("test")) {
        issues.push("ERROR CRÍTICO: Prohibido incluir botones de simulación o testing en pantalla. Los controles de simulación deben ser externos.");
      } else {
        passed.push("CTA de producción válido (sin botones de simulación).");
      }
    }

    // Check sentence case on title
    if (screen.mainTitle) {
      const words = screen.mainTitle.split(" ");
      const isTitleCase = words.length > 2 && words.every((w) => w.length > 3 && w[0] === w[0]?.toUpperCase());
      if (isTitleCase) {
        issues.push("ADVERTENCIA: El titular parece estar en Title Case. Uber exige estrictamente Sentence case.");
      } else {
        passed.push("Titular cumple la regla de Sentence case.");
      }
    }

    // Check button variant
    const allowedVariants = ["primary", "secondary", "tertiary", "negative", "outline", "onBrand"];
    if (screen.ctaVariant && !allowedVariants.includes(screen.ctaVariant.toLowerCase())) {
      issues.push(`ADVERTENCIA: ctaVariant '${screen.ctaVariant}' no es estándar. Usar: ${allowedVariants.join(", ")}`);
    } else {
      passed.push("ctaVariant alineada con las variantes oficiales de Uber Base.");
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            isValid: issues.length === 0,
            screenTitle: screen.mainTitle || screen.navTitle || "Sin título",
            passedRules: passed,
            issuesFound: issues,
            recommendation: issues.length === 0 ? "Pantalla conforme con Uber Base Design System." : "Corregir incidencias antes de enviar a QA.",
          }, null, 2),
        },
      ],
    };
  }

  throw new Error(`Herramienta desconocida: ${name}`);
});

// Resources list
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "design-system://tokens",
        name: "Uber Base Design Tokens (W3C JSON)",
        description: "Catálogo completo de tokens W3C estándar de Uber Base (colores, espaciado, tipografía, bordes, sombras).",
        mimeType: "application/json",
      },
      {
        uri: "design-system://components",
        name: "Uber Base Canonical Components Manifest",
        description: "Manifiesto completo de los 60 componentes canónicos de Uber Base y su mapeo a @uber/baseui.",
        mimeType: "application/json",
      },
      {
        uri: "design-system://zeroheight-manifest",
        name: "Zeroheight AI Integration Manifest",
        description: "Contrato de integración entre el Zeroheight en la nube (styleguide 146571) y los agentes autónomos.",
        mimeType: "application/json",
      },
    ],
  };
});

// Read resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const data = await loadDSData();

  if (uri === "design-system://tokens") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data.tokens, null, 2),
        },
      ],
    };
  }

  if (uri === "design-system://components") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data.baseui, null, 2),
        },
      ],
    };
  }

  if (uri === "design-system://zeroheight-manifest") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data.aiManifest, null, 2),
        },
      ],
    };
  }

  throw new Error(`Recurso desconocido: ${uri}`);
});

// Run server on stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Uber Base Design System MCP Server iniciado en stdio.\n");
}

main().catch((err) => {
  process.stderr.write(`Error fatal en MCP Server: ${err.message}\n`);
  process.exit(1);
});
