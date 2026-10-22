# Refuerzo 3A: seguridad, observabilidad y recuperación — 22-10-2026

## Resultado y alcance

Trabajo exclusivamente local en `inventory-v3`, después del traspaso. Se conserva el incremento de usuarios/Servicio ya publicado, aunque documentos históricos lo denominen 3B. Esta revisión refuerza 3A; no implementa tablero de supervisión, rectificación/anulación, cierre/reapertura ni exportación Excel. No cambia bcrypt coste 12, Free, proveedor, credenciales ni WhatsApp. No se hicieron solicitudes a la aplicación de producción, SQL remoto, respaldos remotos, push o despliegues.

El primer commit de esta entrega, `98282ea`, conserva los 17 archivos modificados y cinco sin seguimiento que ya existían: traspaso, evidencias/documentos, `.gitignore` y lanzador. Sus resultados remotos/históricos no se atribuyen a este trabajo. Los JSON históricos permanecen intactos; los informes de suites se generan en la copia scratch. [Resultado nuevo estructurado](seguridad-observabilidad-local-2026-10-22.json).

No está listo para publicar sin preparación: la consulta de métricas y mantenimiento nuevos necesitan `0005_activity.sql`. No se aplicó remotamente. Los conteos siguen funcionando sobre 0001–0004 si falla/está ausente telemetría, pero eso no equivale a tener la entrega completa habilitada.

## Modelo de amenazas

| Actor | Riesgo y frontera |
| --- | --- |
| Internet anónimo | Fuerza bruta, agotamiento bcrypt/D1/Workers, URL manipulada, descarga accidental de archivos. No puede obtener inventario sin sesión. |
| Trabajador autenticado | Consultar hermanos/otro ámbito, falsificar actor, reintentar aportes, acceder a métricas/administración o reutilizar sesión revocada. Autorización y CAS en servidor/D1. |
| Cuenta comprometida | Todo lo autorizado para esa identidad está expuesto; cuotas reducen abuso, no sustituyen revocación ni recuperan confidencialidad perdida. |
| Jefa | Solo Servicio, sin promoción ni cuentas superiores; cuenta mixta solo sus accesos Servicio. Métricas globales denegadas. |
| Administrador | Acceso global deliberado; acciones sensibles versionadas/auditadas, último admin protegido. Compromiso de esta cuenta tiene impacto alto. |
| Automatización externa | Puede imitar navegador/UA y operar con credenciales robadas. No se identifica con certeza humano/IA ni se atribuye a Claude. |

## Hallazgos, evidencia y decisiones

| Hallazgo | Impacto / probabilidad | Evidencia y tratamiento |
| --- | --- | --- |
| Readiness anterior aceptaba cualquier catálogo con una fila y solo comprobaba una vista | Alto / media operativa | Código inspeccionado y pruebas negativas nuevas con SQLite real. Ahora entrada/bootstrap/preflight validan versión y cardinalidad 1.227/1.268 y vistas/triggers críticos. Sondeos/guardados hacen comprobación ligera de esquema/versiones para no escanear catálogo cada cinco segundos. No es un checksum integral de los datos. |
| Cuerpo JSON se leía completo antes de limitar caracteres | Medio / media | Reproducción con UTF-8 >16 KiB. Ahora se limita bytes durante stream, también Content-Length. No protege del volumen antes de llegar al Worker. |
| Copia recursiva de carpetas públicas podía incluir internos/sourcemaps/enlaces añadidos accidentalmente | Alto potencial / baja-media | Ensayo con cinco sentinelas; ahora solo HTML/CSS/JS, sin ocultos ni enlaces simbólicos. Paquete Pages y rutas privadas comprobados. No se encontró una filtración real nueva en producción. |
| Altas/restablecimientos administrativos sin cuota previa de derivación | Medio-alto / media si cuenta comprometida | Código confirmado. Añadida cuota persistente conjunta de diez por actor/15 min antes de bcrypt; no reduce coste ni sustituye revisión/versionado. |
| Lecturas/escrituras autenticadas sin límite servidor general; navegador reintentaba sondeos a cadencia fija | Medio-alto / media | Nuevos límites por UUID/clase y Retry-After; prueba de ráfaga y navegador. 60 consultas pesadas/min y 180 normales/min por isolate, logout excluido. Sin escritura D1 por cuota de sondeo. No son globales: reinicio, evicción o varios isolates permiten más. |
| Diagnóstico registraba mensajes arbitrarios de excepción | Medio / baja | Se retiraron mensajes libres; logs estructurados con campos controlados. Prueba con secreto en cuerpo/cookie/UA/query verifica ausencia en logs propios y D1. Los logs automáticos del proveedor tienen otra política. |
| Login con bcrypt en Free y eventos de recursos | Alto / evidencia histórica, frecuencia actual desconocida | No se demuestra corregido por este trabajo. Workers Free documenta 10 ms CPU; latencia local no es CPU facturada. No se debilita contraseña ni se migra por inercia. Medir mañana con autorización. |
| Cuotas de login por usuario pueden bloquear una cuenta atacada; IP compartida o rotada afecta precisión | Medio / media | Se conservan 10/usuario y 100/IP por 15 min. Hash SHA-256 de IP no es anonimización fuerte (espacio enumerable); no se añade IP a telemetría. Riesgo pendiente: ataque distribuido/rotación de nombres genera trabajo D1 antes del rechazo. |
| Crecimiento de notas por sumas e historia/usuarios completos | Medio / baja hoy | Entrada de nota 1.000 caracteres, historial 100 y sync 250; catálogo finito. Notas acumuladas y lista administrativa no tienen paginación completa. No se alteran notas/datos históricos para imponer truncamientos silenciosos. Reservar paginación/cursor administrativo para 3B antes de crecer sustancialmente. |

