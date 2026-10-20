# Roadmap — inventory-v2

## Meta

Generar desde la app un inventario completo con la estructura de `inventarios_og/11_10-INVENTARIO-totalizado.xlsx`. La experiencia de conteo se organiza por área, sector y zona cuando corresponde; las categorías prácticas se usan donde simplifican la búsqueda. Garzones abre directamente sus 16 ítems por zona.

## Etapas

1. **Catálogo y navegación:** cargar las filas del Excel como referencia de salida; abrir Cocina, Panadería, Pastelería, Servicio y Bodega Principal; dentro de Servicio, Barra, Armado / Línea / Copería, Garzones y Mercadito; dentro de Garzones, sus tres zonas. Mantener los ID originales y declarar conversiones sin adivinar equivalencias. Esta estructura ya está incorporada en el checkout actual; las zonas de Garzones omiten la pantalla de categoría.
2. **Revisión operativa:** confirmar las asignaciones físicas y unidades, con atención a los productos sin ID, las conversiones pendientes y los productos nuevos. La organización de Mercadito se acordará con la jefa de turno.
3. **Conteo compartido:** reunir los aportes de varios teléfonos sin sobrescrituras, distinguir cantidad pendiente de cero confirmado y conservar responsable y origen de cada conteo. Seleccionar una opción gratuita que cubra el uso real.
4. **Salida Excel:** ofrecer **Exportar** al final del inventario. Solo al elegir esa opción, partir del archivo totalizado de referencia, escribir los stocks contados en las filas correspondientes, consolidar Servicio y revisar el archivo generado antes de entregarlo.

La propuesta detallada de UX, colaboración y alternativas gratuitas está en `docs/propuesta-ux-colaboracion.md`. Es una propuesta para evaluar antes de implementar nuevas etapas. Las preguntas de reunión viven en `archivos-externos/reuniones/dudas_inventario_por_area.xlsx`.

La cobertura del catálogo y el contrato de referencia del Excel tienen pruebas repetibles en `tests/`. La revisión de resultados y simulaciones está en `docs/verification.md`. El panel lateral, la búsqueda, sus categorías plegables, la cuadrícula móvil y el modo oscuro ya existen; la suma/resta por aportes, el trabajo entre teléfonos y la exportación siguen pendientes.

## Criterios de avance

- Ningún producto se vincula a otro ID o fila por parecido de nombre sin validación.
- Una conversión pendiente o un producto nuevo se informa antes de la salida; no se omite silenciosamente.
- Una fila compartida entre sectores suma existencias físicas distintas.
- La exportación conserva la estructura y los datos de referencia del totalizado; solo cambia el stock del nuevo inventario.
- Contar o terminar un área no genera el Excel; la generación requiere elegir **Exportar** al final.
- El módulo Pedido permanece separado de Inventario.
