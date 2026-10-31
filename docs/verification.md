# Verificación vigente

## Cierre local del 31-10-2026

Los cuatro commits recuperados ya están incorporados en el repositorio original, rama `inventory-v3`. Aprobaron 210 unitarias sin exclusiones, 14 Python y las 30 comprobaciones de la batería aislada, incluido el ingreso nativo de treinta personas, saturación, plazos reales de cola/solicitante y recuperación. La exportación aprobó seis combinaciones de ancho/tema en Chromium; se corrigió únicamente el selector ambiguo de «Cerrar» en esa prueba. Se inspeccionaron las capturas móviles de ambos temas.

Formato, lint, build, guard del original, exportación privada nativa, monitor simulado y preparación del Worker privado mediante `--dry-run` aprobaron. [Evidencia completa](revision-local-verificacion-2026-10-31.json). Los bloqueos de puertos/Chromium descritos en el antecedente del 29-10 quedaron resueltos para esta ejecución. No hubo cambios remotos, migraciones, push ni publicaciones.

Queda actualizar el Worker privado antes del push del usuario, comprobar Actions/Pages y completar aceptación física de teléfono/Excel. [Orden de publicación](continuacion-local.md). Las cifras y restricciones de producción conservan sus límites; los resultados anteriores quedan en sus archivos de evidencia.

La evidencia vigente está en [la revisión local del 31-10](revision-local-verificacion-2026-10-31.json). Los registros fechados de etapas anteriores conservan resultados históricos; no sustituyen la comprobación del código publicado, los bindings ni las métricas reales.

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

Las pruebas anteriores describen la cobertura actual; las cifras finales están en la evidencia del 31-10. Los siguientes antecedentes de 4D se conservan como referencia de esa etapa y no sustituyen una comprobación del estado remoto vigente:

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

## Antecedentes

- [Etapa 4D](etapa-4d-verificacion-2026-10-28.json): capturas, motor y almacenamiento privado.
- [Operación Free del 28-10](operacion-free-verificacion-2026-10-28.json): offline, RTv2, índice y monitor.
- [Supervisión e ingreso del 29-10](supervision-acceso-verificacion-2026-10-29.json): recuperación de commits y bloqueos históricos de puertos/Chromium, resueltos en la ejecución local del 31-10.

La última observación pública registrada en esa evidencia fue `879428b`. La revisión del 31-10 fue local y no volvió a verificar producción. El siguiente push requiere comprobar Actions y Pages por separado.
