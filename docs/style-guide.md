# Guía de estilo UX/UI — inventory-v3

## Revisión vigente — 25-10-2026

Las decisiones de [inventarios y móvil](revision-inventarios-2026-10-25.md) prevalecen sobre descripciones históricas. Avisos que requieren acción persisten cerca del encabezado o al inicio del formulario; confirmaciones breves usan el aviso flotante superior. Nunca ubicar notificaciones al final de la página. Mensajes de sincronización breves y sin detalles técnicos.

No añadir bordes/anillos al foco táctil o selección; mantener indicación de teclado mediante cambios suaves de fondo o luminosidad en el control enfocado, sin subrayar texto. Campos editables de al menos 16 px, diálogos con foco inicial en título o Cancelar, sin abrir teclado por defecto. Estado del producto a la derecha de categoría/ubicación; retirar explicación de cero pendiente. Acciones Sin stock / Avance / Listo cerca del campo y, con teclado, en barra compacta sobre el espacio visible, sin duplicar controles ni perder borradores.

Supervisión muestra Servicio y Garzones en ramas desplegables con anillos y cifras reales, respetando permisos; la pestaña Áreas no necesita selector adicional de Área. Recomendación de inventario ámbar suave con X y colapso de 180 ms (inmediato con movimiento reducido), descartable durante el día por administrador.

El contexto usa «Inventario seleccionado» con fecha y estado pequeño (punto verde + Activo). Selector compacto y botón + Crear inventario en Inicio; dentro de áreas se trasladan al menú derecho. Historial en diálogo: búsqueda, año, agrupación mensual y 24 filas por página; foco inicial en título. Menú con inset uniforme de 12 px y filas táctiles de 44 px. Advertencia de duplicado inmediatamente encima de las acciones de confirmación. Al entrar al conteo se abre el listado izquierdo sin enfocar búsqueda; elegir un ítem cierra el panel.

## Revisión vigente — implementada localmente, 23-10-2026

[Contrato completo](decisiones-ux-y-operacion-2026-10-23.md). Títulos página/área 20 px/700, sección 16 px/600, cuerpo 14 px, secundario 12 px y campos 16 px; controles de al menos 44 px. Los títulos largos envuelven. Tonos crema/carbón/cian sin sombras ni degradados; Supervisión tiene más intensidad que resumen/cuenta/usuarios.

Resumen: encabezado y contabilizados sobre el bloque; anillo izquierdo de contados+avance con segmentos teal/ámbar, tres botones verticales de mínimo 52 px a la derecha con **punto, etiqueta y cifra en la misma línea**. Sin barra horizontal, responsable ni acciones antiguas. Categorías prácticas plegables con paginación y contexto preservado. Skeleton mientras faltan datos; countup de 420 ms solo al entrar por primera vez, omitido con movimiento reducido y sin anunciar cada paso al lector de pantalla.

Panel de supervisión: Áreas/Productos/Historial, contexto Inventario Global/Área, filas con 14 px de separación, anillos por área y consultas de 50 productos. Historial agrupado por producto/ubicación y días, sin segundos. Filtros Conteos/Correcciones/Anulaciones seleccionan productos; el detalle conserva toda su secuencia. Refresco visible no interrumpe formularios/diálogos. Regreso del resumen restaura filtros, páginas, expansión y scroll.

Motivos: obligatorio únicamente al reabrir, con sugerencias editables; rectificar/anular opcional, sin motivo para actividad/cerrar/finalizar. Diálogos con botones en la misma fila, cierre exterior con gesto completo fuera y Escape; sin confirmar al cerrarlos ni perder borradores/operación incierta.

Historial del trabajador: últimos diez movimientos mínimos, autor, cantidad y tiempo relativo (segundos/minutos/horas/Ayer; anteriores, hora con fecha accesible). Encargados/Administrador ven secuencia, antes/después y Anular conteo cuando corresponde.

