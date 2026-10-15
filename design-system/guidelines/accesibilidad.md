# Accesibilidad · Albora DS

Objetivo mínimo: **WCAG 2.2 nivel AA**.

## Comprobaciones obligatorias

| Área | Regla |
|------|-------|
| Contraste | Texto normal 4,5:1; texto grande y componentes 3:1. Sol (`--al-sun`) no se usa como color de texto sobre blanco. |
| Áreas táctiles | 44 × 44 px como mínimo (`--al-touch`). |
| Formularios | Cada campo tiene `label` visible asociado. Los errores se explican con texto, no solo con color. |
| Grupos de opciones | Tarifas y opciones similares van en `fieldset` con `legend`. |
| Encabezados | Un `h1` por pantalla y orden sin saltos. |
| Imágenes | `alt` descriptivo; vacío si son decorativas. |
| Precios | Un precio tachado incluye texto para lector de pantalla («antes 249 €»). |
| Estado | Lo seleccionado o activado no depende solo del color (borde, icono o texto). |
| Foco | Siempre visible (`:focus-visible` del sistema). |
| Movimiento | Respetar `prefers-reduced-motion`. |
| Idioma | `lang="es"` en el documento. |

## Pares de color aprobados

| Texto | Fondo | Uso |
|-------|-------|-----|
| `--al-ink` | `--al-white`, `--al-stone` | Texto principal |
| `--al-ink-60` | `--al-white` | Texto secundario |
| `--al-white` | `--al-pine` | Botón principal |
| `--al-ink` | `--al-sun` | Etiquetas y botón Sol |
| `--al-pine-700` | `--al-pine-50` | Banner informativo |
| `#6B4A0E` | `--al-sun-50` | Banner de beneficios |
