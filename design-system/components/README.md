# Catálogo Completo de Componentes · Uber Base Design System (baseui v18.2.0)

Fuente oficial: [Base Design System](https://base.uber.com/6d2425e9f/p/294ab4-base-design-system) y [Base Web Docs](https://baseweb.design)

Este catálogo documenta la totalidad de los componentes oficiales de Uber organizados en sus 10 categorías funcionales. Los agentes de diseño deben utilizar exclusivamente estos componentes, sus props y sus tokens W3C.

---

## 1. Clasificación por Categorías de Componentes

### 1.1 Inputs (Controles de Entrada)
* **Button (`baseui/button`)**: Botón táctil principal (`kind`: `primary` #000, `secondary` #F6F6F6, `tertiary` borde, `negative` #DE1135; `shape`: `rounded` 8px, `pill` 9999px; `size`: `large` 56px, `default` 48px, `compact` 36px).
* **ButtonGroup (`baseui/button-group`)**: Segmentos de selección con bordes compartidos.
* **Checkbox (`baseui/checkbox`)**: Selección binaria y listas de opciones múltiples.
* **FormControl (`baseui/form-control`)**: Envoltorio con `label`, `caption` y mensajes de error WCAG.
* **Input (`baseui/input`)**: Campos de texto para direcciones, origen, destino y búsqueda.
* **PaymentCard (`baseui/payment-card`)**: Detección de tarjeta bancaria, formato y código de seguridad.
* **PhoneInput (`baseui/phone-input`)**: Selector de prefijo de país e input de teléfono móvil.
* **PinCode (`baseui/pin-code`)**: Validación con PIN de seguridad de 4 dígitos para recogida de vehículo.
* **Radio (`baseui/radio`)**: Opciones mutuamente excluyentes (ej: inmediato vs programado).
* **Slider (`baseui/slider`)**: Ajuste continuo de rangos (ej: distancia o propina).
* **Textarea (`baseui/textarea`)**: Instrucciones especiales para el conductor.

### 1.2 Pickers (Selectores)
* **Select (`baseui/select`)**: Menú desplegable con autocompletado y selección filtrada.
* **Rating (`baseui/rating`)**: Calificación por estrellas (1 a 5) para valoración de conductores y servicios.
* **Menu (`baseui/menu`)**: Menú contextual de acciones rápidas.
* **FileUploader (`baseui/file-uploader`)**: Carga de comprobantes o documentos.

### 1.3 Date & Time (Fechas y Horarios)
* **DatePicker (`baseui/datepicker`)**: Calendario para reservas programadas (*Uber Reserve*).
* **TimePicker (`baseui/time-picker`)**: Selector de hora de recogida garantizada.
* **TimezonePicker (`baseui/timezone-picker`)**: Selección de huso horario para viajes internacionales.

### 1.4 Navigation (Navegación)
* **HeaderNavigation (`baseui/header-navigation`)**: Barra superior fija con retroceso, título en sentence case y avatar.
* **Tabs (`baseui/tabs`)**: Pestañas segmentadas para alternar servicios (Viaje / Envíos / Comida).
* **Breadcrumbs (`baseui/breadcrumbs`)**: Migas de pan de contexto de pantalla.
* **Pagination (`baseui/pagination`)**: Paginación de histórico de viajes y facturas.
* **SideNav (`baseui/side-nav`)**: Menú lateral de opciones de cuenta y configuración.
* **Link (`baseui/link`)**: Enlaces de soporte, términos y ayuda 24/7.

### 1.5 Content & Data Display (Contenido)
* **Card (`baseui/card`)**: Tarjeta base con radio de 8px, borde `#E2E2E2` y fondo `#FFFFFF` o `#F6F6F6`.
* **Avatar (`baseui/avatar`)**: Foto circular del conductor o usuario con verificación.
* **List (`baseui/list`)**: Lista de elementos con artwork izquierdo, subtítulo y contenido lateral.
* **Tag (`baseui/tag`)**: Píldora de estado (`positive`, `negative`, `warning`, `neutral`).
* **Accordion (`baseui/accordion`)**: Secciones desplegables de preguntas frecuentes y desglose de tarifas.
* **Heading & Typography (`baseui/typography`)**: Escala oficial con fuentes *Uber Move* y *Uber Move Text*.

### 1.6 Feedback & Status (Notificaciones y Estados)
* **Banner (`baseui/banner`)**: Alertas contextuales: `tone="negative"` para errores, `tone="warning"` para Corner Cases (alta demanda, obras) y `tone="positive"` para confirmación.
* **Notification (`baseui/notification`)**: Notificaciones en línea sobre el estado del trayecto.
* **ProgressBar (`baseui/progress-bar`)**: Barra de progreso de fases o nivel de recarga.
* **ProgressSteps (`baseui/progress-steps`)**: Indicador de etapas del flujo de producto.
* **Spinner (`baseui/spinner`)**: Animación circular oficial durante el emparejamiento con conductor.
* **Toast & Snackbar (`baseui/toast`, `baseui/snackbar`)**: Feedback efímero de confirmación.
* **Skeleton (`baseui/skeleton`)**: Estados de carga esqueleto para evitar saltos de maquetación (*CLS*).

### 1.7 Surfaces & Overlays (Superficies)
* **Drawer / BottomSheet (`baseui/drawer`)**: Hoja inferior deslizable insigne de la app de Uber.
* **Modal (`baseui/modal`)**: Diálogos modales para incidencias, confirmación de cancelación o cobros.
* **Popover (`baseui/popover`)**: Contenedores flotantes de información contextual.
* **Tooltip (`baseui/tooltip`)**: Ayudas contextuales sobre tarifas o términos.

### 1.8 Map Markers (Geolocalización & Movilidad)
* **LocationPuck (`baseui/location-puck`)**: Indicador pulsante azul de la posición GPS del usuario.
* **FloatingMarker (`baseui/floating-marker`)**: Pin flotante con tiempo de llegada (ETA) y conductor.
* **FloatingRouteMarker (`baseui/floating-route-marker`)**: Marcador animado sobre el trazado de la ruta.
* **FixedMarker (`baseui/fixed-marker`)**: Pin estático de punto de encuentro o parada intermedia.

---

## 2. Archivos de Definición en el Repositorio

* **`design-system/components/baseui.manifest.json`**: Manifiesto JSON formal con props, enums y mapeo a Figma.
* **`design-system/tokens/base.tokens.json`**: Tokens W3C oficiales (color, tipografía, radios, sombras, espaciado).
* **`design-system/css/base.css`**: Clases CSS con variables nativas para renderizado instantáneo en el prototipo.
* **`design-system/guidelines/tono-de-voz.md`**: Voz de marca oficial de Uber en sentence case.
* **`design-system/guidelines/accesibilidad.md`**: Criterios WCAG AA (áreas táctiles ≥ 44px/56px, contraste > 4.5:1).