No se demostró SQL injection, escalamiento de rol, acceso a inventario hermano ni sesión revocada utilizable en los casos ensayados. SQL usa bind; interpolaciones de cuentas son fragmentos internos y revisión numérica validada. Texto dinámico de nombres/notas utiliza escape HTML; CSP restringe scripts a self, bloquea frames y origen de formularios. `style-src unsafe-inline` sigue por estilos nativos; no permite script inline. No se realizó una auditoría formal exhaustiva de cada sink ni pentest remoto. `npm audit` completo informó cero avisos, no ausencia garantizada de vulnerabilidades.

Contraseñas: bcrypt 12, mínimo ocho acordado, máximo 72 bytes sin truncamiento, dummy hash para usuario inexistente y mensaje genérico; no registro público. Sesiones: secreto aleatorio 256 bits, solo digest D1, cookie HttpOnly/Secure/SameSite Strict/Path=/ en HTTPS, 12 h; no token en localStorage. Origin exacto + JSON protegen mutaciones; no CORS. Sesión/rol/permisos revalidados en consultas y triggers. Cambios de username/contraseña/activación/eliminación revocan; ámbitos y rol se resuelven de nuevo. Perfil no cambia username/rol. UUID/autoría sobreviven cambios/eliminación. Respaldos contienen hashes y metadatos sensibles: son privados.

## Inventario de pruebas y huecos

| Contrato | Suites existentes y ampliación | Hueco restante |
| --- | --- | --- |
| Catálogo/Excel/UI | Node catálogo, reparto/roles/navegación, contrato workbook histórico | Revisión física/unidades, Android y exportación 4 |
| Autenticación/configuración | production-config, integration, extended; security.test añade esquema antiguo/incompleto, catálogo incorrecto, cuerpo por bytes y privacidad logs | CPU Free, configuración efectiva/cookies del dominio |
| Ámbitos/roles/mixtas | integration y nueve grupos users-service; seis recorridos users-service-browser | Aceptación con personas reales; no reemplazada por inspección |
| Atomicidad/concurrencia/reintentos | integration/extended/load, triggers y recuperación | Distribución real Cloudflare, fallos de red reales prolongados |
| Publicación | build:pages, seis comprobaciones Pages HTTPS; preflight positivo/negativo y sentinelas de paquete nuevos | Preflight/commit/variables/remoto pendientes mañana |
| Abuso/telemetría | security-live, security.test y backoff nuevos; refresh/sync repetidos | Cuota global multi-isolate, métricas de facturación, carga sostenida |
| Datos recuperables | migration-service y operations ampliados para 0005/retención | Copia externa y restauración remota autorizadas por separado |

