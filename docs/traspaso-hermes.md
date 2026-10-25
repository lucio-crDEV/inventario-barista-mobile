# Traspaso de Inventario Brioche a Hermes — 22-10-2026

Actualización vigente 25-10-2026: [inventarios y UX móvil](revision-inventarios-2026-10-25.md), [métricas y respaldos](metrics-backup-2026-10-25.md). Requiere 0008/0009; sustituye la pausa previa de telemetría, sin implementar Root. Ver esos documentos para estado y verificación nuevos; las cifras inferiores son históricas.

## Etapa 3B — implementación local del 23-10-2026

El usuario informó que b24403d funciona y autorizó desarrollar el resto de 3B. Tablero/historial operativo, rectificación/anulación auditada, activación por ciclo y revisión/cierre/reapertura implementados localmente. Jefa supervisa, rectifica y anula solo Servicio; también gestiona su estado propio (reabrir con motivo, revisión, cierre estricto). Administrador conserva alcance global y activación. No se amplían cuentas mixtas ni roles. Root, telemetría técnica, backups automáticos y Excel 4 siguen pendientes.

Requiere **0006_supervision.sql antes del deploy**, independiente de 0005 (sigue sin aprobarse y fuera de migrations). No aplicar fixtures/bootstrap/ciclo nuevo sobre demo. No SQL remoto, push o despliegue en este encargo. La aceptación operativa de 3A y validación de 3B en el dominio siguen abiertas. [Contrato, seguridad y pruebas](etapa-3b.md).


## Decisión vigente — 23-10-2026, continuidad con Codex

Por decisión explícita del usuario, persistencia de telemetría desactivada y Root **solo diseñado**. Se conservan diagnóstico saneado, correlación, cuotas/backoff y auditoría transaccional existente. GET `/api/admin/metrics` queda cerrado a todos los roles actuales (`403 ROOT_NOT_ENABLED` con sesión habilitada; sin sesión `401`). No hay histórico de uso, cuentas activas estimadas ni nuevas métricas funcionales disponibles. No se crea rol/cuenta Root ni se amplían permisos de la jefa.

`0005_activity.sql` pasa de `migrations/` a `docs/propuestas/` como propuesta histórica fuera de las migraciones automáticas. Readiness y preflight validan contrato de usuarios/Servicio, catálogo y ciclo sin tabla activity; la base actual 0001–0004 y el catálogo legado están soportados; mantenimiento solo consulta/poda autenticación vencida, sin tocar telemetría existente. No hay cambios de esquema o datos necesarios para este código. Las instrucciones anteriores que exigían 0005, métricas para Administrador o retención de 14 días quedan sustituidas por esta decisión. [Estado, diseño Root, almacenamiento y publicación](seguridad-observabilidad-3a.md).


## Refuerzo posterior de 3A — leer antes de publicar

El encargo posterior preservó este traspaso y cambios existentes en `98282ea`, por separado. Cambios funcionales locales: [informe nuevo y procedimiento](seguridad-observabilidad-3a.md), [resultados](seguridad-observabilidad-local-2026-10-22.json). La propuesta 0005 no se aplicó remotamente y queda retirada de migraciones automáticas desde el 23-10; no aplicarla. 3A operativa sigue abierta, usuarios/Servicio conservados; resto 3B/Excel fuera de alcance. Pruebas de este encargo locales aisladas, sin reinicializar servidor/base 8790 ni probar app remota. Autorizados commits locales, no push/deploy/cambios remotos.

## Raíz, Git y entornos

- Raíz canónica: `/Users/lucio/workspace/inventario_brioche`. Es el mismo repositorio trasladado, con `.git`, `node_modules`, `.wrangler`, respaldos privados y documentos. La carpeta anterior se retiró; no trabajar en una copia ni reconstruir el proyecto desde cero.
- Rama: `inventory-v3`; último commit funcional recuperado: `cfece26`. HEAD y seguimiento local coinciden al retomar; `git ls-remote` falló por clave SSH, sin cambios de credenciales. Pages confirma ese commit en despliegue canónico `7df21f3c-e662-443d-a953-b9e502863882`, deploy `success`. [Revisión real y evidencia nueva](revision-hermes-2026-10-22.md). Volver a comprobar Git/Pages al continuar; no confundir seguimiento local con consulta viva de GitHub.
- Remoto conservado: `git@github.com:lucio-crDEV/inventario-barista-mobile.git`. Renombrar la carpeta local no cambia GitHub, Pages, D1, el nombre de paquete ni identificadores.
- `inventory-v2` preserva `3d2331919ea8bdf39daf1f095ea09877d69e6dd0`; `warehouse-order` pertenece a Pedido y `main` a la app anterior. No mezclar ramas ni módulos.
- Sitio demo: https://inventario-login.pages.dev/ . D1 `inventario-login-v3`, ID `aff1d8f6-cde2-4ace-97b6-96f35ec0f8b0`; ciclo `piloto-v3-servicio`, catálogo `inventory-v3-2026-10-22`, migraciones 0001–0004 ya aplicadas en esa demo. No volver a crear el primer administrador.
- Credenciales de herramientas permanecen en sus almacenes originales del Mac. No copiarlas a Git ni a memoria/prompts. `.backups/` y `.dev.vars*` son privados e ignorados; no leerlos para un análisis documental. Si una operación requiere una credencial, obtenerla del almacén autorizado sin imprimirla.

