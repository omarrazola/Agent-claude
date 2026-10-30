import os from "node:os";
import { config } from "../src/config.js";
import { getFigmaTarget } from "../src/integrations/figma.js";

function getLocalIps(): string[] {
  const nets = os.networkInterfaces();
  const results: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

const localIps = getLocalIps();
const primaryIp = localIps[0] || "localhost";
const figmaTarget = getFigmaTarget();

console.log("\n==================================================================");
console.log(" 🚀 SERVIDOR DE PRUEBAS EN EQUIPO · AGENTES DE DISEÑO UX/UI");
console.log("==================================================================");
console.log("\n  El servidor se está ejecutando para que todo tu equipo pueda probar.");
console.log("\n  \x1b[1mEnlaces directos para compartir:\x1b[0m");
console.log(`  🌐 \x1b[32m\x1b[1mConsola Web para el Equipo:\x1b[0m   http://${primaryIp}:${config.port}/`);
console.log(`  💻 \x1b[36mAcceso Local (este equipo):\x1b[0m  http://localhost:${config.port}/`);
console.log(`  🔌 \x1b[35mBridge WebSocket (Figma):\x1b[0m    ws://${primaryIp}:${config.port}`);
console.log(`  🎨 \x1b[34mArchivo Figma Vinculado:\x1b[0m    ${figmaTarget.fileKey}`);
console.log(`  🛡️  \x1b[33mModo de Seguridad:\x1b[0m          ${config.dryRun ? "DRY_RUN (Simulación segura)" : "Modo Real (Escribe en Jira/Trello)"}`);
console.log("\n  \x1b[90mPresiona Ctrl + C para detener el servidor cuando termines las pruebas.\x1b[0m");
console.log("==================================================================\n");

// Arranca el servidor importándolo
await import("../src/server.js");
