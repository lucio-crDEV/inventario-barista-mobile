# Consultar y entender las métricas

Actualización 26/10: [ampliación de observabilidad](observabilidad-2026-10-26.md) y [análisis de producción](analisis-metricas-2026-10-26.md). Migración 0011; nuevas mediciones implementadas, pendientes de publicar el código.

Revisión del 25-10-2026 contra `worker/telemetry.js`, `worker/index.js`, migración 0009 y la configuración de producción. Esta guía y las consultas son de lectura: no habilitan nuevas métricas, roles, API ni seguimiento personal. El estado de escritura real se documenta en [la verificación de producción](metrics-production-verification-2026-10-25.json).

## Cómo verlas y obtenerlas

**No necesitas terminal.** Entra a [Cloudflare](https://dash.cloudflare.com/), selecciona tu cuenta, abre **Storage & databases → D1 SQL database → inventario-login-v3 → Console**. Copia un bloque de [metricas-consultas.sql](metricas-consultas.sql) y ejecútalo. El nombre del menú puede variar con el idioma; la base y la pestaña Console identifican el destino. La [documentación oficial](https://developers.cloudflare.com/d1/get-started/) confirma este acceso desde el navegador.

Es un acceso privado de operador con tu cuenta Cloudflare. Un administrador de la app no obtiene acceso a D1 automáticamente. Esta consola admite también escrituras: las quince consultas entregadas solo leen. No hace falta crear otro token para utilizarlas si ya accedes con tu cuenta.

Actualmente no existe un panel de métricas dentro de Inventario ni una URL pública de informes. `/api/admin/metrics` está cerrado a los roles actuales (`ROOT_NOT_ENABLED` tras autenticación); Root sigue pendiente. No compartir credenciales ni habilitar ese endpoint para consultar estas cifras. El panel técnico del proveedor sí muestra sus propias métricas de Workers/D1, que son otra fuente y pueden tener distinto alcance y retención.

Desde la terminal, estando en el repositorio y con Node/dependencias instaladas:

```sh
cd /Users/lucio/workspace/inventario_brioche
npx --no-install wrangler login
node scripts/metrics.mjs --remote --config wrangler.pages.production.jsonc
```

`login` solo es necesario cuando no hay una sesión Cloudflare válida; abre la autorización en el navegador. `--remote` consulta D1 de producción. `--local` consulta una base ficticia local: las pruebas en `127.0.0.1` no representan por sí mismas uso de producción.

Para obtener todas las consultas en JSON, guardar en una ubicación privada nueva:

```sh
umask 077
mkdir -p .backups/informes-metricas
npx --no-install wrangler d1 execute DB --remote \
  --config wrangler.pages.production.jsonc \
  --command="$(cat docs/metricas-consultas.sql)" --json \
  > .backups/informes-metricas/informe-2026-10-25.json
```

Cambiar el nombre para cada informe y conservar también las fechas del período consultado. `.backups/` está excluido de Git y de los assets públicos. El resultado contiene un bloque por consulta, con `results` y metadatos de ejecución de Cloudflare; estos metadatos no son nuevas mediciones de usuarios. Para una sola consulta, copiar su SQL en `--command="SELECT ..."`. Se usa `--command` para obtener las filas: `--file` puede procesar el SQL por la vía de importación y devolver solo un resumen de ejecución. El signo `=` evita que los comentarios iniciales del archivo se interpreten como opciones. [Opciones oficiales de Wrangler](https://developers.cloudflare.com/d1/wrangler-commands/).

No usar el respaldo SQL completo para compartir estadísticas: contiene cuentas, hashes y datos operativos. Estas consultas extraen únicamente agregados. Un informe operativo puede seguir siendo confidencial aunque no incluya nombres. JSON sirve para conservar los resultados o preparar un reporte; esta entrega no incorpora exportador CSV ni una hoja de cálculo automática.

## Qué se está recolectando

La tabla `usage_daily` contiene exactamente siete campos. Cada fila agrupa día UTC + función normalizada + método + familia HTTP.

| Campo | Contenido | Ejemplo / interpretación |
| --- | --- | --- |
| `day` | Día UTC | `2026-10-25`; no equivale al día local de Chile |
| `route` | Función de una lista fija | `count`, `summary`, `supervision`; nunca una URL con parámetros o IDs |
| `method` | Método agrupado | `GET`, `POST`, `other` |
| `status_class` | Familia de respuesta | 2 = 2xx; 4 = 4xx; 5 = 5xx |
| `requests` | Solicitudes HTTP observadas | Incluye sondeos, reintentos y solicitudes rechazadas |
| `elapsed_ms` | Suma de duración en el servidor | Desde entrada al Worker hasta preparar la respuesta; valor individual limitado a 60 s |
| `slow_requests` | Solicitudes de al menos 1.000 ms | Permite calcular qué proporción fue lenta |

Funciones reconocidas: `login`, `logout`, `password`, `profile`, `me`, `status`, `navigation`, `bootstrap`, `sync`, `search`, `summary`, `record`, `history`, `count`, `metrics`, `cycles`, `inventory-management`, `supervision`, `admin-users` y `unknown`. La presencia en esta lista no garantiza tráfico registrado. `supervision` reúne sus subrutas; `admin-users` reúne las operaciones de cuentas; `unknown` agrupa rutas no reconocidas sin almacenar el texto original.

No se guardan en esta tabla cuentas, nombres, IP, user-agent, identificadores de dispositivo/sesión, búsquedas escritas, cuerpos, cantidades, notas, cookies o secretos. **Eso no significa que toda la app carezca de datos personales:** cuentas, autoría de conteos y auditoría existen por su función operativa. Algunos registros técnicos de seguridad incluyen metadatos del actor; son otra fuente, con otro acceso y finalidad. No se consultan ni cruzan aquí. El proveedor también puede procesar información de conexión para prestar su servicio: esta guía describe nuestra tabla, no todas sus prácticas.

### Qué preguntas puede responder

| Consulta | Resultado | Límite principal |
| --- | --- | --- |
| Q01 | Totales conservados, familias HTTP, media y lentitud | No es el total histórico desde que nació la app |
| Q02 | Evolución diaria de los últimos 7 días | Incluye hoy incompleto |
| Q03–Q04 | Llamadas, rendimiento y respuestas por función | Solicitudes, no personas ni clics |
| Q05 | Respuestas de la API de conteo | Reintentos idempotentes pueden repetir una respuesta exitosa |
| Q06 | Solicitudes de ingreso por familia HTTP | No identifica personas ni la causa exacta del rechazo |
| Q07–Q08 | Funciones consultadas y separación de sondeos | El resto de llamadas tampoco equivale a acciones humanas |
| Q09 | Funciones con más lentitud y respuestas 5xx | Muestra mínima orientativa; no es un análisis causal |
| Q10–Q11 | Semanas y meses con datos disponibles | Períodos parciales por inicio/retención |
| Q12 | Comparación de dos períodos completos de 7 días | Una variación no prueba cambios de adopción o productividad |
| Q13 | Días con y sin observaciones | Un hueco no demuestra caída ni ausencia de usuarios |
| Q14 | Exportación de agregados entre dos fechas | Editar el intervalo; no recupera datos depurados |
| Q15 | Coherencia aritmética de los grupos | No certifica captura completa |

Para un período propio, Q14 usa `day >= '2026-10-01' AND day < '2026-11-01'`: incluye octubre y excluye el 1 de noviembre. Ese mismo filtro puede sustituir el intervalo relativo de Q02–Q09. En Q01 puede añadirse antes del punto y coma para obtener un resumen de ese intervalo.

El promedio correcto es `SUM(elapsed_ms) / SUM(requests)`, ponderado por peticiones. Nunca promediar los promedios de las filas. Los porcentajes sin denominador son `NULL`: significan que faltan observaciones, no 0 % de errores. Una solicitud 4xx puede ser sesión vencida, permiso denegado, validación, conflicto o límite; no es necesariamente un defecto. Esta tabla no distingue 401 de 403 ni 409 de 429.

Tampoco permite calcular usuarios únicos, concurrencia, retención de personas, duración de sesiones, clics, guardados únicos, productos contados, percentiles p50/p95/p99, duración máxima, CPU, velocidad de internet o tiempo hasta que una pantalla se ve y responde. Las páginas estáticas no se contabilizan como visitas. Para totales exactos de inventarios, ítems o avances se necesitan informes sobre las tablas operativas y sus reglas; no se pueden inventar a partir de solicitudes. Tampoco se puede filtrar esta tabla por persona, área o inventario: no tiene esas columnas.

### Precisión, calendario y conservación

- El envío es aproximado: primer evento inmediato, después lotes por proceso aislado del Worker, disparados por una nueva petición cuando pasó al menos un minuto. No es un temporizador autónomo. Sin tráfico posterior, con cierre del proceso o fallo de escritura pueden faltar observaciones; no hay auditoría exhaustiva ni disponibilidad garantizada a partir de esta fuente.
- El día es UTC. No se pueden reconstruir horas ni días de Santiago a partir de agregados diarios. Los intervalos de fecha del archivo son días calendario UTC, no ventanas móviles de 168 horas. Para comparar conviene Q12, que excluye hoy.
- La limpieza elimina filas con `day` anterior al día UTC de hace 90 días, en lotes al escribir métricas. El corte por fecha puede conservar 91 etiquetas diarias contando hoy y el día límite; la falta de tráfico puede retrasar la depuración. No ofrece un historial anual continuo.
- Los inventarios y su auditoría no se borran con esa limpieza. Un respaldo cifrado puede conservar métricas más antiguas; su retención se debe gestionar por separado. Un respaldo cada 90 días no garantiza un archivo analítico completo si fallan los lotes, la copia o su calendario. La ausencia de métricas antes de activarlas no se puede subsanar retrospectivamente.

## Qué podría medirse más adelante

Propuestas **sin implementar**; cada ampliación necesita decidir finalidad, campos, acceso y retención antes de activarla.

| Propuesta | Para qué serviría | Diseño mínimo recomendado |
| --- | --- | --- |
| Errores técnicos normalizados y versión de app | Identificar regresiones y conflictos de sincronización | Códigos de una lista fija, sin mensajes crudos, notas ni URLs personales |
| Cola de envío y reconexiones | Saber si el modo con conexión inestable funciona | Rangos de antigüedad/reintentos y totales; sin identificar al trabajador |
| Rendimiento visible: LCP, INP, CLS | Medir carga, respuesta y estabilidad visual reales | Muestreo y rangos agregados; no grabar pantalla ni DOM |
| Histograma de latencias | Aproximar percentiles y ver colas lentas | Contadores por intervalos; no guardar cada petición individual |
| Pasos generales de un flujo | Detectar fricción en búsqueda/selección/guardado | Totales de eventos limitados; sin texto escrito ni identificador persistente; sin IDs no hay embudo individual |
| Salud del recolector | Detectar retrasos de envío y pérdidas estimadas | Último lote exitoso, fallos y descartes; otra fuente independiente ayuda a distinguir falta de tráfico |
| Recursos de Cloudflare | Revisar CPU, filas D1 leídas/escritas y almacenamiento | Usar métricas del proveedor; la duración actual no sustituye CPU |
| Progreso operativo por inventario/área | Ver pendientes, avances, cierres y correcciones | Consultar datos operativos autorizados, con acceso por rol y sin convertir autoría en ranking personal |

No mezclar todas las dimensiones: día × área × rol × dispositivo puede identificar indirectamente a alguien en un equipo pequeño y aumentar almacenamiento. Una app lenta puede deberse a red, dispositivo, servicio o flujo; el número de peticiones por sí solo no lo atribuye.

## Lo descartado y lo todavía no implementado

La decisión vigente descarta **telemetría personal**: no se agregaron IDs de cuenta/sesión/dispositivo, IP, user-agent completo ni contenido de inventario al recolector. Tampoco hay una herramienta de analítica de terceros, cookies de seguimiento ni grabación de sesiones añadidas por esta implementación.

Usuarios únicos, rankings individuales, tiempo ocioso, mapa de teclas, capturas, GPS y seguimiento entre aplicaciones quedan fuera de este alcance. Algunos nunca fueron funciones diseñadas: se enumeran para dejar claro que no existen, no para afirmar que se implementaron y luego eliminaron. Percentiles, Web Vitals y errores del navegador, en cambio, son carencias técnicas actuales; no están descartados por privacidad si se diseñan con datos mínimos.

## Métricas controversiales y dudas de aplicación

| Caso | Duda o riesgo | Criterio antes de plantearlo |
| --- | --- | --- |
| Conteos por trabajador, velocidad o ranking | Confunde carga, dificultad, colaboración, red y desempeño; puede convertirse en vigilancia | No usar la telemetría actual para evaluar personas; separar trazabilidad de evaluación laboral |
| Tiempo en pantalla / inactividad | Una pestaña abierta o un teclado activo no prueba trabajo ni abandono | Definir si realmente responde una necesidad; evitarlo cuando basten datos técnicos agregados |
| Reutilizar auditoría con fines disciplinarios | Una nueva finalidad no queda autorizada por haber almacenado autoría | Evaluar finalidad, acceso y marco laboral antes de cualquier uso nuevo |
| Grabación de sesiones / mapas de calor | Puede capturar nombres, contraseñas, notas o datos privados aun con enmascarado | No está autorizada; priorizar pruebas voluntarias con datos ficticios |
| IP, dispositivo o segmentos pequeños | Posible identificación o huella digital aunque no se guarde un nombre | Reducir granularidad, evitar IDs persistentes; no llamar anónimo a lo que permite reidentificar |
| Decisiones automáticas sobre trabajadores | Indicadores incompletos pueden generar conclusiones injustas | No convertir métricas técnicas en sanciones o decisiones laborales automáticas |

Que una medición sea controversial no la vuelve universalmente ilegal, ni que sea técnicamente posible la autoriza. La [Dirección del Trabajo, ORD. 2295](https://www.dt.gob.cl/legislacion/1624/w3-article-121098.html), distingue control de producción de vigilancia personal y exige respetar derechos fundamentales; otro [pronunciamiento de 2026](https://dt.gob.cl/legislacion/1624/w3-article-129528.html) aplica finalidad, necesidad y proporcionalidad a controles audiovisuales. El contexto concreto importa: no hay una autorización laboral general implícita en esta guía.

## Prohibiciones: del proyecto y legales

**En la implementación vigente** está prohibido introducir datos personales o contenido operativo en `usage_daily`, publicar las métricas por una API abierta o eludir roles para obtenerlas. No deben registrarse contraseñas, hashes, tokens, cookies o claves de respaldo en telemetría, logs, informes públicos o Git. Los hashes de autenticación y el respaldo privado cifrado tienen una finalidad distinta: no son una excepción para copiarlos a analítica.

No se autoriza vigilancia oculta, lectura de mensajes privados, portapapeles, cámara, micrófono, captura de teclas o seguimiento ajeno a la app. Tampoco inferir salud, religión, afiliación sindical, opiniones políticas u otras características sensibles para analítica de inventario. Quedan fuera de finalidad y del alcance aprobado; no se habilitan por agregar una casilla genérica.

**En el plano legal**, no corresponde afirmar que cualquier métrica individual está siempre prohibida. En Chile, la [Ley 19.628, texto aplicable a esta revisión](https://www.bcn.cl/leychile/navegar?idNorma=141599&idParte=8642686&idVersion=2023-05-09), exige autorización legal o consentimiento válido según corresponda (art. 4), limita el uso a la finalidad de recolección con sus excepciones (art. 9) y restringe datos sensibles salvo las excepciones del art. 10. Tratar datos personales sin fundamento habilitante, fuera de las finalidades permitidas o vulnerando derechos fundamentales no queda legitimado por llamarlo «métrica».

La reforma [Ley 21.719](https://www.bcn.cl/leychile/Navegar/imprimir?idNorma=1209272) tiene vigencia diferida: no aplicar automáticamente su texto futuro como si ya estuviera vigente. Revisar la norma vigente al momento de ampliar el tratamiento. Esta guía fija el alcance técnico actual y señala asuntos a resolver; no certifica por sí sola cumplimiento legal del empleador ni del proveedor.

## Validación de esta entrega

Las consultas se validan sobre el esquema real, una tabla vacía, datos ficticios con medias desiguales, límites de períodos, días sin registros y respuestas de distintas familias. Se compara Q01 con la evidencia productiva ya versionada. La comprobación remota adicional se registra por separado sin copiar datos de cuentas ni inventarios. Las 15 consultas se ejecutaron además contra D1 de producción con cero filas escritas y cero grupos incoherentes. [Evidencia de las comprobaciones](metricas-consultas-verificacion-2026-10-25.json). No se requiere migración ni despliegue de la app para usar estos SELECT.
