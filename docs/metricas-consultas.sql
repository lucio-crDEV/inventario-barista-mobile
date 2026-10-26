-- Consultas de SOLO LECTURA para usage_daily (migración 0009).
-- Ejecutar un bloque en D1 Console, o todo el archivo con Wrangler --command="$(cat RUTA_SQL)" --json.
-- Fechas UTC. Solicitudes observadas aproximadas, nunca personas ni clics.
-- NULL significa sin denominador/datos suficientes; no sustituirlo por éxito.

-- Q01. Totales de TODO lo que permanece en la tabla, no de toda la vida de la app.
SELECT MIN(day) AS primer_dia_utc, MAX(day) AS ultimo_dia_utc,
  COUNT(DISTINCT day) AS dias_con_registros,
  COALESCE(SUM(requests), 0) AS solicitudes,
  COALESCE(SUM(CASE WHEN status_class=2 THEN requests ELSE 0 END), 0) AS respuestas_2xx,
  COALESCE(SUM(CASE WHEN status_class=4 THEN requests ELSE 0 END), 0) AS respuestas_4xx,
  COALESCE(SUM(CASE WHEN status_class=5 THEN requests ELSE 0 END), 0) AS respuestas_5xx,
  ROUND(100.0*SUM(CASE WHEN status_class=5 THEN requests ELSE 0 END)/NULLIF(SUM(requests),0), 2) AS porcentaje_5xx,
  ROUND(1.0*SUM(elapsed_ms)/NULLIF(SUM(requests),0), 1) AS promedio_servidor_ms,
  ROUND(100.0*SUM(slow_requests)/NULLIF(SUM(requests),0), 2) AS porcentaje_lentas
FROM usage_daily;

-- Q02. Evolución diaria: últimos 7 días calendario UTC, incluido hoy (incompleto).
SELECT day AS dia_utc, SUM(requests) AS solicitudes,
  SUM(CASE WHEN status_class=4 THEN requests ELSE 0 END) AS respuestas_4xx,
  SUM(CASE WHEN status_class=5 THEN requests ELSE 0 END) AS respuestas_5xx,
  ROUND(1.0*SUM(elapsed_ms)/NULLIF(SUM(requests),0), 1) AS promedio_servidor_ms,
  ROUND(100.0*SUM(slow_requests)/NULLIF(SUM(requests),0), 2) AS porcentaje_lentas
FROM usage_daily WHERE day>=date('now','-6 days') AND day<=date('now')
GROUP BY day ORDER BY day;

-- Q03. Tráfico y rendimiento por función: últimos 30 días calendario, incluido hoy.
SELECT route AS funcion, SUM(requests) AS solicitudes,
  ROUND(1.0*SUM(elapsed_ms)/NULLIF(SUM(requests),0), 1) AS promedio_servidor_ms,
  ROUND(100.0*SUM(slow_requests)/NULLIF(SUM(requests),0), 2) AS porcentaje_lentas,
  SUM(CASE WHEN status_class=5 THEN requests ELSE 0 END) AS respuestas_5xx
FROM usage_daily WHERE day>=date('now','-29 days') AND day<=date('now')
GROUP BY route ORDER BY solicitudes DESC, funcion;

-- Q04. Respuestas por familia HTTP y función. 4xx no equivale necesariamente a fallo.
SELECT route AS funcion, method AS metodo, status_class AS familia_http,
  SUM(requests) AS solicitudes,
  ROUND(1.0*SUM(elapsed_ms)/NULLIF(SUM(requests),0), 1) AS promedio_servidor_ms
FROM usage_daily WHERE day>=date('now','-29 days') AND day<=date('now')
GROUP BY route, method, status_class ORDER BY funcion, metodo, familia_http;

