#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "figma-bridge",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "export_flow_to_figma",
        description: "Export the prototype screens and flow map directly to the Figma canvas in real time without clicking buttons in the plugin.",
        inputSchema: {
          type: "object",
          properties: {
            ticketKey: {
              type: "string",
              description: "Jira ticket key or flow identifier (e.g. 'KAN-1')"
            }
          }
        }
      },
      {
        name: "create_base_components_in_figma",
        description: "Generate the complete official Uber Base Design System component library (Buttons, Forms, Cards, Tokens) on the Figma canvas.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "export_flow_to_figma") {
    try {
      const res = await fetch("http://localhost:8787/api/figma/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: request.params.arguments?.ticketKey })
      });
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const data = await res.json();
      return {
        content: [
          {
            type: "text",
            text: `✨ Exportación completada en tiempo real hacia Figma. Emitido a ${data.sentToPlugins} plugin(s) conectado(s). ${data.screensCount} pantallas renderizadas con conectores ortogonales de 90° para ticket ${data.key}.`
          }
        ]
      };
    } catch(err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `⚠️ Error conectando con el servidor en http://localhost:8787: ${err.message}. Asegúrate de que el servidor esté activo.`
          }
        ]
      };
    }
  }

  if (request.params.name === "create_base_components_in_figma") {
    try {
      const res = await fetch("http://localhost:8787/api/figma/pending");
      const data = await res.json();
      return {
        content: [
          {
            type: "text",
            text: "💎 Solicitud enviada al plugin de Figma para generar el Catálogo de Componentes Base DS."
          }
        ]
      };
    } catch(err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${err.message}` }]
      };
    }
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
