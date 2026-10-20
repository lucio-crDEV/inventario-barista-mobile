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
node --test tests/summary-transition.test.mjs
node --test tests/work-selection.test.mjs
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

## Revisión de estilo del 20-10-2026

- Rama `inventory-v2` limpia al comenzar; cambios limitados a tema, resumen, prueba y documentación. La ruta de Pedido y los estados AM/PM no están implementados en esta rama.
- En la primera revisión, `node --test tests/catalog.test.mjs tests/summary-transition.test.mjs`: 9 pruebas aprobadas. La prueba del resumen comprueba que el contenido ya existe mientras se ve el acento y que se omite con movimiento reducido. En la revisión posterior su duración pasó a 650 ms.
- `python3 tests/workbook_contract.py`: 1.151 filas iguales en ID, nombre, unidad y categoría.
- `node --check` de `app.js`, `theme.js`, `pages/inventario/inventario.js` y `pages/inventario/summary-transition.js`, y `git diff --check`: sin errores.
- Inspección estática de CSS: tarjetas y campos tienen superficies legibles en ambos temas; enlaces y botones mantienen anillo de foco, mientras el buscador del panel cambia a fondo sólido al enfocarse, sin contorno por petición visual. Las etiquetas de estados conservan texto; las categorías móviles siguen en dos columnas y las acciones de conteo pasan a una columna bajo 380 px. La preferencia de movimiento reducido desactiva la animación y la de transparencia reducida deja superficies opacas.
- Tras los comentarios visuales, los pares de color en grises dieron contraste de 12,75:1 (texto principal claro sobre fondo) y 6,19:1 (secundario claro sobre sólido). El ajuste posterior hacia la paleta oscura anterior dio 14,71:1 para `#ededed` sobre `#1b1b1b`, 8,21:1 para `#b8b8b8` sobre `#202020` y 6,35:1 para el texto de la acción principal sobre el extremo más oscuro de su gradiente. Es una comprobación de colores base, no una medición de cada píxel con las transparencias superpuestas.
- La política del navegador de este entorno bloqueó la apertura del archivo local y prohíbe repetirla por otra ruta. Por ello no se certificaron capturas reales ni interacción táctil en 320/375/768 px, lector de pantalla o equipo físico. Quedan como revisión manual antes de publicar.

La persona usuaria aportó capturas de Inicio, Cocina y el resumen de Panadería/Cocina. Sus observaciones originaron el ajuste de la base a grises con gradientes translúcidos, conservando rojo/amarillo/verde para los estados funcionales; también motivaron encabezados sin borde, icono de tema centrado, nombre «Avance», espaciado del responsable y de los indicadores, y búsqueda desde categorías. Estas capturas documentan el estado anterior al ajuste; aún no son una verificación visual del resultado nuevo.

En la última iteración del buscador del panel se quitó el contorno y se dejó un fondo gris translúcido en reposo que se aclara al enfocarse. Queda pendiente evaluar si esta señal sin anillo es suficientemente perceptible para navegación por teclado; no se ha comprobado con lector de pantalla ni en un teléfono físico.

En la revisión posterior se restauraron los símbolos de luna y sol de la rama anterior y se acercó el tema oscuro a su fondo carbón, tarjetas casi negras y botones grises. Se repitieron las 9 pruebas de Node, el contrato de 1.151 filas, la comprobación de sintaxis de `theme.js` y `git diff --check`; todo pasó. El resultado visual de esta última revisión sigue pendiente de inspección en el navegador de la persona usuaria.

## Ajustes de Servicio y conteo del 20-10-2026