-- Q05. Conteo: respuestas a POST /api/count, NO ítems ni guardados únicos.
SELECT day AS dia_utc, SUM(requests) AS solicitudes_de_conteo,
  SUM(CASE WHEN status_class=2 THEN requests ELSE 0 END) AS respuestas_2xx,
  SUM(CASE WHEN status_class=4 THEN requests ELSE 0 END) AS respuestas_4xx,
  SUM(CASE WHEN status_class=5 THEN requests ELSE 0 END) AS respuestas_5xx,
  ROUND(1.0*SUM(elapsed_ms)/NULLIF(SUM(requests),0), 1) AS promedio_servidor_ms
FROM usage_daily
WHERE day>=date('now','-29 days') AND day<=date('now') AND route='count' AND method='POST'
GROUP BY day ORDER BY day;

-- Q06. Ingreso: solicitudes aceptadas/rechazadas por familia, NO usuarios únicos.
-- Un 4xx puede ser contraseña inválida, validación, límite u otra condición.
SELECT day AS dia_utc, status_class AS familia_http, SUM(requests) AS solicitudes
FROM usage_daily
WHERE day>=date('now','-29 days') AND day<=date('now') AND route='login' AND method='POST'
GROUP BY day, status_class ORDER BY day, status_class;

-- Q07. Lecturas de funciones de interés. Repeticiones/cargas automáticas cuentan.
-- Sirve para comparar llamadas, no para calcular adopción ni embudos de personas.
SELECT route AS funcion, SUM(requests) AS solicitudes,
  SUM(CASE WHEN status_class=2 THEN requests ELSE 0 END) AS respuestas_2xx
FROM usage_daily
WHERE day>=date('now','-29 days') AND day<=date('now')
  AND route IN ('navigation','bootstrap','search','summary','record','history','supervision','cycles','inventory-management')
GROUP BY route ORDER BY solicitudes DESC, funcion;

-- Q08. Separar sesión/sincronización del resto. El resto TAMPOCO son acciones humanas.
SELECT CASE WHEN route IN ('me','status','sync') THEN 'sesion_y_sincronizacion'
  ELSE 'otras_llamadas_api' END AS grupo,
  SUM(requests) AS solicitudes,
  ROUND(1.0*SUM(elapsed_ms)/NULLIF(SUM(requests),0), 1) AS promedio_servidor_ms
FROM usage_daily WHERE day>=date('now','-6 days') AND day<=date('now')
GROUP BY grupo ORDER BY solicitudes DESC;

-- Q09. Funciones a revisar por lentitud: muestra mínima orientativa de 10 peticiones.
-- Lenta = >=1000 ms. La muestra mínima NO demuestra significación estadística.
SELECT route AS funcion, SUM(requests) AS solicitudes,
  ROUND(1.0*SUM(elapsed_ms)/NULLIF(SUM(requests),0), 1) AS promedio_servidor_ms,
  ROUND(100.0*SUM(slow_requests)/NULLIF(SUM(requests),0), 2) AS porcentaje_lentas,
  ROUND(100.0*SUM(CASE WHEN status_class=5 THEN requests ELSE 0 END)/NULLIF(SUM(requests),0), 2) AS porcentaje_5xx
FROM usage_daily WHERE day>=date('now','-29 days') AND day<=date('now')
GROUP BY route HAVING SUM(requests)>=10
ORDER BY porcentaje_lentas DESC, promedio_servidor_ms DESC, funcion;

-- Q10. Semanas que comienzan el lunes, incluyendo las semanas parciales disponibles.
SELECT date(day,'weekday 0','-6 days') AS lunes_utc, SUM(requests) AS solicitudes,
  ROUND(1.0*SUM(elapsed_ms)/NULLIF(SUM(requests),0), 1) AS promedio_servidor_ms,
  SUM(CASE WHEN status_class=5 THEN requests ELSE 0 END) AS respuestas_5xx
FROM usage_daily WHERE day>=date('now','-89 days') AND day<=date('now')
GROUP BY lunes_utc ORDER BY lunes_utc;

-- Q11. Meses con datos todavía retenidos; NO supone meses completos ni archivo anual.
SELECT substr(day,1,7) AS mes_utc, COUNT(DISTINCT day) AS dias_con_registros,
  SUM(requests) AS solicitudes,
  ROUND(1.0*SUM(elapsed_ms)/NULLIF(SUM(requests),0), 1) AS promedio_servidor_ms