Menú: sin avatar ni Compartido; Mi perfil junto al nombre con divisor, contraseña dentro del perfil, Cerrar sesión en rojo tenue al final. Nombres exactos: «Panel de supervisión» y «Gestionar usuarios y accesos». Refresco SVG cian18px sin recuadro, área44px y espera30s. Lista de cuentas primero y alta aparte en tres pasos; regenerador SVG lateral y entrega confirmada de accesos.

Avisos en el visualViewport al abrir teclado, cuatro segundos, cierre44px y swipe hacia arriba; tonos de estado sin sombra. Después de un guardado aceptado: salida izquierda160ms y entrada derecha180ms, sin carrusel y con alternativa inmediata de movimiento reducido. KISS obligatorio.

## Referencias históricas y componentes conservados

Las descripciones siguientes registran revisiones anteriores; el contrato vigente de arriba prevalece.

## Ajustes vigentes del 22-10-2026

Usuarios y accesos omite el subtítulo descriptivo. «Cuentas existentes» y el total filtrado comparten fila sobre el buscador. Crear usuario mantiene sus dos avisos finales en líneas separadas. Las tarjetas usan la misma cabecera compacta de nombre/usuario, rol/estado y chevrón; al abrirlas, tres pestañas separan **Cuenta**, **Accesos** y **Seguridad**. Solo se muestra un panel a la vez, conservando los campos escritos y las asignaciones al cambiar. Tab, flechas, Inicio/Fin y foco visible permiten navegar con teclado; la validación abre la pestaña del campo inválido.

Accesos presenta las áreas en una lista uniforme: Servicio y sus ramas con zonas se despliegan bajo demanda, sin repetir toda la ruta en cada fila. Se indica el número de asignaciones y el alcance heredado de una asignación completa; «Todo Servicio» enumera las subáreas incluidas. Restablecer contraseña y Eliminar usuario son bloques separados en Seguridad, con explicación breve y confirmación explícita; eliminar conserva su borde rojo y Cancelar como foco inicial. En cuentas mixtas, la jefa ve directamente solo Accesos y el aviso de límite. Los controles mantienen al menos 44 px, los temas crema/carbón, el cian y las alternativas de movimiento/transparencia reducidos.

Inicio conserva solo selectores con alternativas: un área entra a sus categorías, solo Servicio a sus subáreas y solo Garzones a sus zonas. Varias áreas mantienen Inicio. La jefa entra a Servicio sin flecha al menú global; las vistas interiores conservan un regreso útil. Copería aparece separada de Línea/Armado y Mercadito muestra la categoría Vitrina.

Roles visibles: Administrador, Jefa de servicio, Trabajador, sin coletilla de acceso global en el selector. En altas se conservan nombre visible y usuario; la edición administrativa muestra Usuario y el nombre visible solo como referencia. Mi perfil permite cambiar el nombre propio con el mismo encabezado en fila. Cuentas mixtas muestran únicamente los campos de accesos de Servicio a una jefa.

Eliminar usuario usa un diálogo nativo translúcido, foco inicial en Cancelar, Escape seguro y aviso explícito irreversible. La acción destructiva es de borde/texto rojo, con contraste específico oscuro; cancelar mantiene la cuenta. Una versión cambiada exige revisar de nuevo. El texto explica que conteos e historial se conservan. Los avisos anteriores se limpian al comenzar una nueva solicitud; no se muestra éxito antes de la respuesta.

El cambio obligatorio de contraseña temporal conserva su pantalla sin flecha de regreso al inventario. Para salir sin cambiarla se usa menú superior derecho → Cerrar sesión. El usuario confirmó mantener este comportamiento; perfil y cambio voluntario conservan su regreso normal.

## Dirección visual

La referencia de cinco pantallas entregada el 20 de octubre de 2026 define una interfaz móvil clara, compacta y luminosa: base **blanco crema**, acento cian, tarjetas de color suave, iconos de trazo simple y progreso visible. La revisión posterior elimina todos los degradados de fondos, tarjetas, botones y paneles. El modo oscuro conserva esa jerarquía sobre un **carbón profundo**; el cian ilumina controles y progreso sin volver azul el fondo. Se usa CSS nativo y tipografía del sistema.

