# inventory-v3 en Cloudflare Pages — despliegue automático

Destino: [inventario-login.pages.dev](https://inventario-login.pages.dev/). Proyecto Pages `inventario-login`, repositorio `lucio-crDEV/inventario-barista-mobile`, rama `inventory-v3`. Mantener el proyecto y la rama `inventory-v2` separados.

## Estado comprobado y lo que falta

El usuario ya inició sesión en Wrangler, creó D1 `inventario-login-v3` y su salida de terminal confirma ambas migraciones y el ciclo `piloto-v3`. El 21-10-2026 el usuario confirmó también la aplicación exitosa del SQL del primer administrador `admin`: D1 procesó las cuatro consultas sin error. No repetir migraciones, creación del ciclo ni bootstrap en esta instalación. Sigue pendiente comprobar el ingreso y el cambio obligatorio de contraseña en el sitio publicado.

La revisión pública inicial encontró HTML en `/api/me` y `/api/bootstrap`, y el catálogo global accesible como archivo. El arreglo está en esta rama: publicar **`dist` generado con `npm run build:pages`**, que contiene el Worker. Se comprobó API, autorización, cookie segura y reintento idempotente en Pages + D1 por HTTPS local; no se certifica aún el sitio remoto actualizado.

Esta tarea deja código, documentación y commits locales. No ejecuta push, despliegue, cambios en el panel Cloudflare ni escrituras remotas. Los ajustes del panel de abajo deben guardarse una vez por el propietario; su estado actual no se verificó.

## 1. Configurar una vez el despliegue automático

En Cloudflare → Workers & Pages → **inventario-login**, comprobar la integración Git con `lucio-crDEV/inventario-barista-mobile`. En Settings / Builds & deployments (o Build / Branch control según el panel), establecer:

| Ajuste | Valor |
| --- | --- |
| Production branch | `inventory-v3` |
| Automatic production branch deployments | Activado |
| Framework preset | None |
| Root directory | Raíz del repositorio, sin subcarpeta |
| Build command | `npm run build:pages` |
| Build output directory | `dist` |
| Variable de compilación `NODE_VERSION` | `24` |
| Preview deployments | Desactivadas mientras no exista D1/origen de ensayo separado |

No publicar `.` ni la raíz del repositorio. `npm run build` por sí solo prepara assets para Workers, pero no añade el módulo requerido por Pages. `build:pages` empaqueta el mismo servidor en `dist/_worker.js` y hace pasar todas las rutas por él mediante `_routes.json`; no añade un framework.

En Settings → Bindings del entorno **Production**, añadir enlace D1:

| Campo | Valor |
| --- | --- |
| Nombre de variable | `DB` |
| Base D1 | `inventario-login-v3` |
| Database ID | `aff1d8f6-cde2-4ace-97b6-96f35ec0f8b0` |

En variables de ejecución de **Production**, guardar:

| Variable | Valor |
| --- | --- |
| `APP_ENV` | `production` |
| `APP_ORIGIN` | `https://inventario-login.pages.dev` |
| `ACTIVE_CYCLE_ID` | `piloto-v3` |

Usar fecha de compatibilidad `2026-10-01`. No poner una barra final en `APP_ORIGIN` ni sustituirlo por `*`; cambiar el dominio requiere actualizar el origen exacto y volver a desplegar. No habilitar fixtures en este proyecto.

`wrangler.pages.production.jsonc` contiene esos identificadores para los comandos de administración D1 con `--config`; **no se carga automáticamente por tener ese nombre ni configura el panel de Pages**. La configuración de este flujo Git se guarda en el panel. `wrangler.jsonc` se conserva para Workers/desarrollo, sin `pages_build_output_dir`: no copiar sus valores locales a producción. Las previews necesitan origen y base propios; con el origen actual fallan de forma cerrada.

La integración Git dispara builds con cada push a la rama configurada; `git pull` no publica nada. Referencias oficiales: [integración Git](https://developers.cloudflare.com/pages/configuration/git-integration/), [controles de rama](https://developers.cloudflare.com/pages/configuration/branch-build-controls/), [configuración Pages y Wrangler](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [Worker avanzado](https://developers.cloudflare.com/pages/functions/advanced-mode/). Si el proyecto fuera Direct Upload, el push no habilita por sí solo la integración Git: faltaría preparar una automatización de subida compatible; no se ha comprobado ese supuesto ni se debe borrar el proyecto actual para resolverlo.

## 2. Primer administrador — creado en este sitio

El administrador `admin` ya fue creado en la D1 de este sitio. Conservar el procedimiento siguiente como referencia para otra instalación vacía; **no volver a ejecutarlo aquí**. Tras la aplicación exitosa, retirar `/tmp/primer-admin-v3.bootstrap.sql`, que contiene el hash de la contraseña temporal.

Desde el repositorio actualizado, con Node 24 y `npm ci` ejecutado:

```sh
python3 scripts/first-admin.py /tmp/primer-admin-v3.bootstrap.sql &&
npx wrangler d1 execute DB --config wrangler.pages.production.jsonc --remote --file /tmp/primer-admin-v3.bootstrap.sql
```

Introducir el usuario personal elegido, por ejemplo `admin1`, el nombre visible y **una contraseña privada propia** de al menos 12 caracteres y como máximo 72 bytes UTF-8. La entrada de contraseña no se muestra en pantalla; escribirla también en la confirmación. `admin-prueba` / `Solo-pruebas-2026` pertenecen exclusivamente al entorno ficticio local y no se crean en el sitio real.

El script no conecta a Cloudflare, valida antes de crear archivo, no almacena la contraseña y genera UUID/hash bcrypt con sal en un archivo 0600. El segundo comando sí crea la cuenta en la D1 seleccionada; `&&` impide ejecutarlo si el script falla. El SQL solo funciona con tabla de usuarios vacía. No sobrescribe archivos existentes: si un intento válido ya generó el archivo, conservarlo y comprobar si se aplicó antes de generar otro. No compartir su contenido. Tras aplicación exitosa, retirar el SQL temporal de la computadora. El primer ingreso obliga a cambiar la contraseña temporal y volver a ingresar.

Para una instalación nueva distinta, los pasos previos son los siguientes; **ya realizados en esta base según la terminal del usuario**:

```sh
npx wrangler d1 migrations apply DB --config wrangler.pages.production.jsonc --remote
node scripts/create-cycle.mjs piloto-v3 "Inventario piloto v3" > /tmp/inventario-piloto-v3.sql
npx wrangler d1 execute DB --config wrangler.pages.production.jsonc --remote --file /tmp/inventario-piloto-v3.sql
```

No existe registro ni promoción pública, contraseña predeterminada ni recuperación por correo/SMS. Sin configuración, esquema, catálogo, ciclo o administrador activo válidos, la API rechaza el acceso con 503. Esta revisión no modifica las migraciones ya aplicadas.

## 3. Enviar los commits y desplegar

En la copia que contiene los commits nuevos, comprobar el estado y enviar **solo v3** cuando los ajustes anteriores estén guardados:

```sh
git switch inventory-v3
git status --short --branch
git log -3 --oneline
git push -u origin inventory-v3
```

Si se trabaja desde otra computadora, primero actualizar su copia sin descartar cambios locales:

```sh
git switch inventory-v3
git pull --ff-only origin inventory-v3
npm ci
```

Ese pull requiere que los commits ya se hayan subido desde la copia original. Si `--ff-only` rechaza por historia divergente, revisar la diferencia; no usar reset ni forzar el push.

Pages toma automáticamente el commit de GitHub, ejecuta `npm run build:pages` y publica `dist` en la URL del proyecto. Revisar en Deployments que el despliegue sea **Production**, rama **inventory-v3**, commit recién enviado y estado **Success**. Si ya se había enviado el commit antes de corregir ajustes, reintentar ese deployment desde el panel. Cambiar bindings/variables también exige un nuevo deployment.

No ejecutar migraciones ni bootstrap de administrador como parte del comando de build. Son tareas explícitas de preparación; el build no toca D1 ni crea usuarios. No hace falta añadir GitHub Actions si Pages ya tiene la integración Git habilitada.

## 4. Comprobar el sitio después del deployment

1. Abrir `/api/me` sin sesión: debe responder JSON 401. Un 503 JSON indica configuración/inicialización pendiente; HTML indica que todavía no corre el Worker correcto. No debe aparecer `Unexpected token '<'` en la vista Cuenta.
2. Abrir `/data/inventario/items/catalogo-excel.js`, `/migrations/0001_core.sql`, `/worker/index.js` y `/_worker.js`: deben devolver 404. No publicar libros ni scripts de inicialización.
3. Ingresar con el administrador personal, cambiar su contraseña temporal y volver a ingresar. Comprobar cookie `__Host-inventory_session` Secure, HttpOnly, SameSite Strict y Path `/` en herramientas del navegador.
4. Crear dos cuentas personales con Barra y una con Cocina, con contraseñas temporales privadas. Sin asignaciones se permite ingreso/cambio de contraseña, pero no acceso al inventario. Usar sesiones de navegador independientes.
5. Guardar 4 en Barra como A; proponer 3 como B. Descartar conserva 4; Sumar muestra 4 + 3 = 7; Sobrescribir muestra resultado 3. Restablecer el escenario entre ensayos. Una modificación remota mientras se confirma debe exigir nueva elección.
6. Dar Barra + Armado/Línea/Copería a otra cuenta: no debe ver Mercadito/Garzones. Probar Garzones completo frente a Terraza sola. La cuenta Cocina no debe acceder a Barra por URL ni API.
7. Con una edición pendiente, retirar Barra desde el administrador: la siguiente solicitud rechaza el acceso, desaparecen datos y queda aviso del borrador aislado. Cambiar de usuario no transfiere esos campos.
8. Restablecer/desactivar una cuenta y comprobar que sus sesiones dejan de funcionar. Revisar ambas apariencias en un teléfono real y verificar tiempos de ingreso/guardado en la red del local.

No ejecutar suites automatizadas ni carga con fixtures contra esta base publicada. Los resultados locales y los límites del piloto están en [verification.md](verification.md). La fase 3A tiene implementación y pruebas locales completas para el alcance descrito, pero su aceptación operativa sigue pendiente del ingreso/cambio de contraseña y de este recorrido remoto, CPU/plan, respaldos/restauración, retención y prueba con trabajadores. 3B continúa con supervisión, historial administrativo avanzado, rectificaciones/anulaciones, activación operativa y revisión/cierre/reapertura; Excel corresponde a etapa 4.
