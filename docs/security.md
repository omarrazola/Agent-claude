# Seguridad y datos

## Principios

- **Los agentes proponen, las personas deciden.** Ningún agente aprueba, despliega, cierra tickets ni publica en producción.
- **Permisos mínimos.** Los tokens de Jira y Trello deben pertenecer a una cuenta de servicio con acceso solo a los proyectos y tableros de diseño.
- **Sin datos de clientes finales.** Los briefs y la analítica que se envían a los agentes deben ser agregados. No se envían datos personales de huéspedes.
- **Registro de cada ejecución.** Cada paso queda guardado en `output/runs/` (o en la base de datos elegida) para poder auditarlo.

## Webhooks

- Jira: la URL del webhook incluye un token secreto (`JIRA_WEBHOOK_TOKEN`) que el servidor comprueba.
- Trello: el servidor verifica la firma `X-Trello-Webhook` con `TRELLO_APP_SECRET`.
- Las peticiones que no pasan la verificación se rechazan con `401`.

## Contenido del ticket

El texto de un ticket se trata como **datos**, no como instrucciones para los agentes. Los prompts lo indican de forma explícita, y el agente de entrega solo puede comentar y mover el ticket de origen.

## Secretos

- Las claves viven en variables de entorno, nunca en el repositorio (`.env` está en `.gitignore`).
- En producción, usar el gestor de secretos del proveedor de nube.

## Datos enviados a Claude

Se envían el brief, el catálogo de Albora DS, la guía de tono y las salidas de los agentes. Revisa con el cliente las condiciones de uso de datos de la API de Claude y su política interna antes de activar el piloto.
