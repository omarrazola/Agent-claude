# Agentes

Las instrucciones de cada agente viven en `agents/prompts/` en Markdown. Se pueden ajustar sin tocar código: el orquestador las lee en cada ejecución.

| Paso | Agente | Prompt | Recibe | Devuelve |
|------|--------|--------|--------|----------|
| 1 | Analista de brief | `01-brief.md` | Ticket normalizado | `objective`, `metric`, `scope`, `outOfScope`, `deadline`, `platform`, `openQuestions` |
| 2 | Agente de contexto | `02-context.md` | Brief + catálogo de Albora DS | `findings`, `reusableComponents`, `missingComponents`, `relatedTickets` |
| 3 | Arquitecto UX | `03-ux.md` | Brief + contexto | `flow`, `screens`, `userStories`, `acceptanceCriteria` |
| 4 | Redactor UX | `04-copy.md` | Flujo + guía de tono | `strings` por pantalla |
| 5 | Agente de UI | `05-ui.md` | Flujo + textos + Albora DS | `files` con el HTML de cada pantalla |
| 6 | Revisor QA | `06-qa.md` | Pantallas + reglas de Albora DS | `checks`, `fixes`, `files` corregidos |
| 7 | Agente de entrega | `07-delivery.md` | Todo lo anterior | `summary`, `comment` para el ticket |

## Reglas comunes

- Escriben en español y con el tono de Albora.
- No inventan datos de negocio: si falta algo, lo convierten en pregunta abierta.
- El agente de UI y el de QA solo pueden usar las clases y variables de `design-system/css/albora.css`.
- Ningún agente aprueba, despliega ni cierra tickets.

## Añadir o cambiar un agente

1. Crea o edita el prompt en `agents/prompts/`.
2. Regístralo en `src/agents/index.ts` (nombre, prompt, qué salidas anteriores necesita, modelo y límite de tokens).
3. Si el agente debe relanzarse al iterar, añádelo a `ITERATION_STEPS` en el mismo archivo.

## Modelos

Por defecto todos usan `CLAUDE_MODEL` (ver `.env.example`). Para tareas sencillas (brief, entrega) se puede usar un modelo más rápido; para el agente de UI conviene el más capaz. Se configura por agente en `src/agents/index.ts`.