## Lectura inicial

Leer `AGENTS.md`, `docs/project-context.md`, `docs/roadmap.md`, `docs/style-guide.md`, `docs/verification.md`, `docs/accesos-y-administracion.md`, `docs/contrato-3a.md`, `docs/operacion-3a.md`, `docs/despliegue-pages.md`, `docs/usuarios-y-servicio-3b.md`, `docs/etapa-3b.md`, `docs/autenticacion-free.md` y `docs/tecnologias-y-roadmap.md`. Consultar propuestas históricas solo distinguiendo lo reemplazado por decisiones posteriores. Inspeccionar código real antes de editar. No cargar indiscriminadamente dependencias, logs, secretos ni todas las transcripciones en contexto.

Hermes local v0.22.4 tiene activo el proyecto `inventario_brioche` con esta carpeta primaria. Configuración observada: `openai/gpt-6.1-sol` por `nous`, conservada; la preferencia global de razonamiento no se cambió. Se corrigió la memoria antigua que aún indicaba forzar Gemini.

Hermes carga automáticamente AGENTS.md desde el directorio de trabajo; un HERMES.md tendría precedencia y podría ocultarlo, por eso no se añade. Desde WhatsApp, entrar primero en la raíz indicada y leer AGENTS.md por su ruta absoluta: no asumir que un chat heredó la carpeta del terminal. Lanzador opcional local: `./scripts/hermes-inventario.sh`, que fija la carpeta y razonamiento medio para esa invocación sin cambiar el modelo global.

## Decisiones de producto conservadas

HTML/CSS/JavaScript nativos, mobile first, sin framework nuevo; crema/carbón, cian y vidrio translúcido, skeletons/transiciones con accesibilidad. Mantener unidades, ID y referencias Excel. No tocar libros originales ni fuentes sincronizadas `sources/`. Pedido separado. No publicar materiales internos.

Usuarios personales, mínimo ocho caracteres, UUID estable independiente del username/nombre visible. Sin registro público ni correo/teléfono obligatorio. Administrador > Jefa de servicio > Trabajador. Admin global; jefa solo Servicio. En cuentas mixtas la jefa solo modifica accesos de Servicio, nunca credenciales, activación o eliminación. Administrador modifica username; cada usuario cambia su nombre visible. Eliminación confirmada e irreversible conserva autoría/historial; último admin protegido.

Permisos múltiples, heredados a descendientes sin hermanos; sin asignaciones no hay acceso al inventario. Catálogo, conteos, búsqueda, resúmenes, sincronización e historial se filtran en servidor. Cookie HttpOnly y protección de origen; nunca tokens de sesión en localStorage. Borradores aislados por usuario/ciclo, sin importación automática de datos locales anteriores.

Actualizaciones propias directas con versión. Registros ajenos: Descartar, Sumar o Sobrescribir explícitos; total propuesto salvo Sumar. Sumar 4+3=7; sobrescribir 4 con 3=3. Confirmación vinculada a acción/versión/resultado; cambio remoto obliga a revisar. Sin stock no es aporte sumable. Mantener notas/autoría y atomicidad D1 entre conteo, historial y resultado; reintentar nunca duplica aporte ni restaura una edición superada.

Servicio: Barra, Línea/Armado, Copería, Mercadito y Garzones; Garzones tiene sus zonas. Copería recibe 32 Aseo; Línea/Armado los otros 42 y conserva el ID técnico `armado-linea-coperia`. Vitrina: 41 conteos físicos separados en Mercadito, sin consolidar todavía. Catálogo: 1.268 entradas. Inicio omite selectores con una sola opción; Garzones conserva zonas. Jefa inicia en Servicio. Usuarios y accesos usa pestañas Cuenta/Accesos/Seguridad y ámbitos plegables.

