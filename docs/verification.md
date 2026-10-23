# Verificación — inventory-v3

## Preparación remota autorizada — 23-10-2026

Posterior al commit funcional bcae367: respaldo privado antes/después restaurado y con checksum verificado; 0007 aplicada sobre 0006; preflight remoto ready:true / operation-ux-0007; sin migraciones pendientes. Comparación local privada de filas canónicas: once tablas de datos preservadas sin cambios, integridad correcta y cero violaciones de claves foráneas. Las 16 comprobaciones anónimas posteriores pasan. Configuración efectiva Production y rama inventory-v3 verificadas. [Informe nuevo](preparacion-remota-ux-0007-2026-10-23.json).

No hubo push ni despliegue del código nuevo; el deploy actual sigue en e1c8a06. El usuario realizará el push por SSH. La comprobación del nuevo deployment y el recorrido autenticado/físico dependen de ese paso. Los resultados locales e informes anteriores se conservan fechados como históricos.

## Revisión UX/operación 0007 — comprobación local 23-10-2026

**49 pruebas Node, 7 Python y 24 etapas aisladas aprobadas.** Las etapas incluyen build Pages, preparación nueva, preflight positivo/negativo, integración, extended, usuarios/Servicio, 15 clientes concurrentes, sync/backoff, navegadores de usuarios/supervisión/resumen, carga lenta/refresh, administración, conflictos entre personas, vistas, migración poblada, respaldo/restauración, paquete público y Pages HTTPS. La etapa de vistas se repitió aparte después de actualizar sus expectativas al alta con acceso obligatorio y al foco del menú; los demás resultados finales no se sustituyen por los de un intento fallido. Además pasaron las suites de navegador simuladas de cuentas y diseño de supervisión.

[Informe nuevo y resultados exactos](revision-ux-local-2026-10-23.json). Los informes 3A/3B que siguen son históricos y no se sobrescribieron. El runner utiliza puertos 8990/8991 y una copia base de D1 por suite; no toca la base del proyecto, libros, credenciales ni servidor de vista 8890. Sin llamadas a producción ni mutaciones remotas.

La migración 0007 se prueba sobre 0006 poblada: IDs/rowids, fingerprints, resultados aceptados, catálogo, conteos, historia, usuarios/sesiones y auditoría preservados; integridad/FK válidas. Cubre reapertura final exclusiva de Administrador, reintentos antiguos después de cambios, revocación en transacción, conflictos entre ciclos de actividad, privacidad por rol y paginación. D1/workerd real confirma 8 grupos operativos; respaldo/restauración 10 grupos. No hay 0005 ni telemetría nueva.

Resumen/navegador: recuadros con punto/etiqueta/cifra en una línea, tonos y títulos a 320/390/1024 en ambos temas; categorías/contexto tras volver y revalidar; historial mínimo con tiempo relativo y fecha accesible; anulación autorizada; gesto exterior sin pérdida; transición 160/180 ms y movimiento reducido; avisos en visualViewport con descarte hacia arriba. Claves temporales con generación/regeneración, alta atómica y entrega solo confirmada; copiar/compartir sin secreto en URL/storage. Capturas inspeccionadas de resumen, menú y administración.

Contrato de libros repetido: 1.151 filas y 41 referencias Vitrina coinciden. No se cambiaron datos/referencias/migraciones 0001–0006 ni archivos originales. La regla de oro es mandatoria; exportación sigue pendiente.

La vista local 8890 se actualizó en otra copia de los datos ficticios anteriores, migrada a 0007; el original de esa vista permanece intacto. No hubo push/deploy. Android/iOS físicos, teclado real, lector de pantalla, contraste completo, capacidad sostenida y CPU facturada Cloudflare siguen sin certificarse. [Pasos manuales para publicar](publicar-revision-ux-0007.md).

Comandos reproducibles (solo local): `npm test`, `npm run test:bootstrap`, `python3 tests/workbook_contract.py`, `npm run test:security:isolated`, `node tests/account-revision-browser.mjs` y `node tests/shared/supervision-layout.mjs`. Los dos últimos usan API simulada y servidor local propio; el runner usa D1/workerd real.

## Etapa 3B — pruebas nuevas del 23-10-2026

Desarrollo local posterior a b24403d: 31 pruebas Node (incluyen seis grupos nuevos de permisos/atomicidad/estado Servicio/paginación) y 7 Python aprobadas. Suite aislada final **19/19**, incluidos API 3B D1 real, **5 grupos** nuevos de navegador y **10 grupos** de recuperación/mantenimiento. Carga final: 528 solicitudes totales, 151 escrituras, 150 reintentos deduplicados, 14 conflictos esperados y cero errores inesperados. [Evidencia nueva](supervision-local-3b-2026-10-23.json). No producción, bases existentes, fuentes/libros o respaldos privados. [Contrato y límites](etapa-3b.md).

## Continuidad con Codex — 23-10-2026

Pruebas ejecutadas nuevamente: `npm test` 25/25 y Python 7/7. Suite aislada **17/17** y repetición adicional de operaciones **9 grupos**, todas aprobadas. Carga nueva de quince clientes: 528 solicitudes totales, 151 escrituras, 150 reintentos deduplicados, 14 conflictos esperados y cero errores inesperados; 6.395 ms, p50 36/p95 77/máx 4.265 ms. Preflight y mantenimiento funcionan sin tabla activity; datos de una tabla opcional no se podan. [Resultado nuevo](codex-continuidad-local-2026-10-23.json), [cobertura y límites](seguridad-observabilidad-3a.md). Nuevos casos: todos los roles actuales sin acceso a métricas; Administrador con username root tampoco accede; revocación; cien sondeos sin escrituras de uso; tabla opcional existente preservada. Root solo diseñado, sin pruebas de un rol Root implementado. Los resultados del 22-10 que siguen son históricos y no describen persistencia vigente. No se consultó producción.

## Refuerzo 3A nuevo, posterior al traspaso — 22-10-2026

`npm test` 25/25 y Python 7/7; npm audit completo sin avisos. Runner `npm run test:security:isolated`: 17 etapas aprobadas en scratch, Worker/D1 y Pages HTTPS separados de 8790. Última simulación: 15 clientes, 528 solicitudes totales (496 cronometradas), 151 escrituras/150 retries deduplicados, 14 conflictos esperados, cero errores inesperados; 6.332 ms, p50 34/p95 84/máx 4.206 ms. No mide CPU ni filas facturadas Cloudflare. Recuperación, migración 0005 nueva/poblada, retención, paquete sin internos/sourcemaps, permisos, backoff, fallos de telemetría y cookies HTTPS locales comprobados. No pruebas de la app remota en este encargo; evidencia anterior es histórica. [Resultados estructurados](seguridad-observabilidad-local-2026-10-22.json), [cobertura, intentos intermedios, límites y pendientes](seguridad-observabilidad-3a.md). 0005 remota se descartó el 23-10; preflight remoto/deploy y aceptación operativa continúan pendientes. No se sobrescribieron informes históricos.

## Revisión al retomar con Hermes — 22-10-2026

Estado actual y alcance completo en [revision-hermes-2026-10-22.md](revision-hermes-2026-10-22.md); evidencia estructurada nueva en [revision-hermes-2026-10-22.json](revision-hermes-2026-10-22.json), sin sobrescribir informes anteriores.

- Git: rama `inventory-v3`, HEAD y seguimiento local en `cfece26`. Consulta viva GitHub por SSH rechazada (`publickey`); no se cambiaron credenciales ni referencias. Pages confirma commit completo en despliegue canónico `7df21f3c-e662-443d-a953-b9e502863882`, etapa deploy `success`.
- Local repetido ahora: `npm test` **19/19**, `test:bootstrap` **7/7**, contrato de **1.151 filas y 41 referencias Vitrina** coincidente, build Pages correcto en copia scratch. Sonda SQL en dos bases exclusivamente en memoria aprobada: catálogos/alcance antes-después de 0004, reintento aceptado tras cierre sin escritura, operación nueva cerrada y reintento sin permiso rechazados, integridad/claves válidas. No se recreó `dist` canónico ni se tocó el servidor/base activos en 8790; no se repitieron suites mutantes o carga.
- Producción, solo lectura: **16/16 GET anónimos**, JSON/no-store/cabeceras/privacidad correctos y **cinco assets** coincidentes byte a byte/SHA-256 con este checkout. El usuario confirmó funcionamiento online; esta sesión no creó una sesión autenticada ni modificó contraseñas/cuentas/conteos.
- Métricas Pages posteriores al deploy (16:52:52–17:57:47 UTC): proveedor informa **1.399 success, 2 exceededResources y 4 clientDisconnected**, agregados adaptativos. Los dos errores están en el minuto **17:18 UTC / 14:18 -03**; CPU p50 10 ms, p99 162,149 ms, unidades comprobadas en esquema antes de convertir. No incluyen URL ni `outcome=exceededCpu`: confirman nuevos fallos por recursos, no causa individual ni caída permanente de login. Dataset genérico Workers vacío; dataset específico Pages con 33 grupos, límite 1.000 no alcanzado.
- D1 `NOT_INITIALIZED` histórico corregido, distinto del `exceededCpu` histórico posterior. `/api/me` responde ahora 401 tras el control de inicialización; no se ejecutó SQL remoto ni auditoría integral de D1. Free se mantiene; Supabase continúa como alternativa sin integrar, no cambio obligatorio.

