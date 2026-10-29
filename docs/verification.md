# Verificación vigente

Entrega de etapa 4D, offline real, HTML seguro, sincronización RTv2 y revisión de Supervisión/ingreso compartido. La evidencia de esta revisión está en [supervision-acceso-verificacion-2026-10-29.json](supervision-acceso-verificacion-2026-10-29.json). El [registro de evidencia 4D](etapa-4d-verificacion-2026-10-28.json) conserva los resultados de esa etapa; las cifras finales y el estado remoto constan en [la evidencia de esta revisión](operacion-free-verificacion-2026-10-28.json). Una prueba local no acredita publicación ni alertas activas.

## Validación automática

Requiere Node 24 y las dependencias fijadas en el lockfile:

```sh
npm ci
npm run format:check
npm run lint:html
npm test
python3 -m unittest discover -s tests -p '*_test.py'
npm run test:security:isolated
node tests/shared/export-jobs-runtime.mjs
npm run build:pages
```

La batería aislada crea bases ficticias y servidores locales propios; no reutiliza el estado de desarrollo ni recibe credenciales productivas. Incluye permisos, conflictos, concurrencia, jerarquías, supervisión, navegación móvil, descarga, recuperación de respaldos y paquete público. Las pruebas de contraseña ejecutan bcrypt12 en un objeto SQLite local, incluyendo el ingreso HTTP completo. GitHub Actions comprueba el formato, ejecuta las unitarias —que incluyen el lint HTML y el importador de catálogo— y la batería aislada, con los nuevos recorridos HTML/offline/RTv2. No despliega.

Las regresiones nuevas pueden ejecutarse de forma acotada:

```sh
node tests/shared/html-browser.mjs
node tests/shared/offline-browser.mjs
node tests/shared/realtime-runtime.mjs
node tests/shared/realtime-browser.mjs
```

- HTML: interpolaciones hostiles, fragmentos no falsificables, rechazo de puntos de inserción mediante cadenas y vistas separadas que conservan navegación, campos y borradores.
- Offline con Chromium: apertura de una pestaña nueva realmente sin red, último ciclo/área autorizado, borrador y operación incierta conservados, reconexión sin envío automático y reintento del mismo comando. También se comprueban 401/503 sin alternativa local, cambio de cuenta entre pestañas, salida offline y revocación posterior de la cookie, expiración, cuotas y actualización del service worker sin perder el borrador. El SW solo conserva archivos estáticos y estructuras HTML públicas; IndexedDB guarda las proyecciones privadas por identidad, hasta el vencimiento real de sesión y como máximo doce horas.
- RTv2 nativo: treinta conexiones comparten una consulta de datos del historial por intervalo; se añaden el control inicial y la comprobación de accesos posterior a la espera. Se prueban aislamiento por ciclo/ubicación, mensajes de hasta 250 registros y 48 KiB, continuidad de cursores, revocación y expiración durante la consulta, fallos, desborde, ping/pong sin despertar JavaScript y compatibilidad con avisos v1. No salen peticiones a Internet desde la simulación.
- RTv2 en Chromium: el conteo aplica registros ordinarios sin consultas HTTP por teléfono, conserva cantidad, nota, foco y borrador, y no retrocede ante respuestas antiguas o duplicadas. Los huecos y mensajes inválidos recuperan la API autorizada; las páginas se drenan antes de confiar en el nuevo cursor. La instantánea offline ya autorizada también se actualiza.
- Catálogo: validación del paquete aprobado, hash, ámbitos, referencias Excel, cardinalidades, límites de D1, importación repetida sin cambios y rechazo de estados incompatibles. No se inventan unidades, conversiones ni destinos.

El guard independiente verifica el SHA del original, todos los miembros ZIP, formatos, referencias, fórmulas y límites de modificaciones:

```sh
python3 scripts/verify-excel-template.py
python3 scripts/verify-excel-template.py --candidate .exports/copia.xlsx --recalculate-on-open
```

La segunda opción corresponde a nuevas copias autorizadas para actualizar totales al abrir. Una copia histórica con política `preserve-calc` se verifica omitiendo `--recalculate-on-open`; el guard no acepta las opciones de cálculo sin ese permiso explícito.

## Evidencia y estado de entrega

