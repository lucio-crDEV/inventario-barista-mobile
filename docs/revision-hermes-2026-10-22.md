# Revisión real al retomar — 22-10-2026

## Conclusión vigente

`inventory-v3` conserva el incremento recuperado en `cfece26`; Pages confirma ese commit en producción y el usuario confirmó funcionamiento online. El fallo de inicialización D1 está corregido. Hay evidencia posterior de fallos por recursos, no de una caída permanente: no confundir disponibilidad pública, ingreso autenticado y aceptación operativa.

**Free se mantiene. Supabase es una alternativa sin integrar ni seleccionada como siguiente implementación obligatoria.** Esta revisión corrige documentación; no cambia autenticación, datos, interfaz ni configuración.

Informe estructurado de esta ejecución: [revision-hermes-2026-10-22.json](revision-hermes-2026-10-22.json). Los JSON anteriores conservan su evidencia histórica, sin sobrescribirla.

## Git, código y configuración inspeccionados

- Raíz `/Users/lucio/workspace/inventario_brioche`; rama `inventory-v3`, HEAD y referencia local `origin/inventory-v3` en `cfece26d9c910b460ac895d4948ef8eacf7661aa`. Había cambios documentales, `.gitignore` y archivos de traspaso/lanzador sin commit al empezar; se conservaron. `git ls-remote` falló por clave SSH pública: no se certifica la punta viva de GitHub ni se intentó cambiar credenciales.
- API en `worker/index.js`, cuentas en `worker/accounts.js`, contraseñas en `worker/password.js`; roles, navegación y cliente compartido contrastados con el catálogo, la migración 0003 y las pruebas existentes. `/api/status` declara etapa 3B/incremento usuarios-servicio, no 3B completa.
- Persisten HTML/CSS/JavaScript nativos, cookie HttpOnly, permisos efectivos en servidor, control de revisión de cuentas, identidad estable, conteos versionados, historial y deduplicación atómicos por triggers. No hay adaptador Supabase ni salida Excel implementados.
- `wrangler.jsonc` falla cerrado en producción sin configuración y separa el entorno local. `wrangler.pages.production.jsonc` apunta a la demo v3 y `piloto-v3-servicio`. La lectura de metadatos Pages confirma rama/commit/despliegue; no es una auditoría de todas las variables o del plan de facturación.
- Servidor local existente en 8790 con `.wrangler/test-state`. No se detuvo, reinicializó ni ejecutaron suites mutantes sobre él. No se leyó `.dev.vars*` ni respaldos privados.

## Producción: comprobaciones nuevas de solo lectura

1. API de Pages: despliegue canónico `7df21f3c-e662-443d-a953-b9e502863882`, commit `cfece26`, etapa deploy `success`, terminada a las **16:52:52 UTC / 13:52:52 -03**. URL: https://7df21f3c.inventario-login.pages.dev .
2. Verificador existente ejecutado desde una copia de trabajo en scratch para no sobrescribir `docs/publico-3a.json`: **16/16 GET anónimos**, rutas, cabeceras, JSON/no-store y bloqueo de archivos privados aprobados. `/api/me` devuelve 401 `SESSION_REQUIRED`, no 503 `NOT_INITIALIZED`. Esta respuesta atraviesa la comprobación de esquema/ciclo del Worker; no equivale a una auditoría integral de D1.
3. Cinco assets públicos coinciden byte a byte/SHA-256 con este checkout: administración, Cuenta, cliente, navegación y CSS compartido. No se compara el Worker privado mediante descarga pública.
4. Métricas GraphQL Pages, filtradas por el `production_script_name` leído del proyecto (`pages-worker--21988261-production`), desde el final del despliegue hasta **17:57:47 UTC**: el proveedor informa **1.399 success**, **2 exceededResources** y **4 clientDisconnected**. Son agregados adaptativos, no un registro exhaustivo de cada petición ni un porcentaje de fallos de login. La consulta devolvió 33 grupos de un límite 1.000, sin alcanzar el límite.
5. Los dos errores se agrupan en **17:18 UTC / 14:18 -03**, posteriores a `cfece26`. En ese grupo CPU p50 **10 ms** y p99 **162,149 ms**; las unidades microsegundo se comprobaron en el esquema GraphQL antes de convertirlas. No hay URL ni `outcome=exceededCpu` en este agregado. **Se confirma recurrencia de fallos por recursos tras la recuperación; la causa exacta de estas dos peticiones sigue sin trazarse.** Cloudflare distingue el estado de invocación del HTTP y `exceededResources` puede representar varios límites; no equivale automáticamente al diagnóstico detallado anterior.[1]

La consulta genérica `workersInvocationsAdaptive` devolvió vacío; se usó el dataset específico `pagesFunctionsInvocationsAdaptiveGroups`, con datos. La documentación del tutorial genérico sirve de referencia del mecanismo GraphQL, no valida por sí sola el dataset Pages.[2] Los grupos se filtran por script y ventana temporal, no incluyen un ID de despliegue por petición: son posteriores a la publicación, no una prueba de que `cfece26` causara los errores. No se creó una sesión de tail, se ejecutaron mutaciones GraphQL ni se generó carga/ingresos de prueba en producción. El token existente de Wrangler se utilizó en memoria sin imprimirlo ni persistirlo en el informe.

## D1 y CPU: diagnósticos separados