## Incidencia de despliegue: hechos y límites

La primera caída mostraba `NOT_INITIALIZED`: el código exigía la vista `inventory_permissions`, pero D1 solo tenía 0001/0002. Se corrigió con 0003/0004, ciclo nuevo y variables de Pages. Posteriormente un ingreso real devolvió 503/1102 y el log confirmó `exceededCpu`. No confundir ambos diagnósticos.

El usuario revirtió temporalmente a `55dfc2b`; después pidió todos los cambios, recuperados en `cfece26`, hizo push y confirmó funcionamiento. El módulo bcrypt coste 12 es idéntico entre versiones. No está probado que la versión actual falle sostenidamente ni qué CPU consume cada parte. Un ingreso nuevo deriva contraseña; reutilizar sesión no. La tolerancia de Workers puede permitir excesos ocasionales. Las pruebas locales no acreditan límites Free.

El usuario quiere mantener Free. Supabase sigue como alternativa sin integrar ni seleccionada para implementar. **Primero medir comportamiento actual; no migrar por inercia ni activar Paid.** La revisión de solo lectura posterior a `cfece26` encontró dos errores `exceededResources` a las 17:18 UTC / 14:18 -03; el agregado no identifica ruta ni `exceededCpu` individual. Sí hay recurrencia de fallos por recursos, no prueba de caída permanente ni atribución definitiva a login/bcrypt. [Informe](revision-hermes-2026-10-22.json). No debilitar derivación ni añadir fallback inseguro. Ingresos/altas/cambios/restablecimientos remotos escriben estado y requieren autorización específica antes de ensayarlos.

## Estado y siguiente trabajo

- 3A implementada y probada localmente; aceptación operativa abierta. Piloto con trabajadores aplazado. Faltan validación sostenida/carga real del dominio, revisión de cookies allí, recuperación remota/copia externa y Android físico.
- 3B en curso: incremento de usuarios/Servicio ya publicado según el usuario. Pendientes tablero de supervisión e historial avanzado, rectificaciones/anulaciones auditadas, activación operativa de productos y revisión/cierre/reapertura.
- Etapa 2 mantiene dudas físicas/unidades; no inventar equivalencias para cerrarlas.
- Excel es etapa 4: todavía no exportar ni implementar esta salida. La futura exportación conserva estructura y referencias y solo cambia cantidades; consolidar ubicaciones físicas distintas de forma explícita. Desactivar no significa cero ni elimina filas.

Repetición al retomar: Node 19/19, Python 7/7, 1.151 filas originales y 41 referencias Vitrina coinciden; build Pages aislado en scratch correcto. Producción: 16 GET anónimos aprobados y cinco assets coinciden; sin ensayo autenticado nuevo ni carga. Suites anteriores de API/navegador y simulación local de 15 clientes (496 peticiones, 151 escrituras, 150 reintentos deduplicados, 14 conflictos esperados, cero errores inesperados) permanecen históricas. No se repitieron sobre el servidor activo. [Detalle](revision-hermes-2026-10-22.md). Repetir solo pruebas pertinentes y distinguir nuevo/histórico/local/remoto.

## Trabajo local y límites de autorización

Comprobar primero procesos/puertos y datos existentes. No ejecutar `test:prepare` sobre un servidor activo: reinicia bases ficticias. El servidor de revisión usa `npm run test:server`, puerto 8790 y `.wrangler/test-state`; `npm run dev` usa 8787 y su estado de desarrollo. `npm run build:pages` prepara `dist`, no despliega. Ver `package.json` y verificación para las suites.

Se autoriza en el prompt de traspaso analizar y actualizar documentación local coherentemente; no hay autorización general para commit, push, despliegue, reset, reescritura de historia, cambios remotos, facturación o envío de mensajes/archivos. Preparar primero un resultado revisable y solicitar autorización concreta cuando corresponda. WhatsApp está configurado previamente: no reemparejar ni cambiar destinatarios. No enviar archivos internos sin solicitud explícita y destinatario confirmado.

Lucio prefiere español, claridad y brevedad con explicación didáctica cuando la pide. Espera acción autónoma para trabajo reversible ya autorizado, preservación de decisiones y pruebas honestas; evitar confirmaciones repetidas, sobreingeniería, dependencia innecesaria de proveedores y consumo de contexto sin utilidad. No delegar ni abrir otras conversaciones por defecto. Distinguir observado, informado por el usuario, inferido y pendiente.
