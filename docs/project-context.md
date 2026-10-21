# Contexto del proyecto — inventory-v3

## Separación de versiones — 21-10-2026

Por decisión del usuario, la etapa 3A y todo este avance continúan en `inventory-v3`, creada desde `inventory-v2` en `3d23319`. La rama `inventory-v2` conserva íntegro su commit anterior sin estas modificaciones. Se trasladaron también los cambios de documentación que ya existían antes de implementar 3A. El catálogo versionado y las claves de datos mantienen sus identificadores originales por compatibilidad. Ver [separacion-inventory-v3.md](separacion-inventory-v3.md).

## Objetivo vigente

`inventory-v3` debe permitir contar el inventario completo desde la app y producir un archivo con la misma estructura que `inventarios_og/11_10-INVENTARIO-totalizado.xlsx`. El archivo `inventarios_og/INVENTARIOS_2026-2027_jefa-turno.xlsx` describe el reparto manual del conteo. El archivo totalizado es la referencia de salida: se conservan hojas, filas, identificadores, nombres, unidades, fórmulas y presentación; las cantidades de stock proceden del nuevo conteo.

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

## Estado vigente — etapa 3A, 21-10-2026

Implementados Worker + D1, usuarios personales con contraseña, sesión por cookie HttpOnly, cambio propio/temporal, administración mínima de cuentas y múltiples ámbitos, catálogo filtrado, conteo compartido con versiones, historial, reintentos idempotentes y borradores aislados por identidad/ciclo. Decisiones confirmadas: ausencia de asignaciones significa ausencia de acceso al inventario; administrador global por rol; registros ajenos requieren Descartar, Sumar o Sobrescribir; actualizaciones propias se guardan directamente con control de versión. El catálogo conserva sus identificadores, unidades y referencias originales. Pedido no se modificó.

Inicio y pantallas obtienen la proyección autorizada desde la API. Los contenedores solo conducen a descendientes permitidos. La sesión local anterior permanece sin leer ni importar; Nuevo inventario está deshabilitado en modo compartido. Contrato en [contrato-3a.md](contrato-3a.md), inicio y primer administrador en [operacion-3a.md](operacion-3a.md). 3A está implementada y probada localmente, pendiente de habilitación y piloto operativo; no equivale a producción terminada. Etapa 2 sigue con sus decisiones físicas/unidades pendientes; 3B y Excel en 4 siguen pendientes.

## Interfaz y catálogo conservados

La rama `inventory-v3` usa HTML, CSS y JavaScript nativos. La página inicial muestra las cinco áreas. El módulo de inventario permite elegir sector en Servicio y zona en Garzones. En cada zona de Garzones se muestran directamente sus 16 ítems; las demás áreas y sectores conservan categorías prácticas antes de los productos. Durante el conteo, un botón abre un panel lateral con todos los ítems del área o zona activa, su estado y búsqueda por nombre. El catálogo de la app se deriva de las filas del archivo totalizado y de las asignaciones del libro manual. Se conservan los ID internos existentes de Barra cuando se puede vincular el mismo producto por nombre o por una equivalencia confirmada. Los ID de GetJusto y números de fila del Excel se guardan como referencias de salida sin modificarlos; los ID ausentes permanecen ausentes.