La evidencia anterior permanece fechada como histórica. No convertir «sin push en aquella revisión» en «cfece26 sin publicar», ni pruebas locales anteriores en ensayos nuevos de producción. 3A mantiene aceptación operativa pendiente; 3B conserva usuarios/Servicio y faltan supervisión, rectificación/anulación, activación y cierre/reapertura. Excel sigue en 4 y no se implementó.

Cierre de documentación: 18 Markdown, 154 enlaces locales, 28 scripts npm referidos y 19 informes JSON validados, sin errores; `git diff --check` correcto. 99 archivos versionados protegidos mantienen SHA-256 antes/después. No hay diff de código, migraciones ni configuración contra `cfece26`; cambios previos y servidor/base existentes conservados.

## Traslado y estado informado — 22-10-2026

El usuario informó que el despliegue de `cfece26` funciona; no se presenta esa confirmación como un ensayo autenticado completo independiente. Al iniciar el traslado, local y `origin/inventory-v3` coincidían. El renombrado local conservó mediante SHA-256 **3.180 archivos y enlaces, 431.883.989 bytes**, incluidas bases, secretos locales ignorados y Git; el servidor se detuvo antes de mover. No se modificaron recursos remotos. La ruta canónica es `/Users/lucio/workspace/inventario_brioche`. Medir la recurrencia CPU actual antes de decidir un cambio de autenticación. [Punto de continuación](traspaso-hermes.md).

Comprobaciones posteriores al traslado: `npm test` **19/19**, construcción Pages correcta y Python **7/7**. Servidor reiniciado desde la nueva raíz usando la misma `.wrangler/test-state`, sin inicializarla: Cuenta y cliente 200; `/api/me` 401 JSON sin sesión. Hermes **v0.22.4**, proyecto `inventario_brioche` creado/activo por su CLI, configuración versión 51 validada sin requisitos faltantes (solo opciones de proveedores no configurados). El cargador real incluye AGENTS.md y el enlace al traspaso sin bloquear contexto; el lanzador pasa sintaxis y `--help` sin llamadas a un modelo. Perfil/SOUL ya acordes a las preferencias; se corrigió una memoria obsoleta de modelo con copia privada previa. Modelo/proveedor, credenciales y WhatsApp se conservan. No se probaron envíos WhatsApp ni una conversación nueva de pago/modelo; no hubo commit/push.

## Recuperación histórica previa a publicar cfece26 — 22-10-2026

El usuario subió la reversión `55dfc2b` y después pidió recuperar íntegramente el incremento. Se restituyeron localmente los árboles de `9dfef56`, `94d3a83` y `2c284cd`, conservando el historial. En esta recuperación: `npm test` **19/19**, `build:pages` correcto y pruebas Python del bootstrap/orden SQL **7/7**. No se repitieron suites completas de navegador, integración ni carga; sus resultados anteriores se conservan fechados más abajo. Sin push, despliegue ni modificaciones remotas en esta revisión.

Comprobación pública breve después de la reversión: `/pages/cuenta/` 200, `/api/me` 401 JSON, y los archivos `/pages/cuenta/cuenta.js` y `/shared/client.js` coincidían mediante SHA-256 con el código revertido. Sin autenticación ni escrituras. No demuestra estabilidad de ingreso ni que la aplicación completa funcione en Free. Un primer intento de comparación usó una ruta local inexistente; se corrigió y solo se registran aquí los cuatro resultados válidos.

La comparación histórica entre `5d80658` y `2c284cd`, repetida ahora hasta `cfece26`, confirma **cero cambios en `worker/password.js`**. El control de inicialización exigía la vista `inventory_permissions`, ausente al primer despliegue; incompatibilidad corregida con 0003/0004/ciclo. Después hubo 1102/`exceededCpu`, diagnóstico distinto. La recuperación no aporta corrección específica de CPU, pero el usuario sí confirmó funcionamiento tras publicarla. No hay perfil comparativo remoto por fase que atribuya los errores a consultas nuevas. Reutilizar sesión evita bcrypt; ingreso nuevo sí lo ejecuta. Métricas actuales por recursos y sus límites: sección inicial.

La propuesta anterior de preparar Supabase Auth quedó subordinada a evaluar el comportamiento actual; no es tarea obligatoria ni proveedor integrado. Free se mantiene. `cfece26` ya está publicado y funcionando según el usuario; no documentarlo como pendiente de publicar ni como arreglo específico de CPU. [Diagnóstico y alternativa opcional](autenticacion-free.md).

## Reparación histórica de la demo anterior a cfece26 — 22-10-2026

El usuario publicó `94d3a83` en `inventory-v3`; Pages registra el despliegue `0ffd646a` y los archivos públicos de administración/CSS coinciden con el código local. GET `/api/me` devuelve HTTP 503 JSON `NOT_INITIALIZED`, con no-store y cabeceras de seguridad. No es una compilación pendiente ni una versión antigua en caché.

Consultas de solo lectura a la D1 remota `inventario-login-v3`: únicamente constan `0001_core.sql` y `0002_catalog.sql`; falta la vista `inventory_permissions` de 0003. Solo existe el ciclo abierto `piloto-v3`, con catálogo anterior. Una copia privada de la configuración de Pages confirma `DB` correcta, `APP_ENV=production`, origen correcto y `ACTIVE_CYCLE_ID=piloto-v3`. D1 informó cero filas escritas por el diagnóstico.

El usuario autorizó la corrección y aclaró que el sitio es una demo con cuentas mínimas. Se completaron respaldo privado (ya iniciado antes de esa aclaración; SHA-256 y permisos verificados), migraciones 0003/0004 y ciclo nuevo. Pages conserva las demás variables y DB; `ACTIVE_CYCLE_ID=piloto-v3-servicio`. Reintento del commit aprobado `94d3a83`: despliegue `982d494e`, terminado correctamente, sin push ni cambios de código. No repetir esas migraciones/ciclo ni el primer administrador. [Procedimiento para otros entornos](usuarios-y-servicio-3b.md).

Comprobación pública de aquella reparación: **16/16**, sin sesión ni solicitudes mutantes; API vuelve a 401 JSON. [Informe histórico 3B](publico-servicio-3b.json). Un ingreso y primeras altas funcionaron; después alta/ingreso fallaron con HTML 503/error Cloudflare **1102**. El tail histórico confirmó `outcome=exceededCpu` y `Worker exceeded CPU time limit.` y se cerró. **En esa revisión no se aprobó estabilidad de autenticación.** No se redujo bcrypt coste 12 ni cambió facturación; no era una cuota de filas D1. La recuperación/confirmación posterior del usuario y la nueva lectura de métricas se documentan arriba, sin extrapolar este diagnóstico individual a todas las solicitudes actuales.

Cuentas de demo: **7 activas**, un Administrador conservado, una Jefa de servicio y cinco trabajadores (Bodega, Cocina, Panadería, Pastelería, Servicio). Tres altas por API se aceptaron; las tres restantes se inicializaron explícitamente en D1 con hashes del mismo módulo bcrypt coste 12 calculados localmente, sin rebajar parámetros ni habilitar fallback. Las tres cuentas antiguas de ensayo se retiraron con auditoría y conservación de su identidad histórica. Las seis nuevas mantienen cambio obligatorio de contraseña temporal. Credenciales individuales en un archivo privado e ignorado bajo `.backups/`; ninguna contraseña se incluye en docs o Git.

Consultas históricas comprobaron siete cuentas, permisos (Administrador: 14 nodos; Jefa/Servicio: 10; área directa: 1), dos ciclos y diez conteos antiguos conservados. Cero autores huérfanos; no había conteos en el ciclo nuevo. `PRAGMA integrity_check` remoto rechazado (`SQLITE_AUTH`); se sustituyó por consultas explícitas de referencias, sin declarar equivalencia integral. [Informe histórico](despliegue-demo-3b.json). No se hizo carga/recorrido autenticado completo; esos censos no se repitieron ahora. La decisión vigente es mantener Free e investigar recursos antes de seleccionar cambios, no activar Paid ni migrar por obligación.

## Orden de Usuarios y accesos en móvil — 22-10-2026

Pestañas Cuenta/Accesos/Seguridad por usuario, jerarquía de ámbitos plegable y bloques separados para contraseña/eliminación. Se retiró el subtítulo; contador filtrado al lado de Cuentas existentes y avisos de alta en dos líneas. Sin cambios de API, esquema, catálogo, contraseñas ni recursos remotos.

- `npm test`: **19/19**.
- `npm run test:admin-layout`: **6 grupos**, cero errores JavaScript. Sin desborde a 320/390/1024 px en claro/oscuro, pestañas de 44 px, jerarquía de Servicio/Garzones, teclado/foco, total junto al título y ayuda en líneas separadas. Cambiar de pestaña conserva campos y asignaciones; el envío incluye los permisos de un panel oculto. Se intercepta un fallo para comprobar conservación sin escribir en D1. La variante visual de cuenta mixta usa un DTO simulado aislado; las restricciones reales de servidor pertenecen a las pruebas del incremento descritas más abajo. [Informe específico](usuarios-diseno-local-3b.json).
- `test:views`: **8 grupos**; alta real local, contraseña temporal/cambio obligatorio, otorgar dos ámbitos en sesión activa y restablecer con cancelación/revocación conservados.
- `test:users-service:browser`: **6 grupos**; jefa, alta/accesos, eliminación confirmada/versionada y foco, perfil propio, navegación directa y Copería/Vitrina. Se utiliza la segunda jefa ficticia disponible; no se restablece la contraseña ya modificada de la primera.

