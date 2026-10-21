# AGENTS.md — inventory-v3

## Propósito

Este repositorio desarrolla `inventory-v3`: una aplicación web modular para gestionar inventario y, en una rama de trabajo separada, pedidos internos. No confundirlo con la aplicación anterior **Inventario Barra** ni trasladar automáticamente a esta rama sus límites de producto o su roadmap.

Para conocer estado, decisiones y trabajo pendiente, consulta `docs/project-context.md` y `docs/roadmap.md`. Para cambios de interfaz, lee también `docs/style-guide.md` y `docs/verification.md`. Este archivo contiene reglas de trabajo, no una copia del contexto completo.

## Cómo interpretar el proyecto

Antes de actuar, separa explícitamente:

- decisiones vigentes del usuario;
- comportamiento comprobable en el código de esta rama;
- trabajo pendiente o en exploración;
- contexto histórico de otras ramas y versiones.

El código muestra lo implementado, no necesariamente todas las decisiones de producto. La documentación expresa intención, pero puede quedar obsoleta. Si se contradicen, identifica la diferencia y no conviertas una inferencia en requisito.

## Ramas y alcance

El proyecto mantiene líneas de trabajo diferenciadas: `main` corresponde a la versión estable anterior de Inventario Barra; `warehouse-order` corresponde al trabajo de Pedido a Bodega; `inventory-v2` conserva la versión anterior al conteo compartido; `inventory-v3` continúa desde esa base e incorpora usuarios, permisos y conteo compartido con Workers + D1. Todo nuevo trabajo de esta funcionalidad pertenece a `inventory-v3`; no moverlo ni fusionarlo a `inventory-v2` sin solicitud explícita. Comprueba la rama antes de tareas que dependan de esa separación y no mezcles cambios entre ramas por conveniencia.

El objetivo vigente de `inventory-v3` es contar Cocina, Panadería, Pastelería, Servicio y Bodega Principal, y generar el archivo `inventarios_og/11_10-INVENTARIO-totalizado.xlsx` conservando su estructura, identificadores y datos de referencia; solo deben actualizarse las cantidades contadas. Servicio se cuenta en Barra, Armado/Línea/Copería, Mercadito y Garzones; Garzones distingue Zona Privada, Salón y Terraza. Los catálogos y la navegación pueden avanzar por etapas. No confundas una lista cargada con un flujo completo ni con sincronización entre teléfonos.

El módulo de Pedido está separado del módulo de Inventario. No asumir que sus datos, flujos o decisiones son intercambiables.

## Decisiones vigentes de interfaz en esta rama

- La referencia visual vigente usa blanco crema en modo claro y carbón profundo en modo oscuro, con acentos cian y superficies uniformes sin degradados. Las tarjetas de Inicio llevan tintes por área; no copies cifras de la imagen de referencia. El engranaje queda pendiente y el control de tema permanece arriba a la derecha. Rojo identifica pendiente y el botón «Sin stock» antes de guardar; amarillo identifica avance; verde/teal identifica contado y «Sin stock» ya guardado. Conserva las etiquetas de texto junto al color y el comportamiento de ambos temas. El detalle está en `docs/style-guide.md`.
- «Sin stock» guarda cantidad cero como contado y marca `outOfStock`; la insignia, el panel, el resumen y el aviso de guardado usan verde. El aviso dice «Sin stock guardado.». Un cero guardado con «Listo» no lleva esa marca.
- Al volver a un grupo se prioriza el primer ítem pendiente o con avance. La barra superior de conteo mantiene «Anterior / Ver ítems / Siguiente» y el panel de ítems permite acceder también a los ya contados.
- «Ver ítems» abre el panel sin enfocar el buscador ni activar el teclado móvil; la lupa del encabezado sí enfoca la búsqueda. En cada apertura, solo se despliega la categoría del producto actual y se sitúa el producto a la vista; desde una vista sin producto actual todos los grupos empiezan cerrados. Los botones no cambian color ni relieve al pasar el puntero o al pulsarlos; se conserva el foco visible para teclado. Volver y el toggle liberan el foco tras un toque. La luna y el sol se dibujan con SVG para conservar su apariencia entre plataformas. Al cambiar de vista o de producto se vuelve al inicio de la página.
- En el resumen, el encabezado solo conserva título y controles: no repetir allí la barra ni el contador y no añadir el subtítulo descriptivo. El progreso se concentra en la tarjeta de avance.
- El indicador breve del resumen es decorativo: el contenido está disponible de inmediato, no intercepta interacción y se omite con movimiento reducido. Los avisos superiores usan color uniforme translúcido, sin degradados; duran cuatro segundos, entran desde arriba y salen hacia arriba, no bloquean gestos y tienen alternativa opaca para transparencia reducida.
- En `inventory-v3` no existen estados AM/PM ni el flujo de Pedido; verifica la rama correspondiente antes de cambiar esas funciones. No incluyas el nombre del empleador en textos de la app o documentación pública.

## Inspección antes de editar

1. Lee las instrucciones aplicables y los archivos pertinentes.
2. Revisa rama, estado de Git y diff existente antes de modificar.
3. Inspecciona las rutas reales. No uses rutas, nombres de campos, claves de almacenamiento, versiones de esquema o cantidades del proyecto anterior sin verificarlas en este checkout.
4. Protege cambios del usuario. No reemplaces archivos con cambios previos sin entenderlos.
5. Si el alcance o una decisión de producto no está claro, continúa las comprobaciones independientes y pregunta solo cuando la respuesta cambie sustancialmente el resultado.

## Implementación

- Mantén cambios acotados al objetivo solicitado.
- Sigue la estructura modular existente bajo `pages/` y `data/`.
- Conserva HTML, CSS y JavaScript nativos mientras resuelvan el problema.
- Workers + D1, autenticación y colaboración 3A ya forman parte de esta rama. No incorpores integraciones o dependencias adicionales por anticipado. Las áreas y sus catálogos pertenecen al objetivo vigente.
- Mantén identificadores y datos existentes salvo que el cambio solicitado los requiera.
- Mantén separados los grupos para contar (`countCategory`) de la categoría y demás datos de salida (`exportCategory`, hoja, fila, ID y unidad). En Bodega / Principal, Cocina, Panadería y Pastelería los grupos prácticos se definen por fila en `data/inventario/items/`; cada fila de su hoja debe aparecer exactamente una vez. Reorganizar la pantalla nunca debe cambiar la referencia del Excel.
- Prioriza uso móvil, controles claros, lectura rápida y prevención de pérdida accidental de datos.

## Git y entrega

- No ejecutes `commit`, `push`, `reset`, limpieza destructiva ni publicación salvo solicitud explícita.
- Después de editar, revisa `git diff` y `git status`.
- Ejecuta solo las validaciones pertinentes y solicitadas para el cambio. Describe con precisión qué se comprobó y qué no.

## Documentación

- `README.md`: entrada breve y estructura real del repositorio.
- `docs/project-context.md`: contexto, decisiones, implementación observada y dudas abiertas.
- `docs/roadmap.md`: prioridades, dependencias y criterios de avance.
- `docs/verification.md`: comandos, resultados comprobados y límites de las pruebas.
- `docs/style-guide.md`: identidad visual, componentes, estados, tamaños y accesibilidad.
- `AGENTS.md`: reglas de trabajo para agentes.

Marca como pendiente lo que no esté implementado o decidido. Actualiza la documentación cuando cambie el estado o una decisión; no perpetúes cifras ni descripciones de versiones antiguas.
