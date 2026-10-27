-- Solo lectura. Las nuevas observaciones existen después de desplegar 0011 y el código.
-- Versión = revisión + identificador del build; hora UTC de recepción.
-- Cambiar el filtro por versión para comparar lanzamientos sin mezclar datos antiguos.
SELECT version,kind,sum(n) observaciones FROM telemetry_hourly GROUP BY version,kind ORDER BY version;

-- Distribución de latencia del servidor: bucket = límite superior exclusivo en ms.
-- overflow incluye 60000 ms (valores limitados a 60000).
SELECT version,route,bucket,sum(n) solicitudes,
 round(100.0*sum(n)/sum(sum(n)) OVER(PARTITION BY version,route),2) porcentaje
FROM telemetry_hourly WHERE kind='latency'
GROUP BY version,route,bucket ORDER BY version,route,CASE WHEN bucket='overflow' THEN 999999 ELSE CAST(bucket AS INTEGER) END;

-- Errores técnicos normalizados: no mensajes ni datos personales.
SELECT version,route,device,metric codigo,sum(n) errores
FROM telemetry_hourly WHERE kind='error'
GROUP BY version,route,device,metric ORDER BY errores DESC;

-- Carga LCP, interacción INP, estabilidad CLS: medias y categorías por pantalla.
-- CLS no tiene unidad; sus sumas internas usan escala 10000.
SELECT version,route,device,metric,bucket,sum(n) muestras,
 round(1.0*sum(value_sum)/sum(n)/CASE WHEN metric='CLS' THEN 10000 ELSE 1 END,4) promedio
FROM telemetry_hourly WHERE kind='vital'
GROUP BY version,route,device,metric,bucket ORDER BY version,route,device,metric,bucket;

-- Salud: recorded/known_lost cuentan observaciones (una petición puede aportar varias).
-- La pérdida por terminación del isolate y los informes nunca recibidos son desconocidos.
SELECT version,max(last_success_at) ultimo_envio_correcto,sum(flushes) lotes,
 sum(recorded) observaciones_guardadas,sum(known_lost) descartadas_o_inciertas,
 sum(failed_flushes) lotes_fallidos,max(max_buffer_age_ms) mayor_espera_ms
FROM collector_health GROUP BY version ORDER BY ultimo_envio_correcto DESC;

-- Desde la corrección del 27/10: diagnósticos D1 con muestreo del 0,1%.
-- sumas_muestra NO es gasto total. Filas/SQL solo incluyen metadata completa.
SELECT version,route,metric,sum(n) muestras,sum(value_sum) suma_muestra,
 round(1.0*sum(value_sum)/sum(n),2) promedio_por_muestra
FROM telemetry_hourly WHERE kind='d1'
GROUP BY version,route,metric ORDER BY version,route,metric;

-- Cobertura de metadata por ruta. Fallos sin metadata no aparecen como cero.
SELECT version,route,
 sum(CASE WHEN metric='calls' THEN n ELSE 0 END) muestras_seleccionadas,
 sum(CASE WHEN metric='rows_read' THEN n ELSE 0 END) muestras_completas,
 sum(CASE WHEN metric='metadata_missing' THEN value_sum ELSE 0 END) sentencias_sin_metadata
FROM telemetry_hourly WHERE kind='d1' GROUP BY version,route;

-- Fases del recorrido: tiempo transcurrido, no CPU facturada.
SELECT version,route,metric fase,sum(n) muestras,
 round(1.0*sum(value_sum)/sum(n),2) promedio_ms
FROM telemetry_hourly WHERE kind='phase' GROUP BY version,route,metric
ORDER BY version,route,promedio_ms DESC;