Las comprobaciones de HTML detectaron que el patrón anterior de username no era válido con la sintaxis actual del navegador. Se corrigió sin cambiar la regla del servidor; un campo inválido oculto ahora abre Cuenta y recibe foco. Capturas de los tres paneles en `test-results/admin-layout/`; Seguridad clara y Accesos oscuro a 320 px se inspeccionaron visualmente. El navegador integrado rechazó observar la pestaña existente por su política de acceso; no se automatizó esa pestaña. Las pruebas anteriores usan el navegador aislado del repositorio y D1 local de ensayo, no producción. El servidor de revisión queda disponible en `http://127.0.0.1:8790/pages/admin/` para recarga manual. Android físico y lector de pantalla siguen pendientes; no se repitió carga de 15 clientes por este ajuste de presentación.

Tras la revisión, el usuario confirmó conservar el cambio obligatorio de contraseña temporal sin flecha al inventario y con salida mediante menú → Cerrar sesión. No se editaron Cuenta, autenticación ni servidor por esa observación. El cierre documental no repite las suites funcionales ya aprobadas: revisa sintaxis, enlaces, informes y diff antes de preparar el commit. Sin push ni cambios remotos.

## Incremento de usuarios y Servicio de 3B — 22-10-2026

Cambios locales: rol Jefa de servicio, administración acotada de trabajadores/cuentas mixtas, username administrado, nombre visible propio, eliminación irreversible y navegación directa. Catálogo nuevo con 32 productos en Copería, 42 en Línea/Armado y 41 conteos de Vitrina. [Contrato y preparación del despliegue](usuarios-y-servicio-3b.md). No se ejecutaron cambios remotos, push ni despliegue; el sitio revisado `5d80658` es anterior a este incremento. Se conservaron los cambios documentales previos; `.DS_Store` no se incluye.

| Comprobación ejecutada | Resultado |
| --- | --- |
| `npm test` | 19/19: referencias, cantidades/estados, navegación, rol acotado, migración con datos e irreversibilidad |
| `test:bootstrap` | 7/7 Python: cuatro casos del administrador y tres de orden/seguridad del SQL de recuperación |
| Contrato de libros | 1.151 filas originales sin diferencias y 41 referencias Vitrina cotejadas en producto/unidad; libros sin modificar |
| `test:integration` / `test:extended` | 11/11 y 6/6; se adapta el renombrado al perfil y las mutaciones al contrato de revisión |
| `test:users-service` | 9/9: dos jefas, límites por API, cuentas mixtas, alta temporal, perfil, username/revocación, identidad de pestaña, eliminación, último administrador y concurrencia |
| `test:migration-service` | Migraciones 0003/0004 sobre D1 local con usuarios/sesiones/conteo/historial previos; datos idénticos, claves foráneas/integridad y reintento conservados |
| `test:browser` / `test:views` / `test:ux` | 14, 8 y 8 recorridos/grupos, sin errores JavaScript |
| `test:users-service:browser` | 6 grupos: jefa sin regreso global, alta/username, eliminación/versionado/foco/Escape, perfil, inicio directo y Copería/Vitrina; sin errores JavaScript |
| `test:sync` / `test:refresh` | 3 y 7; borradores/campos conservados y espera/peticiones manuales limitadas |
| `test:pages` | 6/6 sobre Pages HTTPS + D1 local separada, cookie segura, origen, guardado/reintento y logout |
| `test:operations` | 7/7; exportación/importación D1 real, revocación recuperada, triggers, historial/deduplicación y retención |
| `test:load` | 15 clientes, 496 solicitudes en 6.695 ms: 482 HTTP 200, 14 conflictos 409 esperados, cero errores inesperados |

La simulación aceptó 151 escrituras y 150 reintentos sin duplicación; cantidades, operaciones, historial y resultados finales consistentes. Latencias locales: p50 36 ms, p95 99 ms, máximo 4.400 ms, incluyendo ingresos bcrypt. [Informe de carga de este incremento](carga-local-3b.json). No extrapolar a capacidad de producción ni a un día completo.

Evidencia nueva: [API](usuarios-servicio-local-3b.json), [migración D1 poblada](migracion-servicio-local-3b.json) y [navegador](usuarios-servicio-vistas-3b.json). Capturas locales en `test-results/users-service/`; perfil revisado a 320/390/1024 px en ambos temas y eliminación inspeccionada en claro/oscuro después de completar la transición. El diálogo comienza en Cancelar, Escape devuelve el foco y una revisión cambiada impide borrar hasta revisar/confirmar otra vez.

La prueba de recuperación detectó un fallo real del orden exportado tras reconstruir `users`: había datos de tablas hijas antes de crear esa tabla. Se corrigió el importador local para ordenar una copia temporal privada con un analizador de sentencias SQLite, sin ejecutar SQL en Python ni alterar el respaldo. Se repitió y pasó la recuperación completa. Los ensayos de navegador también se ajustaron al ingreso directo y a revisiones administrativas, incluida una contraseña que había cambiado desde abrir la cuenta; los resultados de la tabla son las repeticiones aprobadas.

3B sigue abierta: tablero, consulta administrativa avanzada del historial, rectificaciones/anulaciones de conteo, activación global de productos, revisión/cierre/reapertura. 3A mantiene pendientes de CPU/plan, recorrido completo del dominio, recuperación remota/copia externa, Android físico y piloto. «Activar zonas» en este incremento son accesos por persona; no se implementó apagado global. La consolidación/exportación Excel continúa en etapa 4.

## Registro de etapa 3A — 21-10-2026

Rama `inventory-v3`; `inventory-v2` conserva `3d2331919ea8bdf39daf1f095ea09877d69e6dd0`. Se preservaron los cambios previos. No se modificaron libros, catálogos de referencia, `sources/` ni Pedido. El usuario preparó D1 y publicó por su cuenta hasta `5d80658`; configuración en [despliegue-pages.md](despliegue-pages.md). Las comprobaciones posteriores no desplegaron ni modificaron conteos, cuentas o permisos. El ingreso/cierre de sesión sí crea/revoca los metadatos normales de sesión.

Runtime: Node 24.21.0, Wrangler 4.151.3/workerd 1.20261019.1, D1 local, bcryptjs 3.0.3, esbuild 0.28.2; Chromium 141 mediante Playwright 1.56.1. Los conjuntos automatizados usan bases desechables separadas del desarrollo: Worker 8790 y Pages HTTPS 8791.

## Comprobación histórica del sitio publicado — 21-10-2026, `5d80658`

La consulta de despliegues de Pages confirmó éxito de `5d80658` en `inventario-login`, con URL de despliegue `https://0458b9d4.inventario-login.pages.dev`. En el dominio principal, los cuatro archivos `/shared/client.js`, `/shared/refresh-limit.js`, `/shared/shared.css` y `/shared/inventory.js` coincidieron exactamente con los de ese commit local al solicitarlos sin reutilizar caché. Los cambios de menú, formularios, mínimo de ocho caracteres e icono compacto ya están publicados.

Se repitió `npm run verify:public` contra `https://inventario-login.pages.dev`: **16/16**, `routingPassed`, `securityHeadersPassed` y `passed` en `true`, sin autenticación y **cero solicitudes mutantes**. El resultado coincide con [publico-3a.json](publico-3a.json), que conserva exclusivamente esa comprobación anónima.

Recorrido manual en navegador contra el dominio real:

- Cierre de sesión e ingreso nuevo con la cuenta administradora existente; Inicio muestra las cinco áreas por su rol global.
- Login sin menú, con toggle de tema, ayuda centrada y ojos SVG; cambio de contraseña con cabecera en fila, ayuda de ocho caracteres y flecha superior. No se cambió la contraseña.
- Panel de cuenta desde la derecha, punto/texto de sincronización a la izquierda e icono pequeño cian a la derecha. Al pulsarlo pasa a «Actualizando…» y después «Sincronizado»; queda deshabilitado con espera de 30 segundos y vuelve a habilitarse al terminar.
- Administración abre y carga las cuatro cuentas existentes; comprobación de lectura, sin altas, cambios de acceso ni restablecimientos.
- Apariencia oscura y vuelta a clara en el menú.

Este recorrido no comprueba conteos ni conflictos con trabajadores en producción, revocación de permisos/sesiones de terceros, atributos de cookie en herramientas del dominio, CPU facturada, recuperación remota, dispositivo Android físico ni carga real. Esos criterios siguen abiertos. Las suites completas y la simulación de 15 clientes que siguen son **locales**; no se repitieron contra la base pública. No se guardan credenciales en los informes ni en el repositorio.

La revisión documental posterior contrastó estos resultados con contexto, roadmap, accesos, operación y despliegue: **12 documentos, 95 enlaces locales, 24 comandos de `package.json` y 11 informes JSON**, sin errores; `git diff --check` correcto. No volvió a ejecutar suites funcionales por cambios exclusivamente documentales. En esa revisión documental del 21-10 todavía no había implementación 3B.

## Actualización manual en el panel de cuenta — 21-10-2026

Revisión posterior al comentario visual del usuario: punto y «Sincronizado» a la izquierda, icono cian de 18 px al extremo derecho, sin fondo, conservando un área táctil de 44 px. Una comprobación manual cada 30 segundos por usuario en el navegador; el timestamp compartido entre páginas/pestañas no contiene credenciales ni inventario. Se usa Web Locks cuando está disponible para serializar intentos simultáneos. Los errores consumen también la espera; no se encolan reintentos ni se consulta automáticamente al terminarla.

