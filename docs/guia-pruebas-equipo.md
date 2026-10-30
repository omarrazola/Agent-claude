# 🚀 Guía de Pruebas del Sistema de Agentes de Diseño para el Equipo

Esta guía está diseñada para que el equipo (**Product Managers, Diseñadores UX/UI, QA y Desarrolladores**) pueda realizar pruebas del sistema de agentes de diseño autónomos, validar su funcionamiento y aportar feedback constructivo.

---

## 🎯 Objetivo de las Pruebas

Evaluar cómo los **7 agentes autónomos** acompañan al equipo desde la recepción de una necesidad o ticket hasta la entrega de pantallas listas para revisar:
1. **Analista de brief:** Estructuración de requerimientos y preguntas clave de negocio.
2. **Agente de contexto:** Búsqueda y reutilización de componentes oficiales del Design System (Uber Base DS).
3. **Arquitecto UX:** Definición del flujo completo (Happy path, corner cases y casos de error).
4. **Redactor UX:** Microcopy claro, consistente y sin culpar al usuario.
5. **Agente de UI:** Código HTML responsivo y exportable a Figma con tokens de diseño.
6. **Revisor QA:** Validación de accesibilidad WCAG 2.1 AA y consistencia de diseño.
7. **Agente de entrega:** Publicación del resumen, estado y enlaces de Figma y previsualización.

---

## 🧭 ¿Cómo participar según tu rol?

### 👔 1. Product Managers / Product Owners
*No necesitas instalar nada técnico.*

- **Dónde probar:**
  - **Opción A (Nativa):** En el proyecto de Jira o tablero de Trello de pruebas creando un ticket con la etiqueta `diseño`.
  - **Opción B (Web):** Entrando en la **Consola de Agentes** (`http://<IP_COMPARTIDA>:8787/`) desde tu navegador.
- **Qué evaluar:**
  - ¿El **brief estructurado** resume con fidelidad tu objetivo de negocio?
  - ¿Las **preguntas abiertas** que formula el agente detectan vacíos antes de diseñar?
  - ¿Las historias de usuario y criterios de aceptación son útiles para el sprint?

---

### 🎨 2. Diseñadores UX / UI
*Interactúa con el flujo visual y conecta tu archivo de Figma.*

1. **Configurar tu destino de Figma (1 minuto):**
   - Abre la herramienta en tu navegador: `http://<IP_COMPARTIDA>:8787/`.
   - En la tarjeta destacada **«🎨 Destino en Figma para este Diseñador»**, pega el enlace de tu archivo de Figma (ej. `https://www.figma.com/design/...`).
   - Pulsa **«Guardar destino»**. Tu navegador recordará tu archivo automáticamente.
2. **Instalar el Plugin en Figma Desktop (Opcional para Live Sync):**
   - En Figma Desktop: *Plugins → Development → Import plugin from manifest...*
   - Selecciona el archivo `figma-plugin/manifest.json`.
   - Al abrir el plugin verás el estado de conexión con el agente y el botón para **importar el mapa de flujo completo** a tu lienzo con un solo clic.
   - *Alternativa sin plugin:* Puedes usar el botón **«📋 Copiar para Figma (Ctrl+V)»** o **«💾 Descargar SVG»** en la web y pegarlo directamente en tu Figma.
3. **Pedir cambios e iterar:**
   - Escribe en el ticket o en la caja «Pedir cambios a los agentes» (ej: *"Añade una opción de viaje con mascotas y cambia el botón a variante secundaria"*).
   - Observa cómo los agentes actualizan la pantalla y generan un nuevo registro de versión.

---

### 🧪 3. QA y Desarrolladores Frontend
*Inspección de calidad técnica, accesibilidad y componentes.*

- **Pestaña Handover & Código:**
  - Revisa la especificación de componentes React oficiales (`@uber/baseui`).
  - Inspecciona los tokens de diseño W3C (`base.tokens.json`).
  - Diagrama de estados Mermaid con bifurcaciones de error y éxito.
- **Informe de Accesibilidad (Agente 6):**
  - Comprueba los ratios de contraste calculados (mínimo 4.5:1).
  - Áreas táctiles mínimas de 44x44px y navegación sin teclado.

---

## 📋 Batería de Casos de Prueba Recomendados

| # | Caso | Objetivo | Cómo probarlo |
|---|------|----------|---------------|
| **1** | **Happy Path: Nueva Funcionalidad** | Alta conversión y reserva rápida (Uber Green + Apple Pay) | Ejecutar `npm run team:test:happy` o crear ticket con requisitos claros. |
| **2** | **Ticket Ambiguo** | Comprobar si el agente formula preguntas abiertas antes de diseñar | Ejecutar `npm run team:test:ambiguo` o crear ticket con solo 1 frase. |
| **3** | **Resiliencia & Corner Cases** | Retención de tráfico, alta afluencia y puntos exprés | Ejecutar `npm run team:test:corner` o simular error de pago con recuperación. |
| **4** | **Iteración de Diseño** | Ciclo de feedback continuo | Solicitar cambio de estilo o copy sobre un flujo ya generado. |

---

## 📝 Plantilla de Evaluación y Feedback

Al finalizar tu sesión de prueba, califica del 1 al 5 y anota tus impresiones:

1. **Comprensión del requerimiento (1-5):** ¿El brief y el flujo captaron la intención original?
2. **Calidad del borrador visual (1-5):** ¿El punto de partida ahorra tiempo respecto a empezar de cero?
3. **Fidelidad al Design System (1-5):** ¿Se respetan los componentes, tipografías y tokens oficiales?
4. **Fluidez de la integración con Figma (1-5):** ¿Resultó sencillo llevar el diseño al lienzo?
5. **¿Qué mejorarías?** (Comentarios abiertos sobre prompts, componentes o usabilidad).
