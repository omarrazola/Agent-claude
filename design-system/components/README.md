# Catálogo de componentes · Albora DS v2.3

Cada componente existe con el **mismo nombre** en código (clases `al-*` de `css/albora.css`) y en la librería de Figma. Este catálogo es el que leen los agentes de contexto, UX y UI: si un componente no está aquí, no existe.

| Componente | Clases | Uso |
|------------|--------|-----|
| Page | `al-page` | Contenedor de pantalla móvil (máx. 430 px) |
| TopBar | `al-bar`, `al-back`, `al-logo` | Barra superior con volver o logo |
| SearchSummary | `al-search` | Resumen de destino, fechas y huéspedes |
| Chip | `al-chips`, `al-chip`, `is-on` | Filtros rápidos |
| Banner | `al-banner`, `al-banner--sun`, `al-banner--pine` | Avisos y ofertas. Sun para beneficios, pine para información |
| RoomCard | `al-card`, `al-card__img`, `al-card__body`, `al-badge`, `al-row` | Habitación en un listado |
| Section | `al-sec` | Bloque blanco de contenido |
| AmenityList | `al-amenities` | Lista de servicios en dos columnas |
| RateOption | `al-rates` (fieldset), `al-rate` (label con radio) | Elección de tarifa |
| Button | `al-btn`, `al-btn--ghost`, `al-btn--sm`, `al-btn--sun`, `al-btn--ink` | Acciones |
| StickyFooter | `al-sticky` | Precio y acción fijos abajo |
| Stepper | `al-steps` (ol), `is-done` | Progreso en el checkout |
| Input | `al-field`, `al-input`, `al-field--error`, `al-field__error` | Campos de formulario |
| PointsToggle | `al-points`, `al-switch` (checkbox) | Usar puntos de Albora Club |
| PriceSummary | `al-sum` (dl), `is-discount`, `is-total` | Desglose de precio |
| Confirmation | `al-confirm`, `al-check`, `al-code` | Pantalla de reserva confirmada |

## Texto y datos

| Clase | Uso |
|-------|-----|
| `al-display`, `al-h`, `al-title` | Titulares de mayor a menor |
| `al-sub`, `al-legal` | Texto secundario y legal |
| `al-price`, `al-old-price` | Precios (con cifras tabulares) |
| `al-perk` | Beneficio destacado en verde |
| `al-rating` | Valoración y número de opiniones |

## Reglas

- El botón principal usa `--al-cta`. Pino por defecto; Sol (`al-btn--sun`) solo en campañas de Albora Club; Tinta (`al-btn--ink`) solo en fondos claros sin otro acento.
- Un solo botón principal por pantalla.
- Sol nunca se usa para texto sobre blanco (no cumple contraste).
- Los precios siempre indican si son por noche o totales, y si incluyen impuestos.
- Las imágenes `al-img--*` son marcadores de ejemplo; en producción se sustituyen por fotos con `alt` descriptivo.

## Ejemplos

Las pantallas de `screens/ALB-482/` usan todos estos componentes y sirven de referencia.
