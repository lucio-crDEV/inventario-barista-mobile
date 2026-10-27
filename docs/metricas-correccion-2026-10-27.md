Actualización 27/10: [corrección integral de consumo](consumo-critico-2026-10-27.md). Sustituye el recorrido local anterior por recolector unificado, consultas optimizadas y respaldo IBK2 por flujo/objeto privado; conserva los estados remotos fechados como históricos. Publicación pendiente.

# Métricas corregidas y control del recolector — 27/10/2026

Primera etapa autorizada tras la auditoría del 26/10. Se priorizan medición fiable y cuotas antes de librerías/frameworks. Esta entrega es local y no publica cambios. No cambia inventarios, permisos, catálogo, guardados, frecuencia de sincronización, servicios ni el calendario de respaldo.

## Correcciones

- El navegador finaliza el informe en `visibilitychange(hidden)`, después de los avisos finales de web-vitals. Se elimina la carrera de `pagehide` que descartaba INP/CLS. Mantiene una muestra al primer ocultamiento por visita, hasta cuatro contando restauraciones BFCache; no reintenta ni almacena contenido.
- Un único recolector conserva `usage_daily`, histogramas horarios y salud, en un lote atómico. El import antiguo `recordMetric` es un alias compatible, sin otro buffer. El Worker llama al recolector una sola vez.
- La depuración conserva el corte de 90 días, hasta 1.000 filas por tabla y hora activa/versión. Una guarda en el último éxito evita repetir la depuración entre instancias de la misma versión; el marcador se escribe después de los DELETE dentro de la transacción. Sin tráfico no se ejecuta ni se garantiza una fecha exacta. El backlog grande puede requerir mantenimiento supervisado. No toca tablas operativas.
- Cada solicitud API puede medir llamadas/sentencias D1, filas leídas/escritas y tiempos. No se emiten consultas adicionales para obtenerlos: se aprovecha la metadata del resultado. Para `first()` se ejecuta una sola vez vía `all()` y se devuelve la misma primera fila o `null`; lote, parámetros y transacciones se conservan.
- El encabezado `Server-Timing` muestra el diagnóstico de esa petición solo a un administrador autenticado y con respuesta correcta, con `METRICS_ENABLED=1`. No habilita el endpoint de lectura de métricas ni nuevos roles.
- Se persiste una muestra aleatoria del **0,1 %** de solicitudes en los grupos `d1` y `phase` de la tabla existente `telemetry_hourly`. La pequeña muestra limita escrituras; rutas con poco uso pueden tardar en tener datos. La distribución de latencias y el agregado diario siguen contando todas las observaciones recibidas por el recolector.

No hay migración nueva: se utiliza el esquema 0011 ya existente, con 0012 vigente para la app. No se aplicó ninguna migración, exportación o escritura remota. R2 no recibe nuevas operaciones de esta instrumentación; sus problemas de capacidad/operación quedan para una etapa posterior.

## Qué significan los datos nuevos

`d1` contiene `calls`, `statements`, `rows_read`, `rows_written`, `metadata_missing`, `sql_ms` y `binding_ms`. `n` es el número de peticiones muestreadas que aportaron ese campo; `value_sum` suma sus valores. Los totales son **solo de la muestra**, no consumo total de la cuenta ni valores de factura. `calls` cuenta invocaciones al binding; un lote aporta una llamada y tantas sentencias como componentes. No cuenta SQL interno de triggers por separado.

Las filas y el tiempo SQL se guardan únicamente si toda la metadata D1 de esa petición está disponible. En caso de error o metadata ausente se conserva el indicador `metadata_missing`, sin convertir la información faltante en coste cero. Los encabezados pueden mostrar sumas parciales junto a ese indicador. La escritura del propio recolector queda fuera de la medición de la API, para evitar recursión; R2, SQL de operadores y otros servicios tampoco están incluidos.

`phase` mide `preflight`, `auth`, `cycle` y `handler`. Son tiempos transcurridos, incluyen espera y no equivalen a CPU facturada. `auth` incluye validación de acceso y credenciales en login; `handler` acumula los otros tramos de la ruta. `binding_ms` suma las esperas de llamadas D1, por lo que puede solaparse si en el futuro se paralelizan. La granularidad del reloj depende del runtime. SQL, parámetros, resultados, nombres de usuarios, notas, URLs, mensajes y pilas nunca se convierten en dimensiones.