Las pruebas anteriores describen la cobertura actual. Registrar las cifras finales en la evidencia de la ejecución completa. Los siguientes antecedentes de 4D se conservan como referencia de esa etapa y no sustituyen una comprobación del estado remoto vigente:

- Pruebas unitarias, fidelidad independiente Python y batería aislada: aprobadas según cifras exactas de la evidencia.
- Generador nativo: trabajo SQLite, alarma real, cinco solicitudes simultáneas, recuperación de un fallo, objeto R2 único, descarga estable, sesión revocada y cero salidas a Internet en la simulación.
- UI: 320, 390 y 1024 px, claro/oscuro, sin desborde; solo Admin, revisión, bloqueos, contenido escapado, reintento del mismo comando, progreso, historial y descarga.
- Migraciones 0014/0015 y preflight remoto de exportación: aprobados.
- Plantilla privada remota: hash idéntico al original. r2.dev desactivado y sin dominios públicos.
- Worker privado preparado y bindings efectivos; actualización de configuración de Pages sin crear otro despliegue.
- Se corrigieron dos problemas detectados durante la batería: envoltorio de errores nativos D1 y pruebas que importaban módulos por rutas anteriores al empaquetado. La regresión de una revocación durante la captura de fuente tiene prueba específica.

## Límites

La documentación y los resultados locales no certifican un push, un despliegue de Pages ni el resultado de un workflow remoto. Verificar por separado el código publicado, los bindings y la evidencia operativa. Tampoco certifican CPU facturada ni cobertura de alertas del proveedor.

`0016_catalog_lookup_index.sql` se aplicó en producción, con preflight de solo lectura anterior y posterior aprobado. No asumir su índice ni sus beneficios en una base que todavía no haya recibido la migración; no repetir las migraciones que ya consten aplicadas.

Con tiempo real disponible, una desconexión del conteo activa consultas de respaldo cada treinta segundos; una conexión sana usa registros RTv2 y mantiene la recuperación HTTP inicial o ante discontinuidades. Esa demora de respaldo y el consumo dependen de la carga y de los roles. La simulación con treinta conexiones no garantiza las cuotas Free durante veinticuatro horas continuas.

Falta aceptación en teléfono físico y Microsoft Excel. Las opciones de recálculo solicitan al programa actualizar las fórmulas; el generador no ejecuta Excel ni certifica su motor. Datos de catálogo pendientes pueden bloquear legítimamente una exportación; no se sustituyen por valores supuestos.

TOTP, nuevas políticas de acceso/inactividad, «Cerrar otras sesiones» y Dependabot permanecen pendientes de decisión. Offline, HTML seguro, vistas separadas, importador y RTv2 forman parte de la implementación local actual.

## Comprobación posterior al push

Esperar el build de Pages, verificar la revisión y entrar con una cuenta real. Probar Admin y un trabajador, generación y dos descargas; contrastar sus hashes, STOCK y totales en Excel. Revisar los errores/CPU del proveedor. El error 1102 puede terminar una invocación antes de que la telemetría de la propia aplicación consiga registrarla.

El preflight remoto es de solo lectura:

```sh
node scripts/preflight.mjs --remote --config wrangler.pages.production.jsonc --cycle piloto-v3-servicio --exports
```

No repetir primer administrador, fixtures ni migraciones ya aplicadas. Los informes fechados de etapas anteriores conservan resultados históricos, no pendientes vigentes; [índice](README.md).

## Cierre del 28-10 (antecedente)

204 pruebas unitarias, 14 pruebas Python y 29 recorridos de la batería aislada aprobados; formato y lint aprobados. Las pruebas nativas cubren exportación privada, treinta conexiones de tiempo real y monitor con Analytics simulado, sin tocar datos productivos. El libro original conserva su SHA-256. Se corrigieron y cubrieron dos regresiones: estructura del panel de productos y errores de envío que el aviso offline ocultaba.

El índice 0016 y los Workers privados de tiempo real/monitoreo quedaron preparados remotamente. La alerta de correo figura habilitada y el usuario confirmó la entrega del mensaje de prueba. La consulta real de Analytics validó las cuatro series; las métricas actuales no se confunden con el perfil local ni con un ensayo de carga productiva. Pages y el primer workflow de GitHub de esta revisión requieren el push del usuario.

