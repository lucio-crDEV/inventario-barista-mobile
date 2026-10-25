# Etapa 3B — supervisión y administración del inventario

Actualización vigente 25-10-2026: [inventarios y UX móvil](revision-inventarios-2026-10-25.md), [métricas y respaldos](metrics-backup-2026-10-25.md). Requiere 0008/0009; sustituye la pausa previa de telemetría, sin implementar Root. Ver esos documentos para estado y verificación nuevos; las cifras inferiores son históricas.

Estado 23-10-2026: revisión UX/operación implementada localmente sobre e1c8a06, pendiente de publicación y aceptación operativa. [Decisiones confirmadas](decisiones-ux-y-operacion-2026-10-23.md), [verificación](verification.md), [publicación 0007](publicar-revision-ux-0007.md). No se ejecutaron push, despliegues, SQL ni altas remotas.

## Roles y estados

Se conservan Administrador > Jefa de servicio > Trabajador. Jefa solo Servicio; restricciones de cuentas mixtas intactas. No se implementa Root ni telemetría técnica persistente.

| Acción | Administrador | Jefa de servicio | Trabajador |
| --- | --- | --- | --- |
| Consultar supervisión / corregir / anular | Todo su alcance | SoloServicio | No |
| Activo/Inactivo por área | Sí | No | No |
| Cerrar para revisión / Finalizar y enviar | Global o Servicio | SoloServicio | No |
| Reabrir en revisión, con motivo | Sí | SoloServicio | No |
| Reabrir finalizado, con motivo | Sí | No | No |

Abierto permite conteo normal. **Cerrar** pasa a revisión (`review`), congela al trabajador y permite a responsables revisar/corregir/anular. **Finalizar y enviar** pasa a finalizado (`closed`): finalización interna, sin generar archivo ni transmitir datos externamente. Exige todos los productos activos contados, sin pendientes ni avances. Sin stock es cero contado explícito, nunca la sustitución de un dato desconocido.

Reabrir exige motivo editable de 3–500 caracteres, con sugerencias. Rectificar/Anular tienen motivo opcional; Cerrar/Finalizar/Activo no muestran motivo ni checkbox. Se registra actor, fecha, alcance y resultado aunque no se pida motivo. La jefa puede reabrir Servicio en revisión, pero una finalización solo la reabre un Administrador. La guardia SQL comprueba esa diferencia además de la API.

El estado efectivo es global (`cycles`) con excepción explícitaServicio (`cycle_scope_states`). ReabrirServicio deja otras áreas intactas. Un cambio global sustituye excepciones y lo explica en la confirmación. Rectificar/anular/actividad requieren estado efectivo abierto o revisión. Un guardado concurrente queda aceptado antes del cierre/revisión o rechazado después, dentro de la transacción.

## Actividad persistente por área

`item_activity` usa área e identidad exacta del producto, persiste entre inventarios y se proyecta en los ciclos que contienen esa identidad. Un nombre parecido o repetido no es una correspondencia. Desactivar conserva conteos, historial y referencias Excel; sale del denominador activo y nunca confirma cero. Reactivar recupera la cantidad que tuviera cada ciclo.

`item_activity_events` registra cada cambio con actor/fecha/antes/después. Las confirmaciones usan revisión de actividad para evitar que cambios simultáneos desde dos ciclos se sobreescriban. La revisión se propaga a los ciclos afectados para refrescar sus proyecciones sin perder borradores.

La migración arrastra la última decisión anterior comprobable, priorizando la cronología de comandos aceptados sobre la creación del ciclo. Sin evidencia histórica de antigüedad usa la fecha de migración como inicio conocido; no inventa meses previos. El informe de tres/seis meses queda pendiente y prioritario para gestión.

## Interfaz y consultas

**Panel de supervisión** separa Áreas/Productos/Historial, contexto Inventario Global/Área y anillos de avance. Sin botón grande Actualizar ni filtro por fechas. El sondeo de 20 s pausa en oculto y no reemplaza formularios/diálogos; conserva filtros, páginas, expansión, foco y posición. El enlace Resumen de área conserva el inventario seleccionado y el regreso restaura contexto.

Productos: páginas de 50, orden por posición de catálogo. Historial: grupos de producto+ubicación; Conteos/Correcciones/Anulaciones filtran grupos con movimientos de esa clase. Sumar es Conteo. El detalle muestra secuencia completa por días, autor, hora sin segundos, antes/después y motivos/notas. Las páginas de movimientos también son de 50; no se descarga todo. Cambios administrativos de estado/actividad se consultan aparte. Autores usan UUID interno y nombre visible. Selectores actuales:100 inventarios/500 autores; ampliar con búsqueda/paginación antes de superar esos límites.