Consulta incremental en Inventario (una página, límite existente de 250 movimientos); verificación de sesión/conexión en las demás vistas. No envía borradores, recarga formularios ni vuelve a descargar el catálogo. Peticiones manuales y sondeo comparten una consulta en curso; un sondeo aceptado hace menos de cinco segundos se reutiliza sin petición adicional. El control indica ocupado, error recuperable o pendiente según corresponda. Es un límite de interfaz por navegador, no una cuota global de API. No se añadieron contadores/escrituras en D1 ni se cambió el sondeo de cinco segundos que se pausa al ocultarse.

`npm test` **16/16** y `npm run test:refresh` **7/7 grupos** en la revisión del icono compacto. La suite nueva compara cantidades/campos/borradores y tablas de conteos, operaciones e historial antes/después: actualizar no modifica ninguno, incluso ante cambio remoto o fallo de red. Diez intentos repetidos y otro desde una segunda pestaña no generan solicitudes; terminar la espera tampoco. Comprueba reutilización del sondeo reciente, petición simultánea y formulario de contraseña conservado. Tamaños 320/390/1024 px en ambos temas, sin errores JavaScript; capturas en `test-results/refresh/`, informe en [actualizacion-local-3a.json](actualizacion-local-3a.json). Se inspeccionó el menú local del administrador en el navegador.

Regresiones repetidas en esta revisión: `test:sync` **3**, `test:views` **8**, `test:browser` **14** y `test:pages` **6** por HTTPS local, con D1 separadas y cero errores JavaScript en las suites de navegador. Sintaxis de los cuatro módulos modificados/nuevos, construcción `build:pages` y `git diff --check` correctos.

Sin cambios en servidor, migraciones, catálogo o contraseñas. No se repitió la carga de 15 clientes. El ajuste se publicó en `5d80658` y se comprobó como se describe arriba. `.DS_Store` permanece sin seguimiento y fuera de los commits. La comprobación de despliegue solicitada ya está realizada; en ese momento 3B seguía sin implementación y 3A conservaba sus pendientes operativos.

## Menú, formularios y mínimo de contraseña — 21-10-2026

Revisión local solicitada antes de 3B. Inicio, Inventario, Cuenta autenticada y Administración reúnen identidad/sincronización/acciones/tema en un panel translúcido que entra desde la derecha mediante cuatro cuadros SVG. El ingreso **sin sesión** conserva solo el toggle claro/oscuro, sin icono ni panel de menú. El listado de ítems continúa entrando desde la izquierda. Encabezados de acceso/cambio en fila, ayuda de contacto centrada, ojos SVG y flechas superiores de regreso, sin los textos/acciones duplicados señalados por el usuario.

Resultados de esta ronda: `npm test` **16/16**, primer administrador **4/4** con contraseña de ocho caracteres, extended **6/6** (alta/cambio/restablecimiento con ocho; siete se rechazan sin revocar una sesión válida), vistas **8 grupos** a 320/390/1024 px en ambos temas, navegador **14 recorridos**, UX **8/8** y Pages HTTPS local **6/6**. Sin errores JavaScript en las suites de navegador. Contrato Excel: **1.151 filas iguales**. Los informes de vistas y UX se actualizaron con esas ejecuciones; el tamaño de bootstrap del ensayo UX es ahora 29.126 bytes, dependiente de los fixtures presentes.

Se comprueba panel derecho anclado tras su transición, contenido de fondo inerte, Tab/Shift+Tab contenido, Escape/toque exterior y devolución de foco; persistencia del tema y alternancia accesible del ojo sin alterar el campo. Las capturas están en `test-results/3a/`; se inspeccionaron login claro, menú oscuro y cambio de contraseña de la app local. La regresión de conteo conserva las tres acciones, borradores, reintento seguro y aislamiento al cambiar de usuario.

Decisión confirmada: mínimo **8 caracteres**, máximo técnico de 72 bytes UTF-8 sin truncamiento y bcrypt coste 12. La ayuda de pantalla no muestra bytes. Sin migración de credenciales existentes, datos ni esquema; CPU/plan permanece pendiente. No se ejecutó carga remota ni se repitió la simulación local de 15 clientes, al no cambiar reglas de conteo. Esta revisión UI ya está publicada e incluida en la comprobación de `5d80658` de arriba.

## Cierre técnico adicional — 21-10-2026

El usuario aplazó la prueba operativa con el equipo. Se completó el trabajo independiente disponible; la aceptación operativa permanece abierta y no impide desarrollar 3B. [Guía de recuperación, retención y pendientes](cierre-tecnico-3a.md).

- `npm run test:operations`: **7/7 grupos**, con migraciones y exportación/importación Wrangler reales sobre dos D1 locales temporales. Respaldo privado 0700/0600 y SHA-256; rechazo de destinos públicos/existentes y SQL alterado; tablas de cuentas/permisos/catálogo/ciclo/conteos/historial/resultados idénticas; integridad y claves foráneas válidas; revocación de sesiones y auditoría de restauración. Los triggers siguen funcionando; reintentar una operación anterior no repite escritura ni recupera un valor superado.
- Retención: consulta sin cambios; dos ejecuciones eliminan 1.005 sesiones y 1.005 claves antiguas en lotes máximos de 1.000 por tabla. Conserva sesión recientemente vencida, cuota vigente, conteos, auditoría e IDs de operación. No se ejecutó ninguna limpieza remota. Informe: [operaciones-local-3a.json](operaciones-local-3a.json).
- `npm run verify:public`: **16/16 comprobaciones públicas aprobadas**, cero solicitudes mutantes, sin credenciales. El usuario repitió la ejecución el 21-10-2026 después del despliegue y compartió la salida: `routingPassed`, `securityHeadersPassed` y `passed` son `true`. Inicio/Cuenta/código de skeleton publicados; seis API rechazan con JSON 401/no-store y cabeceras; catálogo, SQL, bootstrap, Worker, libro y carpetas privadas inaccesibles. Informe generado por esa ejecución: [publico-3a.json](publico-3a.json). No certifica sesiones del dominio, permisos autenticados, CPU ni carga remota.
- Corrección: todas las respuestas del Worker, incluidos errores, reciben CSP, protección de marcos, nosniff y política de referencia. Antes del despliegue faltaban esas cabeceras en los seis 401; el resultado anterior quedó en el commit `4aac9bc`. `npm test` pasó **15/15** con aserciones de errores 503 y el verificador local **16/16 incluyendo cabeceras**, en [publico-local-3a.json](publico-local-3a.json). La comprobación aportada por el usuario después de publicar cierra el pendiente público de cabeceras.
- `npm run test:integration`: **11/11**, 10,98 s en esta ronda, con versiones, sumas concurrentes, cuotas, permisos revocados y rollback por fallo de historial. Se conserva el informe anterior de carga de 15 clientes; no se repite sin cambiar reglas de conteo.
- Se repitieron `npm run test:extended` (**5/5**) y `npm run test:pages` (**6/6**) con el Worker actualizado: sesiones en dos dispositivos, autoría estable, cookie segura, guardado/reintento HTTPS, permisos y cierre de sesión.
- `npm run profile:local`: **6 muestras** de bcrypt coste 12 con el módulo real; CPU del proceso Node entre **274 y 325 ms**, tiempo transcurrido 274–331 ms. No es CPU facturada en Workers, no incluye D1 ni certifica Free. Informe: [perfil-local-3a.json](perfil-local-3a.json). El intento de perfilado con inspector workerd no produjo medición utilizable; no se declara aprobado.

