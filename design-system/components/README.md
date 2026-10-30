# Catálogo Oficial de Componentes · Uber Base Design System (baseui)

Replicado directamente desde la especificación oficial de Uber en Zeroheight:
🔗 [https://zeroheight.com/6d2425e9f/p/556814-components](https://zeroheight.com/6d2425e9f/p/556814-components)
🔗 Sincronizado en tu espacio: [https://untitled-team-601jp.zeroheight.com/styleguide/s/146571/p/961de2-components](https://untitled-team-601jp.zeroheight.com/styleguide/s/146571/p/961de2-components)

Este catálogo documenta la totalidad de los componentes oficiales de Uber organizados en sus **7 categorías oficiales**. Los agentes autónomos de diseño (Brief, Context, UX, Copy, UI, QA, Delivery) deben utilizar exclusivamente estos componentes, sus props y sus tokens W3C correspondientes sin inventar estilos arbitrarios.

---

## 1. Arquitectura de Pestañas (Tabs) Estándar por Componente

Cada componente en Uber Base se estructura bajo 5 pestañas de documentación técnica:
1. **Usage:** Lineamientos de uso, variantes principales, anatomía y reglas de diseño (Do / Don't).
2. **Specs:** Medidas numéricas, padding, escala de espaciado, tokens aplicados y estados interactivos.
3. **Content:** Pautas de redacción, microcopy, capitalización (sentence case) y límites de longitud.
4. **Accessibility:** Soporte de navegación por teclado, roles y atributos ARIA, contraste cromático WCAG AA.
5. **Status & resources:** Estado de soporte en producción, enlaces al archivo de Figma y repositorio `@uber/baseui`.

---

## 2. Las 7 Categorías Oficiales y Componentes

### 2.1 Action
Componentes diseñados para iniciar operaciones inmediatas, confirmar flujos o navegar entre contextos:
* **Button (`baseui/button`)**: Disparador de acción prioritario. Tipos: `Primary` (#000000), `Secondary` (#EEEEEE / #F6F6F6), `Tertiary` (ghost sin borde en reposo), `Outline`, `OnBrand`. Variantes semánticas: `Default` vs `Danger` (#DE1135 / #E11900). Forma estándar: Rectangular redondeado (8px / `radius200`); y forma `Rounded` (píldora 9999px) para CTAs móviles de pantalla o botones circulares de icono. Alturas oficiales: Large (56px), Medium (48px - default), Small (40px) y xSmall (32px).
* **Button dock (`baseui/button-dock`)**: Contenedor inferior persistente en móvil para botones de confirmación (ej. "Confirmar UberX").
* **Button group (`baseui/button-group`)**: Segmentos de selección acoplados con bordes compartidos.
* **Link (`baseui/link`)**: Hipervínculos a documentación, soporte o términos legales.
* **Sliding button (`baseui/sliding-button`)**: Deslizador de confirmación crítica (evita pulsaciones accidentales).
* **Tile (`baseui/tile`)**: Bloques interactivos de acceso directo o categoría.
* **Timed button (`baseui/button`)**: Botón con temporizador regresivo de cancelación o caducidad de tarifa.

### 2.2 Input & control
Elementos interactivos para captura de datos, selecciones binarias o múltiples y validación en línea:
* **Check (`baseui/checkbox`)**: Selección binaria y listas de opciones múltiples.
* **Date picker (`baseui/datepicker`)**: Calendario para reservas programadas (*Uber Reserve*).
* **File upload (`baseui/file-uploader`)**: Carga de comprobantes, recibos o documentación.
* **Menu (`baseui/menu`)**: Menú contextual de opciones desplegables.
* **Radio (`baseui/radio`)**: Opciones mutuamente excluyentes (ej. "Inmediato" vs "Programado").
* **Select (`baseui/select`)**: Selector desplegable con soporte de autocompletado y búsqueda.
* **Text field (`baseui/input`)**: Entrada de texto estándar (dirección, recogida, destino, búsqueda).
* **PIN code (`baseui/pin-code`)**: Validación de recogida con código PIN de seguridad de 4 dígitos.
* **Search (`baseui/input`)**: Campo de búsqueda de destino con autocompletado y geocodificación.
* **Slider (`baseui/slider`)**: Control deslizante de rangos continuos (ej. propinas o distancias).
* **Star rating (`baseui/rating`)**: Calificación mediante estrellas (1 a 5) para evaluación de viajes.
* **Stepper (`baseui/stepper`)**: Contador de incremento/decremento (número de pasajeros o bultos).
* **Switch (`baseui/switch`)**: Conmutador binario de activación inmediata de ajustes.
* **Time picker (`baseui/timepicker`)**: Selector de hora de recogida garantizada.

### 2.3 Data display
Presentación jerárquica de contenidos, datos estructurados y estados asíncronos:
* **Accordion (`baseui/accordion`)**: Secciones desplegables de preguntas frecuentes o desglose de tarifas.
* **Avatar (`baseui/avatar`)**: Identificador fotográfico circular del conductor o usuario.
* **Badge (`baseui/badge`)**: Insignia compacta numérica o de estado (ej. "ETA 3 min").
* **Divider (`baseui/divider`)**: Línea divisoria horizontal sutil (`#E2E2E2`).
* **Draggable list (`baseui/dnd-list`)**: Lista reordenable de paradas intermedias o destinos.
* **Drawer (`baseui/drawer`)**: Panel lateral o inferior para filtros o detalles secundarios.
* **Empty state (`baseui/empty-state`)**: Pantalla informativa cuando no hay resultados o viajes registrados.
* **List item (`baseui/list`)**: Fila de lista con avatar izquierdo, título, descripción y meta lateral.
* **Message card (`baseui/card`)**: Tarjeta contextual de información o advertencia.
* **Placeholder (`baseui/skeleton`)**: Esqueleto de carga asíncrona mientras se calculan rutas o precios.
* **Popover (`baseui/popover`)**: Contenedor emergente de ayuda flotante.
* **Progress bar (`baseui/progress-bar`)**: Barra lineal de avance de trayecto o validación de pago.
* **Progress circle (`baseui/spinner`)**: Indicador circular de emparejamiento con conductor.
* **Progress steps (`baseui/progress-steps`)**: Indicador de etapas consecutivas de viaje.
* **Section heading (`baseui/heading`)**: Encabezados de sección jerarquizados.
* **Tag (`baseui/tag`)**: Etiqueta compacta semántica o de estado.
* **Tooltip (`baseui/tooltip`)**: Texto de apoyo flotante al interactuar.

### 2.4 Feedback & status
Alertas, notificaciones y estados en tiempo real:
* **Banner (`baseui/banner`)**: Notificación destacada contextual (Positive, Warning, Negative, Info).
* **Notification (`baseui/notification`)**: Aviso emergente o fijo en cabecera.
* **Snackbar (`baseui/snackbar`)**: Notificación efímera en el borde inferior con acción de deshacer.
* **Spinner (`baseui/spinner`)**: Indicador de carga activa indeterminada.
* **System alert (`baseui/banner`)**: Alerta crítica de sistema o fallo de conectividad.

### 2.5 Surfaces
Contenedores estructurales, modales y hojas deslizantes:
* **Card (`baseui/card`)**: Superficie principal para tarjetas de viaje, tarifas y vehículos (radio 8-12px, borde 1px).
* **Modal (`baseui/modal`)**: Cuadro de diálogo sobrepuesto bloqueante para confirmaciones críticas.
* **Modal full screen (`baseui/modal`)**: Modal a pantalla completa oficial de Uber (Stacked sheet e Immersive) con cabecera, cuerpo y botón docked inferior.
* **Sheet (`baseui/bottom-sheet`)**: Hoja inferior deslizable nativa de la app móvil.

### 2.6 Navigation
Itinerarios y desplazamiento entre pantallas:
* **Bottom navigation (`baseui/bottom-navigation`)**: Barra inferior fija de navegación móvil con iconos.
* **Breadcrumbs (`baseui/breadcrumbs`)**: Ruta de navegación jerárquica en interfaces de escritorio.
* **Navigation header (`baseui/header-navigation`)**: Barra superior con botón atrás, título y acción contextual.
* **Page controls (`baseui/page-control`)**: Paginador por puntos para carruseles de onboarding.
* **Pagination (`baseui/pagination`)**: Paginador para tablas de historial o viajes corporativos.
* **Side navigation (`baseui/side-navigation`)**: Menú lateral jerárquico para paneles web.
* **Tabs (`baseui/tabs`)**: Pestañas superiores para alternar vistas (ej. "Viajes", "Entregas", "Reservar").
* **Top navigation (`baseui/header-navigation`)**: Barra de navegación global.
* **Tree view (`baseui/tree-view`)**: Árbol colapsable para directorios o configuraciones complejas.

### 2.7 Data & tables
Visualización masiva de datos y tablas estructuradas:
* **Charts (`baseui/charts`)**: Gráficas oficiales de Uber (conceptos, paleta cromática de datos, librería base).
* **Data table (`baseui/data-table`)**: Tabla avanzada con ordenamiento, filtrado y renderizado virtualizado.
* **Table (`baseui/table`)**: Tabla estática semántica accesible.

---

## 3. Contrato de Integración para Agentes IA

Todo agente que diseñe o genere código a partir de este sistema debe seguir estas reglas:
1. **Mapeo directo:** Cada elemento visual en la pantalla debe corresponder exactamente a uno de estos componentes de Base Web.
2. **Tokens W3C obligatorios:** No se permiten colores hexadecimales ni espaciados arbitrarios en el CSS; deben emplearse variables `--base-*` del archivo `design-system/tokens/base.tokens.json`.
3. **Móvil Primero:** Ancho de contenedor fijo de `430px` para vistas de usuario móvil y áreas táctiles mínimas de `48px`.