El historial de producto reutiliza ese detalle y el mismo comando Anular para responsables autorizados. Trabajador recibe solo sus últimos 10 movimientos autorizados: autor, createdAt, cantidad, unidad y estado; laUI muestra tiempo relativo/ayer/hora y fecha completa accesible. Solo Cerrar, sin razones ni campos técnicos. La reducción está enAPI.

Resumen: anillo de `(contados+avance)/activos`; contabilizados cuenta solo contados. Tres botones con punto, etiqueta y cifra en una línea; categorías prácticas plegables/paginadas preservan filtro/posición. Se retiraron responsable, Copiar/Enviar y Nuevo inventario con sus eventos obsoletos. Guardados compartidos y autoría autenticada permanecen. Animación de cifras solo en primera presentación; skeleton hasta datos reales, movimiento reducido inmediato.

Menú/perfil/usuarios usan títulos y tamaños comunes, tintes suaves sin sombras; Supervisión mantiene mayor intensidad. Modales se cierran por gesto completo fuera, Escape y Cancelar/Cerrar sin confirmar ni borrar borradores. Avisos siguen visualViewport al abrir teclado y se descartan hacia arriba. Tras guardado aceptado, transición breve izquierda/derecha; KISS, sin carrusel/dependencias.

## Modelo, migración e integridad

0006_supervision.sql es la base histórica y no se modifica. **0007_operation_ux.sql** reconstruye la restricción de motivos preservando IDs, rowids, fingerprints y resultados de comandos; añade actividad persistente, índices y las guardias nuevas. No cambia catálogo, conteos ni snapshots aceptados. 0005 permanece fuera de migraciones, sin telemetría. Readiness/preflight exige `operation-ux-0007`; sobre 0006 falla cerrado con NOT_INITIALIZED.

Anular conserva fila y versión creciente en counts, proyectando pending/quantity null. Un conteo posterior usa esa versión; sumar a un anulado se rechaza. Rectificación/anulación actualizan operación, conteo, historial, resultado y auditoría atómicamente. Sesión/identidad/rol/revisión/alcance se revalidan antes de deduplicar. Un resultado aceptado se recupera sin restaurar cantidades anteriores, incluso tras finalización, siempre con autorización vigente.

Supervisión e historial de producto comparten una cola de comando pendiente por usuario en sessionStorage. Ante respuesta incierta conservan ID/payload y ofrecen reintento manual; no crean otra operación ni permiten un comando distinto hasta resolver. Errores definitivos requieren revisar de nuevo. Borradores normales siguen aislados por UUID/ciclo.

Alta de trabajador requiere grants válidos no vacíos en el mismo batch de creación; guardias revalidan actor/alcance tras hashing. Administrador/Jefa reciben alcance heredado. Claves temporales con WebCrypto, palabras temáticas completas y sufijo aleatorio fuerte; se pueden regenerar. Entrega en memoria solo tras éxito confirmado, copiar/compartir nativo; sin claves en URLs/storage/auditoría. Política personal 8–72 bytes/bcrypt 12 intacta.

## Excel y publicación

**Regla de oro mandatoria:** original solo lectura; salida futura en copia con la misma estructura, hojas, filas,ID, unidades, referencias, fórmulas y formatos. Solo se actualizan celdas de conteo autorizadas. Inactivar o reagrupar nunca elimina filas ni transforma desconocidos en cero. Exportación etapa 4 y adaptación de plantillas fase 5 siguen pendientes.

Preparar respaldo, aplicar solo pendientes 0006/0007 según listado, preflight y luego push manual; [procedimiento completo](publicar-revision-ux-0007.md). Volver al código 0006 no revierte actividad persistente ni representa una reversión funcional transparente. No bajar esquema ni restaurar una copia sobre escrituras recientes sin operación específica de recuperación.

## Evidencia y límites

Las comprobaciones nuevas se recogen en [verification](verification.md) e informe `revision-ux-local-2026-10-23.json`; los informes 3A/3B anteriores se conservan como históricos. SQLite real, D1/workerd local, sesiones de navegador independientes, migración poblada, concurrencia, respuesta perdida y respaldo/restauración. ContratoExcel 1.151 filas y 41 referencias Vitrina intactos. No certifica dispositivos físicos, CPU facturada Cloudflare ni aceptación en producción.