El usuario **supone** Workers Free porque no contrató pagos; no confirmó el panel. El límite publicado es 10 ms CPU/solicitud. Por la evidencia local no se puede aprobar compatibilidad del ingreso actual con Free. Falta confirmar plan y medir CPU/errores reales de ingreso, creación/restablecimiento y cambio de contraseña; resolver alojamiento antes del uso real. No se debilitó bcrypt ni se modificó facturación. Fuentes: [límites](https://developers.cloudflare.com/workers/platform/limits/), [medición CPU](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/).

Las conexiones loopback y el runtime de D1 fueron bloqueados inicialmente por el sandbox (`EPERM`); se repitieron con permiso de ejecución local y pasaron. No es un fallo de la API. Los respaldos/remotos, copia externa, Time Travel, Android físico y piloto no se certifican con este ensayo local.

## Revisión UX y reducción de espera — 21-10-2026

El usuario aportó los logs exitosos de `ec80d9c` y después `fb67ecb` en Pages y confirmó que funciona. La inspección pública mostró la vista nueva de ingreso, JSON `SESSION_REQUIRED` en `/api/me` y `/api/bootstrap` y `NOT_FOUND` en el archivo de catálogo global; el verificador posterior también confirma los skeletons publicados y la corrección de cabeceras. Esta evidencia verifica esos accesos públicos, no todos los recorridos autenticados o el rendimiento del entorno real.

`npm run test:ux`: **8/8 grupos** sobre Worker/D1 local, navegador móvil y peticiones retenidas/liberadas de forma controlada. Informe en [ux-local-v3.json](ux-local-v3.json), capturas en `test-results/ux/`. Se verifica:

- API de navegación con sesión, jerarquía autorizada, múltiples ámbitos, sin áreas y permisos retirados en la sesión activa; no devuelve catálogo ni conteos.
- Skeletons antes de responder en Cuenta/Inicio/Inventario/Administración y al abrir Historial; ambos temas, aviso de espera larga, limpieza de `aria-busy`, formas estáticas y transiciones omitidas con movimiento reducido.
- Formulario de ingreso ocupado, error recuperable y campos conservados; no hay éxito optimista. Guardado protege cantidad, nota y navegación, evita doble envío y su etiqueta cabe en móvil.
- Historial puede cerrarse durante la carga y la respuesta tardía no lo reabre; el borrador permanece.
- Tras perder una respuesta aceptada y sobrescribir otra persona el dato, el reintento recupera la versión vigente: no restaura el snapshot anterior.

Peticiones iniciales comprobadas: Inicio **1** (`/api/navigation`, antes sesión + bootstrap), Inventario **1** (`/api/bootstrap`), Administración **1** (`/api/admin/users` con identidad). Guardado nuevo **1** (`/api/count`, antes guardado + lectura); los reintentos inciertos conservan **2** para recuperar el dato vigente. En la cuenta de Barra del ensayo, navegación = **275 bytes** frente a **29415 bytes** de bootstrap. Son tamaños JSON locales sin compresión y conteos de peticiones, no una medición de mejora de latencia de producción.

Regresiones repetidas con este cambio: 15 pruebas generales, 11 grupos de integración, 5 adicionales, 14 recorridos de navegador, 7 de vistas, 3 de sincronización y 6 de Pages HTTPS local. Cero errores JavaScript en los recorridos. No se modificaron migraciones, datos del catálogo, referencias Excel ni derivación de contraseñas. No se repitió la carga de 15 clientes: su informe inferior corresponde al ensayo anterior.

## Resultados históricos de 3A ejecutados — 21-10-2026

| Comprobación | Resultado |
| --- | --- |
| `npm test` | **16/16**: catálogo, cantidades/cero, política de ocho caracteres, configuración/inicialización cerrada y flujos existentes |
| `npm run test:bootstrap` | **4/4**: contraseña corta, límite UTF-8, discrepancia y generación real privada sin texto plano ni sobrescritura |
| `python3 tests/workbook_contract.py` | **1.151 filas** coinciden; cero diferencias en ID, nombre, unidad y categoría |
| `npm run test:integration` | **11/11** grupos sobre Worker + D1; última ejecución 10,98 s |
| `npm run test:extended` | **6/6** grupos de identidad, dos dispositivos, cantidades, sincronización, sesiones y contraseñas de ocho caracteres |
| `npm run test:browser` | **14 recorridos**, seis contextos independientes a 390 × 844; sin errores JavaScript |
| `npm run test:views` | **8 grupos** de ingreso, menú derecho, cambio y administración; 320/390/1024 px, ambos temas, sin desborde ni errores JavaScript |
| `npm run test:ux` | **8/8 grupos** de carga lenta, menor número de peticiones y reintento tras cambio remoto |
| `npm run test:sync` | **3 comprobaciones** de pantalla oculta/visible simulada y preservación de edición |
| `npm run test:refresh` | **7/7 grupos**: control compacto, espera de 30 s entre páginas/pestañas, peticiones limitadas y campos/borradores/conteos intactos |
| `npm run test:pages` | **6 comprobaciones** del paquete avanzado de Pages + D1 aislado, HTTPS local y cookie segura |
| `npm run test:load` | **15 clientes**, 496 solicitudes, 6.919 ms; cero errores inesperados |
| `npm run test:operations` | **7/7** grupos de respaldo/restauración y retención local |
| Verificador público anónimo | **16/16** tras `5d80658`, repetido desde esta tarea; coincide con la salida previa del usuario, incluidas cabeceras de los seis errores |
| Navegador en dominio publicado | Ingreso/cierre, login/cuenta/menú, temas, espera de refresco y lectura de administración; alcance limitado descrito arriba |
| `npm run profile:local` | 6 muestras; CPU Node 274–325 ms; no mide CPU facturada de Workers |
| Migraciones y bootstrap D1 vacío separado | 0001 y 0002 desde cero; 1.227 ítems/ubicaciones, árbol real, primer administrador temporal y auditoría; repetición rechazada |
| Sintaxis, compilación y diff | Módulos válidos, paquete Pages construido y `git diff --check` sin errores |

El log de configuración negativa «no such table: cycles» es esperado y termina en 503 JSON, sin datos ni fixtures. No es un error de la base utilizada por los recorridos.

## Autenticación y permisos comprobados en servidor

Ingreso correcto/incorrecto con mensajes genéricos, cuotas antes de derivación, cookie HttpOnly/SameSite, rechazo de otro Origin, cambio propio, temporal obligatorio, restablecimiento, cuenta inactiva, revocación de sesiones y protección del último administrador. Los ensayos adicionales simulan sesión caducada y un cambio concurrente que deja el INSERT de sesión sin filas: no se devuelve éxito ni cookie de ingreso. Desactivar revoca dos dispositivos; reactivar no recupera esas sesiones.

Usuario sin áreas puede ingresar y no recibe inventario. Se prueban ámbito único, Barra + Armado, Garzones completo/Terraza sola, herencia de Servicio sin otras áreas, administrador global sin asignaciones y trabajador sin administración. Otorgar/retirar permisos se aplica en una sesión activa; la auditoría conserva cuenta y ámbitos sin contraseñas. Renombrar al autor mantiene su UUID y autoría histórica.

Se intentan lecturas y escrituras ajenas por producto, catálogo operativo, búsqueda, resumen, sincronización e historial. La URL del catálogo global responde 404. Las respuestas operativas omiten las referencias Excel. El servidor obtiene autor/rol/permisos de la sesión; una cabecera de identidad de pestaña distinta se rechaza sin escritura. También se autoriza antes de recuperar una operación anterior.

## Conteo, orden y atomicidad comprobados

Primer guardado y actualización propia; registro ajeno existente y cambio remoto durante edición; Sumar 4 + 3 = 7 y Sobrescribir 4 → 3; avance si cualquiera está parcial, ambos contados, notas anteriores/nuevas con autor, cero contado, cero en avance y Sin stock. Se rechazan aporte Sin stock, unidad incorrecta/desconocida, precisión superior a tres decimales y desborde de cantidad; la suma decimal 0,1 + 0,2 guarda 0,3. Una suma positiva retira Sin stock.

Versiones obsoletas, dos sumas concurrentes sobre una confirmación (solo una aceptada), dos primeros guardados concurrentes, doble envío idéntico, ID repetido con contenido distinto, reintento histórico tras otro cambio, guardado propio retrasado y nueva operación válida tras un rechazo. Para dos dispositivos del mismo usuario prevalece la primera operación aceptada por el servidor; la otra queda obsoleta, sin restaurar valores anteriores ni diálogo de registro ajeno.

Retirar permiso antes de confirmar suma o recuperar un resultado previo impide ambas acciones. Ubicaciones distintas del mismo producto permanecen independientes. El ciclo cerrado rechaza directo, suma y sobrescritura. Un fallo inyectado en la escritura de historial produce HTTP 500 esperado, sin conteo, operación ni historial parcial; retirar el fallo permite reintentar el ID. Se comprueba correspondencia entre operaciones, versiones, historial y resultados.

La validación y los efectos del conteo son una única sentencia con triggers; no dependen de leer y luego escribir sin protección ni de un UPDATE de cero filas para revertir un lote. [Contrato de versiones y atomicidad](contrato-3a.md).

## Sesiones independientes y diseño

[navegador-local-3a.json](navegador-local-3a.json): Ana, Bruno, Cocina, Múltiple, administrador y sin áreas, en seis contextos. Se comprueban tarjetas/URL filtradas, ámbitos múltiples, tres decisiones sobre registro ajeno, resultado antes de confirmar, foco inicial Descartar, Tab/Shift+Tab dentro y Escape conservando borrador. Descartar mantiene 4 y el otro borrador; Sumar guarda 7; Sobrescribir guarda 3. Una nueva versión invalida la elección anterior. El sondeo conserva cantidad/nota en edición y la recarga recupera el borrador.

Sin stock deshabilita Sumar. El formulario real del administrador retira acceso durante la comparación: desaparecen datos, queda el aviso y se aísla el borrador. Cambiar de persona no transfiere datos. `inventario-session-v2` permanece íntegro. Se pierde la respuesta después de aceptar un guardado: Reintentar recupera la operación sin aumentar de nuevo la versión.

[vistas-local-3a.json](vistas-local-3a.json): ingreso a 320/390/1024 px en claro y oscuro, tipografía del sistema, solo toggle en ingreso sin sesión y menú derecho con sesión, ojos SVG para mostrar/ocultar contraseña, errores legibles/foco, indisponibilidad ante HTML o D1 sin inicializar, administración plegable/buscable en ambos temas. Se crea una cuenta desde la interfaz, se valida discrepancia de contraseñas y cambio obligatorio; se otorgan dos ámbitos durante su sesión. El restablecimiento permite cancelar conservando el campo y confirma revocación/nuevo cambio obligatorio.

Las capturas reproducibles quedan en `test-results/3a/`, excluido de Git. Se inspeccionaron visualmente ingreso y administración además de las capturas de conteo/conflicto. Se corrigió la superposición del menú Mi cuenta, la legibilidad de la comparación y la diferencia entre cero en avance y cero confirmado. Esto no certifica Android físico, teclado virtual, gestos, lector de pantalla ni contraste de cada superposición.

[sync-local-3a.json](sync-local-3a.json): con reloj y `document.hidden` simulados, no hay sondeo durante 16 s oculto; al volver visible consulta inmediatamente y conserva cantidad/nota editadas. No se simuló visibilidad real del sistema operativo de un teléfono. La protección frente a páginas de sincronización tardías está inspeccionada en código; el orden de operaciones retrasadas sí está probado en servidor.

## Paquete Pages por HTTPS local

[pages-local-3a.json](pages-local-3a.json): `_worker.js` construido con esbuild, rutas completas y D1 independiente. Sin sesión `/api/me` y `/api/status` devuelven JSON 401. Catálogo global, servidor, SQL, bootstrap, libros y `/_worker.js` no se entregan como archivos. Cookie `__Host-inventory_session` Secure, HttpOnly, SameSite Strict, Path `/`, no visible en `document.cookie`. Se obtiene catálogo filtrado de Barra, se guarda y reintenta idéntica operación sin duplicarla, se rechaza otro origen y se revoca sesión al salir.

La revisión pública inicial de `inventario-login.pages.dev` detectó una publicación estática que devolvía HTML en la API y exponía el archivo de catálogo. Se corrigió con el paquete Worker; el usuario lo desplegó y se comprobó públicamente el aislamiento. La terminal aportada confirma migraciones/ciclo y bootstrap del administrador `admin` (cuatro consultas). Los logs posteriores confirman `ec80d9c` y `fb67ecb`; la última comprobación de `5d80658` está al inicio de este documento. No certifica el recorrido autenticado completo, CPU remota ni todos los ajustes del panel. Las credenciales no se incluyen en informes ni documentación.

## Simulación repetible de 15 clientes

Informe: [carga-local-3a.json](carga-local-3a.json). Cada cliente ingresa, obtiene catálogo, realiza diez guardados intencionales en su ítem, reintenta cada operación con el mismo ID y consulta sincronización, con 50 ms entre rondas. Al final los quince intentan sumar sobre una misma versión confirmada: uno se acepta y catorce reciben conflicto esperado; no se confirman automáticamente sobre la nueva versión.

- Duración **6.919 ms**, incluidos ingresos bcrypt.
- **496** solicitudes medidas: 482 HTTP 200 y 14 HTTP 409 esperados; las lecturas auxiliares de verificación no están incluidas.
- **151** escrituras aceptadas, **150** reintentos sin duplicación, **0** errores inesperados.
- Latencia conjunta: p50 **46 ms**, p95 **119 ms**, máximo **4.309 ms**, incluida autenticación concurrente.
- Cantidades finales, 151 operaciones, resultados y movimientos de historial consistentes; conflictos sin historial de éxito.

No extrapolar este ensayo local a capacidad garantizada en producción ni al día completo de inventario. No se midió CPU facturada, red real, cuotas diarias ni consumo del plan elegido. Medir el coste de autenticación en Workers antes del piloto.

## Repetición y estado de aceptación

[README](../README.md) y [operación](operacion-3a.md) describen `test:prepare`, los servidores y el orden de suites. Detener los servidores de ensayo antes de recrear sus bases; no ejecutar conjuntos mutantes simultáneamente. Las suites anteriores a esta revisión usaban fixtures de desarrollo; ahora todas apuntan a `.wrangler/test-state` o `.wrangler/pages-test-state`, independientes de `.wrangler/state`. Nunca ejecutar fixtures o carga contra D1 publicada.

**3A funcional implementada y verificada localmente; aceptación operativa abierta.** Interfaz y control compacto publicados hasta `5d80658`, verificador anónimo 16/16 y recorrido administrativo básico del dominio comprobado. Respaldo/restauración y retención ya tienen herramientas y pruebas locales. Faltan conteos/conflictos y permisos con varias personas en el dominio, inspección de atributos de cookie allí, CPU/plan y consumo, recuperación remota/copia externa y Android físico. El piloto con trabajadores/señal real queda aplazado por decisión del usuario, sin bloquear el desarrollo 3B. Producción vacía o mal configurada rechaza acceso sin cuentas de fábrica.

Etapa 2 conserva cinco unidades ausentes de Pastelería, 18 entradas de Barra sin referencia y dos conversiones pendientes. No se inventaron equivalencias. El rechazo de sumar con unidad desconocida se probó en servidor; no hay ensayo visual específico de las cinco filas. 3B: tablero, historial administrativo avanzado, rectificación/anulación, activación operativa y revisión/cierre/reapertura. Etapa 4: exportación fiel. Exportación, SMS/correo y conteo offline completo no están implementados ni se declaran probados.

## Registro histórico anterior (20-10-2026)

Las descripciones siguientes conservan las revisiones previas del modo local. Sus limitaciones sobre ausencia de Worker/sincronización describen ese estado anterior y están sustituidas por el registro de 3A de arriba.

# Verificación local — inventory-v2

**Fecha:** 20-10-2026. **Rama:** `inventory-v2`. **Alcance:** catálogo, referencia Excel e interfaz de conteo local. No se generó ni modificó un libro de salida.

## Pruebas repetibles

Desde la raíz del repositorio:

```sh
node --test tests/catalog.test.mjs
python3 tests/workbook_contract.py
node --check pages/inventario/inventario.js
node --check app.js
node --check theme.js
node --test tests/summary-transition.test.mjs
node --test tests/work-selection.test.mjs
```

Resultados de esta revisión:

- **Catálogo:** 7 pruebas aprobadas. Los 1.227 ítems tienen ID interno único; las 1.151 filas de las cinco hojas de conteo tienen al menos un vínculo; las áreas directas no duplican sus filas; Servicio cubre sus 295 filas y cada zona de Garzones contiene los mismos 16 productos de salida. La prueba específica de Principal comprueba sus 14 grupos, la asignación de sus 288 filas, nombres y unidades originales, factor de conversión 1 y la separación entre categoría de conteo y categoría de exportación para los dos atunes y el jamón. Las equivalencias acordadas de chai y syrups se mantienen.
- **Contrato Excel:** 1.151 filas comparadas directamente con `inventarios_og/11_10-INVENTARIO-totalizado.xlsx`; 0 diferencias en ID GetJusto, nombre, unidad y categoría. La prueba lee el libro y no lo modifica.
- **Sintaxis:** las tres verificaciones JavaScript anteriores terminaron sin errores. En la revisión de Principal también pasaron `node --check data/inventario/items/principal.js` y `node --check data/inventario/items/index.js`.

El catálogo conserva **18 ítems de Barra sin fila de exportación** y **2 conversiones pendientes**: Rinza (`ml` a `UN`) y Chocolate Líquido (`Kg` a `un`). Son bloqueos conocidos para una exportación automática completa, no fallos que deban resolverse inventando equivalencias. La planilla `archivos-externos/reuniones/dudas_inventario_por_area.xlsx` organiza las decisiones pendientes con el equipo.

## Simulaciones en navegador

Se usó un origen local aislado para no alterar los conteos abiertos en otras pestañas:

| Escenario | Resultado observado |
| --- | --- |
| Guardar `0` como contado en Cocina | El ítem quedó **Contado** con cantidad `0`; el avance pasó a `1 / 171`. |
| Guardar `1,25` como parcial con nota | El ítem quedó **Parcial**; cantidad y nota se recuperaron después de recargar. |
| Intentar guardar `-1` | Apareció «Ingresa una cantidad válida» y no aumentó el avance. |
| Ir a Panadería y volver a Cocina | Panadería mostró `0 / 151`; Cocina mantuvo su contado y su parcial. |
| Abrir Garzones → Zona privada | Entró directamente al primer ítem y mostró `0 / 16`, sin pantalla de categorías. |
| Buscar `ajo kg` en el panel lateral | Se mostró solo el producto coincidente; el grupo pudo plegarse y siguió plegado al limpiar la búsqueda. |
| Elegir «Nuevo inventario» | Se pidió confirmación antes de borrar; al confirmar, Cocina volvió a `0 / 171` en el origen de prueba. |

En la revisión de Bodega / Principal se abrió un origen local aislado: la pantalla mostró **14 grupos y 0 / 288 contados**. «Carnes, aves y pescados» abrió sus tres productos en orden (Atun Coliseo, Atun Dorasol y Jamon Ahumado). Al confirmar cantidad `0` para el jamón, el grupo quedó en **1 / 3** y el área en **1 / 288**; el cero se registró como contado. Este conteo de prueba quedó solo en el navegador de ese origen local.

## Límites de lo comprobado

- El diseño móvil usa dos columnas según la regla CSS; esta revisión no incluyó una captura en un teléfono físico ni evaluación con trabajadores.
- No se pudo verificar sincronización simultánea entre teléfonos ni resolución de conflictos: el conteo aún depende de `localStorage` de un solo navegador.
- No se pudo validar un archivo exportado ni su importación a GetJusto: la acción **Exportar** y el generador fiel del Excel aún no están implementados.
- La comparación del libro cubre los campos de referencia del catálogo; no certifica por sí sola que un futuro exportador preserve fórmulas, estilos, valores calculados y todas las hojas. Esa prueba pertenece a la etapa de exportación.

## Revisión de estilo del 20-10-2026

- Rama `inventory-v2` limpia al comenzar; cambios limitados a tema, resumen, prueba y documentación. La ruta de Pedido y los estados AM/PM no están implementados en esta rama.
- En la primera revisión, `node --test tests/catalog.test.mjs tests/summary-transition.test.mjs`: 9 pruebas aprobadas. La prueba del resumen comprueba que el contenido ya existe mientras se ve el acento y que se omite con movimiento reducido. En la revisión posterior su duración pasó a 650 ms.
- `python3 tests/workbook_contract.py`: 1.151 filas iguales en ID, nombre, unidad y categoría.
- `node --check` de `app.js`, `theme.js`, `pages/inventario/inventario.js` y `pages/inventario/summary-transition.js`, y `git diff --check`: sin errores.
- Inspección estática de CSS: tarjetas y campos tienen superficies legibles en ambos temas; enlaces y botones mantienen anillo de foco, mientras el buscador del panel cambia a fondo sólido al enfocarse, sin contorno por petición visual. Las etiquetas de estados conservan texto; las categorías móviles siguen en dos columnas y las acciones de conteo pasan a una columna bajo 380 px. La preferencia de movimiento reducido desactiva la animación y la de transparencia reducida deja superficies opacas.
- Tras los comentarios visuales, los pares de color en grises dieron contraste de 12,75:1 (texto principal claro sobre fondo) y 6,19:1 (secundario claro sobre sólido). El ajuste posterior hacia la paleta oscura anterior dio 14,71:1 para `#ededed` sobre `#1b1b1b`, 8,21:1 para `#b8b8b8` sobre `#202020` y 6,35:1 para el texto de la acción principal sobre el extremo más oscuro de su gradiente. Es una comprobación de colores base, no una medición de cada píxel con las transparencias superpuestas.
- La política del navegador de este entorno bloqueó la apertura del archivo local y prohíbe repetirla por otra ruta. Por ello no se certificaron capturas reales ni interacción táctil en 320/375/768 px, lector de pantalla o equipo físico. Quedan como revisión manual antes de publicar.

La persona usuaria aportó capturas de Inicio, Cocina y el resumen de Panadería/Cocina. Sus observaciones originaron el ajuste de la base a grises con gradientes translúcidos, conservando rojo/amarillo/verde para los estados funcionales; también motivaron encabezados sin borde, icono de tema centrado, nombre «Avance», espaciado del responsable y de los indicadores, y búsqueda desde categorías. Estas capturas documentan el estado anterior al ajuste; aún no son una verificación visual del resultado nuevo.

En la última iteración del buscador del panel se quitó el contorno y se dejó un fondo gris translúcido en reposo que se aclara al enfocarse. Queda pendiente evaluar si esta señal sin anillo es suficientemente perceptible para navegación por teclado; no se ha comprobado con lector de pantalla ni en un teléfono físico.

En la revisión posterior se restauraron los símbolos de luna y sol de la rama anterior y se acercó el tema oscuro a su fondo carbón, tarjetas casi negras y botones grises. Se repitieron las 9 pruebas de Node, el contrato de 1.151 filas, la comprobación de sintaxis de `theme.js` y `git diff --check`; todo pasó. El resultado visual de esta última revisión sigue pendiente de inspección en el navegador de la persona usuaria.

## Ajustes de Servicio y conteo del 20-10-2026

- Las capturas aportadas muestran Servicio, Garzones y Barra antes del ajuste. Se eliminó el encabezado redundante de sectores; en Garzones el título es «Zonas» y cada tarjeta muestra su progreso sobre 16 ítems. Se aumentó el margen interior de estas vistas y la tipografía de sus tarjetas.
- Al abrir una categoría o volver a una zona se elige el primer ítem que aún no esté contado. Si todos están contados, se conserva el primero para permitir revisión. «Sin stock» registra cantidad 0, estado contado y la marca `outOfStock`; aparece explícitamente en la ficha, el panel, el resumen y el texto copiado. Un cero confirmado mediante «Listo» no recibe esa marca.
- Los avisos de guardado aparecen arriba durante cuatro segundos, sin capturar gestos. Su superficie de vidrio usa fondo translúcido, desenfoque y una entrada con ligero aumento; las preferencias de movimiento o transparencia reducidos eliminan esos efectos. El indicador del resumen dura 650 ms y sigue sin retrasar el contenido ni mostrarse con movimiento reducido.
- `node --test tests/catalog.test.mjs tests/summary-transition.test.mjs tests/work-selection.test.mjs`: **11 pruebas aprobadas**. `python3 tests/workbook_contract.py`: **1.151 filas coinciden** en ID, nombre, unidad y categoría. `node --check` de `app.js`, `theme.js`, `pages/inventario/inventario.js`, `pages/inventario/summary-transition.js` y `pages/inventario/work-selection.js`, más `git diff --check`: sin errores.
- Pendiente una comprobación visual e interacción táctil de estos ajustes en el navegador local de la persona usuaria y en teléfono físico; las capturas recibidas no muestran todavía el resultado actualizado.

La revisión posterior de Mercadito movió «Anterior» y «Siguiente» a la barra superior, a ambos lados de «Ver ítems», sin cambiar sus funciones. «Ir a Resumen» permanece bajo las acciones de conteo. La barra conserva su lugar y cada sección mantiene al menos 58 px de alto. Se repitieron las 11 pruebas de Node, el contrato de 1.151 filas, la comprobación de sintaxis del módulo de Inventario y `git diff --check`; todo pasó. Queda pendiente la comprobación visual de la nueva barra en el navegador local.

La captura posterior de Panadería mostró «Ver ítems» a la derecha y un contorno demasiado intenso en el buscador oscuro. Se fijó explícitamente la posición central del botón, se suavizaron los bordes oscuros de tarjetas y panel, y se quitó el borde y la sombra del buscador en reposo y foco. El foco del buscador se distingue por un cambio de fondo; su percepción con teclado sigue pendiente de prueba con personas usuarias.

En Pastelería se observó un único divisor vertical en la barra superior: la regla más específica del botón central ocultaba el otro. Se eliminaron ambos divisores para mantener las tres zonas sin una línea aislada.

El aviso superior conserva el tinte funcional y el texto blanco: verde para los guardados de «Sin stock» y «Listo», ámbar para avance y rojo para errores. En esa revisión el ítem marcado «Sin stock» aún se identificaba en rojo; la corrección posterior de su estado guardado se documenta al final. Tras la revisión visual se retiró el reflejo interior, se suavizaron borde y sombra, y se aclararon los tintes con más transparencia, especialmente en modo oscuro. El desenfoque mantiene la lectura sobre el contenido. Cuando el sistema pide menos transparencia, el aviso usa un color sólido. La prueba de selección incluye el tono de cada acción.

La última comprobación pasó las **12 pruebas de Node**, el contrato de **1.151 filas**, la sintaxis de los módulos de Inventario y selección, y `git diff --check`. La apariencia del aviso más transparente queda pendiente de valoración visual en el navegador local.

## Ajuste de navegación y tema del 20-10-2026

El botón «Ver ítems» enfocaba directamente `#item-drawer-search`, lo que seleccionaba el campo y podía abrir el teclado en Android. Ahora enfoca el panel; la lupa del encabezado sigue enfocando el buscador. El recorrido con Tab permanece dentro del panel y Escape devuelve el foco al botón que lo abrió. Los iconos de luna y sol pasan de caracteres dependientes de la fuente del dispositivo a SVG; el centro del sol usa el mismo blanco que sus rayos en modo oscuro.

La barra de navegación del conteo usa tres columnas iguales. Se ajustaron los espacios reservados para búsqueda y tema en el encabezado móvil, el centrado de la flecha de regreso y el comportamiento de títulos largos. Al abrir categorías, resumen o un nuevo producto, la página vuelve arriba para evitar quedar a mitad de una vista recién renderizada. El cierre del panel usa un icono vectorial centrado.

Tras estos cambios pasaron **12 pruebas de Node**, el contrato de **1.151 filas**, la sintaxis de `theme.js` y `pages/inventario/inventario.js`, y `git diff --check`. Estas comprobaciones no simulan la apertura del teclado Android ni sustituyen una revisión visual y táctil en dispositivo; esa revisión sigue pendiente.

La vista local usa el servidor indicado en `README.md`. En esta revisión se comprobó que `/pages/inventario/?area=panaderia` respondía con HTTP 200 después de iniciar el servidor. Un error previo de conexión se debía a que el servidor estaba apagado; esa comprobación HTTP no valida por sí sola el aspecto de la página.

### Preparación de esta entrega

Los cambios de esta ronda abarcan el foco del panel, el recorrido con teclado, el retorno al inicio al navegar, el reparto de la barra de tres acciones, los espacios del encabezado móvil y los iconos SVG de tema y cierre. Se actualizaron `AGENTS.md`, `README.md`, `docs/project-context.md`, `docs/style-guide.md` y este registro. No se cambiaron catálogos, conteos guardados, datos de salida ni el flujo de Pedido. Antes de subir la rama, ejecutar los comandos de «Pruebas repetibles» y revisar visualmente en Android el teclado, los iconos y los títulos largos; esa revisión en dispositivo no se ha realizado aquí.

## Incidente de navegación en Cloudflare Pages

El despliegue del commit `41cfb35` publicó los archivos, pero la regla `_redirects` enviaba `/` a `/pages/inventario/`. Esa pantalla, cuando no recibía `?area=`, solo ofrecía «Ir al inicio», que volvía a `/` y repetía la redirección. Una URL directa con `?area=cocina` sí cargaba el catálogo.

La corrección elimina esa redirección y muestra las cinco áreas activas cuando se abre `/pages/inventario/` sin parámetros. En la copia local se comprobó que `/` abre la portada, `/pages/inventario/` ofrece las cinco áreas, Cocina abre con sus 171 ítems y el botón «Volver» regresa a la portada. La verificación del despliegue público actual sigue pendiente; la comprobación local no demuestra su estado.

## Rediseño visual según referencia del 20-10-2026

Se actualizó la guía de estilo con base azul hielo, acento cian y tarjetas tintadas por área; el modo oscuro usa un fondo gris carbón. Inicio conserva solo el toggle de tema en la esquina superior derecha, sin incorporar el engranaje de la referencia. El resumen incorpora un anillo calculado a partir de `contados / total`; no usa las cifras ilustrativas de la imagen.

Se inspeccionaron visualmente Inicio en claro y oscuro a 1280 × 720 y Cocina en claro y oscuro a 534 × 804 mediante el navegador local. Se comprobó que las tarjetas, el toggle y los controles de conteo permanecen visibles, y que el resumen muestra 0 % para 0 de 171 ítems contados en la sesión observada. `git diff --check` terminó sin errores en esa primera revisión. La comprobación en un Android físico sigue pendiente.

### Pruebas y simulación posterior

- `node --test tests/catalog.test.mjs tests/summary-transition.test.mjs tests/work-selection.test.mjs`: **12 de 12 aprobadas**.
- `python3 tests/workbook_contract.py`: **1.151 filas coinciden** en ID, nombre, unidad y categoría.
- `node --check` de `app.js`, `theme.js`, `pages/inventario/inventario.js`, `pages/inventario/summary-transition.js` y `pages/inventario/work-selection.js`, más `git diff --check`: sin errores.
- En un origen local temporal separado (`127.0.0.1:8766`) se abrió Inicio en ambos temas, se navegó a Cocina y se abrió «Ver ítems». El foco quedó en el panel, no en el buscador. La lupa del encabezado sí enfocó el buscador y filtrar «ajo kg» mostró el producto coincidente.
- Se guardó `1,25` con nota como avance y se recuperaron ambos valores al volver al ítem. `-1` fue rechazado sin cambiar el progreso. «Listo» elevó el conteo a 1/171 y «Sin stock» a 2/171 con el aviso «Sin stock guardado.». El resumen mostró 169 pendientes, 2 contados y 1 %; el detalle de contados distinguió el cero «Sin stock».
- «Nuevo inventario» pidió confirmación; cancelar conservó los datos y confirmar, solo en ese origen temporal, devolvió Cocina a 0/171. La simulación reveló que el foco inicial caía en la acción destructiva. Se corrigió para iniciar en «Cancelar», mantener Tab entre los dos botones y devolver el foco al botón de origen al cancelar. Esa secuencia se repitió en el navegador y funcionó.

El origen temporal y su servidor se cerraron al terminar. Esta simulación no sustituye pruebas táctiles ni de teclado virtual en un Android físico; tampoco valida sincronización entre dispositivos ni exportación, funciones que aún no existen en esta rama.

### Panel de ítems y aviso superior

- El panel se modificó para abrir únicamente la categoría del producto actual, situar ese producto a la vista y mantener cerradas las demás. En una vista sin producto actual, todos los grupos comienzan cerrados. La búsqueda abre coincidencias y recupera la selección manual al vaciarse.
- El aviso superior adopta los tintes claros de la guía visual, aumenta a 64 px de alto como mínimo y 420 px de ancho máximo, y usa entrada vertical y salida vertical tras cuatro segundos. Respeta movimiento y transparencia reducidos. El panel lateral usa una transición de 340 ms.
- `node --check pages/inventario/inventario.js` y `git diff --check`: sin errores. `node --test tests/catalog.test.mjs tests/summary-transition.test.mjs tests/work-selection.test.mjs`: **12 de 12 aprobadas**. `python3 tests/workbook_contract.py`: **1.151 filas coinciden** en ID, nombre, unidad y categoría.
- En el navegador local, Cocina mostró solo «Verduras y frutas» desplegado con «AJI AMARILLO» visible al abrir «Ver ítems»; los otros siete grupos aparecieron cerrados y el foco quedó en el panel. Buscar «ajo kg» mostró la coincidencia; al limpiar volvió la apertura exclusiva de la categoría actual. Abrir otra categoría manualmente, cerrar y reabrir el panel volvió a dejar solo la categoría actual desplegada. En un origen de prueba separado, «Guardar avance» mostró el aviso ámbar «Avance guardado.» y este se retiró automáticamente; «Sin stock» en modo oscuro mostró el aviso verde «Sin stock guardado.» y elevó el progreso a 1/171. El conteo de prueba no alteró el origen principal.

### Preparación de Git para envío

La entrega reúne el rediseño azul hielo/cian y gris carbón, el anillo de progreso del resumen, la mejora del foco de la confirmación, la apertura selectiva del panel y el aviso ampliado con entrada y salida vertical. Se actualizaron `README.md`, `AGENTS.md`, `docs/project-context.md` y `docs/style-guide.md` para reflejar el comportamiento vigente. No se modificaron los catálogos ni el libro original.

Se repitieron las **12 pruebas de Node**, el contrato de **1.151 filas**, la sintaxis de los cinco módulos JavaScript usados en la app y `git diff --check`; todo pasó. Antes del commit, la rama local `inventory-v2` y su referencia local `origin/inventory-v2` apuntaban al mismo commit `d0a97bf`. No se pudo consultar el estado remoto en vivo: SSH rechazó la clave pública y HTTPS solicitó credenciales. Por ello el próximo `push` requiere acceso a GitHub y, si la rama remota avanzó, una integración previa de esos cambios. No se ejecutó `push`.

### Ajuste final del aviso

Tras la revisión visual, se retiraron los degradados del aviso en claro y oscuro. Los tres tonos funcionales usan una única superficie translúcida cada uno, con desenfoque y sombra más discretos. Se conservan el tamaño, las etiquetas, la duración y la entrada/salida vertical. La variante de transparencia reducida usa el mismo color en versión opaca. En el origen local aislado `127.0.0.1:8766` se comprobó visualmente el aviso verde «Sin stock guardado.» en oscuro y el ámbar «Avance guardado.» en claro; ambos mostraron un color uniforme. Ese servidor y su pestaña se cerraron tras la comprobación, sin modificar el origen principal.

### Color del estado «Sin stock» guardado

Las tres observaciones en Cocina mostraban la marca «Sin stock» roja en la ficha, el resumen y el panel lateral. El estado sigue siendo un cero contabilizado con `outOfStock`, pero ahora usa verde en el icono, la insignia, el punto del panel y los textos de estado de las listas. El botón que inicia la acción «Sin stock» conserva su rojo; no cambia el guardado ni la marca persistida.

En el origen aislado `127.0.0.1:8766` se revisaron dos ítems guardados «Sin stock» en Cocina. La ficha mostró «🟢 Sin stock»; el panel mostró el punto y el texto verdes; el resumen incluyó ambos en «Contados» con icono verde y cantidad «0 · Sin stock» verde. Se comprobaron los colores calculados en claro y oscuro. En oscuro hubo que ajustar la prioridad de una regla general que mantenía gris el texto del resumen. Las 12 pruebas de Node y la revisión de sintaxis pasaron; el origen principal permaneció intacto.

### Fondos uniformes, resumen compacto y controles táctiles

- Se retiraron todos los degradados de las hojas CSS: fondo, tarjetas, panel y acciones usan un color uniforme. El fondo claro es blanco crema `#faf8f3` y el oscuro carbón profundo `#111315`. El anillo de progreso conserva su porcentaje mediante círculos SVG, sin gradiente.
- En Resumen se ocultan la barra y el contador del encabezado, se elimina el subtítulo y se reduce la separación del encabezado. Al regresar a conteo o categorías, el progreso del encabezado vuelve a mostrarse.
- Los controles Volver, búsqueda y tema no permiten selección de contenido y liberan el foco después de un clic o toque. Hover solo se aplica con puntero preciso compatible; el teclado conserva su foco visible.
- En el navegador del origen aislado `127.0.0.1:8766` se revisaron Inicio en claro/oscuro, Resumen en claro/oscuro, conteo y panel. Los estilos calculados confirmaron los fondos nuevos y cero fondos con gradiente. Se comprobó la ocultación del progreso duplicado y su restauración al salir del resumen, y se mantuvo verde «Sin stock» guardado.
- Tras pulsar el toggle y Volver se comprobó que no quedaban enfocados ni con contorno, ni había texto seleccionado. Tab enfocó Volver con contorno visible; Tab y Enter permitieron activar el toggle conservando su indicador de teclado. No se probó en un teléfono físico.
- Las 12 pruebas de Node, `node --check` para Inventario y tema, y `git diff --check` pasaron. La expectativa de duración del indicador se actualizó al valor vigente de 800 ms del código. No se modificaron datos ni conteos del origen principal.

### Realimentación de botones

Se retiraron los cambios visuales de hover y pulsación de los botones, incluidos cambios de color, borde y escala. Se mantienen los estados de negocio (por ejemplo, categoría actual) y el contorno `:focus-visible` para teclado. La búsqueda de selectores `:hover` y `:active` en las hojas CSS no encontró reglas restantes.
