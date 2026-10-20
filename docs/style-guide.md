# Guía de estilo UX/UI — inventory-v2

## Dirección visual

La referencia de cinco pantallas entregada el 20 de octubre de 2026 define una interfaz móvil clara, compacta y luminosa: base azul hielo, acento cian, tarjetas de color suave, iconos de trazo simple y progreso visible. El modo oscuro conserva esa jerarquía sobre un **gris carbón**; el cian ilumina controles y progreso sin volver azul el fondo. Se usa CSS nativo y tipografía del sistema.

La imagen es una referencia de diseño, no una fuente de cantidades, nombres de productos ni funciones nuevas. Esta rama mantiene sus cinco áreas y los flujos existentes de Servicio, ítems, resumen, envío y confirmación. No se incorpora el engranaje ni una pantalla de ajustes. En el encabezado, el único control de tema es el toggle claro/oscuro situado arriba a la derecha; la lupa de búsqueda existente aparece únicamente donde su función ya está disponible.

## Tokens

Los valores aplicados viven en `theme.css`. Las dos páginas cargan esa hoja después de sus estilos base y `theme.js` actualiza el color de la barra del navegador.

| Uso | Claro | Oscuro |
| --- | --- | --- |
| Fondo | Gradiente `#edf9fc` → `#dceef6` | Gradiente gris carbón `#283137` → `#1b2227` |
| Texto principal | `#142b4d` | `#f0f6f8` |
| Texto secundario | `#526c8a` | `#b1c2cb` |
| Superficie | Blanco azulado translúcido, 70–88 % | Grises `#384146` → `#262e33` translúcidos |
| Campo sólido | `#f7fcfe` | `#293238` |
| Acento | `#00738e` | `#38d6e5` |
| Progreso y acción principal | Cian `#07bfd0`; gradiente `#08c2d2` → `#00a9c5` | Cian `#1bc9d9`; gradiente `#19c7d8` → `#00a9bd` |
| Foco visible | `#007f9d` | `#66e4ef` |

Los bordes de tarjeta son tenues (azul al 18 % en claro, blanco azulado al 10 % en oscuro), con radios de 16–18 px y sombras suaves. El desenfoque refuerza la superposición del menú, el modal y las superficies; nunca sustituye un fondo legible. En `prefers-reduced-transparency: reduce` se usan superficies opacas. En `prefers-reduced-motion: reduce` se desactivan transiciones decorativas.

## Color con significado

El cian identifica navegación, progreso y acciones generales. Los estados y acciones de conteo conservan su semántica previa: **rojo** para pendiente y «Sin stock»; **amarillo/ámbar** para avance; **verde/teal** para contado y «Listo». Los avisos de guardado de «Listo» y «Sin stock» siguen siendo verdes porque ambas operaciones guardan un conteo. Cada estado mantiene texto además de color. Las tarjetas de Inicio pueden usar tintes propios por área: cian para Bodega, azul para Cocina, ámbar para Panadería, rosa para Pastelería y verde agua para Servicio; estos tintes no cambian el estado de sus ítems.

## Pantallas y componentes

- **Inicio:** encabezado limpio y toggle de tema a la derecha. Las cinco áreas se presentan en tarjetas con icono vectorial, nombre y flecha. El orden es Bodega / Principal, Cocina, Panadería, Pastelería y Servicio. No se muestran cifras de ejemplo de la referencia.
- **Áreas, sectores y zonas:** cuadrícula de tarjetas con márgenes, títulos legibles y barra de progreso alimentada por el conteo local. Servicio sigue pasando por sectores; Garzones muestra «Zonas» y los avances correspondientes. La barra cian representa ítems contados y la sección ámbar representa avances.
- **Conteo:** cabecera con regreso, título, barra de progreso y toggle. La navegación mantiene «Anterior / Ver ítems / Siguiente» con acceso central al panel flotante. La ficha separa categoría, nombre, estado, cantidad y nota. Las acciones conservan el orden «Sin stock / Guardar avance / Listo» y los colores funcionales. Los campos usan fondo sólido y foco visible.
- **Panel de ítems:** conserva búsqueda por nombre, agrupación y acceso a ítems contados. Al abrirlo, solo queda desplegada la categoría del producto actual y la lista se sitúa en ese producto; las demás categorías empiezan cerradas, pero pueden abrirse manualmente. Desde una vista sin producto seleccionado, todas empiezan cerradas. La búsqueda despliega los grupos coincidentes y al limpiarla recupera los grupos abiertos manualmente. «Ver ítems» no enfoca el buscador; la lupa del encabezado sí. El campo permanece integrado en la superficie del panel, sin contorno de reposo. El ítem actual lleva una marca cian discreta.
- **Resumen:** el anillo y la barra cian muestran `contados / total` real; las tres tarjetas de pendientes, avance y contados abren las listas existentes. Se mantienen responsable, copiar, enviar, regreso y nuevo inventario. El indicador de transición sigue siendo decorativo y no bloquea acciones.
- **Confirmación:** el modal destaca el riesgo con ámbar y reserva el rojo para borrar el progreso. La acción de cancelar permanece visible. La referencia visual no autoriza un botón de «Finalizar inventario» ni modifica el texto o la lógica de borrado actual.

## Interacción, accesibilidad y tamaños

Los controles principales miden al menos 44 px de alto, con estados de foco perceptibles, nombres accesibles y texto legible sobre superficies translúcidas. Luna y sol son SVG para conservar forma y centrado en Android. El encabezado no usa borde de tarjeta. A 600 px o menos se reducen márgenes y tamaño de tarjetas; las categorías continúan en dos columnas, y bajo 380 px las tres acciones de conteo pasan a una columna. Nombres largos y zoom del sistema deben envolver sin cortar acciones ni cifras.

El aviso de guardado se presenta arriba como una pieza de vidrio coloreado de hasta 420 px y al menos 64 px de alto. Su fondo es de **color uniforme y translúcido, sin degradados**; el desenfoque y una sombra tenue aportan profundidad sin relieve marcado. Verde/teal confirma «Listo» y «Sin stock», ámbar confirma avance y rosa rojizo indica error; el texto mantiene contraste propio de cada tema. Entra desde arriba con desplazamiento corto y sale hacia arriba después de cuatro segundos, sin interceptar gestos. El panel lateral usa una curva suave de 340 ms. Con movimiento reducido se omiten estas animaciones; con transparencia reducida los fondos pasan a ser opacos. El movimiento vertical toma como referencia las entradas y salidas [slideInDown y slideOutUp de Animate.css](https://animate.style/), implementadas aquí con CSS local sin añadir la biblioteca.

## Alcance de datos

Esta guía no cambia productos, cantidades, ID, filas ni categorías de exportación. «Sin stock» sigue guardando cero con marca explícita `outOfStock`; un cero guardado con «Listo» sigue contado sin esa marca. No hay estados AM/PM ni una vista local de Pedido en `inventory-v2`: se revisan en sus propias ramas antes de aplicarles esta guía.
