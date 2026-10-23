# Decisiones de revisión UX y operación — 23-10-2026

Estado: implementado localmente en la revisión UX sobre e1c8a06, sin publicación ni cambios remotos. La versión requiere 0007_operation_ux.sql después de 0006. Este documento prevalece sobre las descripciones históricas. Ver [pruebas y límites](verification.md) y [publicación manual](publicar-revision-ux-0007.md).

## Regla de oro del Excel — obligatoria

Hasta una instrucción explícita posterior del usuario, **solo se actualizan las celdas destinadas al conteo en una copia del libro de referencia**. El libro original es de solo lectura y debe conservarse intacto.

- La salida mantiene hojas, nombres y orden, filas/columnas, ID, nombres de productos, unidades, categorías de exportación, referencias, fórmulas, formatos y demás estructura del libro. No se agrega, elimina, reordena, renombra ni normaliza esa información por iniciativa del programa.
- Solo se escriben cantidades de conteo en las celdas de entrada autorizadas y verificadas para la plantilla. No se reemplazan fórmulas por cantidades. Consolidaciones y conversiones requieren correspondencias y unidades aprobadas; no se adivinan por parecido de nombre.
- Reagrupar la UI o desactivar un producto no elimina su fila, no cambia su referencia y no confirma cero. Productos de nombre repetido conservan sus identidades y ubicaciones; no se deduplican por nombre.
- Una cantidad desconocida, un avance, un producto inactivo o una conversión pendiente no se convierten automáticamente en cero. La política de celdas sin dato vigente se resolverá en etapa 4 antes de implementar la exportación.
- La futura aceptación de la salida exige comprobar que el original no cambió y comparar la estructura y contenido de la copia con la plantilla, permitiendo diferencias únicamente en las celdas de conteo autorizadas. No basta con que el archivo abra en Excel.

Etapa 4 sigue pendiente. Finalizar y enviar en la app no genera ni transmite un Excel.

### Fase 5 o evolución futura de plantillas

Registrar como trabajo futuro la adaptación a otra versión del Excel o a un libro similar. Deberá identificar/versionar la plantilla, revisar diferencias y correspondencias, validar unidades y preservar la trazabilidad de inventarios anteriores. Una plantilla desconocida requiere revisión antes de exportar; no se adapta silenciosamente. Tras varios meses podrá evaluarse un rediseño del libro con autorización expresa. Esta previsión no autoriza modificar hoy el libro ni relaja la regla de oro.

## Cierre, finalización y reapertura — decisión confirmada

Se conservan los roles actuales: Administrador, Jefa de servicio y Trabajador. Los posibles jefes de Cocina, Pastelería o Panadería quedan como idea futura, sin crear roles ni ampliar permisos ahora.

| Estado del alcance | Trabajador | Jefa de servicio, solo Servicio | Administrador |
| --- | --- | --- | --- |
| Abierto | Conteo normal autorizado | Conteo y supervisión | Conteo y supervisión |
| Cerrado para revisión | Sin conteos nuevos | Revisa, completa, corrige/anula; puede reabrir con motivo | Revisa y puede reabrir con motivo |
| Finalizado y enviado | Sin conteos nuevos | Sin cambios y sin permiso de reapertura | Puede reabrir con motivo |

Cerrar congela la edición normal y habilita la revisión de encargados. Finalizar y enviar representa una finalización interna del alcance, sin envío externo. Exige todos sus productos activos contados, sin pendientes ni avances. Sin stock sigue siendo cero contado explícito.

La jefa puede cerrar, revisar y finalizar únicamente Servicio; **mientras Servicio esté finalizado, solo un Administrador puede reabrirlo**. Antes de finalizar, la jefa sí puede reabrir Servicio. Todo permiso se verifica en servidor y en las guardias transaccionales; ocultar un botón no satisface esta regla. La API y los triggers rechazan nuevas reaperturas de finalizados por una jefa; los reintentos de operaciones ya aceptadas conservan su resultado.

Servicio mantiene estado propio; sus cambios no reabren otras áreas. Un Administrador puede reabrir el alcance autorizado en cualquier etapa, registrando motivo. Tras una reapertura administrativa se puede realizar otra revisión y finalización; cada transición conserva actor, alcance, fecha y estado anterior/posterior.

| Acción | Motivo |
| --- | --- |
| Reabrir, para cualquier rol habilitado | Obligatorio |
| Rectificar o Anular conteo | Opcional |
| Cerrar; Finalizar y enviar | Sin campo de motivo ni checkbox |
| Activo/Inactivo | Sin campo de motivo |