Ejecución final: `npm test` 25/25, Python bootstrap/orden 7/7. `npm run test:security:isolated`: 17 etapas aprobadas en 102.794 ms, incluyendo build, preparación local, preflight positivo/negativo, integración (11 grupos), extended (6), users-service (9), carga, sync, backoff, refresh, users-service-browser, security-live, migración poblada, operaciones, paquete y Pages HTTPS. El runner usa scratch y puertos 8890/8891, excluye secretos/respaldos/fuentes y no toca el servidor/base existentes 8790. Reinicia su Worker entre suites para no acumular cuotas de cuentas de fixture entre pruebas independientes; no lo reinicia durante la carga.

Intentos intermedios detectaron y corrigieron un helper `toHex` no disponible, una aserción de tiempo demasiado exacta, contaminación de cuotas entre suites y una carrera de refresh al abrir el menú de otra pestaña antes de montar la identidad (ahora espera su montaje). No se ocultaron fallos elevando límites ni deshabilitando protecciones. Regresión completa de todas las vistas/UX no repetida; se ejecutaron las relevantes al cambio. La prueba Pages anterior esperaba un status antiguo: se actualizó al contrato 3A con incremento usuarios-servicio, conservando todas sus comprobaciones.

### Simulación local reproducible de 15 clientes

`npm run test:security:isolated` crea bases nuevas e independientes. Dentro ejecuta `tests/shared/load.mjs`: 15 cookies/sesiones independientes, diez rondas por cliente, guardado + reintento idéntico + sync, y carrera final de 15 aportes contra una versión común. Duración 6.332 ms, incluye login bcrypt. 496 solicitudes cronometradas (482 HTTP 200, 14 conflictos 409 esperados), 528 totales incluyendo lecturas auxiliares; 151 escrituras aceptadas y 150 reintentos sin duplicación, cero errores inesperados. Latencia p50 34 ms, p95 84 ms, máximo 4.206 ms (con ingresos concurrentes). Cantidades finales, igualdad operación/historial/resultado y cardinalidad comprobadas.

Medición local adicional: 92 observaciones agregadas de telemetría, crecimiento 74 páginas SQLite de 4.096 bytes. Incluye efectos de inventario/índices/telemetría, no atribuye todo a una función ni mide filas facturadas. No mide CPU Cloudflare ni cuota diaria. Es una ráfaga corta, no quince personas sostenidas durante horas. No garantiza capacidad de producción. Prueba de ráfaga aparte obtiene 429 sin bloquear otra cuenta ni logout; navegador respeta Retry-After y conserva estado de error/borradores.

## Métricas mínimas y privacidad

Diseño previo en scratch; implementación en `worker/telemetry.js`, tabla aditiva `activity_hourly`. GET `/api/admin/metrics` requiere administrador con sesión vigente y sin cambio obligatorio; SQL vuelve a comprobar autorización. Trabajador y jefa reciben 403. La jefa mantiene las lecturas/acciones de Servicio existentes, pero no recibe métricas globales ni lista de sesiones. No se añadió tablero ni enlace nuevo.

Desde una pestaña ya autenticada como admin puede consultarse `fetch('/api/admin/metrics').then(r => r.json())` en consola; la cookie sigue HttpOnly, no copiarla. Devuelve JSON no-store: cuentas observadas, actividad horaria por ruta/ámbito/HTTP, estimación de actividad reciente, número de sesiones no vencidas y últimos 100 eventos administrativos (actor, objetivo, acción, fecha; sin detail). Hasta 1.000 grupos horarios; `possiblyTruncated` indica que podría faltar información. No sumar cuentas distintas de cada grupo para obtener un total único: usar accounts24h.

