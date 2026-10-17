# Uber Base Design System (v10.02.26)

Implementación consolidada del sistema de diseño oficial de Uber para el equipo de agentes de diseño.
Fuente oficial de referencia: [https://base.uber.com/6d2425e9f/p/294ab4-base-design-system](https://base.uber.com/6d2425e9f/p/294ab4-base-design-system)

Es la **única** fuente de estilos que pueden usar los agentes, y está sincronizada con los tokens en formato W3C y la librería de componentes.

```
design-system/
├── tokens/base.tokens.json     Tokens oficiales en formato W3C: color, tipografía, espacio, radios, elevación
├── css/base.css                Variables CSS (--base-*) y componentes de utilidad (.base-*)
├── components/README.md        Catálogo de componentes autorizados y equivalencias con baseui
└── guidelines/
    ├── tono-de-voz.md          Directrices de voz, tono y redacción de Uber Base
    └── accesibilidad.md        Reglas WCAG AA que revisa el agente de QA
```

## Principios visuales de Uber Base

- **Negro (#000000)** es el color primario de acción y contraste. **Blanco (#FFFFFF)** y **Gris (#F6F6F6 / #E2E2E2)** son los fondos y divisores base.
- **Uber Move** para titulares con impacto geométrico; **Uber Move Text** para todo lo funcional y textos de lectura.
- Botones de acción y etiquetas con esquinas en píldora (`border-radius: 9999px`).
- Móvil primero, con un ancho máximo de 430 px por pantalla (`.base-page`).

## Mantener código y Figma alineados

1. Los tokens residen en `tokens/base.tokens.json`.
2. Se generan `css/base.css` y variables correspondientes para prototipos web o CSS puro.
3. El catálogo `components/README.md` define los únicos componentes autorizados para los agentes de UI y UX.
