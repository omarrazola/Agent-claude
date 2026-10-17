# Catálogo de componentes · Uber Base Design System (v10.02.26)

Fuente oficial: [Base Design System](https://base.uber.com/6d2425e9f/p/294ab4-base-design-system)

Cada componente de la interfaz sigue el sistema de diseño **Base de Uber**, garantizando coherencia visual, accesibilidad AA estricta y sincronización directa con Figma y tokens W3C.

---

## 1. Mapeo de Componentes CSS Oficiales

| Componente | Clase Principal | Variantes / Elementos | Uso |
|------------|-----------------|-----------------------|-----|
| **Page Container** | `base-page` | — | Marco de pantalla móvil (ancho máx. 430 px) |
| **Navigation Header** | `base-header` | `base-header-title` | Barra superior con título o logo y botón de regreso |
| **Button (Pill)** | `base-btn` | `base-btn-primary`, `base-btn-secondary`, `base-btn-tertiary` | Botón negro icónico con texto blanco y esquinas en píldora (`border-radius: 9999px`) |
| **Input Field** | `base-input` | `base-input-pill` | Campo de entrada de texto (direcciones, búsqueda, formularios) |
| **Product / Ride Card** | `base-card` | `base-card-selected` | Tarjetas de vehículos (UberX, Comfort, Black) o servicios |
| **Tag / Pill Filter** | `base-tag` | `base-tag-positive`, `base-tag-negative` | Filtros rápidos y etiquetas de estado en píldora |
| **Banner / Notification** | `base-banner` | `base-banner-warning`, `base-banner-positive` | Alertas del sistema, promociones y avisos |
| **Sticky Footer** | `base-sticky` | — | Barra fija inferior para precio final y botón de acción principal |

---

## 2. Componentes React Base Web (`baseui`)

Si el agente genera código React, debe importar directamente de la librería oficial `baseui`:

* **Button**: `import { Button, KIND, SIZE, SHAPE } from 'baseui/button';`
  * Primario: `kind={KIND.primary}` (Fondo negro)
  * Secundario: `kind={KIND.secondary}`
  * Píldora: `shape={SHAPE.pill}`
* **Input**: `import { Input, SIZE } from 'baseui/input';`
* **Card**: `import { Card, StyledBody, StyledAction } from 'baseui/card';`
* **Select**: `import { Select } from 'baseui/select';`
* **Modal**: `import { Modal, ModalHeader, ModalBody, ModalFooter } from 'baseui/modal';`
* **Typography**: `import { HeadingLarge, HeadingMedium, LabelLarge, ParagraphMedium } from 'baseui/typography';`

---

## 3. Tipografía (Uber Move & Uber Move Text)

| Escala | Token / Clase | Fuente | Tamaño / Altura | Peso | Uso |
|--------|---------------|--------|-----------------|------|-----|
| **Display** | `--base-fs-display` | Uber Move | 36px / 44px | Bold (700) | Titulares de bienvenida o impacto |
| **Heading Large** | `--base-fs-h-lg` | Uber Move | 24px / 32px | Bold (700) | Título principal de pantalla |
| **Heading Medium** | `--base-fs-h-md` | Uber Move | 20px / 28px | Bold (700) | Títulos de sección o tarjetas |
| **Heading Small** | `--base-fs-h-sm` | Uber Move | 16px / 24px | Bold (700) | Subtítulos y nombres de productos |
| **Label Large** | `--base-fs-label-lg` | Uber Move Text | 16px / 24px | Bold (700) | Botones principales y acciones |
| **Paragraph Medium**| `--base-fs-body-md` | Uber Move Text | 14px / 20px | Regular (400) | Texto de cuerpo y descripciones |
| **Label Small** | `--base-fs-label-sm` | Uber Move Text | 12px / 16px | Medium (500) | Metadatos y badges |
| **Caption** | `--base-fs-caption` | Uber Move Text | 11px / 16px | Regular (400) | Textos legales y notas al pie |

---

## 4. Reglas de diseño fundamentales de Uber Base

1. **Color negro como elemento unificador**: El botón principal y los titulares destacados usan `#000000`.
2. **Geometría y píldoras**: Los botones de acción y tags usan bordes píldora (`border-radius: 9999px`), característicos de la identidad de Uber.
3. **Alto contraste**: Todo el texto sobre blanco o gris `#F6F6F6` cumple sobradamente el ratio de contraste WCAG AA (>4.5:1).
4. **Voz activa y concisa**: Los textos son directos, sin relleno y centrados en la acción que realiza el usuario.
