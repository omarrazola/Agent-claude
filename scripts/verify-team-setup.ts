import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { config, ROOT } from "../src/config.js";
import { getFigmaTarget } from "../src/integrations/figma.js";

function getLocalIpAddresses(): string[] {
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

console.log("\n=======================================================");
console.log(" 🔍 DIAGNÓSTICO Y VERIFICACIÓN PARA PRUEBAS EN EQUIPO");
console.log("=======================================================\n");

let warnings = 0;
let passes = 0;

function check(label: string, ok: boolean, details?: string, isWarning = false) {
  if (ok) {
    passes++;
    console.log(`  \x1b[32m✔ [OK]\x1b[0m ${label}`);
    if (details) console.log(`         \x1b[90m${details}\x1b[0m`);
  } else if (isWarning) {
    warnings++;
    console.log(`  \x1b[33m⚠ [AVISO]\x1b[0m ${label}`);
    if (details) console.log(`         \x1b[33m${details}\x1b[0m`);
  } else {
    warnings++;
    console.log(`  \x1b[31m✖ [FALLO]\x1b[0m ${label}`);
    if (details) console.log(`         \x1b[31m${details}\x1b[0m`);
  }
}

// 1. Entorno Node.js
const nodeVer = process.version;
const major = parseInt(nodeVer.replace("v", "").split(".")[0], 10);
check("Versión de Node.js", major >= 20, `${nodeVer} (Requerido: >= v20)`);

// 2. Archivo .env y Configuración LLM
const envExists = fs.existsSync(path.join(ROOT, ".env"));
check("Archivo de entorno .env", envExists, envExists ? "Cargado correctamente" : "Falta .env (copiar de .env.example)", !envExists);

const provider = config.provider;
const hasApiKey = Boolean(config.geminiApiKey || config.anthropicApiKey);
if (provider === "mock") {
  check("Proveedor de Inteligencia Artificial (LLM)", true, "Modo MOCK activo (pruebas locales sin coste de API ni necesidad de clave)", true);
} else {
  check(`Proveedor de Inteligencia Artificial: ${provider.toUpperCase()}`, hasApiKey, `Modelo configurado: ${provider === "gemini" ? config.geminiModel : config.model}`);
}

// 3. Modo de seguridad para Jira / Trello
if (config.dryRun) {
  check("Modo de Ejecución (DRY_RUN)", true, "DRY_RUN=true (Modo simulación seguro: los agentes no modificarán tickets reales en Jira/Trello)");
} else {
  check("Modo de Ejecución (DRY_RUN)", true, "DRY_RUN=false (Modo real activo: las acciones se publicarán en Jira/Trello si están configurados)", true);
}

// 4. Integración y Destino en Figma
const figmaTarget = getFigmaTarget();
check("Destino en Figma", Boolean(figmaTarget.fileKey), `Archivo activo: ${figmaTarget.fileKey} (${figmaTarget.fileUrl})`);

// 5. Estructura de Agentes y Sistema de Diseño
const agentsPrompts = fs.existsSync(config.paths.prompts);
check("Prompts de los 7 Agentes", agentsPrompts, `Ruta: ${config.paths.prompts}`);

const dsPath = fs.existsSync(config.paths.designSystem);
check("Librería de Componentes y Tokens de Diseño", dsPath, `Ruta: ${config.paths.designSystem}`);

// 6. Detección de Red para Compartir con el Equipo
const ips = getLocalIpAddresses();
console.log("\n-------------------------------------------------------");
console.log(" 🌐 DIRECCIONES PARA COMPARTIR CON EL EQUIPO:");
console.log("-------------------------------------------------------");
console.log(`  • Localmente en tu máquina:  \x1b[36mhttp://localhost:${config.port}/\x1b[0m`);
if (ips.length > 0) {
  ips.forEach((ip) => {
    console.log(`  • En tu red local / WiFi:     \x1b[32m\x1b[1mhttp://${ip}:${config.port}/\x1b[0m`);
  });
  console.log("\n  \x1b[90m(Cualquier compañero conectado a la misma red WiFi o VPN corporativa\n   puede abrir ese enlace directamente en su navegador sin instalar nada)\x1b[0m");
} else {
  console.log("  \x1b[33mNo se han detectado IPs de red externa. Para compartir por internet,\n  usa un túnel como Cloudflare: 'cloudflared tunnel --url http://localhost:8787'\x1b[0m");
}

console.log("\n-------------------------------------------------------");
console.log(` 📊 RESUMEN: ${passes} verificaciones superadas | ${warnings} advertencias`);
console.log("-------------------------------------------------------\n");

if (warnings === 0 || provider === "mock") {
  console.log("  \x1b[32m✔ El entorno está completamente listo para iniciar pruebas con el equipo.\x1b[0m");
  console.log("  Para arrancar el servidor compartido, ejecuta: \x1b[1mnpm run team:start\x1b[0m\n");
}
