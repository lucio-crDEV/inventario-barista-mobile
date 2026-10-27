Actualización: [preparación remota completada](consumo-activacion-2026-10-27.md). El estado local inicial descrito abajo es histórico; 0013, Workers y binding de Pages ya están preparados. Falta el commit/push del usuario y verificar su despliegue automático.

# Corrección del consumo crítico — 27/10/2026

Implementación local sobre `inventory-v3`, base `2f515a3`. Continúa la corrección de métricas y la auditoría del 26/10. **No se aplicó 0013 a producción, no se publicaron Workers/Pages y no se hizo commit ni push.** No se incorporaron dependencias ni frameworks. La activación online tiene un orden obligatorio descrito abajo; publicar solo Pages no activa el canal compartido.

## Problemas corregidos

| Causa comprobada | Corrección implementada |
| --- | --- |
| Dos recolectores y pérdida de INP/CLS al salir | Un lote diario/horario atómico; retención horaria acotada; entrega real de Web Vitals y diagnóstico D1 al 0,1 %. [Detalle y límites](metricas-correccion-2026-10-27.md). |
| Comprobar catálogo completo y resolver/listar inventarios varias veces por petición | Contrato 0013 con contadores transaccionales, comprobación acotada de esquema y resolución indexada solo en las rutas que la usan. Sesión y permisos siguen comprobándose en cada petición. |
| Supervisión materializa conteos de todos los inventarios retenidos | Proyección relacional filtrada por inventario; resúmenes sin JSON innecesario; historial limita productos antes de agrupar movimientos. Vista actualizada también para lecturas de los triggers. |
| Bootstrap descarga otras áreas | `area` limita productos y registros, conservando los ámbitos autorizados y el cursor global. Los borradores y la navegación mantienen su contrato. |
| GET duplicados, selector oculto consultando y refrescos completos de Supervisión | Agrupación de GET solo mientras están pendientes, clave por identidad/ruta/época de escritura; sin caché de respuestas terminadas. Selector carga al abrir ajustes. Supervisión usa una versión y evita recargar páginas sin cambios. |
| 30 teléfonos consultan aunque nadie guarde | Canal WebSocket nativo y privado, con un observador compartido del historial cada 3 s, hibernación, recuperación por cursor y sondeo de respaldo ante fallos. Requiere activar el binding. |
| JS/CSS públicos invocan el Worker | Exclusiones de rutas exactas generadas desde el paquete público; API, HTML y rutas desconocidas conservan sus controles. Cabeceras de seguridad y revalidación de archivos sin hash. El build rechaza superar 100 reglas. |
| Cada control diario de respaldo adquiere/escribe un bloqueo | Consulta primero el marcador: cuando no corresponde copiar, R2 hace 1 GET y ninguna escritura/borrado. La reserva condicional sigue protegiendo el trabajo real. |
| Respaldo limitado a 8 MiB, copia completa en memoria y CPU de Cron Free | Formato cifrado IBK2 por bloques, multipart secuencial y ejecución en un objeto privado `BackupJob`; Cron solo delega. Descifrador conserva IBK1. Sin binding falla cerrado. |

## Lecturas y seguridad de D1

0013 mantiene cardinalidades aprobadas de 1227 y 1268 mediante triggers y conserva actividad, autoría, conteos, historial e idempotencia. El preflight explícito compara además contadores con filas reales, guardas y columnas; no escribe ni recalcula firmas.

D1 rechaza `pragma_schema_version`, detectado durante el ensayo nativo y corregido antes de entregar. El recorrido de producción compara una firma exacta de nombres/tipos/definiciones del pequeño esquema público de SQLite, excluyendo internos `_cf_`/`sqlite_`. En el fixture son 68 objetos y 40.245 bytes; el motor local D1 tenía 90 objetos totales. **Sigue leyendo metadatos de esquema; no significa cero filas leídas.** Se eliminó el escaneo del catálogo por petición. No se midió en producción la nueva cifra facturable de filas.

Un borrado de guarda o una modificación de su definición, incluso conservando el nombre, rechaza solicitudes. Una migración futura debe validar su esquema y actualizar explícitamente la firma al final. No añadir DDL después de 0013 sin ese procedimiento. El código conserva compatibilidad con instalaciones anteriores mediante su validación completa; la detección de capacidad se reintenta a los 60 s, sin cachear identidad, permisos ni disponibilidad.

Medición reproducible del Worker real con SQLite sintética y catálogo 1268:

| Ruta | Sentencias antes → ahora | Invocaciones D1 antes → ahora |
| --- | --- | --- |
| Identidad | 4 → 2 | 4 → 2 |
| Navegación | 10 → 4 | 8 → 4 |
| Sincronización | 11 → 5 | 9 → 4 |
| Bootstrap con área | 15 → 9 | 9 → 4 |
| Inventarios | 13 → 5 | 9 → 3 |
| Resumen de Supervisión | 14 → 7 | 11 → 5 |
| Guardado nuevo | 12 → 5 | 10 → 5 |

