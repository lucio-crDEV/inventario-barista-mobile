# Seguridad, observabilidad y recuperación — estado vigente 23-10-2026

## Extensión operativa 3B — 23-10-2026

El [contrato 3B](etapa-3b.md) documenta tablero/historial de inventario, correcciones y estados. Es auditoría operativa autorizada por rol/ámbito, no métricas técnicas de uso. La persistencia de telemetría continúa desactivada, Root solo diseñado y 0005 no se aplica. Esta etapa añade **0006 operativa**, necesaria antes de publicar. Las instrucciones “este diff no requiere SQL” de la entrega b24403d que siguen son históricas respecto a 3B. No SQL remoto/deploy en esta sesión.

## Decisiones y comportamiento real

Continuidad con GPT/Codex en `/Users/lucio/workspace/inventario_brioche`, rama `inventory-v3`, desde `72c1aeb`, limpio al iniciar. Sin fetch ni consultas remotas: las referencias origin y la publicación cfece26 del 22-10 son evidencia histórica, no verificaciones actuales. No commits, push, despliegues, SQL/cuentas remotas, cambios de facturación, credenciales o configuración de otros agentes.

El usuario eligió explícitamente **desactivar persistencia de telemetría** y **dejar Root solo diseñado**. Se retiraron el escritor `activity_hourly` y las consultas de métricas. El endpoint existente exige sesión y devuelve `403 ROOT_NOT_ENABLED` a Administrador, Jefa y Trabajador habilitados; conserva el rechazo por cambio obligatorio de contraseña. No devuelve sesiones, agregados ni eventos administrativos. No hay pantalla de métricas. Un usuario llamado root no obtiene privilegios.

Se conservan: bcrypt coste 12, Free, sesiones/revocación, permisos y cuentas mixtas, atomicidad/deduplicación, cuotas servidor por UUID/isolate, Retry-After/backoff y logs saneados con X-Request-ID. Los logs propios cubren errores/acciones sensibles, sin cuerpos, cantidades/notas, cookies/tokens, credenciales, username, IP, UA ni parámetros libres. La duración es tiempo de pared, no CPU. Los logs del proveedor tienen su propia política; no se activó captura/exportación. No existe nuevo histórico de uso disponible dentro de la app.

`0005_activity.sql` se conserva en [propuesta histórica](propuestas/0005_activity.sql), fuera de migraciones automáticas. No se aplica. Readiness no dependía de activity; preflight valida el mismo contrato de usuarios/Servicio, catálogo/ciclo y administrador. La base actual 0001–0004 está soportada; el catálogo legado también sigue admitido. No es una comprobación del ledger de migraciones ni un checksum integral del catálogo. El mantenimiento conserva su política de autenticación (dos días tras vencimiento, lotes de 1.000): no consulta ni borra telemetría ni aplica 14 días. Si una base ya tuviese una tabla activity, queda intacta y sin nuevas escrituras del Worker. No se modifica ningún esquema existente para desactivarla. La retención anterior era una propuesta, nunca un límite técnico de 14 días.

La interfaz, catálogo, referencias Excel, IDs/unidades, autoría y datos no cambian. Usuarios/Servicio se mantienen; supervisión/resto 3B y Excel 4 siguen pendientes. **3A operativa permanece abierta** (recursos Free, dominio/cookies/varias personas, recuperación externa, Android/piloto).

## Root/Desarrollador: diseño pendiente, sin implementación

Jerarquía deseada: Root > Administrador > Jefa de servicio > Trabajador. Root heredaría administración/inventario global y tendría acceso exclusivo a métricas técnicas. No otorga shell, secretos, repositorio o Cloudflare ni evita validaciones, confirmaciones, cuotas o auditoría. La jefa conserva solo Servicio y sus trabajadores; en mixtas únicamente asignaciones de Servicio. No se propone permitirle gestionar roles.

El rol futuro debe persistirse como identidad/capacidad validada por UUID en servidor y SQL; nunca se deduce de username=root, cabecera, frontend o asignación de ámbito. La base vigente solo admite worker/service_lead/admin: se necesitaría una migración independiente de telemetría, ensayada sobre base poblada y nueva antes de aprobarla. Debe preservar UUID, hashes, autoría, permisos, sesiones y FK/vistas/triggers; cualquier cambio de rol revoca sesiones y aumenta revisión. La protección del último Administrador existente se conserva; definir y probar además la del último Root antes de habilitarlo.