Definiciones:
- Cuenta distinta: UUID con al menos una observación retenida, no una persona acreditada.
- Login aceptado: respuesta de ingreso aceptada/sesión emitida; se agrega cada aceptación (si telemetría funciona). No equivale a cuenta única, lectura efectiva posterior ni sesión activa.
- Sesiones no vencidas: filas vigentes en D1; múltiples dispositivos cuentan varias veces, sesión abandonada puede durar 12 horas. No es concurrencia.
- Solicitudes: usar métricas Pages del proveedor para volumen/errores/CPU, con sus límites de muestreo. `observations` D1 NO es contador exacto: una observación cada cinco minutos por combinación actor/ruta/ámbito/HTTP e isolate; reinicios/evicciones añaden, fallos omiten. Login/logout/cambio contraseña aceptados se agregan sin ese muestreo; rechazos anónimos quedan agregados/muestreados y en log estructurado.
- `activeAccounts5m`: UUID observados recientemente. Puede incluir quien ya salió hasta cinco minutos y omitir usuarios sin petición reciente; varios dispositivos/pestañas se consolidan. No mide conexiones simultáneas ni personas trabajando ahora.
- La ventana horaria incluye la primera hora parcial (24–25 horas de buckets), indicado en respuesta. Agregados no separan ciclos: son uso de la app; conteos/historial sí mantienen ciclo. No usarlos para sumar inventario entre ciclos.
- Ámbito observado: áreas autorizadas incluidas en bootstrap; ubicación validada en record/history/count. Sync y otras rutas sin selección concreta usan `none`, no se inventa el ámbito consultado desde parámetros arbitrarios. Descargar áreas autorizadas no prueba que la persona las haya leído físicamente.
- Actor es quien ejecuta, target es la cuenta afectada; ambos UUID distintos en eventos administrativos. `admin_audit` transaccional existente es fuente de verdad de mutaciones, no el log best-effort.

Logs propios: requestId aleatorio servidor (también X-Request-ID), ruta normalizada, método GET/POST/other, status, fecha UTC, duración de pared; actor/target/acción/ámbito cuando conocidos y bandera de revocación. No loguea contraseñas, cookies, tokens/digests de sesión, cuerpo completo, cantidades/notas, username, query arbitraria, IP ni user-agent. No se usan fingerprints ni detección de IA. Los errores SQL no se vuelcan como texto libre. Una terminación del runtime puede impedir responder/loguear; correlacionar también CF-Ray/outcome/fecha del proveedor.

Telemetría asíncrona mediante waitUntil, sin alterar transacción del conteo; fallo probado con tabla ausente y conteo aceptado. No reintenta ni muestra sincronización falsa. Una fila agregada por clave/hora, NO por sondeo. Mapas limitados a 4.096 claves por isolate. Aun así hay trabajo adicional y puede perderse; no es auditoría financiera exacta ni promete impacto cero.

Retención objetivo 14 días para buckets: `maintenance` consulta por defecto, `--apply` elimina como máximo 1.000 vencidos por ejecución; no hay scheduler. Sin ejecutar limpieza autorizada pueden conservarse más tiempo. Sesiones/intentos conservan política de dos días tras vencimiento; admin_audit/historial/resultados no se podan. D1 y Cloudflare solo operadores autorizados; endpoint solo admin. IP de cuota actual es digest no salado, potencialmente reversible, retenido por mantenimiento; se justifica solo para frenar intentos, nunca identidad de persona. No se añade UA por su baja precisión.

Señales manuales: incremento de 401/403/429 por hora, login rechazados frente a aceptados, lecturas pesadas desproporcionadas y errores 5xx/outcome de recursos. Comparar con inventario planificado y conexión compartida; no marcar automáticamente abuso/IA ni bloquear por un único pico. No hay alertas recurrentes ni umbral universal fiable implementados.

## Publicar y recuperar sin repetir la incidencia

