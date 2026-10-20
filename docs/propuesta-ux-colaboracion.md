# Propuesta de evolución de inventory-v2

**Estado:** propuesta para evaluar. Ya se aplicaron la navegación por áreas, el acceso directo a los ítems de Garzones, el panel lateral con búsqueda y categorías plegables, la cuadrícula móvil y el modo oscuro. Las etapas de conteo compartido, revisión central y exportación siguen pendientes.

## Diagnóstico del checkout actual

La app ya separa Cocina, Panadería, Pastelería, Servicio y Bodega Principal. Servicio distingue Barra, Armado / Línea / Copería, Mercadito y Garzones; Garzones tiene zona privada, salón y terraza. El catálogo distingue categoría práctica de conteo y categoría del Excel, además de fila, ID GetJusto, unidad y conversión cuando está acordada. Los productos de Barra conservan sus ID internos cuando hay vínculo confirmado.

El conteo usa una sola clave `localStorage` (`inventario-session-v2`, esquema 3) por navegador. Los teléfonos no comparten cambios, y «Nuevo inventario» elimina esa sesión local completa. La app permite revisar y compartir un resumen de texto, pero todavía no existe un ciclo central, revisión entre personas ni exportador del Excel. El libro final tiene muchas fórmulas; antes de elegir cómo escribir las cantidades, hay que comprobar qué datos y valores calculados lee GetJusto.

## Experiencia propuesta

En el teléfono: **inventario activo → área → subárea y zona si corresponde → ítems**. Las categorías solo aparecen donde ayudan a encontrar productos. Cada ítem muestra ubicación, unidad, total actual, estado y acciones claras para sumar, restar, confirmar cero o dejar pendiente. Después de cada acción se ve qué se guardó y quién hizo el último movimiento. Búsqueda por nombre y acceso directo a pendientes reducen desplazamientos.

Para jefatura: tablero del mismo ciclo con avance por área, cambios recientes, parciales, conversiones sin resolver y productos sin fila de salida. Las correcciones se registran como movimientos nuevos, con autor y motivo, para conservar el historial. **Exportar** aparece en el cierre y muestra primero los bloqueos y cantidades que se enviarán.

La interfaz puede evolucionar sobre el HTML, CSS y JavaScript existentes. Conviene extraer componentes pequeños para tarjetas, estados y acciones, y luego separar navegación, sesión, conteo y exportación en módulos. No hace falta rehacer el catálogo ni cambiar de framework ahora.

## Etapas propuestas

| Etapa | Trabajo | Criterio de revisión |
| --- | --- | --- |
| 0. Ajuste puntual | Quitar las flechas de Servicio y zonas; después de elegir zona de Garzones abrir sus 16 ítems directamente, con regreso a zonas y acceso a resumen. | Recorrido móvil sin categoría intermedia. **Aplicado.** |
| 1. Conteo móvil | Vista de ciclo, búsqueda, estados claros, suma/resta con unidad visible, cero confirmado, prevención de pérdida de un campo editado y revisión del alcance de «Nuevo inventario». | Trabajadores de Barra, Cocina y Garzones prueban el flujo y señalan errores o pasos sobrantes. |
| 2. Trabajo compartido | Ciclo con ID y versión fija del catálogo; cada aporte guarda autor, ubicación, fecha, delta y un ID de operación que impide duplicar reintentos. La API actualiza el total de forma controlada. | Dos teléfonos cambian el mismo producto sin perder aportes; pendiente y cero confirmado se distinguen. |
| 3. Revisión y cierre | Tablero para jefe de turno/local, historial, correcciones con motivo, permisos y cierre del ciclo. | Jefatura puede revisar, cerrar y, si se acuerda, reabrir con trazabilidad. |
| 4. Exportación fiel | Solo al pulsar Exportar: sumar ubicaciones de Servicio, aplicar conversiones aprobadas, comprobar bloqueos y escribir exclusivamente las celdas de cantidad en una copia del libro de referencia. Comparar hojas, filas, IDs, fórmulas y formato con el original. | Archivo de ejemplo aceptado por GetJusto; se revisa además el comportamiento de fórmulas y valores guardados. |
| 5. Piloto sostenido | Recuperación de borradores, errores de red, respaldo, control de límites gratuitos y procedimiento para cierre semanal o mensual. El modo sin conexión se decide con mediciones de señal. | Dos o más ciclos con varios trabajadores y una exportación revisada. |

## Opciones gratuitas para varios teléfonos

| Opción | Ventaja | Límite o trabajo adicional |
| --- | --- | --- |
| **Cloudflare Workers + D1**, recomendación inicial | Sigue la infraestructura Cloudflare actual. Una API pequeña guarda aportes y permite consultar cambios cada pocos segundos. | Workers Free: 100.000 solicitudes/día. D1 Free: 5 millones de filas leídas y 100.000 escritas por día, 5 GB totales y máximo 500 MB por base. Al llegar al límite se detienen operaciones. |
| **Cloudflare Durable Objects con SQLite** | Coordina operaciones por ciclo y puede enviar actualizaciones en vivo. | Más complejidad de conexiones y límites; conviene solo si el piloto requiere inmediatez real. |
| **Supabase Free** | Postgres, autenticación y Realtime integrados. | Otro proveedor; 500 MB de base en plan gratuito y pausa tras una semana sin actividad. |

Workers KV sirve para configuración o caché; su consistencia eventual no basta por sí sola para sumas simultáneas. La identificación puede evaluarse con Cloudflare Access si el número de personas y sus cuentas encajan; los permisos de contar, revisar y exportar deben validarse igualmente en el servidor. Los límites y precios se verifican otra vez antes de elegir proveedor.

## Temas para decidir con el equipo

1. **Ubicación física y catálogo:** Mercadito, marca VITRINA, productos compartidos, faltas de ID, unidad o fila, y equivalencias entre presentaciones. La planilla en `archivos-externos/reuniones/` organiza las preguntas por área y subárea.
2. **Regla de aportes:** quién puede sumar/restar un mismo producto, cuándo se exige motivo, quién confirma el total y cómo se corrige un error sin borrar historial.
3. **Roles y ciclos:** quién abre el conteo semanal o de fin de mes, quién cierra o reabre, quién exporta y si puede haber más de un ciclo abierto.
4. **Conexión:** comprobar señal en cada zona. Si hay trabajo sin conexión, mostrar una cola local y avisar qué sigue pendiente de sincronizar.
5. **Contrato GetJusto:** confirmar qué celdas y hojas importa; comprobar si lee resultados calculados guardados o recalcula fórmulas. Esta prueba define el método de exportación sin rediseñar el documento.
6. **Publicación de materiales:** confirmar cómo se publica Cloudflare hoy. Excluir `archivos-externos/` e `inventarios_og/` del directorio público antes de un nuevo despliegue.

## Referencias de planes y límites consultados

- [Workers Free](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 Free](https://developers.cloudflare.com/d1/platform/pricing/) y [límites por base](https://developers.cloudflare.com/d1/platform/limits/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Consistencia de Workers KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [Supabase Free](https://supabase.com/pricing)