La imagen es una referencia de diseño, no una fuente de cantidades, nombres de productos ni funciones nuevas. Esta rama mantiene sus cinco áreas y los flujos existentes de Servicio, ítems, resumen, envío y confirmación. El botón de cuatro cuadros redondeados, basado en el icono aportado por el usuario el 21-10-2026, abre desde la derecha el panel flotante de cuenta y ajustes. En ingreso sin sesión se conserva únicamente el toggle claro/oscuro, sin icono ni panel de menú. Con sesión, la identidad, sincronización, acciones de cuenta y tema se reúnen allí; no se repiten como tarjeta sobre el contenido. La lupa existente conserva su función y el panel de ítems sigue entrando desde la izquierda.

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

- **Inicio:** encabezado limpio y botón de menú a la derecha. Las cinco áreas se presentan en tarjetas con icono vectorial, nombre y flecha. El orden es Bodega / Principal, Cocina, Panadería, Pastelería y Servicio. No se muestran cifras de ejemplo de la referencia.
- **Áreas, sectores y zonas:** cuadrícula de tarjetas con márgenes, títulos legibles y barra de progreso alimentada por el conteo compartido autorizado. Servicio sigue pasando por sectores; Garzones muestra «Zonas» y los avances correspondientes. La barra cian representa ítems contados y la sección ámbar representa avances.
- **Conteo:** cabecera con regreso, título, barra de progreso y menú. La navegación mantiene «Anterior / Ver ítems / Siguiente» con acceso central al panel flotante. La ficha separa categoría, nombre, estado, cantidad y nota. Las acciones conservan el orden «Sin stock / Guardar avance / Listo» y los colores funcionales. Los campos usan fondo sólido y foco visible.
- **Panel de ítems:** conserva búsqueda por nombre, agrupación y acceso a ítems contados. Al abrirlo, solo queda desplegada la categoría del producto actual y la lista se sitúa en ese producto; las demás categorías empiezan cerradas, pero pueden abrirse manualmente. Desde una vista sin producto seleccionado, todas empiezan cerradas. La búsqueda despliega los grupos coincidentes y al limpiarla recupera los grupos abiertos manualmente. «Ver ítems» no enfoca el buscador; la lupa del encabezado sí. El campo permanece integrado en la superficie del panel, sin contorno de reposo. El ítem actual lleva una marca cian discreta.
- **Resumen:** el contrato vigente sustituye la barra, responsable y acciones antiguas por anillo combinado, estados y categorías.
- **Confirmación:** registros ajenos se resuelven mediante Descartar/Sumar/Sobrescribir, revisión de resultado y confirmación; no existe borrado compartido de progreso. Rojo se reserva para acciones destructivas explícitas, como eliminar cuenta conservando conteos/historial. La referencia visual no autoriza «Finalizar inventario» ni flujo de cierre todavía pendiente de 3B.

## Interacción, accesibilidad y tamaños

Los controles principales miden al menos 44 px de alto, con estados de foco perceptibles, nombres accesibles y texto legible sobre superficies translúcidas. Luna y sol son SVG para conservar forma y centrado en Android. El encabezado no usa borde de tarjeta. Los botones no cambian color ni relieve al pasar el puntero o pulsarlos. Volver, búsqueda y toggle no seleccionan su contenido ni conservan foco tras un toque. La navegación por teclado conserva `:focus-visible`. A 600 px o menos se reducen márgenes y tamaño de tarjetas; las categorías continúan en dos columnas, y bajo 380 px las tres acciones de conteo pasan a una columna. Nombres largos y zoom del sistema deben envolver sin cortar acciones ni cifras.