Supervisión sin cambios: 6 sentencias/4 invocaciones y respuesta `unchanged`, sin volver a cargar productos/historial. La referencia anterior proviene de la auditoría; datos y consultas equivalentes, bootstrap nuevo acotado por área. Las cifras excluyen sentencias internas de triggers y escrituras del recolector. **No son filas facturadas, porcentaje de ahorro económico ni latencia productiva.** Reproducir con `node tests/shared/consumption-cost.mjs`.

Al aumentar de 1 a 100 inventarios sintéticos, el coste de las consultas nuevas permanece prácticamente constante en instrucciones SQLite: resumen 206.100→205.600, productos 83.900→84.000 e historial 94.100→94.200. La vista anterior crecía de 159.600→7.326.600. Se verificó equivalencia de registros, anulaciones, actividad, filtros y permisos.

## Canal compartido y presupuesto

Pages autentica origen, sesión, inventario y ámbitos antes de abrir `/api/realtime`. Solo envía al objeto un contexto operativo mínimo; no reenvía cookies ni acepta el contexto aportado por el cliente. El objeto privado conserva en la conexión identidad/revisión/vencimiento y ámbitos necesarios para autorizar avisos. No son datos de analítica ni se publican.

Los mensajes solo indican `ready`, `changed`, `refresh` o `pong`: no incluyen registros, nombres, cantidades ni identificadores de productos. Cada lectura posterior vuelve a autorizarse en la API. Cambios de accesos/sesiones invalidan conexiones; el contexto incluye la revisión global para rechazar la carrera entre autorización y apertura. Ante interrupción, desbordamiento del lote o fallo de D1 se cierra el canal y se recupera mediante el cursor y sondeo con espera creciente. Pestañas ocultas/offline cierran conexiones; al volver hacen recuperación. No se envían borradores automáticamente.

El observador consulta una vez los controles indexados y, solo si cambió el historial, hasta 1001 filas desde el cursor anterior y hasta el límite de la instantánea. Esto evita perder avisos entre escritura y publicación: la fuente es el historial confirmado en D1. Sin conexiones no hay alarma ni consultas periódicas. Un latido por minuto no consulta D1. No hay tabla de presencia ni heartbeat de escritura por teléfono.

Modelo aritmético de 30 pestañas durante 4 horas sin cambios: 86.400 solicitudes HTTP vacías del sondeo se sustituyen por aproximadamente 4.800 controles compartidos D1, más aperturas/reconexiones y la recuperación inicial. Hay unas 7.200 entradas de latido, 4.800 alarmas y operaciones de almacenamiento del objeto. Con cambios se suman lecturas de historial y las consultas autorizadas de los teléfonos interesados. **No equivale a cero coste ni simula una jornada productiva completa.**

La prueba nativa tuvo 30 WebSockets reales locales: inicialización simultánea 1 lectura D1 compartida; barrido con cambios 2; sin cambios 1; latidos y barrido vacío 0. Verificó separación de ámbito/inventario, revisión de accesos, corte ante fallos/desbordamiento y cursor limitado a la instantánea. Miniflare retrasa algunos cierres de transporte; el cliente de prueba acota ese cierre a 100 ms y verifica sus códigos. No certifica CPU ni latencia de producción.

Objetivo: visibilidad en hasta 5 s con red y servicios sanos. Los 3 s de observación dejan margen para lectura y entrega; no es un SLA. Red lenta, reconexión, alarmas retrasadas o el sondeo de respaldo pueden excederlo y deben medirse tras activar. No se modificó la colocación ni la replicación D1: faltan ensayos productivos de consistencia/latencia antes de elegirlos.

