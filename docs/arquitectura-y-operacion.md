# Arquitectura y operación

Estado de trabajo: etapa 4D, apertura sin conexión, HTML seguro y sincronización RTv2 del 28-10-2026. Este documento describe la implementación local. La evidencia de cada entrega distingue pruebas, preparación remota y publicación; no asumir que el código local ya está publicado.

## Recorrido actual

Pages protege las rutas normales de HTML y sirve recursos empaquetados con hash. Sin sesión, el acceso en línea redirige al ingreso. Las copias públicas del HTML usadas por el service worker son estructuras vacías, sin datos de personas ni inventarios; el cliente vuelve a exigir una sesión o una instantánea local autorizada y vigente. El catálogo completo, las migraciones, libros y código privado no se sirven como archivos.

El Worker valida entorno/origen, contrato de despliegue y sesión; después aplica autorización de la operación. Cada escritura mantiene idempotencia, revisión esperada, autorización transaccional y auditoría. D1 conserva usuarios, permisos, inventarios, conteos, historial y capturas inmutables. Los objetos privados ejecutan sincronización, exportación y trabajo costoso. R2 conserva respaldos cifrados y copias Excel en depósitos separados, privados.

La aplicación es de un local: las áreas y catálogos aprobados se concentran en `shared/deployment-domain.js`; los ítems y referencias pertenecen a `data/inventario/`. Centralizar estos datos no convierte la aplicación en una plataforma multilocal ni autoriza otras plantillas.

## Reglas y fronteras

| Responsabilidad | Fuente |
| --- | --- |
| Sesión, cuota y credenciales | `worker/session.js`, `worker/password.js` |
| Identidad y ámbitos | `worker/authorization.js`, vistas de permisos |
| Validación del comando de conteo | `worker/count-contract.js` |
| Coherencia, versión, idempotencia y auditoría atómicas | Triggers de operaciones, supervisión e inventarios |
| Interpretación de errores de D1 | `worker/db-errors.js` |
| Lecturas y proyección permitida | `worker/inventory-queries.js` |
| Catálogos aprobados y nombres históricos | `shared/deployment-domain.js` |
| Captura, consolidación y fidelidad | `worker/export-snapshots.js`, `export-plan.js`, `excel-generator.js` |
| Construcción pública | `scripts/build.mjs`, `build-pages.mjs` |
| HTML seguro y vistas de conteo | `shared/html.js`, `scripts/lint-html.mjs`, `pages/inventario/view-*.js` |
| Instantánea local por identidad | `shared/offline-cache.js`, `offline.js` |
| Estructura pública sin conexión | `shared/offline-worker.js`, manifiesto generado por el build |
| Registros compartidos en tiempo real | `operations/realtime-worker/index.js`, `shared/realtime.js`, `shared/inventory.js` |
| Importación de catálogo aprobada | `scripts/catalog-data.mjs`, `scripts/operations/catalog-data.mjs` |

Los triggers no se eliminan para reducir su número: protegen transacciones y carreras que una validación previa en JS no puede impedir. Las reglas que cambian una guarda necesitan una migración revisada. El contrato de comandos, pruebas de concurrencia y esta tabla permiten localizar esa modificación. D1 entrega las excepciones de RAISE dentro de texto; un decodificador central acepta códigos completos y el formato del proveedor. Un texto que solo contenga una palabra como STALE no se convierte en un conflicto de negocio.

## Cambios de rendimiento y mantenimiento

- El navegador recibe paquetes minificados con hash y caché inmutable; `modulepreload` adelanta sus dependencias. Las hojas CSS se combinan por página. Solo `/assets/*` evita la invocación del Worker; se elimina el techo de una regla por archivo. HTML y API conservan comprobaciones y `no-store`.
- `/api/summary` usa agregación SQL; `/api/search` selecciona productos autorizados en SQL. No hidratan conteos, ámbitos e historial mediante `boot()`. Se conserva búsqueda literal, actividad, alcance y correspondencia de mayúsculas españolas.
- Los índices por versión/área y versión/ubicación optimizan las consultas sin reconstruir los documentos históricos del catálogo. `0016_catalog_lookup_index.sql` añadió el índice de versión/ubicación y su sello; está aplicado en producción con preflight aprobado. No atribuir su rendimiento a un entorno que todavía no lo tenga.
- El contrato 15 comprueba una versión explícita, contadores de catálogo y presencia de las guardas/vistas requeridas. Deja de serializar y comparar todas las definiciones SQL en cada petición. D1 no permite `PRAGMA schema_version`.
- El preflight sigue comparando las definiciones completas selladas y las cardinalidades reales. Un índice ajeno no derriba el servicio; una guarda ausente sí. Alterar una guarda conservando su nombre se detecta en el preflight, no comparando su definición en cada petición. Este es el límite deliberado de la comprobación ligera.
- Las cardinalidades aprobadas siguen existiendo como datos de despliegue: protegen la correspondencia del libro. No se eliminan ni se infieren para aceptar silenciosamente un catálogo diferente.
- La plantilla `html` escapa las interpolaciones y solo sus fragmentos pueden cruzar `setHTML`. El lint sintáctico rechaza los puntos de inserción de HTML mediante cadenas fuera de esa frontera compartida. Las vistas de ámbitos, categorías, listado, conteo y resumen están separadas; sus pruebas conservan campos, foco, borradores y navegación. `escapeHtml` sigue centralizado para los usos de texto que lo necesitan.

