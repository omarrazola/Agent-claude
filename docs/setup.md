# Puesta en marcha

## 1. Requisitos

- Node.js 20 o superior
- Una clave de API de **Google Gemini** (`GEMINI_API_KEY`, nativa en Antigravity) o de **Claude** (`ANTHROPIC_API_KEY`). Si no tienes ninguna, funciona en modo `mock` para demostración.
- Para webhooks reales: una URL pública (en local, un túnel como ngrok o cloudflared)

## 2. Instalar y probar en local

```bash
npm install
cp .env.example .env
# edita .env y añade GEMINI_API_KEY o ANTHROPIC_API_KEY; deja DRY_RUN=true
npm run demo:local
```

Esto ejecuta los siete agentes sobre `fixtures/jira-issue-created.json` sin escribir en Jira ni Trello. Revisa:

- `output/runs/ALB-482/*.json`: la salida de cada agente
- `output/previews/ALB-482/`: las pantallas generadas
- La consola: el comentario que se publicaría en el ticket

## 3. Conectar Jira Cloud

1. Crea un token de API en tu cuenta de Atlassian y rellena `JIRA_BASE_URL`, `JIRA_EMAIL` y `JIRA_API_TOKEN`.
2. Inventa un valor para `JIRA_WEBHOOK_TOKEN`.
3. En Jira: *Configuración del sistema → Webhooks → Crear webhook*.
   - URL: `https://TU_URL/webhooks/jira?token=JIRA_WEBHOOK_TOKEN`
   - Eventos: *Incidencia creada*, *Incidencia actualizada* y *Comentario creado*
   - Filtro JQL recomendado: `project = ALB AND labels = diseño`
4. Busca los ID de las transiciones «Revisión diseño» y «Listo para desarrollo» de tu flujo y ponlos en `JIRA_TRANSITION_REVIEW_ID` y `JIRA_TRANSITION_DEV_ID`.

## 4. Conectar Trello

1. Obtén tu API key, un token y el secreto de la aplicación desde la página de desarrolladores de Trello.
2. Rellena `TRELLO_API_KEY`, `TRELLO_TOKEN` y `TRELLO_APP_SECRET`.
3. Crea el webhook apuntando al tablero (sustituye los valores):

```bash
curl -X POST "https://api.trello.com/1/webhooks/?key=KEY&token=TOKEN" \
  -d "callbackURL=https://TU_URL/webhooks/trello" \
  -d "idModel=ID_DEL_TABLERO" \
  -d "description=Albora Design Agents"
```

Trello hace una petición `HEAD` a la URL al crear el webhook; el servidor ya responde a ella.

4. Pon los ID de las listas «Revisión diseño» y «Listo para desarrollo» en `TRELLO_REVIEW_LIST_ID` y `TRELLO_DEV_LIST_ID`.

## 5. Pasar a modo real

Cambia `DRY_RUN=false` y arranca el servidor:

```bash
npm run build && npm start
```

## 6. Figma (opcional)

La escritura de diseños en Figma se hace mejor desde un agente con el conector MCP de Figma (Claude Agent SDK). `src/integrations/figma.ts` deja el punto de enganche preparado y documenta el enfoque; por defecto está desactivado.
