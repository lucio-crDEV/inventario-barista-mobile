# Etapa 3B — supervisión y administración del inventario

Estado al 21-10-2026: alcance preparado, **sin implementación 3B**. La administración mínima de cuentas y ámbitos ya pertenece a 3A y no se vuelve a contar como avance 3B. Ver [cierre técnico y pendientes de 3A](cierre-tecnico-3a.md).

## Orden de implementación

1. **Supervisión de solo lectura:** tablero administrativo por ciclo, ámbito y estado, con pendientes/avance/contados calculados desde el servidor. Consulta avanzada de historial por ciclo, ubicación, producto, autor estable, acción y fecha. Paginación/cursor y datos autorizados; el trabajador sigue accediendo únicamente a sus ámbitos. Enlace desde el tablero al historial del producto sin cambiar conteos.
2. **Rectificación y anulación auditadas:** cambios explícitos de administrador, vinculados a la versión vigente y con antes/después, motivo, identidad, fecha del servidor e ID idempotente. Mantener la operación, historial y resultado atómicos. No añadir un `force` que ignore versiones. La semántica concreta de anulación y su efecto sobre progreso se define y prueba antes de añadirla; conservar auditoría es requisito confirmado.
3. **Activación operativa:** capa separada del catálogo de referencia inmutable. Activar/desactivar modifica lo visible/contable en la app, nunca filas ni referencias del Excel y nunca confirma cero. Definir si rige para el ciclo en curso o siguiente y cómo tratar conteos/borradores existentes antes de implementar. No variar silenciosamente el denominador del progreso.
4. **Revisión, cierre y reapertura:** interfaz administrativa y estados de ciclo con versión, control de concurrencia y auditoría. El servidor ya rechaza escrituras en un ciclo no abierto; conservar esa validación también para confirmaciones antiguas y reintentos. Definir el estado de datos no resueltos/inactivos y la autorización de reapertura, sin inventar cantidades.

## Primer incremento comprobable

Para el tablero y la consulta administrativa, reutilizar usuarios, roles, ciclos, ámbitos, conteos e historial existentes. Mantener navegación móvil, temas, foco visible, skeletons y errores recuperables de la guía. Las vistas deben mostrar el ciclo consultado y la fecha de actualización; una consulta fallida no puede parecer un estado vacío confirmado. Diseñar la consulta paginada antes de descargar historiales completos al navegador.

Criterios de aceptación: trabajador rechazado en todas las rutas administrativas nuevas, administrador global sin asignaciones operativas, filtros que no mezclen ciclos ni ubicaciones, autoría estable tras renombrar, distinción entre pendiente/cero/Sin stock, progresos consistentes con conteos y carga/paginación sin bloquear edición. Probar en Worker/D1 local y sesiones independientes. Este incremento no requiere el piloto del equipo, cambios de contraseña ni mutaciones en la D1 publicada.

## Límites que continúan

No confundir el tablero con Excel: la exportación fiel es etapa 4. Debe conservar estructura, filas, identificadores, unidades, fórmulas y presentación del libro, actualizando solo cantidades. Cinco unidades ausentes, 18 entradas de Barra sin referencia y dos conversiones siguen pendientes de etapa 2; no resolverlas por similitud o conveniencia.

No destruir registros históricos ni resultados de operaciones para “limpiar” la pantalla. Eliminar exige una definición compatible con auditoría. Conteo offline completo, Pedido, recuperación por SMS/correo, Durable Objects, WebSockets y frameworks no se incorporan por anticipado. Antes del uso real continúa el requisito de resolver CPU/plan y recuperación remota de 3A.
