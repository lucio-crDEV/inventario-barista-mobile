# Continuación local de la revisión del 29-10

La copia recuperada contiene los commits de CI, exportación en Supervisión e ingreso compartido, más la verificación final. Parte de `879428b` en `inventory-v3`. El repositorio original sigue intacto porque esta sesión solo puede leerlo. No se hizo push ni se publicaron Workers/Pages.

## Incorporar sin descartar cambios

En la terminal local de la Mac, con el repositorio original limpio y en `inventory-v3`:

```sh
cd /Users/lucio/workspace/inventario_brioche
git status --short --branch
git fetch /Users/lucio/.codex/.chatgpt-projects/g-p-6a3c69a85dc8819186d67bd2c6064455/inventario_brioche inventory-v3
git merge --ff-only FETCH_HEAD
```

`fetch` es local y no requiere conexión a GitHub. `--ff-only` evita crear una combinación inesperada: si la rama avanzó por otro camino, detenerse y revisar; no usar reset, force ni sobrescribir cambios. También puede usarse el archivo `inventory-v3-recuperado.bundle` entregado como origen de `git fetch`, en lugar de la carpeta de la copia.

## Comprobaciones pendientes antes de publicar

Con Node 24 y dependencias del lockfile instaladas, ejecutar fuera de la sesión que bloquea servidores y Chromium:

```sh
npm test
npm run test:security:isolated
```

La batería incluye `tests/shared/password-concurrency-runtime.mjs` y `tests/shared/export-ui.mjs`; no hace falta repetirlos si ambos aprobaron allí. El primer ensayo usa treinta cuentas ficticias de la misma IP y un binding SQLite privado nativo; también comprueba colas, cuotas, vencimiento, timeout y recuperación. El segundo cubre la exportación en tres anchos y dos temas. Nunca usar fixtures productivos.

Después de que aprueben, actualizar el código del Worker privado `inventory-exports` con su configuración existente antes del push del usuario que publica Pages. No añadir migraciones, plantilla, llaves ni recursos. La configuración privada y su comando se mantienen en [la guía de exportación](etapa-4d-exportacion.md); no publicar con una configuración de ejemplo.

Tras el push del usuario, comprobar Actions y el commit efectivo en Pages, binding PASSWORDS, permisos de Administrador y flujo de exportación. La versión pública observada ahora es `879428b`, anterior a estos cambios. Siguen pendientes la aceptación en teléfono físico y Microsoft Excel, y la observación de CPU/errores en uso normal. El resultado de una simulación local no certifica capacidad productiva ni cuota Free.
