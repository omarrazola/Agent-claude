# Albora Design Agents

Sistema de agentes que acompaña al equipo de diseño UX/UI desde que llega una petición en **Jira** o **Trello** hasta que hay pantallas codificadas listas para revisar.

> Caso de ejemplo para **Hoteles Albora** (cadena hotelera ficticia) y su agencia de diseño **Estudio Norte**. El sistema de diseño, los datos y las personas son inventados.

## Qué hace

Cada vez que se abre una petición de diseño:

1. **Jira o Trello** envían un webhook al orquestador.
2. El **orquestador** convierte el ticket o la tarjeta en un brief común y lanza la cadena de agentes.
3. **Siete agentes** trabajan en orden, cada uno sobre el resultado del anterior:

| # | Agente | Entrega |
|---|--------|---------|
| 1 | Analista de brief | Brief estructurado y preguntas abiertas |
| 2 | Agente de contexto | Hallazgos y componentes de Albora DS reutilizables |
| 3 | Arquitecto UX | Flujo, historias de usuario y criterios de aceptación |
| 4 | Redactor UX | Textos de interfaz con el tono de Albora |
| 5 | Agente de UI | Pantallas en HTML usando solo tokens y componentes de Albora DS |
| 6 | Revisor QA | Informe de accesibilidad y coherencia, con correcciones |
| 7 | Agente de entrega | Comentario en el ticket, cambio de estado y previsualización |

4. La **diseñadora** revisa la propuesta, pide cambios desde el propio ticket y aprueba la versión final para desarrollo.

Los agentes **nunca** aprueban ni publican en producción: preparan un punto de partida.

## Estructura del repositorio

```
albora-design-agents/
├── agents/                 Instrucciones de cada agente (editables sin tocar código)
│   └── prompts/
├── demo/                   Demo interactiva para presentar al cliente (un solo HTML)
├── design-system/          Albora DS: tokens, CSS, componentes y guías
│   ├── tokens/
│   ├── css/
│   ├── components/
│   └── guidelines/
├── docs/                   Arquitectura, agentes, puesta en marcha, piloto y seguridad
├── fixtures/               Webhooks de ejemplo de Jira y Trello
├── screens/                Pantallas generadas por ticket (ejemplo: ALB-482)
├── scripts/                Utilidades para ejecutar el flujo en local
├── src/                    Orquestador (Node + TypeScript)
│   ├── agents/
│   ├── integrations/
│   ├── lib/
│   ├── pipeline/
│   └── webhooks/
└── templates/              Plantillas de brief y de comentario en el ticket
```

## Puesta en marcha rápida

```bash
npm install
cp .env.example .env        # añade GEMINI_API_KEY (recomendado en Antigravity) o ANTHROPIC_API_KEY
npm run demo:local          # ejecuta la cadena completa con el ticket de ejemplo, sin tocar Jira ni Trello
```

> **Modo demo sin API Key:** Si aún no has añadido ninguna clave en `.env`, el sistema funciona automáticamente en modo `mock` para que puedas probar la cadena completa de los 7 agentes y generar las pantallas de inmediato.

El resultado se guarda en `output/runs/ALB-482/` (un JSON por agente) y las pantallas en `output/previews/ALB-482/`.

Para recibir webhooks reales:

```bash
npm run dev                 # servidor en http://localhost:8787
```

Los pasos para conectar Jira, Trello y la previsualización están en [`docs/setup.md`](docs/setup.md).

## Documentación

- [Arquitectura](docs/architecture.md)
- [Agentes y Organigrama](docs/agents.md)
- [Puesta en marcha](docs/setup.md)
- [Plan de piloto](docs/pilot-plan.md)
- [Seguridad y datos](docs/security.md)
- [Albora DS](design-system/README.md)

## Demo

Abre `demo/index.html` en el navegador. Simula el flujo completo, incluye el prototipo navegable, la iteración con los agentes y la aprobación para desarrollo.

> La iteración en vivo de la demo usa Claude solo cuando la página se abre como artifact en claude.ai. Abierta en local funciona en modo demo con cambios predefinidos.
