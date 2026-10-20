# Verificación local — inventory-v2

**Fecha:** 20-10-2026. **Rama:** `inventory-v2`. **Alcance:** catálogo, referencia Excel e interfaz de conteo local. No se generó ni modificó un libro de salida.

## Pruebas repetibles

Desde la raíz del repositorio:

```sh
node --test tests/catalog.test.mjs
python3 tests/workbook_contract.py
node --check pages/inventario/inventario.js
node --check app.js
node --check theme.js
```

Resultados de esta revisión:

- **Catálogo:** 7 pruebas aprobadas. Los 1.227 ítems tienen ID interno único; las 1.151 filas de las cinco hojas de conteo tienen al menos un vínculo; las áreas directas no duplican sus filas; Servicio cubre sus 295 filas y cada zona de Garzones contiene los mismos 16 productos de salida. La prueba específica de Principal comprueba sus 14 grupos, la asignación de sus 288 filas, nombres y unidades originales, factor de conversión 1 y la separación entre categoría de conteo y categoría de exportación para los dos atunes y el jamón. Las equivalencias acordadas de chai y syrups se mantienen.
- **Contrato Excel:** 1.151 filas comparadas directamente con `inventarios_og/11_10-INVENTARIO-totalizado.xlsx`; 0 diferencias en ID GetJusto, nombre, unidad y categoría. La prueba lee el libro y no lo modifica.
- **Sintaxis:** las tres verificaciones JavaScript anteriores terminaron sin errores. En la revisión de Principal también pasaron `node --check data/inventario/items/principal.js` y `node --check data/inventario/items/index.js`.

El catálogo conserva **18 ítems de Barra sin fila de exportación** y **2 conversiones pendientes**: Rinza (`ml` a `UN`) y Chocolate Líquido (`Kg` a `un`). Son bloqueos conocidos para una exportación automática completa, no fallos que deban resolverse inventando equivalencias. La planilla `archivos-externos/reuniones/dudas_inventario_por_area.xlsx` organiza las decisiones pendientes con el equipo.

## Simulaciones en navegador

Se usó un origen local aislado para no alterar los conteos abiertos en otras pestañas:

| Escenario | Resultado observado |
| --- | --- |
| Guardar `0` como contado en Cocina | El ítem quedó **Contado** con cantidad `0`; el avance pasó a `1 / 171`. |
| Guardar `1,25` como parcial con nota | El ítem quedó **Parcial**; cantidad y nota se recuperaron después de recargar. |
| Intentar guardar `-1` | Apareció «Ingresa una cantidad válida» y no aumentó el avance. |
| Ir a Panadería y volver a Cocina | Panadería mostró `0 / 151`; Cocina mantuvo su contado y su parcial. |
| Abrir Garzones → Zona privada | Entró directamente al primer ítem y mostró `0 / 16`, sin pantalla de categorías. |
| Buscar `ajo kg` en el panel lateral | Se mostró solo el producto coincidente; el grupo pudo plegarse y siguió plegado al limpiar la búsqueda. |
| Elegir «Nuevo inventario» | Se pidió confirmación antes de borrar; al confirmar, Cocina volvió a `0 / 171` en el origen de prueba. |

En la revisión de Bodega / Principal se abrió un origen local aislado: la pantalla mostró **14 grupos y 0 / 288 contados**. «Carnes, aves y pescados» abrió sus tres productos en orden (Atun Coliseo, Atun Dorasol y Jamon Ahumado). Al confirmar cantidad `0` para el jamón, el grupo quedó en **1 / 3** y el área en **1 / 288**; el cero se registró como contado. Este conteo de prueba quedó solo en el navegador de ese origen local.

## Límites de lo comprobado

- El diseño móvil usa dos columnas según la regla CSS; esta revisión no incluyó una captura en un teléfono físico ni evaluación con trabajadores.
- No se pudo verificar sincronización simultánea entre teléfonos ni resolución de conflictos: el conteo aún depende de `localStorage` de un solo navegador.
- No se pudo validar un archivo exportado ni su importación a GetJusto: la acción **Exportar** y el generador fiel del Excel aún no están implementados.
- La comparación del libro cubre los campos de referencia del catálogo; no certifica por sí sola que un futuro exportador preserve fórmulas, estilos, valores calculados y todas las hojas. Esa prueba pertenece a la etapa de exportación.

## Incidente de navegación en Cloudflare Pages

El despliegue del commit `41cfb35` publicó los archivos, pero la regla `_redirects` enviaba `/` a `/pages/inventario/`. Esa pantalla, cuando no recibía `?area=`, solo ofrecía «Ir al inicio», que volvía a `/` y repetía la redirección. Una URL directa con `?area=cocina` sí cargaba el catálogo.

La corrección elimina esa redirección y muestra las cinco áreas activas cuando se abre `/pages/inventario/` sin parámetros. En la copia local se comprobó que `/` abre la portada, `/pages/inventario/` ofrece las cinco áreas, Cocina abre con sus 171 ítems y el botón «Volver» regresa a la portada. La corrección aún requiere subir la rama y esperar un nuevo despliegue para comprobarla en `inventario-local.pages.dev`.