- **D1 histórico corregido:** faltaba `inventory_permissions` porque solo estaban 0001/0002. La reparación autorizada anterior aplicó 0003/0004, ciclo separado y variables. Su evidencia vive en [despliegue-demo-3b.json](despliegue-demo-3b.json). No repetir bootstrap, migraciones aplicadas ni ciclo. Esta sesión no ejecutó SQL remoto.
- **CPU histórico comprobado:** tras reparar D1 hubo 503/1102 y un log `outcome=exceededCpu`. `worker/password.js` no cambia entre `5d80658` y `cfece26` (diff vacío); no hay fundamento para atribuir todo el fallo a las migraciones ni para decir que la recuperación cambió bcrypt.
- **Evidencia actual:** dos errores remotos por recursos posteriores al despliegue recuperado. No se demuestra que todo ingreso falle ni se localiza la ruta de esos errores. El funcionamiento confirmado por el usuario y los errores ocasionales pueden coexistir.
- **Siguiente comprobación afectada por permisos:** correlacionar esas ventanas con trazas existentes y, si hiciera falta, autorizar específicamente ingresos nuevos y flujos de contraseña de ensayo. Un ingreso escribe cuotas/sesiones; cambiar/restablecer contraseña o crear cuentas también modifica estado remoto. No ejecutarlos bajo el permiso de solo lectura. No debilitar bcrypt, activar Paid ni introducir proveedor por inercia.

## Pruebas locales repetidas en esta sesión

| Comando o contrato | Resultado nuevo | Límite |
| --- | --- | --- |
| `npm test` | **19/19** | Node/SQLite en memoria y configuración negativa; no carga real Cloudflare |
| `npm run test:bootstrap` | **7/7 Python** | Generación/bootstrap y orden SQL; no crea administrador remoto |
| `python3 tests/workbook_contract.py` | **1.151 filas y 41 referencias Vitrina coinciden** | Lectura de libros; no exportador ni modificación de Excel |
| `npm run build:pages` | Correcto en copia scratch aislada | Sin tocar `dist` canónico ni desplegar; el build existente recrea su salida |
| Sonda SQL aislada del contrato documentado | Catálogos 1.227/1.268; asignaciones antes/después de 0004; deduplicación tras cierre; operación nueva cerrada y reintento sin permiso rechazados; integridad válida | Dos SQLite exclusivamente en memoria, no D1 remota ni bases existentes |

`Inventory initialization failed no such table: cycles` es la salida esperada del test negativo de entorno sin inicializar, no un fallo nuevo de la demo. Runtime observado: Node 24.21.0, npm 11.19.0 y Python 3.9.6.

La sonda adicional verifica dos matices documentales contra las migraciones reales: una cuenta combinada existente recibe Copería al migrar 0004; los fixtures nuevos creados después no la heredan. También distingue recuperar un resultado aceptado después del cierre (sin nueva escritura) de intentar una operación nueva cerrada (`CYCLE_CLOSED`), y vuelve a exigir permiso incluso al reintentar (`FORBIDDEN`). Script de esta sesión en `/Users/lucio/.hermes/cache/scratch/inventario-contract-smoke.mjs`; no se añadió una suite funcional al repositorio.

No se repitieron API/navegador mutantes, migración Wrangler, recuperación ni carga de 15 clientes: no hay cambios funcionales y el servidor de ensayo conserva datos existentes. Sus resultados anteriores siguen siendo **locales e históricos**. Tampoco se verificaron Android físico, cookies autenticadas del dominio, recuperación remota/copia externa, piloto ni consumo diario/plan del panel. El presupuesto CPU no queda certificado por los GET públicos ni por este build.

## Implementado y pendiente

- **3A implementada; aceptación operativa abierta:** usuarios, sesiones, permisos, conteo compartido, conflictos, historial por producto, sincronización/borradores y herramientas de recuperación locales. Faltan pruebas operativas de varias personas en el dominio, cookies allí, recurrencia/atribución de recursos y consumo Free, recuperación remota/copia externa, Android y piloto aplazado.
- **3B en curso:** incremento usuarios/Servicio recuperado y publicado. Administrador/Jefa/Trabajador; cuentas mixtas acotadas, username/perfil, eliminación irreversible conservando autoría, navegación directa, Copería/Línea y Vitrina. **Pendientes:** supervisión e historial avanzado, rectificaciones/anulaciones auditadas, activación operativa, revisión/cierre/reapertura. El servidor rechaza nuevas escrituras en ciclo cerrado, pero esto no implementa el flujo de cierre. Un reintento idéntico ya aceptado puede recuperar su resultado histórico sin nueva escritura, incluso después del cierre.
- **Etapa 2:** unidades, referencias y equivalencias físicas no resueltas; no se inventaron conversiones.
- **Etapa 4:** Excel aún sin implementar; no se implementa ahora.

Se preservan libros originales, `sources/`, Pedido, datos y configuración; sin commit, push, despliegue, borrados de datos existentes, cambios remotos, facturación o envíos. No se modificaron modelo, credenciales ni WhatsApp.

## Cierre documental comprobado

Validador local aprobado: **18 documentos Markdown, 154 enlaces locales, 28 nombres de scripts npm y 19 informes JSON**, sin enlaces rotos ni JSON inválidos; `git diff --check` correcto. SHA-256 de **99 archivos versionados protegidos** coincide antes/después, incluidos código/configuración/referencias fuera de documentación; no se modificó funcionalidad. Se conservaron los cambios previos de `.gitignore`, `AGENTS.md`, prompt/lanzador y traspaso, actualizando este último con evidencia nueva. Los archivos de código, migraciones y configuraciones no tienen diff contra `cfece26`.

## Sources

[1] https://developers.cloudflare.com/pages/functions/metrics
[2] https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics
