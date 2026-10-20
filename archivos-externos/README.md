# Archivos externos del inventario

Esta carpeta reúne material de trabajo que llega desde reuniones o sistemas externos y se usa para tomar decisiones del catálogo. No forma parte de la interfaz de conteo.

- `reuniones/dudas_inventario_por_area.xlsx`: copia de trabajo de las dudas clasificadas por área, subárea y zona; se completa en reuniones con trabajadores, bodeguero, jefatura de turno y jefatura de local. El archivo no altera por sí mismo el catálogo ni el contrato de exportación.
- `../inventarios_og/11_10-INVENTARIO-totalizado.xlsx`: libro de referencia para la futura exportación. Conservar su ruta y estructura.
- `../inventarios_og/INVENTARIOS_2026-2027_jefa-turno.xlsx`: referencia histórica del reparto físico del conteo.

Al actualizar la planilla de reunión, conservar las respuestas y el estado de cada duda. Las decisiones aprobadas se trasladan después al catálogo o a las reglas de conteo; no se toman automáticamente desde el Excel.

Antes de publicar la app, verificar que este directorio y `inventarios_og/` estén excluidos del directorio público que sirve Cloudflare. Estar dentro del repositorio no los vuelve privados por sí solo.
