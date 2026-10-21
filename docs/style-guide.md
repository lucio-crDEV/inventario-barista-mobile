# Guía de estilo UX/UI — inventory-v3

## Dirección visual

La referencia de cinco pantallas entregada el 20 de octubre de 2026 define una interfaz móvil clara, compacta y luminosa: base **blanco crema**, acento cian, tarjetas de color suave, iconos de trazo simple y progreso visible. La revisión posterior elimina todos los degradados de fondos, tarjetas, botones y paneles. El modo oscuro conserva esa jerarquía sobre un **carbón profundo**; el cian ilumina controles y progreso sin volver azul el fondo. Se usa CSS nativo y tipografía del sistema.

La imagen es una referencia de diseño, no una fuente de cantidades, nombres de productos ni funciones nuevas. Esta rama mantiene sus cinco áreas y los flujos existentes de Servicio, ítems, resumen, envío y confirmación. No se incorpora el engranaje ni una pantalla de ajustes. En el encabezado, el único control de tema es el toggle claro/oscuro situado arriba a la derecha; la lupa de búsqueda existente aparece únicamente donde su función ya está disponible.

## Tokens

Los valores aplicados viven en `theme.css`. Las páginas cargan esa hoja después de sus estilos base y `theme.js` actualiza el color de la barra del navegador.

| Uso | Claro | Oscuro |
| --- | --- | --- |
| Fondo uniforme | Blanco crema `#faf8f3` | Carbón profundo `#111315` |
| Texto principal | `#142b4d` | `#f0f6f8` |
| Texto secundario | `#526c8a` | `#b1c2cb` |
| Superficie uniforme | Blanco cálido `rgb(255 254 250 / 88%)` | Carbón `rgb(29 32 34 / 90%)` |
| Superficie opaca | `#fffefa` | `#1d2022` |
| Acento | `#00738e` | `#38d6e5` |
| Progreso y acción principal | Cian `#07bfd0` / `#08c2d2` uniforme | Cian `#1bc9d9` / `#19c7d8` uniforme |
| Foco visible | `#007f9d` | `#66e4ef` |

Los bordes de tarjeta son tenues (gris cálido al 12 % en claro, blanco azulado al 10 % en oscuro), con radios de 16–18 px y sombras suaves. El desenfoque refuerza la superposición del menú, el modal y las superficies; nunca sustituye un fondo legible. En `prefers-reduced-transparency: reduce` se usan superficies opacas. En `prefers-reduced-motion: reduce` se desactivan transiciones decorativas.

## Color con significado

El cian identifica navegación, progreso y acciones generales. **Rojo** señala pendientes y el botón «Sin stock» antes de confirmar; **amarillo/ámbar** señala avance; **verde/teal** señala contado y «Sin stock» ya guardado. La insignia del producto, su punto y etiqueta en el panel, y su icono y cantidad en el resumen usan verde para «Sin stock» guardado. Los avisos de «Listo» y «Sin stock» son verdes porque ambas operaciones guardan un conteo. Cada estado mantiene texto además de color. Las tarjetas de Inicio pueden usar tintes propios por área: cian para Bodega, azul para Cocina, ámbar para Panadería, rosa para Pastelería y verde agua para Servicio; estos tintes no cambian el estado de sus ítems.

## Pantallas y componentes

- **Inicio:** encabezado limpio y toggle de tema a la derecha. Las cinco áreas se presentan en tarjetas con icono vectorial, nombre y flecha. El orden es Bodega / Principal, Cocina, Panadería, Pastelería y Servicio. No se muestran cifras de ejemplo de la referencia.
- **Áreas, sectores y zonas:** cuadrícula de tarjetas con márgenes, títulos legibles y barra de progreso alimentada por el conteo compartido autorizado. Servicio sigue pasando por sectores; Garzones muestra «Zonas» y los avances correspondientes. La barra cian representa ítems contados y la sección ámbar representa avances.
- **Conteo:** cabecera con regreso, título, barra de progreso y toggle. La navegación mantiene «Anterior / Ver ítems / Siguiente» con acceso central al panel flotante. La ficha separa categoría, nombre, estado, cantidad y nota. Las acciones conservan el orden «Sin stock / Guardar avance / Listo» y los colores funcionales. Los campos usan fondo sólido y foco visible.
- **Panel de ítems:** conserva búsqueda por nombre, agrupación y acceso a ítems contados. Al abrirlo, solo queda desplegada la categoría del producto actual y la lista se sitúa en ese producto; las demás categorías empiezan cerradas, pero pueden abrirse manualmente. Desde una vista sin producto seleccionado, todas empiezan cerradas. La búsqueda despliega los grupos coincidentes y al limpiarla recupera los grupos abiertos manualmente. «Ver ítems» no enfoca el buscador; la lupa del encabezado sí. El campo permanece integrado en la superficie del panel, sin contorno de reposo. El ítem actual lleva una marca cian discreta.
- **Resumen:** encabezado compacto con regreso, título y toggle; se ocultan su barra y contador para evitar duplicar el avance. Se elimina el subtítulo descriptivo. El anillo vectorial sin degradado y la barra cian muestran `contados / total` real; las tres tarjetas de pendientes, avance y contados abren las listas existentes. Se mantienen responsable, copiar, enviar, regreso y nuevo inventario. El indicador de transición sigue siendo decorativo y no bloquea acciones.
- **Confirmación:** el modal destaca el riesgo con ámbar y reserva el rojo para borrar el progreso. La acción de cancelar permanece visible. La referencia visual no autoriza un botón de «Finalizar inventario» ni modifica el texto o la lógica de borrado actual.

