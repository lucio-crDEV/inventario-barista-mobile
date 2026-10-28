# Verificación vigente

Entrega de etapa 4D, rendimiento y mantenimiento. El [registro de evidencia](etapa-4d-verificacion-2026-10-28.json) distingue código local, preparación remota y publicación pendiente del push.

## Validación automática

Requiere Node 24 y las dependencias fijadas en el lockfile:

```sh
npm ci
npm test
python3 -m unittest discover -s tests -p '*_test.py'
npm run test:security:isolated
node tests/shared/export-jobs-runtime.mjs
npm run build:pages
```

La batería aislada crea bases ficticias y servidores locales propios; no reutiliza el estado de desarrollo ni recibe credenciales productivas. Incluye permisos, conflictos, concurrencia, jerarquías, supervisión, navegación móvil, descarga, recuperación de respaldos y paquete público. Las pruebas nuevas de contraseña ejecutan bcrypt12 en un objeto SQLite local, incluyendo el ingreso HTTP completo. GitHub Actions usa este recorrido sin desplegar.

El guard independiente verifica el SHA del original, todos los miembros ZIP, formatos, referencias, fórmulas y límites de modificaciones:

```sh
python3 scripts/verify-excel-template.py
python3 scripts/verify-excel-template.py --candidate .exports/copia.xlsx --recalculate-on-open
```

La segunda opción corresponde a nuevas copias autorizadas para actualizar totales al abrir. Una copia histórica con política `preserve-calc` se verifica omitiendo `--recalculate-on-open`; el guard no acepta las opciones de cálculo sin ese permiso explícito.

## Resultados de esta entrega

- Pruebas unitarias, fidelidad independiente Python y batería aislada: aprobadas según cifras exactas de la evidencia.
- Generador nativo: trabajo SQLite, alarma real, cinco solicitudes simultáneas, recuperación de un fallo, objeto R2 único, descarga estable, sesión revocada y cero salidas a Internet en la simulación.
- UI: 320, 390 y 1024 px, claro/oscuro, sin desborde; solo Admin, revisión, bloqueos, contenido escapado, reintento del mismo comando, progreso, historial y descarga.
- Migraciones 0014/0015 y preflight remoto de exportación: aprobados.
- Plantilla privada remota: hash idéntico al original. r2.dev desactivado y sin dominios públicos.
- Worker privado preparado y bindings efectivos; actualización de configuración de Pages sin crear otro despliegue.
- Se corrigieron dos problemas detectados durante la batería: envoltorio de errores nativos D1 y pruebas que importaban módulos por rutas anteriores al empaquetado. La regresión de una revocación durante la captura de fuente tiene prueba específica.

## Límites

No se hizo push ni despliegue de Pages en esta entrega. CI está preparado: su primera ejecución real en GitHub ocurre después del push. Una aprobación local no demuestra el resultado de ese workflow ni CPU facturada de producción.

Falta aceptación en teléfono físico y Microsoft Excel. Las opciones de recálculo solicitan al programa actualizar las fórmulas; el generador no ejecuta Excel ni certifica su motor. Datos de catálogo pendientes pueden bloquear legítimamente una exportación; no se sustituyen por valores supuestos.

## Comprobación posterior al push

Esperar el build de Pages, verificar la revisión y entrar con una cuenta real. Probar Admin y un trabajador, generación y dos descargas; contrastar sus hashes, STOCK y totales en Excel. Revisar los errores/CPU del proveedor. El error 1102 puede terminar una invocación antes de que la telemetría de la propia aplicación consiga registrarla.

El preflight remoto es de solo lectura:

```sh
node scripts/preflight.mjs --remote --config wrangler.pages.production.jsonc --cycle piloto-v3-servicio --exports
```

No repetir primer administrador, fixtures ni migraciones ya aplicadas. Los informes fechados de etapas anteriores conservan resultados históricos, no pendientes vigentes; [índice](README.md).
