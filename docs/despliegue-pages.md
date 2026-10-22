# inventory-v3 en Cloudflare Pages — despliegue automático

**Estado del 22-10-2026:** demo en `94d3a83`, despliegue `982d494e`, con migraciones `0003`/`0004`, ciclo `piloto-v3-servicio` y siete cuentas mínimas preparados con autorización. El 503 `NOT_INITIALIZED` se corrigió; las 16 comprobaciones públicas pasan. **Ingreso y altas no son estables: error Cloudflare 1102, `exceededCpu` confirmado en logs.** Resolver alojamiento/CPU; no se cambió facturación ni bcrypt. [Evidencia](verification.md), [procedimiento para otros entornos](usuarios-y-servicio-3b.md). No repetir bootstrap, migraciones aplicadas ni creación del ciclo. El registro de `5d80658` de abajo es histórico del 21-10.

Destino: [inventario-login.pages.dev](https://inventario-login.pages.dev/). Proyecto Pages `inventario-login`, repositorio `lucio-crDEV/inventario-barista-mobile`, rama `inventory-v3`. Mantener el proyecto y la rama `inventory-v2` separados.

## Registro histórico del 21-10-2026

El usuario ya inició sesión en Wrangler, creó D1 `inventario-login-v3` y su salida de terminal confirma ambas migraciones y el ciclo `piloto-v3`. El 21-10-2026 confirmó la aplicación exitosa del SQL del primer administrador `admin`: cuatro consultas sin error. **No repetir el bootstrap ni recrear `piloto-v3`; las migraciones nuevas y el ciclo separado del incremento del 22-10 sí se preparan según la guía inicial.** Último código publicado comprobado: `5d80658`, éxito confirmado mediante consulta de despliegues; URL de ese despliegue `https://0458b9d4.inventario-login.pages.dev`.

En el dominio principal, cuatro archivos del ajuste coinciden exactamente con el commit local. Verificador anónimo **16/16** y recorrido básico de ingreso/cierre del administrador, Cuenta, menú, temas, refresco con espera de 30 segundos y lectura de cuentas aprobados. No se modificaron conteos, cuentas, contraseñas ni permisos; ingresar/salir utiliza los metadatos normales de sesión. Los conteos/conflictos y cambios de permisos con varias personas, atributos de cookie del dominio, CPU y recuperación remota siguen pendientes. [Detalle de comprobaciones](verification.md).

La revisión pública inicial encontró HTML en `/api/me` y `/api/bootstrap`, y el catálogo global accesible como archivo. Se corrigió publicando **`dist` generado con `npm run build:pages`**, que contiene el Worker. Se comprobó API, autorización, cookie segura y reintento idempotente en Pages + D1 por HTTPS local; la comprobación pública posterior confirmó la pantalla nueva, API JSON que exige sesión y catálogo global inaccesible. Después se corrigieron cabeceras ausentes en seis errores 401. Tras esperar el despliegue, el usuario repitió el verificador el 21-10-2026: **16/16 comprobaciones aprobadas**, con `routingPassed`, `securityHeadersPassed` y `passed` en `true`. Informe: [publico-3a.json](publico-3a.json). No se modificaron esquema ni datos para esa corrección.

Los pushes, despliegues e inicialización remota los realizó el usuario. La revisión consultó en lectura los despliegues y proyectos mediante Wrangler; no cambió la configuración de Cloudflare. Los logs confirman `build:pages`, compilación/carga del Worker y publicación. No se han certificado todos los ajustes del panel ni CPU remota. Se conserva abajo la configuración reproducible.

## 1. Configurar una vez el despliegue automático

En Cloudflare → Workers & Pages → **inventario-login**, comprobar la integración Git con `lucio-crDEV/inventario-barista-mobile`. En Settings / Builds & deployments (o Build / Branch control según el panel), usar esta configuración objetivo. La fila de previews es una recomendación pendiente, no un cambio ya realizado:

| Ajuste | Valor |
| --- | --- |
| Production branch | `inventory-v3` |
| Automatic production branch deployments | Activado |
| Framework preset | None |
| Root directory | Raíz del repositorio, sin subcarpeta |
| Build command | `npm run build:pages` |
| Build output directory | `dist` |
| Variable de compilación `NODE_VERSION` | `24` |
| Preview deployments | Recomendado: desactivadas mientras no exista D1/origen de ensayo separado; todavía no aplicado |

La consulta de proyectos del 21-10-2026 mostró previews para **todas las ramas** en los cuatro proyectos: `inventario-login` (producción `inventory-v3`), `inventario-local` (`inventory-v2`), `pedido-bodega` (`warehouse-order`) e `inventario-barra` (`main`). Un push a v3 puede generar tres builds de preview adicionales. Conviene restringir las previews irrelevantes preservando esas ramas de producción; **no se modificó esa configuración**. Esto puede consumir compilaciones, pero no demuestra por sí solo la causa de la demora observada.

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
| `ACTIVE_CYCLE_ID` | `piloto-v3-servicio` para el incremento del 22-10; crear primero ese ciclo |

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

Introducir el usuario personal elegido, por ejemplo `admin1`, el nombre visible y **una contraseña privada propia** de al menos 8 caracteres y como máximo 72 bytes UTF-8. La entrada de contraseña no se muestra en pantalla; escribirla también en la confirmación. `admin-prueba` / `Solo-pruebas-2026` pertenecen exclusivamente al entorno ficticio local y no se crean en el sitio real.

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

Última comprobación: `5d80658` publicado y revisado como se describe al inicio; no hay un despliegue pendiente de ese ajuste en esta revisión. Que `.DS_Store` quede sin seguimiento no impide publicar archivos versionados. No repetir migraciones ni bootstrap para cambios de interfaz/documentación.

1. Abrir `/api/me` sin sesión: debe responder JSON 401. Un 503 JSON indica configuración/inicialización pendiente; HTML indica que todavía no corre el Worker correcto. No debe aparecer `Unexpected token '<'` en la vista Cuenta.
2. Abrir `/data/inventario/items/catalogo-excel.js`, `/migrations/0001_core.sql`, `/worker/index.js` y `/_worker.js`: deben devolver 404. No publicar libros ni scripts de inicialización.
3. Ingresar con el administrador personal. Solo para una cuenta temporal nueva, cambiar su contraseña y volver a ingresar; no repetir ese paso si ya se completó. Comprobar cookie `__Host-inventory_session` Secure, HttpOnly, SameSite Strict y Path `/` en herramientas del navegador. El ingreso/cierre ya se revisó en el dominio; la inspección allí de esos atributos sigue pendiente.
4. Crear dos cuentas personales con Barra y una con Cocina, con contraseñas temporales privadas. Sin asignaciones se permite ingreso/cambio de contraseña, pero no acceso al inventario. Usar sesiones de navegador independientes.
5. Guardar 4 en Barra como A; proponer 3 como B. Descartar conserva 4; Sumar muestra 4 + 3 = 7; Sobrescribir muestra resultado 3. Restablecer el escenario entre ensayos. Una modificación remota mientras se confirma debe exigir nueva elección.
6. Dar Barra + Armado/Línea/Copería a otra cuenta: no debe ver Mercadito/Garzones. Probar Garzones completo frente a Terraza sola. La cuenta Cocina no debe acceder a Barra por URL ni API.
7. Con una edición pendiente, retirar Barra desde el administrador: la siguiente solicitud rechaza el acceso, desaparecen datos y queda aviso del borrador aislado. Cambiar de usuario no transfiere esos campos.
8. Restablecer/desactivar una cuenta y comprobar que sus sesiones dejan de funcionar. Revisar ambas apariencias en un teléfono real y verificar tiempos de ingreso/guardado en la red del local.

No ejecutar suites automatizadas ni carga con fixtures contra esta base publicada. Los resultados locales y límites están en [verification.md](verification.md). 3A tiene implementación, pruebas locales y revisión básica del dominio; respaldo/restauración y retención cuentan con herramientas ensayadas localmente. Su aceptación operativa sigue pendiente de conteos/conflictos y permisos con varias personas en el dominio, atributos de cookie allí, CPU/plan, recuperación remota/copia externa y dispositivo físico. El piloto con equipo se aplazó por decisión del usuario. 3B puede comenzar por supervisión e historial administrativo de solo lectura, según [etapa-3b.md](etapa-3b.md); Excel corresponde a etapa 4.

El usuario supone Free por no haber contratado pagos, sin confirmación del panel. La medición local de bcrypt coste 12 no permite aprobar su compatibilidad con ese plan. Confirmar plan y resolver CPU antes de habilitar uso real; no cambiar coste ni facturación automáticamente. [Evidencia y procedimiento de recuperación](cierre-tecnico-3a.md).


## Demora observada y publicaciones posteriores — 21-10-2026

Durante el primer intento de publicar el menú, producción aún servía `f760035`; dos intentos de `2ac0e4c` quedaron sin publicar, uno sustituido y otro cancelado por el usuario. Después se envió `80927ab`. Sus etapas registran **14 min 47 s en cola**; desde el comienzo de clonado hasta el éxito transcurrieron aproximadamente **22 s** (15:18:33–15:18:55 UTC). El tiempo de cola es distinto del tiempo de compilación/publicación.

La captura de Cloudflare mostró un aviso explícito de degradación de eventos push procedentes de GitHub. El [incidente oficial de GitHub sobre retrasos en pull requests y webhooks](https://www.githubstatus.com/incidents/nms1dpzmh9d9) se abrió a las 14:52 UTC y seguía en investigación en la actualización consultada de las 15:36 UTC. Esta es evidencia histórica del incidente observado, no una afirmación sobre su estado actual ni una prueba de la causa de cada segundo de cola.

Posteriormente se publicaron `80927ab`, `7dc005c` y finalmente `5d80658`; este último se comprobó en el dominio. No crear commits vacíos ni repetir pushes como método para resolver una demora externa. Comprobar primero commit recibido, estado de cola/build y avisos del proveedor.

## Actualizaciones posteriores

Menú, formularios y refresco compacto están incluidos en `5d80658`, además de skeletons y corrección de cabeceras. Se conservan rama, build, salida, D1, variables y ciclo. Los cambios futuros se envían con `git push origin inventory-v3` después de quedar en commits. **No repetir migraciones ni bootstrap de usuarios** cuando no cambia el esquema. Después de cada deployment, comprobar el commit y ejecutar `npm run verify:public`: únicamente 16 GET anónimos, sin carga ni escrituras. La última ejecución de esta tarea tras `5d80658` pasa también las cabeceras de los errores; el informe anterior fallido queda en la historia de Git.

Los scripts de respaldo y mantenimiento son tareas explícitas del operador; el deploy no los ejecuta. El aviso del log sobre el Wrangler de desarrollo es compatible con este flujo configurado desde el panel; la confirmación relevante es la compilación/carga de `_worker.js` y el estado final de éxito.