FROM usage_daily WHERE day>=date('now','-89 days') AND day<=date('now')
GROUP BY mes_utc ORDER BY mes_utc;

-- Q12. Comparar dos períodos de 7 días UTC completos; hoy queda fuera.
-- Una diferencia de tráfico no prueba cambio en personas, productividad o disponibilidad.
WITH periodos AS (
  SELECT 'ultimos_7_completos' AS periodo, date('now','-7 days') AS desde, date('now') AS hasta
  UNION ALL SELECT '7_completos_anteriores', date('now','-14 days'), date('now','-7 days')
), resumen AS (
  SELECT p.periodo, COALESCE(SUM(u.requests),0) AS solicitudes,
    ROUND(1.0*SUM(u.elapsed_ms)/NULLIF(SUM(u.requests),0),1) AS promedio_servidor_ms,
    ROUND(100.0*SUM(CASE WHEN u.status_class=5 THEN u.requests ELSE 0 END)/NULLIF(SUM(u.requests),0),2) AS porcentaje_5xx
  FROM periodos p LEFT JOIN usage_daily u ON u.day>=p.desde AND u.day<p.hasta
  GROUP BY p.periodo
)
SELECT actual.solicitudes AS ultimos_7_completos, anterior.solicitudes AS anteriores_7_completos,
  actual.solicitudes-anterior.solicitudes AS diferencia_solicitudes,
  ROUND(100.0*(actual.solicitudes-anterior.solicitudes)/NULLIF(anterior.solicitudes,0),2) AS variacion_porcentaje,
  actual.promedio_servidor_ms AS promedio_actual_ms,
  anterior.promedio_servidor_ms AS promedio_anterior_ms,
  actual.porcentaje_5xx AS porcentaje_5xx_actual,
  anterior.porcentaje_5xx AS porcentaje_5xx_anterior
FROM resumen actual CROSS JOIN resumen anterior
WHERE actual.periodo='ultimos_7_completos' AND anterior.periodo='7_completos_anteriores';

-- Q13. Calendario de observaciones: últimos 14 días completos, incluso sin filas.
-- Cero registrado NO certifica ausencia de usuarios ni una caída de servicio.
WITH RECURSIVE calendario(dia) AS (
  SELECT date('now','-14 days')
  UNION ALL SELECT date(dia,'+1 day') FROM calendario WHERE dia<date('now','-1 day')
)
SELECT c.dia AS dia_utc, COALESCE(SUM(u.requests),0) AS solicitudes_registradas,
  CASE WHEN COUNT(u.day)=0 THEN 'sin_observaciones' ELSE 'con_observaciones' END AS cobertura
FROM calendario c LEFT JOIN usage_daily u ON u.day=c.dia
GROUP BY c.dia ORDER BY c.dia;

-- Q14. Exportación detallada de AGREGADOS por intervalo; editar ambas fechas ISO.
-- Desde inclusivo, hasta exclusivo. Ejemplo: octubre de 2026, solo datos disponibles.
SELECT day, route, method, status_class, requests, elapsed_ms, slow_requests,
  ROUND(1.0*elapsed_ms/NULLIF(requests,0),1) AS promedio_servidor_ms
FROM usage_daily WHERE day>='2026-10-01' AND day<'2026-11-01'
ORDER BY day, route, method, status_class;

-- Q15. Coherencia de agregados; cero anomalías NO certifica captura completa.
SELECT COUNT(*) AS grupos,
  COALESCE(SUM(CASE WHEN requests<=0 OR elapsed_ms<0 OR slow_requests<0
    OR slow_requests>requests OR elapsed_ms>60000*requests
    OR elapsed_ms<1000*slow_requests OR status_class NOT BETWEEN 1 AND 5
    OR method NOT IN ('GET','POST','other') OR date(day) IS NULL OR day<>date(day)
    THEN 1 ELSE 0 END),0) AS grupos_incoherentes
FROM usage_daily;