- Las capturas aportadas muestran Servicio, Garzones y Barra antes del ajuste. Se eliminó el encabezado redundante de sectores; en Garzones el título es «Zonas» y cada tarjeta muestra su progreso sobre 16 ítems. Se aumentó el margen interior de estas vistas y la tipografía de sus tarjetas.
- Al abrir una categoría o volver a una zona se elige el primer ítem que aún no esté contado. Si todos están contados, se conserva el primero para permitir revisión. «Sin stock» registra cantidad 0, estado contado y la marca `outOfStock`; aparece explícitamente en la ficha, el panel, el resumen y el texto copiado. Un cero confirmado mediante «Listo» no recibe esa marca.
- Los avisos de guardado aparecen arriba durante cuatro segundos, sin capturar gestos. Su superficie de vidrio usa fondo translúcido, desenfoque y una entrada con ligero aumento; las preferencias de movimiento o transparencia reducidos eliminan esos efectos. El indicador del resumen dura 650 ms y sigue sin retrasar el contenido ni mostrarse con movimiento reducido.
- `node --test tests/catalog.test.mjs tests/summary-transition.test.mjs tests/work-selection.test.mjs`: **11 pruebas aprobadas**. `python3 tests/workbook_contract.py`: **1.151 filas coinciden** en ID, nombre, unidad y categoría. `node --check` de `app.js`, `theme.js`, `pages/inventario/inventario.js`, `pages/inventario/summary-transition.js` y `pages/inventario/work-selection.js`, más `git diff --check`: sin errores.
- Pendiente una comprobación visual e interacción táctil de estos ajustes en el navegador local de la persona usuaria y en teléfono físico; las capturas recibidas no muestran todavía el resultado actualizado.

La revisión posterior de Mercadito movió «Anterior» y «Siguiente» a la barra superior, a ambos lados de «Ver ítems», sin cambiar sus funciones. «Ir a Resumen» permanece bajo las acciones de conteo. La barra conserva su lugar y cada sección mantiene al menos 58 px de alto. Se repitieron las 11 pruebas de Node, el contrato de 1.151 filas, la comprobación de sintaxis del módulo de Inventario y `git diff --check`; todo pasó. Queda pendiente la comprobación visual de la nueva barra en el navegador local.

La captura posterior de Panadería mostró «Ver ítems» a la derecha y un contorno demasiado intenso en el buscador oscuro. Se fijó explícitamente la posición central del botón, se suavizaron los bordes oscuros de tarjetas y panel, y se quitó el borde y la sombra del buscador en reposo y foco. El foco del buscador se distingue por un cambio de fondo; su percepción con teclado sigue pendiente de prueba con personas usuarias.

En Pastelería se observó un único divisor vertical en la barra superior: la regla más específica del botón central ocultaba el otro. Se eliminaron ambos divisores para mantener las tres zonas sin una línea aislada.

El aviso superior conserva el tinte funcional y el texto blanco: verde para los guardados de «Sin stock» y «Listo», ámbar para avance y rojo para errores. El ítem marcado «Sin stock» sigue identificado en rojo. Tras la revisión visual se retiró el reflejo interior, se suavizaron borde y sombra, y se aclararon los tintes con más transparencia, especialmente en modo oscuro. El desenfoque mantiene la lectura sobre el contenido. Cuando el sistema pide menos transparencia, el aviso usa un color sólido. La prueba de selección incluye el tono de cada acción.

La última comprobación pasó las **12 pruebas de Node**, el contrato de **1.151 filas**, la sintaxis de los módulos de Inventario y selección, y `git diff --check`. La apariencia del aviso más transparente queda pendiente de valoración visual en el navegador local.

## Incidente de navegación en Cloudflare Pages

El despliegue del commit `41cfb35` publicó los archivos, pero la regla `_redirects` enviaba `/` a `/pages/inventario/`. Esa pantalla, cuando no recibía `?area=`, solo ofrecía «Ir al inicio», que volvía a `/` y repetía la redirección. Una URL directa con `?area=cocina` sí cargaba el catálogo.

La corrección elimina esa redirección y muestra las cinco áreas activas cuando se abre `/pages/inventario/` sin parámetros. En la copia local se comprobó que `/` abre la portada, `/pages/inventario/` ofrece las cinco áreas, Cocina abre con sus 171 ítems y el botón «Volver» regresa a la portada. La corrección aún requiere subir la rama y esperar un nuevo despliegue para comprobarla en `inventario-local.pages.dev`.
