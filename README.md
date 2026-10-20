# inventory-v2

Aplicación web móvil para contar el inventario por área y generar, en una etapa posterior, el libro `inventarios_og/11_10-INVENTARIO-totalizado.xlsx` con las cantidades nuevas y el resto de su estructura intacta.

La pantalla inicial muestra Bodega / Principal, Cocina, Panadería, Pastelería y Servicio. Servicio se cuenta por Barra, Armado / Línea / Copería, Mercadito y Garzones; Garzones distingue Zona Privada, Salón y Terraza. Cocina, Panadería, Pastelería, Bodega y los sectores de Servicio salvo Garzones muestran categorías prácticas; al elegir una zona de Garzones se entra directamente a sus 16 ítems.

Al abrir un grupo se muestra primero el siguiente ítem pendiente o con avance. «Sin stock» guarda explícitamente un cero como contado; «Guardar avance» y «Listo» conservan sus respectivos estados. El panel de ítems y el resumen permiten volver a cualquier producto.

«Ver ítems» abre el panel sin activar el buscador ni el teclado móvil. Solo despliega la categoría del producto actual y deja ese producto a la vista; las demás categorías se pueden abrir manualmente. La lupa del encabezado abre el mismo panel con la búsqueda enfocada. La navegación vuelve al inicio de la página al cambiar de vista o de producto. El selector claro/oscuro usa iconos SVG para mantener su apariencia en Android.

La interfaz usa blanco crema en modo claro y carbón profundo en modo oscuro, con acentos cian y superficies uniformes sin degradados. El rojo indica pendiente y distingue el botón «Sin stock» antes de guardar; el ámbar indica avance y el verde identifica tanto un conteo normal como «Sin stock» ya guardado. Los avisos superiores usan esos colores sobre vidrio translúcido, duran cuatro segundos y entran y salen con movimiento vertical breve; respetan las preferencias de movimiento y transparencia reducidos.

Las listas de productos se derivan de los dos inventarios originales en `inventarios_og/`. `data/inventario/items/catalogo-excel.js` contiene las filas e ID de la salida y las asignaciones de Servicio. `data/inventario/items/barra.js` conserva los ID internos del catálogo anterior de Barra.

El conteo actual sigue guardándose en el navegador mediante `localStorage`. La sincronización entre teléfonos y la generación del Excel final son etapas pendientes. Revisa `docs/project-context.md`, `docs/roadmap.md`, `docs/propuesta-ux-colaboracion.md`, `docs/style-guide.md` y `docs/verification.md` para el estado, las etapas, las decisiones pendientes, el diseño y las comprobaciones realizadas. La planilla de dudas de reunión está en `archivos-externos/reuniones/`.

## Vista local

Desde la raíz del repositorio, inicia un servidor y mantenlo abierto mientras revisas la app:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8765/`. Si el navegador indica que se rechazó la conexión, comprueba que el servidor siga en ejecución.

## Comprobaciones locales

Con Node.js y Python 3 disponibles, desde la raíz del proyecto:

```sh
node --test tests/catalog.test.mjs tests/summary-transition.test.mjs tests/work-selection.test.mjs
python3 tests/workbook_contract.py
node --check pages/inventario/inventario.js
node --check theme.js
git diff --check
```

Las pruebas de Node revisan el catálogo, el indicador breve del resumen y la selección del siguiente ítem de trabajo. La prueba de Python compara las 1.151 filas de referencia con el Excel original sin modificarlo. Estas verificaciones no prueban exportación ni sincronización, porque esas funciones aún no están implementadas.

## Envío de esta rama

Los cambios de interfaz y documentación se preparan en `inventory-v2`. Después de revisar el commit local, el comando de envío es `git push origin inventory-v2`. El remoto usa SSH; se necesita una clave con acceso a `lucio-crDEV/inventario-barista-mobile` para ejecutar ese comando.
