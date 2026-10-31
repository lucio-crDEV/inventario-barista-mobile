# Documentación

Las entradas vigentes son:

| Tema | Documento |
| --- | --- |
| Estructura y contratos | [Arquitectura y operación](arquitectura-y-operacion.md) |
| Excel: captura, motor y entrega | [4D](etapa-4d-exportacion.md), [4B/4C](etapa-4bc-exportacion.md) |
| Pruebas y publicación | [Verificación](verification.md), [Pages](despliegue-pages.md) |
| Interfaz y HTML seguro | [Guía de estilos](style-guide.md), [plantillas y vistas](arquitectura-y-operacion.md#cambios-de-rendimiento-y-mantenimiento) |
| Offline: identidad, privacidad y borradores | [Apertura sin conexión](arquitectura-y-operacion.md#apertura-y-conteo-sin-conexión) |
| Tiempo real y límites de consumo | [RTv2](arquitectura-y-operacion.md#sincronización-rtv2), [recursos Cloudflare](recursos-cloudflare.md) |
| Catálogo e índice 0016 | [Cambios de esquema y catálogo](arquitectura-y-operacion.md#cambiar-el-esquema-o-el-catálogo) |
| Ingreso compartido y revisión 29-10 | [Contrato de carriles](ingresos-compartidos.md), [evidencia](supervision-acceso-verificacion-2026-10-29.json) |
| Conteo compacto, inventario de ejemplo y publicación | [Continuación local](continuacion-local.md), [evidencia vigente](conteo-compacto-verificacion-2026-10-31.json) |
| Prioridades | [Roadmap](roadmap.md) |
| Excepción de la plantilla | [Cocina C74 y reversión](excepcion-stock-cocina-c74.md) |

Los informes con fecha, archivos JSON de evidencia y traspasos conservan decisiones y pruebas históricas. No representan por sí solos el estado de producción actual. Se conservan para trazabilidad; no es necesario leerlos todos para mantener la aplicación. Los enlaces vigentes anteriores prevalecen sobre estados históricos contradictorios.

`AGENTS.md` reúne instrucciones para herramientas de desarrollo. El funcionamiento, instalación, pruebas y publicación también se explican en documentación convencional: no se requiere un agente para mantener el proyecto.

La implementación local incluye offline real, plantillas con escape automático, vistas separadas, importador de catálogo y RTv2 compatible con v1. El índice 0016 ya se aplicó en producción con preflight aprobado. TOTP, nuevas políticas de acceso, «Cerrar otras sesiones» y Dependabot siguen pendientes; las pruebas físicas de teléfono/Excel y los datos no resueltos no se sustituyen por supuestos. Verificación y evidencia distinguen estos alcances de cualquier publicación.