## Cambiar el esquema o el catálogo

1. Crear una migración aditiva y sus pruebas sobre SQLite y D1 local. No editar migraciones históricas ni borrar datos para que las pruebas pasen.
2. Si cambia una capacidad requerida, actualizar contrato/manifest y comprobar compatibilidad con la versión publicada. La versión no sustituye las guardas de permisos.
3. Sellar la definición completa al final de la migración revisada, nunca mediante un arreglo genérico que acepte DDL desconocido.
4. Ejecutar preflight completo antes y después de la migración; no publicar con un fallo. Los fixtures y bootstrap son exclusivamente locales.
5. Usar `npm run catalog:data -- --export --output ARCHIVO` para obtener el paquete aprobado y `--import --input ARCHIVO --local --state ESTADO` para una base local aislada. La importación remota requiere un destino explícito y autorización. El importador valida versión, hash, cardinalidades, ámbitos, referencias Excel y límites de D1; un catálogo idéntico no se vuelve a escribir y una versión incompleta en uso activo se rechaza. Una versión nueva exige revisión del código aprobado. Las migraciones históricas con catálogo no se reescriben.

## Apertura y conteo sin conexión

El service worker conserva únicamente recursos estáticos con hash y estructuras HTML públicas del build. Se preparan al visitar cada pantalla, sin descargar anticipadamente todo el sitio. No almacena API, contraseñas, peticiones de escritura, objetos R2 ni descargas Excel. Las versiones anteriores se retiran al activar la nueva; una actualización espera a que las pestañas antiguas se cierren y no fuerza recargas que pierdan borradores.

IndexedDB conserva como máximo cuatro proyecciones: identidad, navegación, inventarios y una única instantánea de productos/conteos del último ciclo y área autorizados. Cada entrada tiene un límite de tamaño; no se duplica el catálogo por petición. La vigencia termina con la expiración real de la sesión informada por el servidor, con un máximo de doce horas. Un cambio de persona o revisión de cuenta invalida la instantánea. Las respuestas 401/403 la eliminan; los errores HTTP, incluido 503, nunca se sustituyen por datos anteriores. La alternativa local solo se usa ante fallo de red y para el mismo ámbito guardado.

La pantalla muestra «Sin conexión · datos del último acceso». Se puede continuar un borrador de conteo; el servidor sigue siendo la única autoridad de escritura. La reconexión no envía borradores automáticamente. Una operación incierta conserva su identificador y versión para un reintento explícito e idempotente. El ingreso, la administración y la exportación necesitan conexión.

Cerrar sesión elimina identidad e instantánea en todas las pestañas y avisa al service worker. Si no hay red, queda una marca de cierre pendiente: antes de la siguiente lectura en línea se revoca la cookie antigua en el servidor. Un teléfono compartido no recupera por esa cookie la instantánea de quien salió. Los borradores anteriores permanecen separados por persona y ciclo, sin enviarse desde otra cuenta. Los fallos de cuota o almacenamiento no convierten una respuesta aceptada del servidor en un fallo de guardado.

## Sincronización RTv2

El conteo solicita `v=2`; Pages vuelve a comprobar sesión, origen, inventario y ámbitos antes de enviar al objeto privado un contexto de protocolo 2. Inicio, Supervisión y clientes anteriores conservan los avisos v1, sin recibir registros por ese protocolo.

El objeto lee una sola vez el intervalo de historial compartido, limitado a mil entradas. Cada conexión recibe únicamente registros de su ciclo y ubicaciones autorizadas, en mensajes de hasta 250 registros y 48 KiB. Los intervalos incluyen cursores de inicio/fin; los mensajes vacíos cubren saltos de otras ubicaciones sin revelar su contenido. Después de esperar la consulta de datos se comprueba de nuevo la revisión de accesos desde el primario y se revisa la expiración antes de enviar contenido. Los ping/pong usan la respuesta automática hibernable del proveedor cuando está disponible; la alarma sigue controlando accesos y vencimientos cada tres segundos.

Con una conexión sana, un registro recibido actualiza conteos y progreso sin provocar una lectura HTTP en cada teléfono. La entrada inicial, una discontinuidad, un mensaje inválido o un cambio de configuración recuperan el estado mediante la API autorizada y drenan sus páginas antes de avanzar el cursor. Las versiones y cursores nunca retroceden; una respuesta antigua no sustituye un guardado o registro más reciente. La aplicación conserva los campos, foco, diálogos y borradores, y actualiza solo la instantánea local ya autorizada.