La primera muestra programada real se observó el 28-10-2026 a las 16:30:22 UTC: monitor disponible y las cuatro series disponibles. El canal de correo también fue confirmado por el usuario.

## Revisión del 29-10: Supervisión e ingreso compartido

Exportar Excel se trasladó a Supervisión, exclusivamente para Administrador. El diálogo usa el inventario seleccionado y el historial conserva ese filtro al paginar. Mi perfil ya no carga exportación. Las cuatro regresiones `tests/export-context.test.mjs` ejecutan el componente con un puerto DOM/API mínimo: permisos, historial contextual, respuesta incierta y cierre, actualización del mismo inventario sin cambiar de destino. No certifican diseño ni un navegador. La batería `tests/shared/export-ui.mjs` cubre 320/390/1024 px, claro/oscuro, foco, controles de 44 px, navegación/filtros, permisos, cierre de una captura incierta, bloqueos, generación, descarga, historial y reaperturas. Debe ejecutarse en un entorno con Chromium permitido; una revisión estática no certifica estas comprobaciones visuales.

La corrección del ingreso está en [ingresos compartidos](ingresos-compartidos.md). `npm run test:login:runtime` ejecuta treinta ingresos por el servicio privado nativo, cuotas, errores, saturación y recuperación. La batería aislada lo incluye sin recibir credenciales productivas. `npm run test:login:core` permite verificar el handler, SQLite y bcrypt12 real en memoria cuando no se permiten servidores; no sustituye Workerd/Durable Objects.

El workflow remoto de `879428b` aprobó `unit` y falló en la instalación de Chromium, antes de ejecutar la batería aislada. La vista pública no proporcionó el log detallado. GitHub avisó del cambio de `ubuntu-latest` a Ubuntu 26; se fija Ubuntu 24.04, compatible con la versión fijada de Playwright. Es una corrección del entorno basada en ese diagnóstico; su éxito remoto exige otro workflow tras el push.

Al retomar se confirmó el ingreso público de Pages y la versión `879428b0080f.20261029171810` en `/assets/shared-RZ2MYGHY.js`, importado por la página de cuenta. Esto verifica los recursos efectivos de aquel push, aunque Actions haya fallado en paralelo. No verifica por sí solo el estado del panel de despliegues, todos los bindings ni una sesión autenticada. No se modificaron recursos remotos, migraciones ni secretos; los commits nuevos siguen sin publicar.

Persisten las aceptaciones de teléfono físico y Microsoft Excel. Tampoco se certifica carga o CPU de Cloudflare. Consultar cifras, bloqueos de ejecución y próximos pasos exactos en la evidencia JSON del 29-10.

Resultado en esta sesión restringida: la ejecución completa de unitarias tuvo 206 pruebas, 204 aprobadas y dos bloqueadas por `listen EPERM` (D1 nativa y contraseñas nativas). Las cuatro nuevas regresiones de contexto aprobaron; la ejecución dirigida posterior de contexto/empaquetado/capturas/trabajos aprobó 25/25. Python aprobó 14/14, al igual que formato, lint, build y guard independiente del original. El escenario privado en proceso aprobó 30/30 (8.374 ms de ráfaga, p95 8.279 ms), con cuotas, timeout y revocación durante verificación. No presentar estos números como aprobación de la batería nativa ni del navegador.

Comprobación al retomar: 208 unitarias aprobadas al excluir explícitamente las dos pruebas nativas bloqueadas por la política de puertos. El núcleo privado volvió a aprobar 30/30 ingresos ficticios de una IP (8.370 ms, p95 8.264 ms), credenciales erróneas, cuotas, timeout y revocación; formato, lint, build y guard del original también aprobaron. Workerd volvió a fallar antes de ejecutar por `listen EPERM 127.0.0.1`; Chromium, por `MachPortRendezvousServer: Permission denied`. No se repitió la batería completa tras confirmar estos bloqueos.

Se amplió el ensayo nativo para comprobar saturación, vencimiento real de ocho segundos, límite real de diez segundos del solicitante y recuperación por el binding privado, además de los treinta ingresos. Su sintaxis se comprobó; su ejecución continúa pendiente, sin sustituirla por el núcleo en proceso. Los pasos para incorporar los commits y ejecutar lo pendiente están en [continuación local](continuacion-local.md).
