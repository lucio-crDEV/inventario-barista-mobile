# Verificación después del despliegue — 27/10/2026

Versión `2d94cf5f31cd.20261027234331`, lectura alrededor de las 23:57 UTC (20:57 Chile). Commit productivo `2d94cf5`, estado Success. Consultas de lectura sobre agregados, configuración y el pequeño marcador de respaldo; no se cambiaron cuentas, conteos, configuración ni código del producto.

El usuario comprobó dos teléfonos y observó propagación de aproximadamente un segundo o menos. Es aceptación funcional reportada, no un percentil medido. La nueva versión registró **28 aperturas WebSocket101**. El campo de bindings del objeto deployment no venía en esa respuesta API; no se interpretó como ausencia: los upgrades101 y los bindings del Worker privado confirman el recorrido.

## Duraciones observadas

| Recorrido | Antes, media ms (n) | Ahora, media ms (n) | Variación observada |
| --- | ---: | ---: | ---: |
| count | 1231 (102) | 659.5 (23) | −46.4 % |
| bootstrap | 1484.1 (11) | 630.4 (15) | −57.5 % |
| sync | 1069.4 (119) | 494.6 (54) | −53.7 % |
| supervision | 1233.4 (57) | 530.9 (9) | −57.0 % |
| cycles | 1078.9 (34) | 369 (21) | −65.8 % |
| navigation | 979.9 (13) | 494.1 (21) | −49.6 % |

Son medias de pared del servidor persistidas; muestras pequeñas y ventanas/tráfico distintos. No prueban causalidad ni ahorro facturable. Todos los guardados correctos (23), bootstrap correctos (15), sincronizaciones correctas (54) y resúmenes de supervisión correctos (9) de esta lectura caen en el intervalo de **300 a menos de1000 ms**. No calcular percentiles exactos desde esos intervalos. El ingreso conserva4 muestras entre1 y3s, media1108ms.

## Métricas y recolector

No hay5xx ni errores técnicos normalizados registrados para la versión en esta lectura. Existen4xx de ingreso/sesión, bootstrap, gestión y conteo; sus agregados no guardan el motivo individual, así que no se califican todos como fallos ni todos como conflictos esperados.

El recolector informa28 lotes,288 observaciones guardadas,0 fallos de lote y0 pérdidas conocidas. Último éxito23:57:00 UTC. Máxima espera de lote176761ms; el vaciado depende de tráfico y no es un heartbeat permanente. Pérdidas por terminación de un isolate o por informes nunca recibidos siguen desconocidas.

INP y CLS ahora llegan desde teléfonos reales. Conteo móvil:3 muestras por indicador, INP medio82,7ms, LCP1616ms, CLS0,0573, todas en categoría buena. **Hallazgo pendiente:** una muestra de Supervisión en equipo clasificado como `other` registra CLS0,4136 (malo). No se extrapola a toda la pantalla; merece una comprobación de cambios de altura tras cargar/refrescar.

## Consumo: comprobado y límites

Las aperturas101 confirman que los avisos funcionan. Una sola muestra correcta de `/me` y54 lecturas sync, junto con la prueba de dos teléfonos, son compatibles con el diseño nuevo. No se infiere el número de usuarios ni concurrencia desde esas solicitudes; sync también sirve para recuperación, cambios y respaldo. No se comprobó la pausa del sondeo de cada pestaña desde un registro de red individual.

La serie del proveedor `workersInvocationsAdaptive` volvió vacía para el intervalo; eso **no significa cero tráfico**. La introspección de su esquema alcanzó su presupuesto temporal y no se insistió. El muestreo D1 al0,1% todavía no aportó muestras. Por tanto **filas totales D1, CPU, coste total y porcentaje de ahorro de cuota quedan sin certificar** con esta lectura. No se cambió muestreo, permisos o facturación para obtener datos.

## Respaldo

Marcador privado vigente: éxito del25/10 a15:03:55UTC, formatoIBK1,157654bytes. Sigue dentro del intervalo de90días; vence el23/01/2027 a15:03:55UTC y el cron posterior decidirá la copia. Se conservaron el objeto anterior y su marcador.

Worker actualizado con objeto privado `BACKUP_JOBS`, bucket y dos secretos presentes; cron diario05:17UTC verificado. No se forzó una copia ni se descargó SQL. **La primera ejecución programada del código nuevo aún no se comprobó**: después del despliegue de las23:37–23:40UTC, el próximo control corresponde a05:17UTC del28/10 (02:17Chile). No se creó una automatización de seguimiento. Un cron configurado y una copia antigua válida no certifican el siguiente trabajo.

[Evidencia agregada](verificacion-produccion-2026-10-27.json). [Preparación de infraestructura](consumo-activacion-2026-10-27.md).
