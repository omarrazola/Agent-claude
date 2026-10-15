# Albora DS v2.3

Sistema de diseño de Hoteles Albora (ficticio). Es la **única** fuente de estilos que pueden usar los agentes, y la misma que usa el equipo en Figma.

```
design-system/
├── tokens/albora.tokens.json   Tokens en formato Design Tokens (W3C): color, tipo, espacio, radios
├── css/albora.css              Variables --al-* y componentes .al-*
├── components/README.md        Catálogo de componentes y reglas de uso
└── guidelines/
    ├── tono-de-voz.md          Cómo escribe Albora
    └── accesibilidad.md        Reglas AA que revisa el agente de QA
```

## Principios visuales

- **Pino** es el color de acción. **Sol** destaca beneficios y Albora Club. **Piedra** es el fondo base.
- **Young Serif** para titulares con carácter mediterráneo; **Figtree** para todo lo funcional.
- Móvil primero, con un ancho máximo de 430 px por pantalla.

## Mantener código y Figma alineados

1. Los tokens se editan en `tokens/albora.tokens.json`.
2. Se regenera `css/albora.css` y se sincronizan las variables de Figma (por ejemplo, con un plugin de importación de tokens).
3. Un componente nuevo se añade a la vez en el CSS, en Figma y en `components/README.md`. Si no está en el catálogo, los agentes no lo usarán.