1. Mañana revisar commits/diff y destino exacto: rama inventory-v3, Pages inventario-login, D1 v3, Free. Confirmar qué migraciones están aplicadas; 0001–0004/ciclo/administrador ya estaban preparados según evidencia anterior. No repetir bootstrap, fixtures o ciclo.
2. Pausa operativa acordada si es necesaria. Comprobar recuperación y copia privada válida según autorización separada; esta tarea no crea copia remota. D1 export puede bloquear consultas mientras exporta. Obtener bookmark Time Travel antes de migrar con permiso explícito.
3. Aplicar SOLO pendientes de esquema, en particular 0005, antes del push que dispara Pages. Comando de referencia, NO ejecutado: `npx wrangler d1 migrations apply DB --config wrangler.pages.production.jsonc --remote`. No borrar/recrear DB ni hacer down destructivo.
4. Preflight remoto de solo lectura, pendiente autorización: `npm run preflight -- --remote --config wrangler.pages.production.jsonc --cycle piloto-v3-servicio`. Verifica schema/catalog/admin/ciclo y tabla 0005; no migra ni prueba cookies. No usar 503 como diagnóstico CPU genérico.
5. Panel Pages Production: DB correcto, APP_ENV=production, APP_ORIGIN HTTPS exacto, ACTIVE_CYCLE_ID correcto; build `npm run build:pages`, salida dist y Node 24. Config con nombre personalizado no sustituye variables efectivas de Pages. Previews sin DB/origen separados deben mantenerse sin acceso; restringir previews irrelevantes solo con aprobación.
6. Solo entonces el usuario hace push. Verificar commit y éxito de deployment. Build nunca migra, restaura, crea cuentas ni ejecuta preflight remoto.
7. Postdeploy controlado: `npm run verify:public` son 16 GET anónimos; ejecutar desde copia/informe separado para no sobrescribir evidencia histórica. Confirmar JSON 401/no-store, cabeceras, archivos internos 404 y assets correspondientes. Esta tarea no los repitió remotamente.
8. Ingreso/cookie/métricas y escrituras requieren autorización concreta: dos cuentas de ensayo existentes acordadas, no fixtures. Verificar cookie, logout/revocación, jefa/mixta fuera de ámbito, 4+3=7, sobrescritura y reintento incierto. Sin carga contra producción. Conservar borradores ante error, no declarar listo/sincronizado antes de aceptación.
9. Capturar solo traza saneada durante ventana corta y observar CPU/outcome HTTP/ruta normalizada/correlación. Si aparece 1102/exceededCpu detener intentos repetidos, no reducir bcrypt ni activar Paid. Separar tiempo de pared de CPU. No completar aceptación Free por un login exitoso.

Rollback: código Pages/Git no revierte D1, bindings, variables, ciclo o datos. 0005 es aditiva y código previo la ignora; se puede volver al deployment cfece26 conservando la tabla (cesan métricas/cuotas nuevas/backoff, continúan datos). No se ensayó ese rollback remoto. Cambiar variable/ciclo no restaura cantidades y exige comprobar catálogo seleccionado; no apuntar otra base por conveniencia. Restaurar datos necesita ventana sin escrituras, verificar referencia temporal, asumir pérdida de cambios posteriores y revocar TODAS las sesiones recuperadas antes de reabrir. No ejecutar SQL de respaldo sobre producción existente a ciegas. Recuperar snapshot antiguo también restaura permisos/contraseñas viejos: revisar administradores y accesos antes de servicio.

## Cloudflare: acciones manuales pendientes y límites Free

Consultada documentación oficial vigente, no auditado panel de cuenta:
- Workers Free: 100.000 peticiones/día y 10 ms CPU/HTTP; D1 Free Time Travel siete días, no 30. Time Travel no es copia externa independiente.
- Pages soporta tail de Functions por deployment: `npx wrangler pages deployment tail --project-name inventario-login --format json`. Iniciar únicamente ventana autorizada y no guardar cabeceras/cookies/URLs arbitrarias del evento bruto; filtrar antes de persistir. Tail es vivo, limitado y no una historia completa. Cerrar al terminar. Logs automáticos del proveedor pueden incluir más datos que nuestros console; revisarlos antes de retener/exportar.
- Workers Logs Free publica 200.000 eventos/día y tres días; NO se presume que activar observability Workers configure este proyecto Pages. Pages usa su documentación propia de logs/métricas y se revisará mañana en el panel. No se habilitó almacenamiento/exportación ni servicio de pago.
- WAF Free de zona publica una regla de rate limit, periodo y bloqueo diez segundos, conteo IP sin NAT support. `pages.dev` no es una zona propia administrable: no prometer regla de zona allí. En dominio propio proxied autorizado, propuesta a revisar: expresión `http.request.uri.path eq "/api/login"`, 30 solicitudes/10 s/IP, bloqueo 10 s; no aplicarla a sync/count. Quince ingresos legítimos caben, reintentos/red compartida pueden dar falsos positivos. No activada; verificar disponibilidad exacta en zona y probar acceso antes.
- Turnstile Free: hasta 20 widgets/10 hostnames cada uno, desafíos ilimitados, analítica siete días. Requiere crear widget con hostname exacto, guardar secret solo servidor, validar Siteverify (single-use, caducidad) antes de bcrypt y adaptar CSP/formulario con alternativa accesible. No se integró/activó ni interrumpió trabajadores. Solo plantearlo tras observar abuso y autorización; UA/robots.txt no protegen secretos ni coste.
- Rate Limiting API Workers es aproximada por ubicación; no se añadió binding ni se asume compatibilidad de configuración de Pages. Migrar a infraestructura nueva solo para cuotas no se justifica ahora.

