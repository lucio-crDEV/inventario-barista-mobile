# Perfil de capacidad y alertas de Cloudflare

## Perfil local medido

El perfil del 28-10-2026 ejercitó el Worker real contra una D1 local desechable: 30 cuentas ficticias concurrentes, catálogo de 1.268 filas, dos pasadas completas por los ítems, reintentos idempotentes y obsoletos, carga inicial por área y sincronización incremental vacía. Los conjuntos de ítems por persona/área no se solaparon para evitar conflictos artificiales.

| Medida observada | Resultado |
| --- | ---: |
| Duración total / carga medida | 33.122 ms / 9.372 ms |
| Solicitudes HTTP | 2.686 |
| Respuestas por encima del límite inesperado | 0 |
| Filas D1 leídas visibles | 2.045.764 |
| Filas D1 escritas visibles | 34.477 |
| Filas leídas / escritas por la cuota diaria Free de referencia | 5.000.000 / 100.000 |
| Respuestas con metadata D1 no nula | 2.656 |
| Respuestas sin encabezado de metadata | 30 |

La metadata proviene de contadores `Server-Timing` del wrapper de pruebas autenticado, no de Analytics ni de D1 remoto. Las 30 respuestas `409 STALE` no incluyeron contadores; por eso el perfil las excluye del total de filas observado. El informe local calcula un máximo de dos perfiles diarios completos usando solo las respuestas exitosas visibles. No se extrapola ese resultado a patrones de uso distintos.

Resultados por operación (p50/p95 local, ms):

| Operación | Solicitudes/resultados | p50 / p95 |
| --- | ---: | ---: |
| Login | 30 | 8.577 / 8.577 |
| Bootstrap por área | 30 | 42 / 50 |
| Avance parcial | 1.268 | 95 / 107 |
| Reintento idempotente | 30 | 93 / 97 |
| Reintento obsoleto | 30 HTTP 409 esperados | 98 / 99 |
| Conteo final | 1.268 | 94 / 114 |
| Sincronización incremental vacía | 30 | 79 / 79 |

El estado final verificado en la D1 desechable tuvo 2.536 operaciones, 2.536 filas de historial, 1.268 ítems contados y 0 parciales. Las 1.268 filas inactivas se habilitaron solo en esa base de pruebas mediante `item_activity`; el catálogo fuente no cambió.

## Límites para interpretar el resultado