La interfaz usa un fondo blanco crema uniforme (#faf8f3), acentos cian y tarjetas de área con tintes propios en modo claro. El modo oscuro usa un fondo carbón profundo (#111315) y superficies oscuras uniformes. Fondos, tarjetas, botones y paneles no llevan degradados; se conservan transparencia y desenfoque moderados. Los botones no cambian color ni relieve al hover o al pulsarlos; el foco visible se reserva para teclado. Volver y el toggle liberan el foco tras un toque. El único control de tema del encabezado permanece arriba a la derecha; el engranaje de la referencia visual queda pendiente. La preferencia se guarda en el navegador y los iconos de luna y sol son SVG para evitar diferencias de fuente en Android. Las superficies compartidas de navegación, conteo y resumen emplean transparencia moderada con alternativa opaca para la preferencia de transparencia reducida; los encabezados y el botón de tema no tienen borde de tarjeta. El resumen muestra un anillo SVG calculado con los conteos reales. Su encabezado conserva título y controles, pero oculta la barra y el contador duplicados; se retiró el subtítulo descriptivo y se redujo el espacio anterior al contenido. El panel lateral de ítems conserva la transparencia, permite buscar y plegar categorías, y se abre también desde el botón de búsqueda en el encabezado de categorías. Al abrirlo, solo la categoría del producto actual queda desplegada y el producto se sitúa a la vista; en una vista sin producto todos los grupos empiezan cerrados. «Ver ítems» no enfoca el buscador ni activa el teclado; el botón de búsqueda sí enfoca el campo. En celulares, las categorías usan una cuadrícula compacta de dos columnas; los controles de conteo conservan separación y foco visible. La guía visual y de interacción está en `docs/style-guide.md`.

El resumen ya no queda sin encabezado cuando hay pendientes. Al abrirlo se muestra un indicador decorativo durante 800 ms después de dibujar el contenido; no retrasa las acciones y se omite con movimiento reducido. Al entrar en un grupo o volver a una zona se prioriza un ítem sin contar. La barra superior de conteo dispone «Anterior», «Ver ítems» y «Siguiente» en ese orden. La acción «Sin stock» guarda 0 como contado con una marca explícita que se muestra en el panel, la ficha, el resumen y el texto copiado. Una vez guardado, su estado se ve verde en esos lugares, como cualquier conteo confirmado; el botón de acción conserva el rojo antes de guardar. Los avisos de guardado aparecen arriba durante cuatro segundos: son verde/teal para «Listo» y «Sin stock», ámbar para avance y rosa rojizo para errores. Tienen una superficie translúcida más amplia, entrada desde arriba y salida hacia arriba; con movimiento o transparencia reducidos simplifican esos efectos. Esta rama no contiene estados AM/PM ni la vista de Pedido de la otra rama, por lo que sus flujos no se modificaron aquí.

Barra conserva las seis categorías de conteo de la versión anterior: Insumos, Syrups, Congelados, Té / Infusiones, Desechables y Limpieza (en el catálogo el nombre histórico es `Te / Infusiones`). Las filas adicionales del Excel se ubican dentro de estas categorías según el producto; las categorías de la hoja Servicio se guardan solo como referencia de salida. La falta de vínculo con el Excel y las conversiones pendientes son asuntos internos y no se muestran como categorías ni avisos en la pantalla de conteo.

Las bebidas envasadas de marca (Coca-Cola, Coca-Cola Zero, Fanta, Sprite y Sprite Zero) y las aguas con y sin gas se cuentan en Armado / Línea / Copería, bajo «Bebidas». Las pulpas, porciones de jugo, hielo y Primaveral siguen en Barra. Las siete bebidas trasladadas conservan sus ID internos previos para mantener conteos locales existentes.

Históricamente, hasta el 20-10-2026, el conteo se guardaba en `localStorage` con la clave `inventario-session-v2` y esquema 3. Esa persistencia histórica es local al navegador y no se importa automáticamente al nuevo ciclo compartido. El generador del Excel final tampoco está implementado todavía. Las propuestas históricas de `docs/propuesta-ux-colaboracion.md` quedan subordinadas a las decisiones confirmadas de 3A. Las dudas de reunión se conservan en `archivos-externos/reuniones/dudas_inventario_por_area.xlsx`. La ruta de Pedido pertenece a un módulo separado y no forma parte de esta navegación de inventario.

La revisión del 20-10-2026 comprobó 1.151 filas de referencia contra el Excel original y encontró cero diferencias en ID, nombre, unidad y categoría. El catálogo tiene 1.227 entradas de conteo porque algunos productos aparecen en más de un sector o zona; 18 ítems anteriores de Barra siguen sin fila de salida y dos conversiones de Barra siguen sin equivalencia aprobada. Las pruebas y simulaciones, junto con su alcance, están en `docs/verification.md`.

## Conversiones conocidas y pendientes

- Chai en polvo: conteo y salida en KG. Al cargar una sesión antigua de Barra que guardó gramos, la cantidad se convierte a kilos.
- Syrups de 750 cc: conteo en CC; la salida en UN corresponde a `cc / 750`.
- Las unidades iguales, ignorando mayúsculas, mantienen factor 1; gramos a kilos tienen factor `0,001`.
- Las conversiones sin equivalencia confirmada se marcan como pendientes. No se inventan tamaños de envase.

## Contexto de ramas

`main` es la versión estable anterior de Inventario Barra; `warehouse-order` es la línea de Pedido a Bodega; `inventory-v2` conserva la base local anterior y `inventory-v3` es la evolución compartida actual. Las decisiones de `inventory-v2` reemplazan los límites de la versión anterior.

## Evaluación histórica de la siguiente etapa — 20-10-2026

La revisión de código confirma que Responsable es texto de sesión y no identidad por registro. La propuesta actualizada en [etapa-conteo-compartido.md](etapa-conteo-compartido.md) recomienda Workers + D1, usuarios individuales, conteo por ubicación con control de versión, historial y cierre previo a exportar. Son recomendaciones pendientes de implementación y validación operativa; no cambian todavía el funcionamiento local. Las 12 pruebas Node y el contrato de 1.151 filas volvieron a pasar en esta evaluación. No se verificó el despliegue remoto.

## Accesos y administración: análisis histórico, sustituido el 21-10-2026

En ese análisis previo el ingreso seguía abierto a evaluación. La decisión posterior confirmada es usuario personal y contraseña, sin verificación obligatoria por correo/teléfono. El usuario confirmó aislamiento de datos por área/subárea y administración global con historial, rectificaciones, activación operativa de productos, cierre y exportación. Ver [accesos-y-administracion.md](accesos-y-administracion.md), que distingue requisitos confirmados de alternativas. La estructura del Excel sigue siendo inmutable; desactivar un producto no autoriza eliminar su fila ni asignarle cero automáticamente.
