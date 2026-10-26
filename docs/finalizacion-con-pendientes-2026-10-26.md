# Finalización con pendientes y opciones del inventario — 26-10-2026

Solicitud vigente: permitir finalizar después del cierre para revisión aunque haya productos sin completar, con «Continuar de todas formas». Sustituye la exigencia anterior de todos los activos contados; no elimina la revisión ni amplía permisos. Administrador finaliza el global/Servicio; Jefa de servicio solo Servicio; Trabajador no finaliza. Solo Administrador reabre finalizados, con motivo.

## Significado de cantidades y futuro Excel

Un cero guardado con Listo o Sin stock es un conteo confirmado y conserva el 0. Un producto pendiente representa cantidad desconocida; un avance aún no es un conteo final. Ambos quedan en blanco en el futuro Excel al finalizar de todas formas. Se conserva el registro parcial, su cantidad, estado y autoría para consulta/reapertura. No se fabrican conteos, ceros, movimientos o autores al finalizar. Los productos inactivos siguen excluidos del requisito de completar y sus registros tampoco se borran. Esta decisión no permite alterar filas, formatos, fórmulas, referencias ni el original.

La exportación Excel sigue pendiente de etapa 4: esta entrega define su contrato y registra la decisión de cierre; no genera ni envía un archivo. No confundir finalizar en la app con exportar.

## Confirmación y concurrencia

El primer intento de finalizar con pendientes devuelve las cantidades reales de pendientes y avances para el alcance autorizado. El diálogo muestra un aviso ámbar junto a Cancelar/Continuar de todas formas. No añade checkbox ni motivo obligatorio. Un cierre completo sigue el flujo normal.

Migración aditiva 0012 después de 0011: revisión de completitud por ciclo, confirmación en supervision_commands y resumen auditable. Los cambios en conteos y actividad invalidan la confirmación anterior. La revisión se valida dentro del mismo comando SQL que cierra; un cambio concurrente devuelve COMPLETION_CHANGED y requiere volver a confirmar las cantidades actualizadas. No basta una comprobación anterior al INSERT.

La auditoría y resultado guardan cuántos pendientes/avances existían y la política uncompletedAsBlank. Los reintentos aceptados conservan la misma identidad, fingerprint y resultado; una respuesta incierta se recupera con exactamente el mismo comando. Las autorizaciones siguen comprobándose antes de recuperar un resultado. La migración no cambia fingerprints/resultados previamente aceptados.

## Opciones de inventario

Contexto compacto con fecha/tipo/estado, X y acción Cerrar; se retira «últ. inventario» de esta pantalla. Los preparados ofrecen activar o eliminar. Eliminar se distingue en rojo y lleva a una segunda confirmación con Cancelar enfocado. Eliminar retira de la lista y bloquea nuevos conteos; se conservan historial y cantidades conforme al archivado existente. No es borrado físico. El cierre con X/Escape no envía nada. Las operaciones inciertas impiden cambiar a otra acción y mantienen la recuperación anterior.

Diseño nativo con tokens crema/carbón, superficies uniformes, controles >=44 px, foco de teclado suave y sin bordes de selección táctil. Sin dependencias nuevas.

## Verificación y publicación

Verificar pruebas unitarias, navegador aislado para finalización/opciones/creación y contrato de libros. Los navegadores usan APIs simuladas: no finalizan ni eliminan inventarios reales. Dispositivos físicos y aceptación visual final siguen abiertos.

Antes de publicar: respaldo privado, aplicar únicamente migrations/0012_incomplete_finalization.sql a la D1 elegida y comprobar columnas/triggers; nunca 0005 ni fixtures remotos. Build Pages y push manual en inventory-v3. No publicar solo el frontend sin su migración/backend.

## Resultado comprobado

86 pruebas unitarias aprobadas. Chromium: creación/activación, opciones con eliminación segura, finalización por Administrador/Jefa, reconfirmación tras cambios y reintentos inciertos aprobados. Ambos temas y anchos 320/390/654 comprobados. Contrato: 1.151 filas del libro original y 41 referencias de Vitrina intactas. Build Pages, allowlist de assets y git diff --check correctos.

0012 aplicada a D1 productiva tras respaldo privado restaurado en base aislada. Comprobación antes/después: cantidades agregadas, conteos de filas de historial/operaciones/comandos/auditoría/ciclos y estados preservados; columnas y seis triggers nuevos presentes. El primer intento de respaldo falló por autenticación y no es válido; la copia válida es `.backups/pre-finalization-0012-20261026-retry`. No se modificó ni finalizó ningún inventario productivo para probar la interfaz. [Evidencia](finalizacion-verificacion-2026-10-26.json). Cambio preparado con commit para push manual; despliegue de aplicación pendiente.

Confirmación explícita del usuario: pendientes o avances sin finalizar en blanco; ceros confirmados con Sin stock/Listo conservan 0 en el futuro Excel.
