# Contexto del proyecto — inventory-v2

## 1. Propósito y alcance

`inventory-v2` es la evolución modular del sistema de inventario para Brioche Bakery. Debe entenderse como una línea de trabajo distinta de la aplicación anterior **Inventario Barra** y de la rama dedicada a **Pedido a Bodega**. No trasladar fases, límites ni supuestos de la aplicación anterior sin contrastarlos con las decisiones de esta evolución.

La estructura contempla un módulo de inventario y un módulo de pedido. La aplicación raíz (`app.js`) registra las rutas de ambos. El inventario tiene una estructura inicial para varias áreas; la presencia de una opción en el catálogo de áreas no significa que el área ya tenga catálogo, datos o flujo validado.

## 2. Ramas de trabajo

El contexto del proyecto distingue:

- `main`: versión estable anterior de Inventario Barra.
- `warehouse-order`: trabajo de Pedido a Bodega.
- `inventory-v2`: evolución del inventario documentada aquí.

Verifica siempre la rama antes de editar o describir el estado. No mezcles el roadmap de la versión anterior con esta rama.

## 3. Implementación observada en este checkout

### Estructura

- `app.js` configura navegación a `pages/inventario/` y `pages/pedido/`.
- `pages/inventario/index.html`, `inventario.css` e `inventario.js` implementan el módulo de inventario.
- `data/inventario/areas.js` declara las áreas.
- `data/inventario/items/index.js` reúne los módulos de catálogo; hoy importa `barra.js`.
- `data/inventario/items/barra.js` contiene el catálogo presente.

### Áreas y catálogo

El catálogo de áreas declara cinco opciones activas: Barra, Línea + Armado + Copería, Panadería, Pastelería y Cocina. El módulo de ítems actualmente reúne únicamente `barra.js`; todos los registros de ese archivo tienen `areaId: "barra"`.

El archivo contiene 74 registros ordenados (órdenes 1 a 74), de los cuales 72 están activos y 2 inactivos. Estos recuentos describen el checkout auditado y deben recalcularse si cambia el catálogo. No describir las cinco áreas como cinco inventarios completos: el código de áreas es una base, mientras que los datos de producto cargados son de Barra.

Los objetos actuales contienen `id`, `name`, `category`, `areaId`, `unit`, `order` y `active`. `id` funciona como identificador interno; no cambiarlo sin necesidad y revisar las referencias al migrar datos.

### Sesión y persistencia

`pages/inventario/inventario.js` usa `localStorage` con la clave `inventario-session-v2`. La sesión creada tiene `schemaVersion: 3`; el cargador admite esquemas 2 y 3 y normaliza la sesión a versión 3. La sesión es local al navegador y no constituye sincronización remota ni historial central.

La sesión incluye identificador, fecha, inicio, índice actual, vista, responsable y conteos. El código presenta vistas de categorías, conteo y resumen, y conserva los datos de sesión en el almacenamiento local. Para detalles de comportamiento, inspecciona el código vigente antes de implementar cambios: pueden variar entre commits.

### Pedido

La ruta del módulo Pedido está registrada en la aplicación raíz, pero el estado y alcance de ese módulo deben verificarse en `pages/pedido/` y contrastarse con la rama `warehouse-order`. No inferir que está completo por existir una ruta.

## 4. Decisiones de documentación

- Separar hechos comprobados en el checkout de objetivos y decisiones de producto.
- Tratar el catálogo multiárea como estructura inicial mientras solo haya datos de Barra.
- No describir funciones como descartadas o comprometidas sin una decisión explícita y vigente.
- No reutilizar cifras, claves de almacenamiento, modelos o nombres de la versión anterior sin verificar.
- Mantener separados Inventario y Pedido, respetando la línea de trabajo de cada rama.

## 5. Cuestiones abiertas

El código por sí solo no establece:

- cuándo se cargarán y validarán productos de las otras áreas;
- si las áreas compartirán un flujo o tendrán particularidades operativas;
- qué alcance funcional exacto corresponde al módulo Pedido en esta rama;
- qué secuencia de entregas y criterios de aceptación fueron acordados para las siguientes iteraciones.

Resolver estas cuestiones desde el contexto de decisiones del proyecto o preguntando al usuario. No rellenarlas con supuestos heredados del MVP anterior.

## 6. Cómo mantener este documento

Al cambiar código, vuelve a comprobar rutas, catálogo, áreas, persistencia y comportamiento antes de actualizar las afirmaciones. Los recuentos son una fotografía del estado auditado, no valores permanentes. Usa `docs/roadmap.md` para el orden de trabajo y conserva aquí solo contexto, decisiones y estado relevante.