Provisionamiento propuesto: procedimiento fuera de la API, operado por custodio autorizado sobre destino explícito, con credencial privada introducida sin argumentos visibles, hash bcrypt 12 calculado fuera del Worker, UUID nuevo, username deseado root si está libre, cambio obligatorio y auditoría sin secretos. Una cuenta previa llamada root exige resolver la colisión: nunca promoverla automáticamente. Primer Root exige autorización específica; altas/promociones adicionales también quedan fuera de la API ordinaria. Ningún SQL, herramienta de alta ni cuenta Root se creó en este encargo.

Administrador ordinario nunca puede crear/promover Root ni cambiarle username, contraseña, rol, activación, ámbitos o eliminación. Las rutas directas y las guardias transaccionales deben comprobar actor/objetivo/revisión/sesión vigente, incluyendo carreras con cambios de rol. Root usaría su propio perfil/contraseña con las mismas garantías; su recuperación sería privada y auditada. Antes de implementarlo definir si habrá uno o varios Root y su custodio de recuperación. La futura pantalla es opcional y pospuesta; el control del endpoint es obligatorio antes de entregar datos. No hay un rol Root funcionando ni pruebas de tal implementación en esta entrega.

## Qué significarían las métricas

| Dato | Significado y límite |
| --- | --- |
| Cuenta distinta | UUID observado en una ventana; no acredita una persona distinta. |
| Sesión emitida/no vencida | Una cuenta puede tener varios dispositivos; una sesión abandonada no prueba actividad. |
| Solicitud | Una llamada HTTP; sondeos y reintentos generan varias sin otro usuario. |
| Concurrencia | Peticiones solapadas o trabajo simultáneo según definición explícita; no se deduce de sesiones vigentes ni actividad en cinco minutos. |
| Observación muestreada | Señal incompleta dependiente de ventanas/isolate/fallos; no contador exacto ni auditoría de inventario. |
| Auditoría de inventario | Historia transaccional ligada a operación/ciclo/autor; sigue conservándose, separada del uso técnico. |

No hay valores disponibles para las métricas de uso retiradas: ausencia de colección significa **no disponible**, nunca cero usuarios/errores. Las métricas del proveedor sobre solicitudes/CPU tienen su propio muestreo. No se promete identificar IA ni evitar copia de HTML/CSS/JS visibles.

## Histórico, almacenamiento y copias: evaluación sin selección de infraestructura

| Alternativa | Disponibilidad, coste y crecimiento | Custodia y recuperación |
| --- | --- | --- |
| Telemetría en D1 de la app | Consultable con PC apagado, pero comparte espacio/cuotas y carga con inventario; índices y actualizaciones también consumen recursos. No elegida. | Requiere autorización de esquema, agregados mínimos, alcance Root y política de borrado; Time Travel no es copia independiente. |
| Archivo/servicio cloud separado | Disponible con PC apagado; capacidad y posible coste recurrente según proveedor, salida y volumen. No se creó ni seleccionó servicio. | Cifrar antes de subir, permisos mínimos, clave fuera del proveedor, restauración ensayada; definir jurisdicción/retención/custodio. |
| Extracción SALIENTE a disco privado del PC (~1 TB) | Sin exponer disco, puertos o túneles. Usa espacio y conexión propios; el PC debe encenderse/conectarse para copiar. No aumenta capacidad D1. | Cifrado autenticado del archivo + disco protegido, clave fuera de Git y segunda custodia; verificar integridad y restaurar en destino nuevo. Una sola copia en ese PC se pierde con avería/robo. |
| Copias cifradas en PC + segunda ubicación independiente | Mayor resiliencia; almacenamiento/operación adicional a acordar. App online independiente del PC. | Primera recomendación para respaldos, condicionada al destino y custodio; fallo de la copia no debe detener conteos. |

Recomendación: mantener inventario/auditoría operativos en D1, dejar telemetría persistente apagada mientras se define utilidad y conservar métricas agregadas del proveedor como diagnóstico bajo acceso autorizado. Para respaldos, preparar después una extracción saliente diaria cifrada a disco privado y una segunda ubicación acordada. No convertir el PC en servidor ni trasladar autenticación por este motivo. Si se necesita histórico consultable con PC apagado, evaluar archivo cloud separado antes de recargar la base operativa. No se han activado tareas, copias, credenciales, túneles, puertos o servicios.

