# Roadmap — inventory-v2

> Referencia histórica del 20-10-2026 (sustituida en 3A el 21-10-2026): consultar [la siguiente etapa de conteo compartido](etapa-conteo-compartido.md). Precisa usuarios, reparto físico, conflictos y cierre; revisa la suma indiscriminada de aportes de esta propuesta. Son recomendaciones aún no implementadas.

## Meta

Generar desde la app un inventario completo con la estructura de `inventarios_og/11_10-INVENTARIO-totalizado.xlsx`. La experiencia de conteo se organiza por área, sector y zona cuando corresponde; las categorías prácticas se usan donde simplifican la búsqueda. Garzones abre directamente sus 16 ítems por zona.

## Etapas

1. **Catálogo y navegación:** cargar las filas del Excel como referencia de salida; abrir Cocina, Panadería, Pastelería, Servicio y Bodega Principal; dentro de Servicio, Barra, Armado / Línea / Copería, Garzones y Mercadito; dentro de Garzones, sus tres zonas. Mantener los ID originales y declarar conversiones sin adivinar equivalencias. Esta estructura ya está incorporada en el checkout actual; las zonas de Garzones omiten la pantalla de categoría. Bodega / Principal organiza sus 288 filas en 14 grupos de conteo independientes de las categorías del Excel.
2. **Revisión operativa:** confirmar las asignaciones físicas y unidades, con atención a los productos sin ID, las conversiones pendientes y los productos nuevos. La organización de Mercadito se acordará con la jefa de turno.
3. **Conteo compartido:**
   - **3A — implementada y verificada localmente, pendiente de piloto operativo:** usuario personal y contraseña; cambio y restablecimiento; administración mínima de usuarios y permisos múltiples por ámbito; ausencia de asignaciones = ausencia de inventario; administrador global; Worker + D1; aislamiento de lectura/escritura; sincronización incremental, borradores por identidad/ciclo e historial. Propios se actualizan directamente con versión; ajenos se resuelven mediante Descartar, Sumar o Sobrescribir, con confirmación vinculada a versión, acción y resultado. Reintentos no duplican aportes. Ver [operación y requisitos de producción](operacion-3a.md).
   - **3B — posterior:** tablero completo de supervisión; consulta administrativa avanzada del historial; rectificaciones y anulaciones auditadas; activación/desactivación operativa de productos; revisión, cierre y reapertura. Desactivar nunca implica cero ni elimina filas del Excel. Eliminar registros exige definir una semántica compatible con auditoría conservada.
4. **Salida Excel:** ofrecer **Exportar** al final del inventario. Solo al elegir esa opción, partir del archivo totalizado de referencia, escribir los stocks contados en las filas correspondientes, consolidar Servicio y revisar el archivo generado antes de entregarlo.

La propuesta detallada de UX, colaboración y alternativas gratuitas está en `docs/propuesta-ux-colaboracion.md`. Es una propuesta para evaluar antes de implementar nuevas etapas. Las preguntas de reunión viven en `archivos-externos/reuniones/dudas_inventario_por_area.xlsx`.

La cobertura del catálogo y el contrato de referencia del Excel tienen pruebas repetibles en `tests/`. La revisión de resultados y simulaciones está en `docs/verification.md`. El panel lateral, la búsqueda, sus categorías plegables, la cuadrícula móvil, el modo oscuro y la guía visual de vidrio ya existen. El conteo distingue pendiente, avance, contado y «Sin stock» explícito; al reabrir un grupo prioriza el trabajo pendiente. La colaboración 3A ya tiene pruebas de API y sesiones independientes de navegador; continúan pendientes el teléfono físico, el piloto real, la habilitación de producción y la exportación.

## Criterios de avance

- Ningún producto se vincula a otro ID o fila por parecido de nombre sin validación.
- Una conversión pendiente o un producto nuevo se informa antes de la salida; no se omite silenciosamente.
- Una fila compartida entre sectores suma existencias físicas distintas.
- La exportación conserva la estructura y los datos de referencia del totalizado; solo cambia el stock del nuevo inventario.
- Contar o terminar un área no genera el Excel; la generación requiere elegir **Exportar** al final.
- El módulo Pedido permanece separado de Inventario.

## Alcance de accesos y administración

Decisiones confirmadas: usuario personal y contraseña; permisos múltiples administrables por ámbito; sin asignaciones no hay inventario; registros ajenos requieren Descartar, Sumar o Sobrescribir; actualizaciones propias sin ese diálogo. Administración mínima de cuentas y accesos pertenece a 3A. Ver [accesos](accesos-y-administracion.md), [contrato](contrato-3a.md) y [verificación](verification.md).

Criterios operativos todavía abiertos: dominio HTTPS y cookies reales, presupuesto CPU/consumo del plan Workers, respaldo/restauración, retención y piloto con trabajadores. No marcar la etapa operativa terminada a partir de pruebas locales. Etapa 2 continúa sin inventar equivalencias.
