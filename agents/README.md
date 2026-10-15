# Instrucciones de los agentes

Cada archivo de `prompts/` contiene las instrucciones de un agente. `_common.md` se antepone a todos.

| Archivo | Agente |
|---------|--------|
| `_common.md` | Reglas compartidas |
| `01-brief.md` | Analista de brief |
| `02-context.md` | Agente de contexto |
| `03-ux.md` | Arquitecto UX |
| `04-copy.md` | Redactor UX |
| `05-ui.md` | Agente de UI |
| `06-qa.md` | Revisor QA |
| `07-delivery.md` | Agente de entrega |

Se pueden editar sin tocar código. Si cambias la forma del JSON de salida de un agente, revisa los agentes que lo reciben (columna `needs` en `src/agents/index.ts`) y, en el caso de UI, QA y entrega, el orquestador (`src/pipeline/orchestrator.ts`).
