# Guía de estilo UX/UI — inventory-v2

## Alcance e identidad

La interfaz sirve al conteo rápido en teléfono. Su identidad actual usa grises neutros, gradientes CSS y superficies translúcidas. Los efectos de vidrio aportan profundidad; los datos y controles se leen sobre fondos suficientemente sólidos. Esta guía describe la rama `inventory-v2` y no define el módulo separado de Pedido.

## Fundamentos visuales

Los tokens compartidos viven en `theme.css`. La misma escala se usa en Inicio, áreas, sectores, categorías, ítems, resumen y modal. El modo oscuro cambia los valores del token sin cambiar la estructura de las vistas.

| Uso | Claro | Oscuro |
| --- | --- | --- |
| Texto principal | `#242429` | `#ededed` |
| Texto secundario | `#5d5e66` | `#b8b8b8` |
| Fondo base | Gradiente `#f2f2f4` → `#dedee2` | Gradiente carbón `#252525` → `#1b1b1b` |
| Superficie de tarjeta | Gradiente blanco y gris claro translúcidos | Gradiente de grises `#313131` → `#222222` translúcidos |
| Acción principal | Gradiente gris oscuro translúcido | Gradiente gris claro `#c4c4c4` → `#9d9d9d` translúcido |
| Borde de tarjetas | Gris al 17 % | Blanco al 7 % |

Se usa la fuente del sistema y una jerarquía corta: título de pantalla, nombre de categoría o producto, dato secundario, unidad y estado. Los radios de las superficies principales son de 16 a 20 px; botones y campos usan 11 a 12 px. Los encabezados y los botones de tema y búsqueda no tienen contorno de tarjeta. El botón de tema dibuja luna y sol mediante SVG para conservar forma, tamaño y centrado en Android; el sol aparece blanco en modo oscuro. La sombra es tenue. Si el sistema pide menos transparencia, las superficies pasan a ser opacas. El desenfoque de 10 px se aplica solo donde el navegador lo soporta.

## Componentes y comportamiento

- **Navegación:** Inicio muestra las cinco áreas sin texto introductorio. Servicio abre sectores sin repetir el título y Garzones abre «Zonas», con contador y barra para los 16 ítems de cada zona. Las tarjetas tienen margen interior, radio, gradiente de vidrio y foco visible. Al abrir un grupo o volver a una zona se prioriza el primer ítem pendiente o con avance; los contados siguen accesibles por el panel y el resumen. Al cambiar de vista o de ítem, la página vuelve arriba para que el encabezado y el producto actual queden a la vista.
- **Conteo:** la barra superior une «Anterior», «Ver ítems» y «Siguiente» en tres secciones iguales sin divisores visibles, con «Ver ítems» fijado al centro; en el último ítem, la acción derecha indica su destino. La tarjeta separa nombre, ubicación, estado, cantidad con unidad y nota. Las acciones son «Sin stock», «Guardar avance» y «Listo», en ese orden. El panel lateral conserva búsqueda, agrupación y regreso al ítem actual. «Ver ítems» enfoca el panel sin activar el teclado; el botón de búsqueda del encabezado abre ese mismo panel y enfoca el campo. El buscador se integra con el gris del panel en reposo y aclara su fondo al recibir foco, sin borde ni sombra; en modo oscuro el fondo cambia entre dos grises del panel sin añadir un anillo. Un aviso aparece arriba durante cuatro segundos sin bloquear la pantalla: glassmorphism discreto con tinte ámbar al guardar avance, verde al guardar un conteo o «Sin stock» y rojo ante errores; usa texto blanco, desenfoque alto, borde muy tenue y entrada breve.
- **Progreso y estado:** la base visual usa grises. Los colores funcionales mate se conservan en botones y estados: rojo para «Sin stock» y pendiente, amarillo para avance y verde para contado. Siempre acompañan texto. «Sin stock» guarda cantidad 0 y estado contado con marca explícita; un cero guardado con «Listo» sigue contado sin esa marca; una cantidad vacía sigue pendiente.
- **Resumen:** muestra siempre un título y una frase orientadora. Las tres tarjetas de estado abren sus listas; el estado parcial se llama «Avance». Copiar y enviar siguen requiriendo responsable. “Nuevo inventario” mantiene confirmación antes de borrar la sesión local.
- **Carga breve:** al abrir el resumen se dibuja el contenido inmediatamente. Un indicador decorativo se muestra durante 650 ms y no intercepta gestos ni foco; con `prefers-reduced-motion: reduce` no aparece. No se anuncia como carga real a tecnología asistiva porque no bloquea trabajo.

## Accesibilidad y tamaños

Los controles interactivos tienen al menos 44 px de alto donde se tocan con frecuencia. Los enlaces y botones usan un anillo de foco de 3 px. El buscador del panel usa el cambio de fondo como señal de foco, según la revisión visual solicitada; su claridad con teclado queda pendiente de validación con personas usuarias. Los estados conservan texto además de color. El contenido debe tolerar nombres largos, zoom del sistema y anchos desde 320 px; las categorías siguen en dos columnas móviles y los botones de conteo pasan a una columna bajo 380 px. En modo oscuro los campos son sólidos para mantener legibles las cantidades.

## Límites del alcance actual

Los conteos y referencias del Excel no se alteran por esta guía. La rama actual no contiene estados AM/PM ni una vista local de Pedido; sus reglas se deben revisar en la rama donde existan antes de aplicar cambios allí. La colaboración entre teléfonos y la exportación del libro siguen pendientes según `project-context.md`.