El aviso de guardado se presenta arriba como una pieza de vidrio coloreado de hasta 420 px y al menos 64 px de alto. Su fondo es de **color uniforme y translúcido, sin degradados**; el desenfoque y una sombra tenue aportan profundidad sin relieve marcado. Verde/teal confirma «Listo» y «Sin stock», ámbar confirma avance y rosa rojizo indica error; el texto mantiene contraste propio de cada tema. Entra desde arriba con desplazamiento corto y sale hacia arriba después de cuatro segundos, sin interceptar gestos. El panel lateral usa una curva suave de 340 ms. Con movimiento reducido se omiten estas animaciones; con transparencia reducida los fondos pasan a ser opacos. El movimiento vertical toma como referencia las entradas y salidas [slideInDown y slideOutUp de Animate.css](https://animate.style/), implementadas aquí con CSS local sin añadir la biblioteca.

## Alcance de datos

Esta guía no cambia productos, cantidades, ID, filas ni categorías de exportación. «Sin stock» sigue guardando cero con marca explícita `outOfStock`; un cero guardado con «Listo» sigue contado sin esa marca. No hay estados AM/PM ni una vista de Pedido en `inventory-v3`: se revisan en sus propias ramas antes de aplicarles esta guía.


## Etapa 3A — cuenta y colaboración

Se conserva el diseño de inventario. El panel derecho identifica persona, rol y sincronización. Reúne cambio de contraseña, cierre de sesión, tema y, para administradores, Usuarios y accesos. Formularios y diálogo usan superficies crema/carbón, cian, radios y foco visible. El diálogo nativo conserva Tab dentro, permite Escape conservando borrador y empieza en Descartar; ninguna suma/sobrescritura está preseleccionada. Muestra producto, ubicación legible, último autor, versión y tabla vigente/propuesto de cantidad, estado y nota. Cada acción de escritura exige revisar su resultado y confirmarlo. Sin stock no ofrece suma válida.

La fila de sincronización muestra primero el punto verde y «Sincronizado» y, al extremo derecho, un icono cian de actualizar de **18 px, sin fondo ni pastilla**. Su área táctil invisible conserva 44 × 44 px. Mientras consulta, el icono gira; movimiento reducido omite el giro. El punto pasa a cian durante la consulta, ámbar si hay borradores pendientes y rojo si falla; siempre se conserva una etiqueta de texto. El botón permite una comprobación manual cada **30 segundos por usuario en ese navegador**, compartida entre páginas y pestañas. Queda deshabilitado durante la consulta y la espera; el título informa cuándo podrá usarse. La espera no dispara una nueva consulta y también se aplica después de un error.

Actualizar no recarga formularios ni envía borradores. En Inventario comparte la consulta incremental con el sondeo y reutiliza un resultado aceptado de los últimos cinco segundos; no vuelve a descargar el catálogo ni ejecuta un bucle para recorrer el historial. En Inicio, Cuenta y Usuarios y accesos comprueba sesión/conexión, sin reconstruir los formularios abiertos. El sondeo existente conserva su cadencia y pausa al ocultarse la página.

El conteo conserva Guardar avance/Listo/Sin stock. Historial por producto es lectura para trabajadores; encargados autorizados pueden anular. Un resultado incierto protege los campos y ofrece Reintentar envío pendiente; no se etiqueta como sincronizado. Las notas agregadas se ven completas en Nota e Historial. El flujo antiguo Nuevo inventario fue retirado; no hay borrado compartido. Se añadió vista móvil de ingreso/cambio y administración mínima, sin tablero de supervisión.


### Ingreso y administración revisados — 21-10-2026

Ingreso, cambio de contraseña y Usuarios y accesos reutilizan los tokens `--ui-*`, tipografía del sistema, controles de 44–48 px, superficies crema/carbón y acento cian. Con sesión mantienen el menú SVG arriba a la derecha; el ingreso sin sesión usa únicamente el toggle de tema. No hay degradados ni realimentación de hover. El panel derecho de «Mi cuenta» reúne identidad y acciones, se cierra al tocar fuera o con Escape y devuelve el foco al botón de apertura. Los mensajes de disponibilidad no muestran un formulario de ingreso cuando falta la API o la inicialización de D1.

La contraseña puede mostrarse u ocultarse; el cambio exige repetirla y los errores reciben foco. La administración presenta cuentas plegables, búsqueda y alta separada. Cada asignación explica sus descendientes; restablecer contraseña requiere una confirmación que permite cancelar conservando el campo. Un envío en curso deshabilita la acción para evitar dobles toques.

La comparación distingue «Sin conteo», cero en avance, cero contado y «Sin stock». Antes de Sumar muestra operación y total; antes de Sobrescribir muestra el resultado. El historial usa etiquetas y fechas en español, preservando notas multilínea con autor. Verificación ejecutada a 320, 390 y 1024 px en ambos temas, sin desborde horizontal; Android físico, lector de pantalla y teclado virtual siguen pendientes.


### Carga y transiciones — 21-10-2026

Ingreso, Inicio, Inventario y Usuarios y accesos incluyen skeletons en el HTML inicial; el historial abre un diálogo con su estructura de carga antes de consultar. Son bloques uniformes crema/carbón con pulso leve de opacidad, sin degradados ni datos de otra sesión. No representan cantidades, progreso ni número real de cuentas. El área pendiente usa `aria-busy` y las formas decorativas quedan ocultas a tecnologías de asistencia. Tras cuatro segundos aparece una explicación de demora; errores retiran el estado de carga y mantienen el reintento donde corresponde. Nunca se impone una duración mínima ni se bloquea contenido listo por una animación.

Las vistas se revelan con un fundido de 180 ms; los diálogos entran en 180 ms con desplazamiento de 6 px y el panel de cuenta desde la derecha en 340 ms. Inventario aplica el efecto solo al cambiar de vista o producto. La sincronización sin cambios no redibuja categorías; un panel abierto o campo en edición se conserva. No hay efectos de hover o pulsación nuevos. Movimiento reducido deja los skeletons estáticos y omite fundidos, desplazamientos y giro de envío; transparencia reducida mantiene superficies opacas.

Ingresar, crear/restablecer cuentas, cambiar contraseña y guardar muestran una etiqueta de envío con indicador. En el conteo se protegen campos y navegación mientras se espera la respuesta; el éxito se anuncia después de la aceptación del servidor. Un resultado incierto conserva el borrador y ofrece el reintento seguro. El historial puede cerrarse mientras llega la respuesta sin que se vuelva a abrir ni se pierdan campos editados.

### Menú derecho y formularios compactos — 21-10-2026

El icono del encabezado tiene cuatro cuadros rellenos con esquinas redondeadas y usa el color del tema. El panel derecho reutiliza la superficie translúcida, desenfoque, radio de 22 px y curva de 340 ms del panel de ítems. El fondo queda inerte mientras está abierto; Tab permanece dentro, Escape/cierre/toque exterior restauran foco y el borrador no se vuelve a renderizar. Movimiento reducido omite desplazamientos y transparencia reducida usa fondo opaco. El tema se cambia dentro del panel y se conserva en el navegador; no se añaden ajustes ficticios.

En ingreso y cambio de contraseña, el candado queda a la izquierda y a su derecha la etiqueta personal y el título en dos niveles. Se retira la explicación «Usa tu cuenta…» y se centra la ayuda para contactar al administrador. El ojo SVG muestra/oculta cada contraseña y actualiza su icono, nombre accesible y estado. Cuenta y Administración usan la flecha superior izquierda para regresar, sin enlaces de regreso ni cierre de sesión duplicados bajo el formulario. El cambio obligatorio mantiene su restricción de navegación.

Por decisión del usuario, las nuevas contraseñas requieren **8 caracteres**; la ayuda de pantalla dice «Al menos 8 caracteres», sin unidades técnicas. El servidor y el generador del primer administrador conservan el máximo técnico de 72 bytes UTF-8, bcrypt coste 12 y rechazo sin truncamiento. La publicación no requiere migraciones ni cambia credenciales existentes.