Cloudflare publica para D1 Free 500 MB por base, 5 GB por cuenta y siete días de Time Travel; cuotas diarias de 5 millones de filas leídas y 100.000 escritas. No se verificó consumo efectivo de esta cuenta. [Límites D1](https://developers.cloudflare.com/d1/platform/limits/), [precios/cuotas](https://developers.cloudflare.com/d1/platform/pricing/). Pages permite consultar métricas de Functions hasta tres meses, en intervalos máximos de una semana; sus logs de Functions son un stream que no se conserva automáticamente. No confundirlo con Workers Logs. [Métricas Pages](https://developers.cloudflare.com/pages/functions/metrics/), [logs Pages](https://developers.cloudflare.com/pages/functions/debugging-and-logging/). Referencias oficiales consultadas el 23-10-2026; no se inspeccionó ni cambió el panel del usuario.

Dimensionamiento de ejemplo, no medición: quince clientes visibles sondeando cada cinco segundos durante ocho horas producen 86.400 solicitudes, antes de ingresos, guardados y otras lecturas. Un registro por sondeo sería innecesario. Si se autorizase telemetría agregada, 15 cuentas × 6 familias × 8 horas × 1 ámbito × 1 estado darían hasta 720 claves/día en ese ejemplo; varios ámbitos/estados multiplican el espacio. No es predicción de uso ni se aplica al código actual. Medir bytes/filas reales antes de fijar meses/años; no extrapolar el crecimiento SQLite histórico como coste exclusivo de telemetría.

Separar tres productos: histórico de uso (diagnóstico, opcional), backup de datos (usuarios/permisos/catálogos/ciclos/conteos/historia/resultados, sensible) y Excel de cantidades (etapa 4, no es respaldo completo). Las herramientas existentes de backup generan SQL privado con checksum, **sin cifrar**; una automatización futura deberá cifrarlo antes de transferir y controlar el temporal. Checksum no aporta confidencialidad ni protege contra sustitución maliciosa sin autenticación/custodia.

Propuesta operativa por acordar: copia diaria fuera de jornada; conservar treinta diarias y doce mensuales según espacio/necesidad, con copia previa a cambios sensibles y restauración local mensual. No es política aplicada; la auditoría de inventario no se poda por este ejemplo. RPO objetivo 24 h solo si cada copia concluye y se verifica; PC apagado/red caída amplían la pérdida potencial. Registrar última copia válida, reintentar al volver y avisar solo de fallo/atraso relevante cuando se autorice automatización. RTO se fijará tras medir recuperación; objetivo inicial a evaluar: cuatro horas. Mantener claves fuera de Git/SQL, acceso mínimo y una recuperación de clave independiente del PC. Ninguna retención/horario/destino/cifrado/scheduler se seleccionó o activó.

Una exportación D1 puede bloquear consultas mientras se ejecuta; planificar ventana y comprobar tamaño/duración antes de automatizar. [Exportación D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/). Recuperar exige destino nuevo para ensayar, checksum/integridad/FK, sesiones recuperadas revocadas, revisión de cuentas/permisos y comparación de conteos/historial/deduplicación. Restaurar producción requiere autorización/ventana y puede perder cambios posteriores; no ejecutar el SQL a ciegas.

## Verificación nueva y límites

Ejecución nueva de Codex del 23-10: `npm test` **25/25**, Python **7/7**, runner aislado **17/17 etapas** (93.435 ms). Incluye build/preparación nueva, preflight positivo/negativo, integración, extended, usuarios/Servicio, carga, sync/backoff/refresh, navegador Servicio, rutas de seguridad, migración poblada 0003/0004, recuperación/mantenimiento, paquete y Pages HTTPS. Después se amplió y repitió solo operaciones: **9 grupos aprobados**, incluyendo consulta/limpieza sin tabla activity y conservación de una tabla opcional existente. No fallos en estas ejecuciones; no se elevan cuotas ni se deshabilitan protecciones para las pruebas.

Simulación nueva: **15 clientes**, 528 solicitudes totales (496 cronometradas), **151 escrituras / 150 reintentos deduplicados / 14 conflictos esperados / cero errores inesperados**; 6.395 ms, p50 36 ms, p95 77 ms, máximo 4.265 ms. Telemetría persistente desactivada; crecimiento SQLite 70 páginas de 4.096 bytes incluye inventario/índices y no acredita consumo Cloudflare. No es carga sostenida ni garantía de capacidad Free.

Casos añadidos: métricas 401 sin sesión y 403 para los tres roles; cabecera de rol falsificada y Administrador llamado root sin privilegios; revocación; cien sondeos sin escrituras de uso; creación/edición de perfil con rol root rechazadas; conteo aceptado con esquema sin telemetría. Regresiones de permisos globales/Servicio/mixtos, cambio de contraseñas, último administrador, conflicto, identidad, autoría y recuperación pasan en las suites existentes. No existe rol Root que ensayar: solo se verificó que no puede seleccionarse/escalarse en el código actual.

[Resultado nuevo estructurado](codex-continuidad-local-2026-10-23.json). Todo se ensayó con bases nuevas en scratch bajo el temporal del sistema, excluyendo secretos/respaldos/sources/libros/.git; no se usó ni reinicializó la base existente de 8790. La recuperación real conserva datos/UUID/history/resultados y revoca sesiones recuperadas; corrupción/destino existente rechazados. Los informes históricos del 22-10 permanecen intactos. No se repitieron audit de dependencias, pruebas remotas ni Android; no se atribuyen a esta revisión. El diff fue revisado por el mismo ejecutor, sin delegación ni auditoría independiente.

## Publicación y reversión

El usuario autorizó crear el commit local el 23-10-2026, después de revisar la entrega. Push/publicación siguen pendientes de autorización; Windows no requiere trabajo en esta sesión. Métricas y Root permanecen pendientes para más adelante. La base conocida ya tiene 0001–0004 y piloto-v3-servicio según evidencia histórica; el código actualizado no exige 0005 ni crea Root. Antes de publicar, revisar diff/historia/destino, pruebas y aceptación pendiente. No repetir bootstrap, fixtures, ciclo o migraciones aplicadas. No se hicieron fetch ni lecturas remotas en este encargo.

1. Con autorización de lectura remota, ejecutar preflight contra el destino exacto: `npm run preflight -- --remote --config wrangler.pages.production.jsonc --cycle piloto-v3-servicio`. Verifica esquema/catalog/ciclo; no cookies, CPU o configuración efectiva de Pages. Si falta 0001–0004 detenerse y revisar; no aplicar SQL automáticamente. 0005 no debe ejecutarse.
2. Comprobar recuperación/copia privada válida con autorización separada y variables Production: DB, APP_ENV=production, APP_ORIGIN HTTPS y ACTIVE_CYCLE_ID existentes. No necesita nueva configuración. Build `npm run build:pages`, salida dist; no muta D1 ni despliega por sí mismo.
3. Aprobar commit nuevo propuesto `fix(3a): disable usage persistence and defer Root metrics`, sin reescribir 98282ea/72c1aeb. Antes de sincronizar, autorizar lectura/fetch de inventory-v3 y verificar que no haya divergencia o trabajo local ajeno. Si la hay, detenerse y revisar.
4. Solo tras aprobación explícita de publicación, en Mac: `git push origin inventory-v3` (dispara Pages). Verificar commit/deployment y `verify:public` en un informe nuevo. Ensayos autenticados/escrituras de producción requieren alcance/cuentas concretos; no hacer carga remota. Todos los roles actuales deben recibir 403 al endpoint técnico.
5. Windows puede permanecer en cfece26 mientras tanto. Tras publicar, con checkout limpio y en inventory-v3: `git pull --ff-only origin inventory-v3`; si falla o hay cambios/divergencia, detenerse. No bundles, nuevas ramas, worktrees, resets, squash, rebase o force. No se verificó la eliminación de la rama temporal remota y no se recreó ni borró ninguna rama.

Reversión por capas: volver a cfece26 retira este refuerzo de código y conserva datos; volver a 72c1aeb reintroduce escritor/endpoint administrativo y dependencia 0005 en herramientas, por lo que **no es rollback compatible con la decisión actual de privacidad**. Cualquier retorno requiere revisar esa diferencia. Esta entrega no modifica esquema: no hay down SQL ni tablas que borrar. Git/Pages no revierte bindings/variables/ciclo ni cantidades/credenciales/historia. Configuración debe restaurarse por separado si alguien la cambia. Restauración de datos es otra operación autorizada con referencia temporal y revocación de sesiones; no equivale a revertir código.

## Registro histórico conservado

El informe inferior describe exclusivamente 22-10-2026 / 72c1aeb. Sus instrucciones de aplicar 0005, métricas para admin y retención de 14 días están sustituidas. Sus pruebas no se atribuyen a Codex ni a la versión actual.

<details>
<summary>Informe histórico del refuerzo del 22-10-2026 (no ejecutar su secuencia de publicación)</summary>

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

</details>