## Interacción, accesibilidad y tamaños

Los controles principales miden al menos 44 px de alto, con estados de foco perceptibles, nombres accesibles y texto legible sobre superficies translúcidas. Luna y sol son SVG para conservar forma y centrado en Android. El encabezado no usa borde de tarjeta. Los botones no cambian color ni relieve al pasar el puntero o pulsarlos. Volver, búsqueda y toggle no seleccionan su contenido ni conservan foco tras un toque. La navegación por teclado conserva `:focus-visible`. A 600 px o menos se reducen márgenes y tamaño de tarjetas; las categorías continúan en dos columnas, y bajo 380 px las tres acciones de conteo pasan a una columna. Nombres largos y zoom del sistema deben envolver sin cortar acciones ni cifras.

El aviso de guardado se presenta arriba como una pieza de vidrio coloreado de hasta 420 px y al menos 64 px de alto. Su fondo es de **color uniforme y translúcido, sin degradados**; el desenfoque y una sombra tenue aportan profundidad sin relieve marcado. Verde/teal confirma «Listo» y «Sin stock», ámbar confirma avance y rosa rojizo indica error; el texto mantiene contraste propio de cada tema. Entra desde arriba con desplazamiento corto y sale hacia arriba después de cuatro segundos, sin interceptar gestos. El panel lateral usa una curva suave de 340 ms. Con movimiento reducido se omiten estas animaciones; con transparencia reducida los fondos pasan a ser opacos. El movimiento vertical toma como referencia las entradas y salidas [slideInDown y slideOutUp de Animate.css](https://animate.style/), implementadas aquí con CSS local sin añadir la biblioteca.

## Alcance de datos

Esta guía no cambia productos, cantidades, ID, filas ni categorías de exportación. «Sin stock» sigue guardando cero con marca explícita `outOfStock`; un cero guardado con «Listo» sigue contado sin esa marca. No hay estados AM/PM ni una vista de Pedido en `inventory-v3`: se revisan en sus propias ramas antes de aplicarles esta guía.


## Etapa 3A — cuenta y colaboración

Se conserva el diseño de inventario. Una franja compacta identifica persona, rol, modo Compartido, sincronización, cambio de contraseña y cierre de sesión; administradores acceden desde allí a Usuarios y accesos. Formularios y diálogo usan superficies crema/carbón, cian, radios y foco visible. El diálogo nativo conserva Tab dentro, permite Escape conservando borrador y empieza en Descartar; ninguna suma/sobrescritura está preseleccionada. Muestra producto, ubicación legible, último autor, versión y tabla vigente/propuesto de cantidad, estado y nota. Cada acción de escritura exige revisar su resultado y confirmarlo. Sin stock no ofrece suma válida.

El conteo conserva Guardar avance/Listo/Sin stock. Historial por producto es lectura. Un resultado incierto protege los campos y ofrece Reintentar envío pendiente; no se etiqueta como sincronizado. Las notas agregadas se ven completas en Nota e Historial. Nuevo inventario queda deshabilitado con referencia a 3B; no hay borrado compartido. Se añadió vista móvil de ingreso/cambio y administración mínima, sin tablero de supervisión.


### Ingreso y administración revisados — 21-10-2026

Ingreso, cambio de contraseña y Usuarios y accesos reutilizan los tokens `--ui-*`, tipografía del sistema, controles de 44–48 px, superficies crema/carbón y acento cian. Mantienen el toggle SVG arriba a la derecha, sin degradados ni realimentación de hover. La barra de identidad muestra nombre y rol; «Mi cuenta» reúne sus acciones en un menú que se cierra al tocar fuera o con Escape. Los mensajes de disponibilidad no muestran un formulario de ingreso cuando falta la API o la inicialización de D1.

La contraseña puede mostrarse u ocultarse; el cambio exige repetirla y los errores reciben foco. La administración presenta cuentas plegables, búsqueda y alta separada. Cada asignación explica sus descendientes; restablecer contraseña requiere una confirmación que permite cancelar conservando el campo. Un envío en curso deshabilita la acción para evitar dobles toques.

La comparación distingue «Sin conteo», cero en avance, cero contado y «Sin stock». Antes de Sumar muestra operación y total; antes de Sobrescribir muestra el resultado. El historial usa etiquetas y fechas en español, preservando notas multilínea con autor. Verificación ejecutada a 320, 390 y 1024 px en ambos temas, sin desborde horizontal; Android físico, lector de pantalla y teclado virtual siguen pendientes.