Si la conexión de conteo cae, la consulta de respaldo pasa a treinta segundos cuando el servidor ofrece tiempo real; sin esa capacidad se mantiene el intervalo anterior de cinco segundos. El refresco manual conserva su límite de treinta segundos. Esta degradación aumenta la demora de actualización y no garantiza permanecer bajo las cuotas Free durante veinticuatro horas de uso continuo: depende de usuarios, roles, actividad y costo real de las consultas. La prueba nativa con treinta conexiones demuestra el reparto compartido y sus guardas; no certifica CPU ni consumo facturado de producción.

## Entrega y operación

GitHub Actions usa Node 24, `npm ci`, verificación de formato, pruebas unitarias —incluido el lint HTML— y la batería aislada con navegador/base ficticios. Esa batería incluye HTML seguro, apertura offline y RTv2 con navegador y entorno nativo. No recibe credenciales de producción ni despliega. Publicar sigue siendo un push del usuario; un fallo del workflow informa del problema, pero no bloquea por sí solo un despliegue Git integrado de Pages. Una regla de protección o publicación condicionada a CI es una decisión separada.

Solo `dist` se entrega a Pages. No se genera un ZIP de la carpeta de trabajo; los respaldos, capturas privadas, `.git`, dependencias y credenciales quedan fuera. Los IDs de cuenta/base/bindings de la configuración no son secretos. No se trasladan sin necesidad a variables; los tokens y claves permanecen en secretos del proveedor o en archivos locales ignorados. No se rota una clave a ciegas: una exposición confirmada exige revocación y un plan para las copias cifradas anteriores.

La limpieza diaria elimina como máximo 1.000 sesiones y 1.000 claves de intentos vencidas desde hace dos días. No elimina usuarios, inventarios, historial, comandos idempotentes, capturas ni Excel. La cadencia de respaldos sigue siendo de 90 días y no cambia por la nueva limpieza.

## Decisiones y propuestas evaluadas

| Propuesta | Estado y motivo |
| --- | --- |
| Workers Paid | Rechazado por ahora: se mantiene Free. No se cambia la suscripción. |
| Dependabot | Pendiente por decisión del usuario. No hay configuración ni activación remota. CI sí está autorizado. |
| Offline y app shell | Implementados localmente con instantánea por identidad, expiración, borrado al salir y reintento explícito. Alcance y límites descritos arriba. |
| TOTP, mínimo 12 para admin, claves comunes e inactividad | Pendiente: definir recuperación y transición de cuentas, sesiones y pantallas; no aplicar requisitos nuevos silenciosamente. |
| «Cerrar otras sesiones» | Pendiente de diseño de sesión/dispositivo y confirmación; no confundir con cambiar contraseña, que ya revoca todas. |
| Plantilla `html`, lint y vistas separadas | Implementados; conservar la frontera única de inserción y sus pruebas al añadir pantallas. |
| Importador de catálogo | Implementado para el paquete aprobado; contenido separado de migraciones futuras, con validación y límites explícitos. |
| Retención de Excel | Se conservan las copias; no se aprueba borrado automático ni archivo por antigüedad en esta entrega. |

Referencias del proveedor: [límites de Workers](https://developers.cloudflare.com/workers/platform/limits/), [objetos SQLite y plan Free](https://developers.cloudflare.com/durable-objects/platform/pricing/), [error 1102](https://developers.cloudflare.com/workers/observability/errors/), [bindings de Pages](https://developers.cloudflare.com/pages/functions/bindings/).

## Monitor privado de recursos

La misma infraestructura privada de exportación aloja un objeto SQLite separado, sin rutas públicas. Consulta cifras agregadas de Analytics cada quince minutos: lecturas/escrituras D1 del día UTC, invocaciones/errores de Pages y operaciones/almacenamiento R2. Conserva solo esas cifras y la deduplicación de avisos. Una serie ausente no equivale a consumo cero. No ejecuta consultas del catálogo ni lee contenido de archivos para monitorizar.

Los avisos al 80/95% y los errores de recursos se registran como eventos agregados; Cloudflare Monitors consulta únicamente esos eventos del Worker privado y los envía al correo autorizado. La entrega de prueba fue confirmada por el usuario. Los logs automáticos de peticiones están desactivados; hay como máximo 96 muestras y unos pocos avisos por día. La llave solo tiene Account Analytics: Read, se guarda como secreto y vence el 28-10-2027. La purga diaria de autenticación conserva su horario y límite; los respaldos mantienen noventa días. El estado, las métricas y sus límites se detallan en [recursos Cloudflare](recursos-cloudflare.md).
