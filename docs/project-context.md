# Contexto del proyecto — inventory-v2

## Objetivo vigente

`inventory-v2` debe permitir contar el inventario completo desde la app y producir un archivo con la misma estructura que `inventarios_og/11_10-INVENTARIO-totalizado.xlsx`. El archivo `inventarios_og/INVENTARIOS_2026-2027_jefa-turno.xlsx` describe el reparto manual del conteo. El archivo totalizado es la referencia de salida: se conservan hojas, filas, identificadores, nombres, unidades, fórmulas y presentación; las cantidades de stock proceden del nuevo conteo.

El uso operativo puede organizarse de forma distinta del Excel. Cada producto debe vincularse a una fila de salida y contar con una conversión explícita entre su unidad en pantalla y la unidad de esa fila. Una cantidad pendiente no equivale a cero confirmado. Los productos nuevos o sin correspondencia requieren revisión antes de incluirlos en la salida.

El Excel final se genera únicamente cuando se elige explícitamente **Exportar** al terminar el inventario. Los conteos por área forman parte del trabajo previo y no generan archivos por sí solos.

## Áreas y sectores de conteo

- Cocina → hoja `cocina`.
- Panadería → hoja `panaderia`.
- Pastelería → hoja `pasteleria`.
- Bodega / Principal → hoja `principal`.
- Servicio → hoja `servicio`, sumando por producto los conteos de Barra, Armado / Línea / Copería, Mercadito y Garzones.
- Garzones se cuenta en Zona Privada, Salón y Terraza.

Armado / Línea / Copería se cuenta como un solo sector. La organización física y las categorías prácticas de Mercadito se revisarán con la jefa de turno. Cada ítem distingue `countCategory` (grupo que se muestra para contar) de `exportCategory` (categoría de su fila en el Excel).

Cocina se cuenta en ocho grupos prácticos: Verduras y frutas; Carnes, aves y pescados; Lácteos y huevos; Abarrotes; Aceites, salsas y condimentos; Elaborados y productos listos; Panes y masas; Aseo, protección y envases. Sus 171 filas se asignan una sola vez. Porotos verdes queda provisionalmente en Abarrotes. Cocina cuenta todos los productos de su hoja que tenga físicamente, aunque esos productos también aparezcan en otras áreas. Por ahora muestra y registra las unidades del Excel final; las mejoras de unidades se revisarán después con feedback del equipo. La agrupación no modifica filas, ID ni categorías de salida.

Pastelería se cuenta en once grupos prácticos que separan ingredientes, bases, rellenos, coberturas y familias de productos terminados. Sus 246 filas se asignan una sola vez. Cinco filas del Excel final carecen de unidad; la app conserva ese dato ausente y queda pendiente definirlo con el equipo antes de exportar cantidades de esas filas.

Panadería se cuenta en siete grupos prácticos: Harinas y levaduras; Abarrotes, semillas y saborizantes; Refrigerados y huevos; Panes y bollería; Galletas y dulces; Aseo y protección; Envases y rotulación. Sus 151 filas se asignan una sola vez. Aseo y envases se separan aquí porque juntos abarcarían 48 productos.

Bodega / Principal se cuenta en catorce grupos prácticos que separan abarrotes, condimentos, panificación, carnes y pescados, lácteos, congelados, bebidas, cafetería, té, repostería, aseo, envases, artículos de servicio y suministros de operación. Sus 288 filas se asignan una sola vez. Los dos atunes se muestran junto al jamón en «Carnes, aves y pescados», aunque el Excel mantenga los atunes bajo «Abarrotes» y el jamón bajo «Carnes y Aves». Los grupos de pantalla no cambian la fila, el ID, la unidad ni la categoría de exportación. Bodega cuenta solo los productos de su hoja; no se copian aquí los de Cocina por compartir tipo de producto.

## Estado de la implementación

La rama `inventory-v2` usa HTML, CSS y JavaScript nativos. La página inicial muestra las cinco áreas. El módulo de inventario permite elegir sector en Servicio y zona en Garzones. En cada zona de Garzones se muestran directamente sus 16 ítems; las demás áreas y sectores conservan categorías prácticas antes de los productos. Durante el conteo, un botón abre un panel lateral con todos los ítems del área o zona activa, su estado y búsqueda por nombre. El catálogo de la app se deriva de las filas del archivo totalizado y de las asignaciones del libro manual. Se conservan los ID internos existentes de Barra cuando se puede vincular el mismo producto por nombre o por una equivalencia confirmada. Los ID de GetJusto y números de fila del Excel se guardan como referencias de salida sin modificarlos; los ID ausentes permanecen ausentes.