La reapertura ofrece sugerencias como «Revisar conteos» y «Completar productos», que rellenan un campo de texto editable. Siempre se puede escribir un motivo diferente. No hay motivo preseleccionado ni texto de placeholder guardado automáticamente. La auditoría conserva actor/fecha/acción aunque la acción no solicite motivo.

## Activo/Inactivo por área — requisito prioritario confirmado

El switch se mantiene entre inventarios hasta que se cambie y afecta al producto en esa área. Oculta los inactivos del conteo normal y conserva su identidad y referencia al Excel; supervisión permite consultarlos y reactivarlos. No es un borrado ni un cero.

Registrar desactivaciones/reactivaciones, actor y fecha desde la incorporación de la función. La gestión de productos que llevan tres, seis o más meses inactivos es un requerimiento prioritario de la jefa; el informe puede desarrollarse después, pero debe contar con historia desde el inicio. No inventar antigüedad anterior sin evidencia. Se separa este historial operativo de las métricas técnicas Root, que siguen pendientes. Implementado con item_activity e item_activity_events, usando área e identidad exacta del producto, sin unir por nombre. La migración conserva la decisión anterior más reciente comprobable; si no hay fecha fiable, la fecha de migración es solo el inicio conocido, sin atribuir meses previos. Las cantidades de cada ciclo permanecen intactas.

## Resumen y supervisión — implementación local

- Supervisión separa Áreas, Productos e Historial; contexto compacto, etiquetas «Inventario Global» y «Área», sin filtro por fechas ni botón grande de Actualizar. El refresco automático conserva formularios, filtros, paginación y posición. Historial agrupado por producto/ubicación y días, sin segundos; Conteos, Correcciones y Anulaciones filtran ítems con al menos un movimiento del tipo. Sumar es Conteo. Se mantienen la secuencia completa y el antes/después dentro de cada ítem.
- Resumen retira responsable, Copiar resumen, Enviar, Ver categorías y Nuevo inventario, con sus eventos, validaciones, texto de compartir y reinicio local obsoletos. La autoría autenticada, guardados compartidos y borradores permanecen.
- «Avance del área» y «X de Y ítems contabilizados» quedan sobre el bloque. Anillo a la izquierda, tres recuadros a la derecha, algo más altos (mínimo 52 px) y con más espacio: punto, etiqueta y cifra en la misma línea. Bordes redondeados; no conservar dos variantes de los recuadros.
- El anillo representa `(contados + avance) / activos`, con segmentos de verde/teal y ámbar. «Contabilizados» identifica solo contados. Finalizar exige contados, no el porcentaje combinado. Sin barra horizontal redundante.
- Estados seleccionables y productos por categorías prácticas, como Ver ítems. Agrupar no modifica ID, unidad, ubicación ni exportCategory. Conservar selección, categorías abiertas y posición al volver/sincronizar.
- Skeleton inmediato mientras falta información. Con los datos aceptados, animación numérica breve y creciente desde cero, solo en la primera presentación, sin imponer demora de carga ni bloquear acciones. Los cálculos/permisos usan el valor final real durante la animación; no se modifica el dato almacenado. No reiniciar desde cero en cada sondeo. Movimiento reducido muestra directamente la cifra final; lector de pantalla recibe la cifra final sin anunciar pasos intermedios. Otros bloques aún pendientes conservan su skeleton.

## Historial del producto y modales

Decisión confirmada: responsables y Administradores ven el detalle del mismo esquema de supervisión dentro de sus alcances y disponen de «Anular conteo» cuando el estado lo permite. Reutilizar el comando, control de versión, idempotencia, confirmación y motivo opcional de supervisión; no implementar una segunda anulación distinta. En finalizado se requiere reapertura administrativa antes de anular.

Trabajador: últimos diez movimientos mínimos del ítem autorizado (autor visible, tiempo relativo y cantidad/unidad resultante), útiles para evitar duplicaciones al contar en equipo, sin motivos administrativos, datos técnicos ni acciones; únicamente Cerrar. La reducción debe aplicarse en la respuesta de API por rol, no solo al ocultar campos. La API devuelve exclusivamente authorName, createdAt, quantity, unit y status. En el día actual se muestra «Hace unos segundos», «Hace 2 min» o «Hace 5 h»; el día anterior, «Ayer»; para días anteriores, hh:mm por decisión del usuario. La fecha completa sigue accesible en el elemento time. Se usa America/Santiago.

