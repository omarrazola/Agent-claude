# Integración de Uber Base Design System en Zeroheight para Agentes IA

Este documento describe la arquitectura, sincronización y especificación del **Uber Base Design System (v10.02.26)** documentado en el espacio oficial de Zeroheight:
🔗 **URL Oficial en Zeroheight:** [https://untitled-team-601jp.zeroheight.com/styleguide/s/146571/p/01d27b-uber-design-system](https://untitled-team-601jp.zeroheight.com/styleguide/s/146571/p/01d27b-uber-design-system)

---

## 1. Estructura Implementada en Zeroheight

A través del navegador y la API de edición de Zeroheight, se han configurado y persistido las siguientes páginas clave:

1. **Cover / Portada Principal (`/01d27b-uber-design-system`)**:
   - Descripción oficial del sistema optimizada para equipos de producto y agentes de IA.
   - Principios rectores de Uber Base (Negro primario, Píldoras 9999px, Tipografías Uber Move/Uber Move Text, Mobile-First 430px).
   - Especificación Zero-Prompt para agentes autónomos.
   - Mapeo de navegación a Foundations, Components y Guidelines.

2. **Foundations > Tokens (`/114420-tokens`)**:
   - Especificación machine-readable según el estándar W3C Design Tokens Community Group.
   - Tabla de equivalencia entre tokens W3C y variables CSS (`--base-*`).
   - Snippet JSON directamente interpretable por LLMs sin intervención humana.

3. **Foundations > Color (`/56e0f2-color`)**:
   - Paleta oficial dividida en: Primarios de Marca, Superficies/Fondos, Contenido/Tipografía y Estados Semánticos (Positive, Warning, Negative, Accent).
   - Ratios de contraste WCAG AA verificados (21:1 para texto primario, 7.5:1 para secundario).

---

## 2. Contrato para Agentes Autónomos (Zero-Prompt Interpretation)

Para que cualquier agente de IA (como los agentes 01-brief hasta 07-delivery) genere código o componentes sin instrucciones repetitivas, el sistema aplica este contrato determinista:

| Rol de UI | Componente Base Web | Estilos / Tokens Obligatorios |
| :--- | :--- | :--- |
| **Acción Primaria (CTA)** | `Button (KIND.primary)` | `border-radius: 9999px; background: #000000; color: #FFFFFF; height: 48px;` |
| **Acción Secundaria** | `Button (KIND.secondary)` | `border-radius: 9999px; background: #F6F6F6; color: #000000; height: 48px;` |
| **Acción Destructiva / Cancelar** | `Button (KIND.negative)` | `border-radius: 9999px; background: #DE1135; color: #FFFFFF; height: 48px;` |
| **Tarjetas / Contenedores** | `Card` | `background: #FFFFFF; border: 1px solid #E2E2E2; border-radius: 8px;` |
| **Estado Seleccionado** | `Card (selected)` | `border: 2px solid #000000; background: #FAFAFA;` |
| **Titulares** | `Heading` | `font-family: 'Uber Move', sans-serif; font-weight: 700;` |
| **Cuerpo de Texto y UI** | `Paragraph / Label` | `font-family: 'Uber Move Text', sans-serif;` |

---

## 3. Prototipo Interactivo Afín a Zeroheight

Se ha creado un prototipo interactivo en [`demo/zeroheight-uber-prototype.html`](file:///c:/Users/Casa/Agente%20claude/demo/zeroheight-uber-prototype.html) que reproduce fielmente el ecosistema de Zeroheight:
- Navegación lateral idéntica a la barra de Zeroheight.
- Simulador móvil con ancho estricto de **430 px**.
- Tarjetas interactivas de reserva de viaje (UberX, Uber Black, Uber Van).
- Validador interactivo de prompts para agentes de IA con cálculo automático de WCAG AA.
- Bloques de código JSON W3C copiables con un clic.
