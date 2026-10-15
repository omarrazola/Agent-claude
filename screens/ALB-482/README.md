# ALB-482 · Rediseñar el flujo de reserva en móvil

Pantallas de ejemplo de lo que entrega la cadena de agentes para el ticket de `fixtures/jira-issue-created.json`. Están versionadas en el repositorio como referencia; las ejecuciones reales se guardan en `output/previews/<clave>/v<n>/`.

| Pantalla | Archivo | Componentes |
|----------|---------|-------------|
| Resultados | `resultados.html` | TopBar, SearchSummary, Chip, RoomCard |
| Ficha y tarifas | `ficha-habitacion.html` | TopBar, Section, AmenityList, RateOption, StickyFooter |
| Checkout | `checkout.html` | TopBar, Stepper, Input, PointsToggle, PriceSummary, Button |
| Confirmación | `confirmacion.html` | Confirmation, PriceSummary, Button |

Abre `resultados.html` en el navegador y recorre el flujo con los enlaces.

## Brief

- **Objetivo:** subir la conversión de reserva directa en móvil.
- **Flujo:** 5 pasos → 3 pasos (+ confirmación).
- **Preguntas abiertas para negocio:**
  - ¿Se permite pago mixto (puntos + tarjeta)?
  - ¿La tasa turística se cobra al reservar o en el hotel?

## Cifras de ejemplo

| Concepto | Importe |
|----------|---------|
| Flexible · 3 noches × 219 € | 657,00 € |
| Tasa turística (2 × 3 noches) | 9,00 € |
| Puntos Albora Club | −42,00 € |
| **Total** | **624,00 €** |