## Respaldos y recuperación

Se reutilizan `backup`, `restore:local`, `maintenance` y ordenador SQL existente. Ensayo real con D1 local nueva/poblada: manifiesto/hash/permisos, autores/UUID, grants, catálogo/ciclos, conteos/historial/resultados/deduplicación, tabla telemetría; sesiones restauradas vacías, operación posterior y retry antiguo válidos sin sobrescribir nueva edición, corrupción rechazada y destino existente protegido. 0005 probada en base nueva y base existente con datos/sesiones y FK/integridad válidas. Las bases de recuperación son aisladas, no restauraciones de producción. No se han leído ni modificado respaldos privados existentes.

Propuesta pendiente de aprobación operativa: copia privada cifrada externa antes de cada migración/cambio sensible y al finalizar cada jornada con conteo activo; durante un inventario crítico valorar cada hora según pérdida admisible. Retener siete diarias + cuatro semanales, acceso solo operador/administrador autorizado, clave fuera del repositorio; verificar checksum en cada copia y restauración local mensual y antes de migración relevante. Definir destino/cifrado/RPO/RTO con el usuario, sin contratar ni programar nada ahora. No guardar SQL/hashes en Git, dist ni chat. Time Travel siete días Free es recuperación del mismo proveedor, no sustituye copia externa; rollback de código tampoco.

Bases mínimas de integridad/recuperación quedan ahora en 3A. Automatización/custodia operativa de respaldos y exportación fiel Excel se organizan en etapa 4 como tareas separadas; exportar cantidades no es respaldar usuarios/permisos/historial. Aceptación operativa 3A sigue abierta: recursos Free, dominio con varias personas, cookies reales, recuperación remota/copia externa, Android y piloto aplazado.

## Skills y límites

Bloqueo de entrega documental: el entorno rechazó por timeout de aprobación la modificación de `AGENTS.md` solicitada para añadir el enlace. No se reintentó ni se eludió esa protección. El enlace queda accesible desde el traspaso (ya enlazado por AGENTS), contexto, roadmap, accesos, despliegue y verificación. Añadir enlace directo a AGENTS queda pendiente de aprobación interactiva; no afecta las pruebas funcionales.

Catálogo real consultado (57 skills). Se leyó completa `requesting-code-review`: revisión de diff/SQL/XSS/secretos y pruebas antes de commit; sin subagentes, sin stash/reset ni etiqueta de revisión independiente. No existen skills específicas Cloudflare Workers/D1, observabilidad, autenticación o recuperación en esta instalación. No se instalaron componentes ni skills. No se cargaron indiscriminadamente skills de delegación/proceso; se usaron herramientas existentes y referencias oficiales. La revisión es del único ejecutor, no auditoría independiente certificada.

Referencias consultadas:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/pages/functions/debugging-and-logging/
- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/waf/rate-limiting-rules/
- https://developers.cloudflare.com/turnstile/plans/
- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html

## Qué protege y qué no

Datos privados, secretos, lógica del servidor y acceso al repositorio dependen de permisos y custodia. No se consultó/cambió visibilidad GitHub (acceso SSH fallido histórico no demuestra repo privado). Mañana revisar Settings/Collaborators/visibilidad con el propietario; si fuese público, el código puede copiarse y retirar acceso no retira copias existentes. No se publican fuentes internas desde dist, pero eso no prueba privacidad del repositorio.

HTML/CSS/JS entregados al navegador son inspeccionables; una interfaz visible puede reproducirse. Sin ofuscación, bloqueo de clic derecho ni garantías anticopia. UA y patrones pueden falsificarse; si se revisan señales futuras, hablar de automatización declarada o comportamiento sospechoso y falsos positivos, no identificar una IA/persona sin evidencia.