La interfaz usa una paleta de grises y gradientes CSS con indicadores de estado. Incluye un modo oscuro seleccionable desde Inicio y las pantallas de Inventario; la preferencia se guarda en el navegador y los iconos de luna y sol son SVG para evitar diferencias de fuente en Android. Las superficies compartidas de navegación, conteo y resumen emplean transparencia moderada con alternativa opaca para la preferencia de transparencia reducida; los encabezados y el botón de tema no tienen borde de tarjeta. El panel lateral de ítems conserva la transparencia, permite buscar y plegar categorías, y se abre también desde el botón de búsqueda en el encabezado de categorías. «Ver ítems» abre el panel sin enfocar el buscador ni activar el teclado; el botón de búsqueda sí enfoca el campo. En celulares, las categorías usan una cuadrícula compacta de dos columnas; los controles de conteo conservan separación y foco visible. La guía visual y de interacción está en `docs/style-guide.md`.

El resumen ya no queda sin encabezado cuando hay pendientes. Al abrirlo se muestra un indicador decorativo durante 650 ms después de dibujar el contenido; no retrasa las acciones y se omite con movimiento reducido. Al entrar en un grupo o volver a una zona se prioriza un ítem sin contar. La barra superior de conteo dispone «Anterior», «Ver ítems» y «Siguiente» en ese orden. La acción «Sin stock» guarda 0 como contado con una marca explícita que se muestra en el panel, la ficha, el resumen y el texto copiado. Los avisos de guardado aparecen arriba y desaparecen a los cuatro segundos: son verdes para «Listo» y «Sin stock», amarillos para avance y rojos para errores. El botón «Sin stock» y el estado del producto conservan el rojo para distinguir la falta de existencias. Esta rama no contiene estados AM/PM ni la vista de Pedido de la otra rama, por lo que sus flujos no se modificaron aquí.

Barra conserva las seis categorías de conteo de la versión anterior: Insumos, Syrups, Congelados, Té / Infusiones, Desechables y Limpieza (en el catálogo el nombre histórico es `Te / Infusiones`). Las filas adicionales del Excel se ubican dentro de estas categorías según el producto; las categorías de la hoja Servicio se guardan solo como referencia de salida. La falta de vínculo con el Excel y las conversiones pendientes son asuntos internos y no se muestran como categorías ni avisos en la pantalla de conteo.

Las bebidas envasadas de marca (Coca-Cola, Coca-Cola Zero, Fanta, Sprite y Sprite Zero) y las aguas con y sin gas se cuentan en Armado / Línea / Copería, bajo «Bebidas». Las pulpas, porciones de jugo, hielo y Primaveral siguen en Barra. Las siete bebidas trasladadas conservan sus ID internos previos para mantener conteos locales existentes.

El conteo existente se guarda en `localStorage` con la clave `inventario-session-v2` y esquema 3. Esa persistencia es local al navegador y aún no reúne automáticamente los conteos de varios teléfonos. El generador del Excel final tampoco está implementado todavía. El documento `docs/propuesta-ux-colaboracion.md` plantea la evolución de interfaz y trabajo compartido; sus etapas siguen pendientes de evaluación. Las dudas de reunión se conservan en `archivos-externos/reuniones/dudas_inventario_por_area.xlsx`. La ruta de Pedido pertenece a un módulo separado y no forma parte de esta navegación de inventario.

La revisión del 20-10-2026 comprobó 1.151 filas de referencia contra el Excel original y encontró cero diferencias en ID, nombre, unidad y categoría. El catálogo tiene 1.227 entradas de conteo porque algunos productos aparecen en más de un sector o zona; 18 ítems anteriores de Barra siguen sin fila de salida y dos conversiones de Barra siguen sin equivalencia aprobada. Las pruebas y simulaciones, junto con su alcance, están en `docs/verification.md`.

## Conversiones conocidas y pendientes

- Chai en polvo: conteo y salida en KG. Al cargar una sesión antigua de Barra que guardó gramos, la cantidad se convierte a kilos.
- Syrups de 750 cc: conteo en CC; la salida en UN corresponde a `cc / 750`.
- Las unidades iguales, ignorando mayúsculas, mantienen factor 1; gramos a kilos tienen factor `0,001`.
- Las conversiones sin equivalencia confirmada se marcan como pendientes. No se inventan tamaños de envase.

## Contexto de ramas

`main` es la versión estable anterior de Inventario Barra; `warehouse-order` es la línea de Pedido a Bodega; `inventory-v2` es esta evolución. Las decisiones de `inventory-v2` reemplazan los límites de la versión anterior.
