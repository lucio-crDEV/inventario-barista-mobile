# Roadmap

## Implementado

- 3A: usuarios, sesiones, permisos, conteo compartido, conflictos, borradores e historial.
- 3B: supervisión, actividad, gestión de accesos de Servicio y ciclos con creación/activación/finalización/reapertura.
- 4A: estructura del backend, reglas y contrato de fidelidad del original.
- 4B: captura coherente, versionada, idempotente e inmutable del inventario finalizado.
- 4C: consolidación exacta, redondeo final y motor XLSX que modifica únicamente lo autorizado.
- 4D: revisión y exportación desde Supervisión para el Administrador, proceso privado, almacenamiento, recuperación y descarga autorizada.
- Offline real, instantánea privada por sesión/área, HTML con escape automático, vistas separadas, importador transaccional y RTv2 sin consultas por teléfono ante cada cambio.
- Rendimiento y mantenimiento: paquetes con hash/caché/precarga, redirección de ingreso anticipada, consultas SQL, índice de área, contrato ligero de esquema, errores centrales, cuota de ingreso revisada, bcrypt privado, limpieza acotada y CI.

El código de Pages de esta entrega queda pendiente del push del usuario. Las migraciones y la infraestructura privada ya están preparadas; consultar [evidencia de esta revisión](operacion-free-verificacion-2026-10-28.json).

## Siguiente: aceptación posterior a publicación

1. Comprobar en Pages la revisión publicada y el resultado inicial de CI.
2. Probar ingreso y permisos en teléfonos reales, Supervisión admin, revisión, generación y segunda descarga del mismo archivo.
3. Abrir una copia en Microsoft Excel y contrastar STOCK, impresión, hojas y totales recalculados con el inventario conocido.
4. Observar CPU/errores y uso del plan Free, diferenciando tiempos locales de facturación del proveedor.
5. Confirmar la ejecución diaria de limpieza y el control de respaldo con su cadencia existente.

## Decisiones pendientes

Resolver los datos de catálogo que bloqueen una cantidad contada: cinco unidades de Pastelería, equivalencias Rinza/Chocolate líquido y referencias antiguas de Barra. No alterar esos productos sin decisión explícita.

Siguen pendientes por decisión del usuario: TOTP/recuperación, nuevas políticas de contraseña e inactividad, cierre de otras sesiones y Dependabot. Offline, importador, vistas y HTML seguro ya están implementados. Paid queda descartado por ahora. [Análisis y prioridades](arquitectura-y-operacion.md).

## Fase 5

Adaptación a otras versiones de Excel y cambios de plantilla requieren aprobación expresa. El motor actual no debe aceptar silenciosamente libros nuevos. Root y el módulo Pedido siguen fuera de esta entrega.