Todos los modales admiten toque/click fuera, además de Cancelar/Cerrar y Escape. Cerrar no confirma acciones ni borra borradores. Una solicitud ya iniciada conserva su identidad/resultado pendiente aunque se cierre la presentación. Considerar el gesto completo fuera del contenido para no cerrar por un arrastre que empezó dentro. Mantener foco y regreso al control de origen.

## Cuenta, menú y Usuarios y accesos

Confirmado: retirar avatar/inicial de perfil; Mi perfil al lado de la identidad con separación discreta; Cambiar contraseña dentro de Mi perfil; Cerrar sesión en una fila con tono rojo suave. Se retira «Compartido», que era una etiqueta del modo colaborativo general. Los nombres confirmados son «Panel de supervisión» y «Gestionar usuarios y accesos», tanto en menú como en los encabezados.

Icono de refresco SVG para Android, iOS, tablet y escritorio: trazo limpio y uniforme, cian, sin recuadro visible; área táctil de 44 px. Se conservan sondeo, espera manual y estados de sincronización existentes. No reemplazar el estado real por una animación de éxito.

Usuarios y accesos: lista compacta primero, buscador/total y acción Crear usuario breve. El alta se abre aparte con pasos Cuenta → Accesos → Confirmar, conservando campos. Edición mantiene Cuenta/Accesos/Seguridad, jerarquía plegable y límites de cuentas mixtas.

Requisito de alta: cada cuenta nueva tiene alcance efectivo desde su creación. Un Trabajador debe seleccionar al menos un área, subárea o zona; el alcance global del Administrador y Servicio de la jefa se muestran como heredados de su rol. Cuenta y asignaciones de Trabajador deben crearse en la misma operación transaccional, con permisos revalidados en servidor. La API recibe grants y valida los accesos en la misma transacción, revalidando permisos/revisión del actor antes de insertar. La retirada posterior de accesos sigue siendo una acción administrativa explícita.

Contraseña temporal autogenerada con aleatoriedad criptográfica en alta y restablecimiento; botón SVG lateral para regenerar dentro del campo. Combina dos palabras completas de una lista breve de panadería con símbolos y un sufijo aleatorio fuerte de doce caracteres. Incluye mayúscula, símbolo y número; no usa una palabra con tres cifras como límite de seguridad. La política existente de contraseñas personales (8–72 bytes, bcrypt coste 12) se conserva. Mantener cambio obligatorio al primer ingreso y límites de cuentas mixtas. Tras confirmar el éxito, mostrar usuario y clave temporal para Copiar accesos y compartir por WhatsApp con mensaje preparado y envío confirmado por la persona. No guardar claves en texto claro en base, auditoría, logs ni almacenamiento del navegador; entrega temporal en memoria, posterior recuperación mediante un nuevo restablecimiento. Un resultado incierto no habilita compartir credenciales no confirmadas. Para WhatsApp, preferir compartir el texto mediante el mecanismo nativo del dispositivo y elegir allí la aplicación/contacto. Copiar accesos queda siempre disponible si el navegador no ofrece compartir. No colocar la clave en parámetros de URL. No se ha aprobado un servicio de envíos automáticos ni infraestructura adicional.

Referencias: [Web Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues), [compartir texto mediante el dispositivo](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).

## Coherencia visual, avisos y transiciones

Resumen, cuenta y usuarios usan matices suaves; Supervisión conserva mayor intensidad. Sin sombras ni degradados en los componentes de esta revisión. Tipografía del sistema y tokens compartidos para títulos de página/área, secciones, etiquetas y cifras: mismo tamaño/peso por nivel, sin reducciones particulares por página. Títulos largos envuelven sin cortar texto ni reducir objetivos táctiles. La escala compartida aplicada es: título 20 px/700, sección 16 px/600, cuerpo 14 px, secundario 12 px, campos editables 16 px y controles de al menos 44 px.

Los avisos se montan en body, dentro del visualViewport, y se reposicionan al cambiar el espacio visible con el teclado. Mantienen los tonos de estado, sin sombra, cuatro segundos, cierre accesible y descarte deslizando hacia arriba. No cambian los datos al descartarse.

Solo después de un guardado aceptado, la tarjeta actual sale sutilmente a la izquierda (160 ms) y la siguiente entra desde la derecha (180 ms). Movimiento reducido cambia inmediatamente. No hay carrusel ni dependencia nueva. **KISS es obligatorio:** resolver el recorrido con componentes nativos y la menor complejidad necesaria; no añadir infraestructura para efectos visuales.

Las pruebas de esta revisión se documentan separadas de los informes históricos. La simulación del visualViewport no certifica teclados reales de Android/iOS: queda pendiente ese recorrido físico y la aceptación en el dominio publicado.