- Es una prueba local con Workerd/Miniflare; no mide CPU del Worker en Cloudflare ni acredita capacidad de producción.
- Los contadores locales de filas pueden diferir de la metadata facturada por Cloudflare. Las respuestas fallidas de conflicto carecen de contadores en esta prueba.
- Las cuotas de referencia para Workers Free son 100.000 solicitudes por día; para D1, 5 millones de filas leídas y 100.000 escritas por día. R2 Standard incluye 1 millón de operaciones clase A y 10 millones clase B por mes. Las cuotas y su período se deben contrastar con la documentación vigente de [Workers](https://developers.cloudflare.com/workers/platform/limits/), [D1](https://developers.cloudflare.com/d1/platform/pricing/) y [R2](https://developers.cloudflare.com/r2/pricing/).
- El perfil no midió métricas de R2 ni llamadas de Analytics. Las métricas ausentes o vacías deben permanecer como desconocidas, nunca reportarse como cero.

## Criterios del monitor

El monitor agregado debe mantenerse en segundo plano y sondear como máximo cada 15 minutos. Para cuotas con datos válidos, emite aviso al 80% y nivel crítico al 95%. `exceededResources` en Pages se trata como señal urgente de agotamiento de recursos probable, no como identificación exacta de una cuota. Los errores `internalError` se cuentan como fallos genéricos. Para operaciones R2 sin clase reconocible se usa el límite de clase A como cota conservadora.

Una serie ausente, vacía, truncada, inválida o mezclada de períodos no acredita consumo ni recuperación. Tras dos fallos consecutivos de Analytics se puede avisar de indisponibilidad del monitor. Los avisos se deduplican por problema, severidad y día; la recuperación se anuncia una vez. El estado persistido contiene solo cifras agregadas y estado de avisos, nunca consultas, tokens, usuarios ni nombres de buckets.

Para R2, la consulta toma el máximo observado por bucket durante las últimas 24 horas y suma esos máximos. Alcanza un aviso a 8 GB y nivel crítico a 9,5 GB como indicador conservador de capacidad frente a los 10 GB-month incluidos para Standard; no representa ni pronostica GB-month facturados. Los límites mensuales de operaciones Clase A/B y el almacenamiento GB-month usan métricas distintas en [la tarifa oficial de R2](https://developers.cloudflare.com/r2/pricing/).

El Worker `inventory-exports` persiste únicamente avisos estructurados `inventory_resource_alert` para que un Monitor nativo consulte Workers Logs. Los registros automáticos de invocaciones están apagados para no registrar solicitudes; los logs propios usan muestra 100% y persistencia, necesaria para que el Monitor consulte la serie. El límite del plan Free documenta 200.000 eventos diarios y retención de tres días en [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/). El destinatario y las reglas de correo se configuran en Cloudflare y no se guardan en el repositorio.

El monitor ofrece una alarma operativa temprana, no un medidor exacto de facturación. Para la cifra de uso y el ciclo de cuota vigentes, prevalecen los paneles y métricas de Cloudflare.

## Preparación operativa realizada

El índice 0016 se aplicó en producción y el preflight completo anterior y posterior conservó contrato 15 y capturas listas. Los Workers privados de tiempo real y exportación/monitor ya están desplegados. Pages de esta revisión queda pendiente del push del usuario.

`ResourceMonitor` usa un objeto SQLite separado en `inventory-exports`, sin direcciones públicas. Su secreto Analytics tiene solo lectura y vence el 28-10-2027. El cron de quince minutos no ejecuta la purga diaria; esa purga mantiene su horario específico. Cada muestra consume una operación GraphQL acotada, sin acceder a filas D1 ni archivos R2 de la app. Los logs contienen exclusivamente estados y avisos agregados; los logs automáticos de peticiones están desactivados. La retención corresponde a Workers Logs Free, sin contratar otro proveedor.

Cloudflare Monitors tiene habilitada la alerta «Inventario · consumo y errores Free», consulta cada quince minutos los eventos `inventory_resource_alert` del Worker privado y utiliza el correo autorizado. El usuario confirmó la recepción del mensaje de prueba. La prueba acredita el canal de correo, no una simulación de agotamiento real de producción. El monitor avisa también si Analytics falla repetidamente. La duración/capacidad facturada de Durable Objects no está cubierta por estas cuatro series y debe consultarse en su panel.

Una consulta real del 28-10-2026 a las 16:15 UTC validó las cuatro series: D1 llevaba 1.212.564 filas leídas y 5.706 escritas; R2, 130 operaciones del mes y una cota de almacenamiento de 846.688 bytes en dos depósitos. Son cifras de operación observada, no del ensayo de treinta personas. El día completo incluía 42 errores genéricos de Pages; desde el despliegue anterior de las 10:43 UTC se observaron dos `internalError`, 28 respuestas exitosas y cinco desconexiones del cliente. No se identifican como 1102. El p99 de CPU de esas 28 respuestas exitosas fue 5.537 microsegundos: una muestra pequeña, no garantía de carga. Sin logs históricos de esas peticiones no se determina su causa exacta.

El resultado permite continuar en Free con vigilancia y validación posterior al push; no garantiza funcionamiento continuo ilimitado. En el perfil local, cada sincronización vacía leyó aproximadamente 414 filas. Treinta teléfonos consultando cada treinta segundos durante una caída sostenida de WebSocket suponen 3.600 consultas/hora, cerca de 1,49 millones de filas/hora si se conserva ese costo. Por ello es importante comprobar que RTv2 funciona en la red del local y reaccionar ante las alertas. La conexión sana reparte los registros desde una lectura compartida y evita ese recorrido HTTP por teléfono.

La primera muestra programada real se observó el 28-10-2026 a las 16:30:22 UTC: monitor disponible y las cuatro series disponibles. El canal de correo también fue confirmado por el usuario.

Pendiente para la siguiente entrega: mejorar la concurrencia de la verificación privada de contraseñas cuando 25–30 personas ingresan simultáneamente desde una misma IP pública. Esta entrega conserva la cola existente y no incluye esa corrección; la prueba local de treinta personas no certifica ese escenario de ingreso privado. Si se satura, algunos ingresos pueden requerir un reintento.