Durable Objects SQLite está disponible en Free, con cuotas propias; cuenta solicitudes, alarmas, mensajes entrantes, duración y almacenamiento. No es ilimitado ni activa un plan de pago desde el código. [Precios oficiales](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## Respaldos: límites y recuperación

La cadencia sigue siendo una copia completa cada 90×24 h, con comprobación diaria. No se borran inventarios ni copias antiguas. IBK2 comprime en flujo, cifra bloques autenticados AES-GCM de 64 KiB y exige manifiesto final; la verificación del objeto usa una cadena SHA-256. Corta exportaciones SQL por encima de 128 MiB, limita objeto y partes, aplica contrapresión y no mantiene SQL completo en memoria. Multipart usa partes de 5 MiB; el máximo teórico está acotado a 48 subsolicitudes, incluyendo hasta 10 sondeos de exportación. Peticiones API: 15 s; descarga SQL: 120 s.

El límite de 128 MiB es una barrera operativa, **no una certificación de poder completar cualquier base de ese tamaño**. Deben vigilarse CPU, tiempo, tamaño y antigüedad de la copia real. `BackupJob` dispone del presupuesto nativo de CPU del objeto, separado del Cron; el valor documentado por el proveedor es 30 s por invocación por defecto. [Límites oficiales](https://developers.cloudflare.com/durable-objects/platform/limits/).

Un fallo no adelanta `last-success.json`, no elimina la copia anterior y aborta multipart cuando procede. La reserva sigue siendo condicional y se comprueba su propiedad. Los errores publicados son constantes y no contienen tokens, URLs firmadas ni contenido. Endpoint público: 404; sin `BACKUP_ENABLED=1` no se invoca ningún binding.

Se recuperaron 12.582.977 bytes SQL sintéticos mediante workerd local + objeto SQLite + R2 multipart local: descifrado correcto y `integrity_check=ok`; segunda ejecución `not-due`. Pruebas negativas cubren corrupción, truncamiento, exceso de tamaño, concurrencia y fallos sin adelantar el marcador. También se exportó/restauró el esquema completo 0013, conservando firma exacta, contadores, datos y revocación de sesiones; el contrato restaurado siguió válido. No hubo llamadas remotas. El nuevo descifrador acepta IBK1 e IBK2 y publica archivos solo tras verificar toda la autenticación.

Estado privado del respaldo descargado: `node scripts/backup-status.mjs --checkpoint RUTA/last-success.json`. Informa `current` o `due-or-stale`; una copia ausente no certifica éxito. No expone endpoint ni dispara copias. La supervisión de fallos/antigüedad sigue siendo responsabilidad del custodio; no se configuró email/webhook. La custodia externa de claves y el crecimiento acumulado R2 siguen siendo necesarios.

## Activación online pendiente, en orden

1. Crear y verificar una copia privada previa a la migración con el procedimiento existente. No borrar estado ni aplicar fixtures a D1 remota.
2. Aplicar 0013 después de 0012 y ejecutar el preflight de solo lectura contra el ciclo real. La configuración de producción existente identifica D1; no usar `prueba-compartida` por suposición.
3. Publicar el Worker privado de avisos con `wrangler.realtime.production.jsonc`: mismo D1, clase `InventoryRealtime`, migración SQLite `realtime-v1`, sin workers.dev ni preview URLs.
4. En Pages, agregar binding Durable Object `REALTIME` a clase `InventoryRealtime` del script `inventory-realtime`; conservar origen, D1 y variables. Reflejar ese binding en `wrangler.pages.production.jsonc` **después de crear el Worker**. No se añadió anticipadamente a esa configuración para evitar romper el despliegue normal cuando la clase todavía no existe.
5. Construir/publicar Pages; confirmar que navigation/bootstrap/overview indican `realtime:true`, la apertura devuelve 101 y al estar conectado desaparecen los sondeos vacíos. Verificar dos teléfonos, ámbitos distintos, revocación, vuelta de segundo plano y fallos. Si no hay binding, `realtime:false` conserva el sondeo; esa modalidad por sí sola no elimina su volumen de solicitudes.
6. Actualizar la configuración privada del respaldo conservando secretos/bucket/variables existentes: `main` debe apuntar a `operations/backup-worker/entry.js`, y añadir `BACKUP_JOBS` + migración SQLite del ejemplo. No publicar el ejemplo con valores de reemplazo. Mantener el bucket privado y los secretos como secretos. Ensayar configuración y revisar las ejecuciones reales antes de dar por certificado el nuevo recorrido.
7. Comparar métricas por versión, CPU/límites del proveedor, filas D1, reconexiones y antigüedad del respaldo. Si falla el canal, quitar solo el binding de Pages recupera el sondeo; no borrar namespace, historial, contadores ni R2. No retirar 0013 ni recomputar firmas a ciegas para ocultar un error.

Las migraciones y despliegues anteriores requieren autorización explícita de publicación según AGENTS.md. No hace falta un token nuevo para los avisos: usan bindings privados; el respaldo conserva los secretos ya configurados. Esta entrega no activa facturación.

## Verificación y pendientes restantes

Evidencia consolidada: [consumo-verificacion-2026-10-27.json](consumo-verificacion-2026-10-27.json). 123 pruebas unitarias y 24 suites aisladas aprobadas; dos paquetes privados validados con `deploy --dry-run`. HTTP/browser/HTTPS, roles, concurrencia, borradores, errores transaccionales, migración, paquete público, recuperación y runtime nativo. Los fallos iniciales y las repeticiones de suites afectadas se registran separados: no se presentan como una primera ejecución perfecta.

Se completa el código de las causas críticas de consumo identificadas. Permanecen pendientes **la activación y la medición online**, el seguimiento de cuotas reales y la capacidad con mayor volumen. Smart Placement, replicación, transición al guardar, tipado/routing/frameworks y Excel son trabajos independientes; no se implementaron como parte de esta corrección de cuotas. El objetivo de reducir consumo no autoriza perder registros, debilitar permisos, borrar histórico ni presentar simulaciones como factura real.