La memoria sigue acotada a 512 grupos horarios y 512 grupos diarios por instancia. El envío sigue disparándose al llegar tráfico después de un minuto y el primero es inmediato; no es un heartbeat autónomo. El cierre de una instancia puede perder lo pendiente sin registrarlo. `known_lost` cuenta observaciones descartadas o inciertas: un resultado ambiguo puede haberse confirmado en D1 aunque su respuesta no llegara. No se reenvía ese lote para evitar duplicarlo; ese contador no es un censo de pérdidas ciertas ni de informes de navegador nunca recibidos.

La política de versiones sigue siendo estricta: pestañas anteriores a un despliegue pueden perder su informe. Mantener varias versiones aceptadas requiere una lista acotada y una decisión posterior; no se aceptan versiones arbitrarias que permitan multiplicar dimensiones. Tampoco se amplía aquí la muestra a todas las interacciones después de ocultar y volver a la misma visita.

## Validación y comparación

- **95 pruebas unitarias aprobadas** de la app y pruebas de regresión de solapamiento, errores, metadata incompleta, privacidad y compatibilidad de informes.
- Chromium real genera una interacción lenta y un cambio de diseño: el informe contiene LCP, INP y CLS, versión del build y error normalizado. Se comprueba ausencia de cookies, referrer y contenido. La misma prueba contra el cliente anterior falla por INP ausente.
- Runtime workerd/D1 local: primera fila, ausencia de fila, columna, parámetros, lote y rollback; metadata real del binding. No equivale a medición de la factura productiva.
- Build Pages en una copia temporal sin secretos ni bases persistentes. BFCache se prueba con mocks; iOS/Safari/dispositivos físicos siguen pendientes.
- Simulación determinista del recolector, 30 instancias estables, cuatro horas, una consulta cada cinco segundos: 86.400 solicitudes y 86 diagnósticos. Anterior: 21.600 llamadas D1 y 43.290 sentencias externas. Actual: 7.200 y 22.985. Reducciones del **66,7 %** y **46,9 %**, respectivamente. No son porcentajes de filas facturadas, factura total, CPU o coste de R2. Los DELETE vacíos y distintos arranques/versiones pueden cambiar la relación. La simulación no mide las consultas operativas ni la capacidad de treinta clientes reales.

Comandos: `npm test`, `node tests/shared/metrics-cost.mjs`, `node tests/shared/request-metrics-d1.mjs`; después de un build aislado, `node tests/shared/observability-browser.mjs`. Datos y límites en [verificación](metricas-correccion-verificacion-2026-10-27.json). [Consultas](metricas-ampliadas-consultas.sql).

## Continuación del informe completo

| Prioridad pendiente | Evidencia y siguiente decisión |
|---|---|
| D1: comprobación repetida de catálogo | La auditoría midió 1.914 filas en la comprobación de `/me`. Separar contrato de despliegue del sondeo, preservando sesión y rechazo seguro. Todavía no corregido. |
| D1: resolución duplicada de ciclos | Varias rutas vuelven a listar inventarios/estados o descartan el resultado. Eliminar trabajo repetido sin cachear permisos indebidamente. |
| D1: consultas de supervisión/bootstrap | Materialización histórica confirmada en D1. Reescribir con equivalencia de estados, permisos y concurrencia. |
| Solicitudes del navegador/Worker | Agrupar duplicadas, reutilizar catálogo autorizado, evitar recargar páginas previas y revisar recursos estáticos. |
| Sincronización | Objetivo de hasta cinco segundos, unas 30 personas durante 2–4 horas diarias. Comparar sondeo adaptativo y avisos con recuperación; sin infraestructura nueva por ahora. |
| Latencia y UX de guardado | Medir ubicación y tramos; conservar idempotencia/borradores. La transición añade 160 ms antes del siguiente ítem. |
| R2 y recuperación | Revisar límite de SQL de 8 MiB, compresión en memoria, CPU, antigüedad/alertas de éxito y custodia de claves. Respaldo de 90 días y retención de métricas no garantizan un archivo analítico completo. Sin exportar otra vez por esta etapa. |
| Librerías/frameworks | Pospuestos expresamente hasta resolver consumo y rendimiento críticos. |

No ejecutar commit, push ni despliegue sin la instrucción correspondiente. Después de publicar, verificar muestras de la nueva versión y usar los encabezados de administrador para una captura de carga/guardado. Las mediciones históricas del 26/10 no son resultados de esta implementación.
