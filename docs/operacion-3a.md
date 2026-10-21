# Operación local y preparación de producción — 3A

Implementación del 21-10-2026, trasladada completa a `inventory-v3` por decisión del usuario. `inventory-v2` queda en su base anterior sin 3A. El usuario preparó D1, hizo push y publicó las mejoras UX y la corrección posterior de cabeceras. La última ejecución pública compartida por el usuario pasa las 16 comprobaciones. Esta tarea no ejecuta push, despliegue ni modificación remota. El despliegue automático se documenta en [despliegue-pages.md](despliegue-pages.md). El contrato está en [contrato-3a.md](contrato-3a.md). Las pruebas actúan sobre fixtures locales y no deben apuntar a una base operativa.

## Iniciar el entorno local

Requisitos: Node 24 (las pruebas inspeccionan SQLite local mediante node:sqlite), npm, Python 3 para el contrato Excel. Desde el repositorio:

```sh
npm ci
npm run db:local
npm run seed:local
npm run dev
```

Abrir `http://127.0.0.1:8787/` (usar ese origen exacto). Mantener el servidor abierto. `seed:local` se ejecuta una sola vez sobre una base local vacía; repetirlo provoca un rechazo por usuario duplicado. No borra una base anterior. Los datos viven bajo `.wrangler/`, excluido de Git. No utiliza una cuenta Cloudflare ni recursos remotos. Si el entorno restringe abrir puertos o la caché de Wrangler, ejecutar en una terminal local con esos permisos; `WRANGLER_LOG_PATH=/tmp/inventory-wrangler.log` permite situar el log fuera de la caché personal.

Usuarios **exclusivamente ficticios**, contraseña local de todos: `Solo-pruebas-2026`:

| Usuario | Alcance |
| --- | --- |
| admin-prueba | Administrador global, sin asignaciones operativas |
| ana, bruno | Barra |
| cocina | Cocina |
| multiple | Barra y Armado / Línea / Copería |
| garzones | Todas las zonas de Garzones |
| terraza | Solo Terraza |
| sin-areas | Puede ingresar, sin inventario |
| carga1 … carga15 | Barra; simulación repetible |

Los fixtures omiten el cambio obligatorio para facilitar pruebas. Las cuentas creadas desde la administración y el primer administrador real **sí** deben cambiar su contraseña temporal. No existe fallback a fixtures. Una caída de API muestra error y conserva borrador; no activa modo local.

## Recorrido manual

1. Usar dos perfiles de navegador independientes (o uno normal y otro privado). Ingresar como Ana y Bruno. Ambos abren Servicio → Barra y el mismo producto mediante Buscar ítems.
2. Ana escribe 4 y pulsa Listo. Bruno escribe 3 y pulsa Listo: la comparación muestra autor, cantidad, estado, nota y ubicación. Descartar mantiene 4, borra solo ese borrador y recupera el vigente más reciente.
3. Repetir con 4 vigente y 3 propuesto. Sumar muestra **4 + 3 = 7** y exige Confirmar resultado. Sobrescribir muestra **Resultado: 3** y exige su confirmación. Ninguna opción se selecciona automáticamente. Si Ana cambia el registro mientras Bruno decide, la confirmación rechaza la versión antigua y solicita nueva elección.
4. Con Sin stock, Sumar queda deshabilitado. Cero con Listo se distingue del cero marcado Sin stock. Una suma conserva todas las notas; las notas previas y nuevas se etiquetan `[nombre · fecha]` y se muestran en el campo Nota y en Historial del producto. El historial guarda también antes/después, identidad estable, acción, versiones, marca y aporte.
5. Entrar como `multiple`: solo Barra y Armado. Entrar como `terraza`: Servicio → Garzones → Terraza, sin zonas hermanas. `sin-areas` muestra «No tienes áreas asignadas. Contacta al administrador».
6. En otro perfil, `admin-prueba` → Usuarios y accesos. Editar los ámbitos de Bruno y guardar. El servidor aplica el cambio desde la siguiente solicitud; la pantalla visible lo recoge con la consulta periódica (5 s). Al retirar Barra desaparecen sus datos; los borradores quedan aislados, sin reenvío. Volver a otorgar el acceso permite recuperarlos bajo el mismo usuario y ciclo. Asignar Servicio indica explícitamente que incluye todas sus subáreas.
7. Crear un trabajador sin permisos; iniciar sesión, cambiar su contraseña temporal y volver a ingresar. Otorgar áreas, cambiar su nombre, restablecer contraseña o desactivarlo. Restablecer/desactivar revoca todas sus sesiones; los cambios de ámbito no exigen nuevo ingreso. La última cuenta administradora activa está protegida.
8. Escribir sin guardar, navegar y volver: se recupera el borrador. Tras cerrar sesión, otra persona no recibe esos campos ni operaciones. Ante respuesta perdida, Reintentar envío pendiente recupera la operación original; mientras el resultado sea incierto, los campos se protegen contra nuevas ediciones. No existe envío automático al reconectar.

## Primer administrador, sin registro público

La app no ofrece registro, promoción inicial ni endpoint de bootstrap. El operador con acceso administrativo a **la base D1 seleccionada** genera SQL fuera de línea:

```sh
python3 scripts/first-admin.py /tmp/primer-admin.bootstrap.sql
```

El script pregunta usuario, nombre y contraseña con entrada oculta; no pasa la contraseña en argumentos ni la guarda. Crea un archivo nuevo con permisos 0600 que contiene el hash bcrypt con sal, UUID y una auditoría de bootstrap. El SQL exige una tabla de usuarios vacía; no se usa para añadir o promover cuentas en una instalación ya inicializada. Para ensayar con una base local vacía usar `wrangler d1 execute ... --local --file /tmp/primer-admin.bootstrap.sql`; no ejecutar además los fixtures sobre esa base.

Para el sitio del usuario, usar `wrangler.pages.production.jsonc` con D1 `inventario-login-v3`, ciclo `piloto-v3` y origen HTTPS exacto. El procedimiento completo y los ajustes del panel están en [despliegue-pages.md](despliegue-pages.md). El usuario ya aplicó migraciones y ciclo y confirmó el bootstrap del administrador `admin` el 21-10-2026: cuatro consultas importadas sin error. No repetir el bootstrap en esta instalación; retirar el SQL temporal después de su aplicación. Después informó funcionamiento; no se verificó independientemente el recorrido autenticado completo. Generar el archivo y aplicarlo son pasos distintos; usar `&&` entre ellos para no ejecutar SQL tras un error de validación. Un error de contraseña corta no crea archivo ni cuenta. No usar los usuarios ni contraseña de ensayo en la base pública.

Para otro despliegue Workers, partir de `wrangler.production.example.jsonc`; para Pages, de `wrangler.pages.example.jsonc`. El archivo principal sigue sin DB de producción ni origen válido por defecto. Las configuraciones de ejemplo no habilitan recursos ni usuarios por sí mismas.

El ciclo inicial real se crea explícitamente por el operador de D1, con ID propio, nombre, `catalog_version='inventory-v2-2026-10-21'` y `state='open'`; `ACTIVE_CYCLE_ID` debe coincidir. La interfaz de ciclo/revisión/cierre es 3B. No usar el nombre ni los usuarios de prueba en producción. Retirar el SQL temporal tras su aplicación y conservar el acceso administrativo a D1 para recuperación de desastre.

## Separación y publicación

`npm run build` copia a `dist/` una lista explícita de archivos públicos. No copia libros, `sources/`, documentación interna, fixtures, migraciones, servidor ni el catálogo global. El Worker restringe también las rutas estáticas. Servir **Worker + dist del mismo origen**. En Pages, `npm run build:pages` genera `_worker.js` y `_routes.json` junto con los assets permitidos; configurar esa compilación y salida `dist` en la integración Git. Una publicación estática sin el Worker no implementa autorización. El panel aporta DB y variables en este flujo; el archivo de configuración con nombre personalizado se usa explícitamente por los comandos D1. No publicar la raíz del repositorio.

Las cookies reales usan `__Host-inventory_session`, Secure, HttpOnly, SameSite=Strict, Path=/ y caducidad de 12 horas. Solo `APP_ENV=local` con origen loopback usa una cookie local sin Secure. POST exige Origin exacto y JSON; no se habilita CORS. La cabecera X-Inventory-User en guardados es una comprobación de que no cambió la cuenta de la pestaña; nunca determina autoría ni permisos, que salen de la sesión del servidor.

Las contraseñas usan bcryptjs 3.0.3, coste 12 y sal individual, sin truncar entradas mayores de 72 bytes. [bcryptjs](https://github.com/dcodeIO/bcrypt.js) documenta ese límite y su ejecución en JavaScript. [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) exige un coste bcrypt de al menos 10 y prefiere Argon2id para sistemas nuevos; aquí se priorizó una implementación portable que se verificó en workerd sin binarios o WASM adicionales. **Antes de producción es obligatorio medir CPU y ajustar el plan de Workers para este coste**: la simulación local no demuestra que quepa en los límites de un plan gratuito. No reducir el coste silenciosamente para sortear un límite. La cuota es 10 intentos por usuario y 100 por IP por ventana de 15 minutos, antes de derivar; cambio de contraseña, 10 por usuario. Las claves de cuotas son hashes, sin contraseñas. Revisar el umbral por IP en el piloto con la red real del local y definir mantenimiento/retención de cuotas, sesiones y auditoría.

[D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/) documenta transacciones por lote. El conteo usa una única sentencia INSERT con validaciones y efectos atómicos en triggers; no depende de transacciones interactivas ni de que un UPDATE de cero filas revierta un lote. Las mutaciones administrativas usan batch, guardia de sesión/rol y auditoría en el mismo lote.

## Criterios que siguen pendientes

3A está implementada y verificada en entorno local, **no declarada operativa en producción**. El usuario publicó `fb67ecb` y se comprobaron API protegida, archivos privados y skeletons públicos. Respaldo/restauración y retención tienen herramientas y siete grupos de prueba D1 local; instrucciones en [cierre-tecnico-3a.md](cierre-tecnico-3a.md). Falta ensayo de recuperación remota/copia externa, recorrido autenticado/cookies del dominio, evaluación en Android físico y CPU/límites/consumo. El piloto con trabajadores/señal real queda aplazado por decisión del usuario; puede continuar el desarrollo [3B](etapa-3b.md).

El usuario supone Free por no haber contratado pagos, sin comprobar el panel. El perfil de bcrypt coste 12 da 274–325 ms de CPU del proceso Node local, que no mide CPU facturada de Workers; frente al límite Free publicado de 10 ms por solicitud no se puede declarar compatible el alojamiento. Confirmar plan/CPU real y resolverlo antes del uso operativo. No se cambió coste ni facturación. No se han probado SMS/correo, exportación ni offline completo porque no forman parte de esta entrega.

Las cinco unidades ausentes de Pastelería siguen ausentes. Se permite registrar el valor explícito sin inventar unidad, pero Sumar se bloquea cuando la unidad es desconocida. No se certifica ese dato para Excel. Continúan las 18 entradas de Barra sin referencia, dos conversiones pendientes y revisión física de etapa 2.

Los datos de `inventario-session-v2` permanecen intactos en su origen anterior. No se leen, migran ni consolidan automáticamente; la transición/importación revisada queda pendiente. No hay botón de borrado compartido. Los borradores son almacenamiento local por usuario/ciclo, no una bóveda frente al propietario del navegador; la interfaz impide transferirlos entre identidades. No se promete conteo completo sin conexión.


## Identidad de versión y despliegue

El paquete y Worker de esta rama se llaman `inventory-v3`; el entorno local, `inventory-v3-local`. El ejemplo genérico Workers usa `inventory-v3-production`; la configuración Pages del sitio usa la base separada `inventario-login-v3` con el UUID suministrado por el usuario. No reutilizar la aplicación, dominio o base de producción de `inventory-v2` al preparar v3. El UUID local ficticio se conserva para no perder los datos de ensayo ya preparados. El identificador inmutable de catálogo `inventory-v2-2026-10-21` se conserva: identifica los datos heredados, no el nombre de la rama o del Worker.

El usuario ya publicó los commits anteriores. Para este cierre técnico queda preparado `git push origin inventory-v3`, sin ejecutarlo desde la tarea. Detalles y límites respecto de configuraciones externas de Cloudflare: [separacion-inventory-v3.md](separacion-inventory-v3.md).


## Pruebas sin alterar el desarrollo local

`npm run test:prepare` aplica migraciones y fixtures a `.wrangler/test-state` (Worker) y `.wrangler/pages-test-state` (Pages). **Reinicia solo esas dos bases desechables**; detener sus servidores antes de repetirlo. No apunta a `.wrangler/state` ni a D1 remota. El Worker de pruebas se abre con `npm run test:server` en 8790; ejecutar integración, extended, browser, views, sync y load en secuencia. Las suites modifican únicamente los fixtures de esa base.

Para Pages: `npm run build:pages`, `npm run test:pages:server` en otra terminal y `npm run test:pages`. Usa 8791, HTTPS local y una base independiente. `npm run test:bootstrap` valida el generador del administrador. Comandos completos en README y resultados en [verification.md](verification.md).

El desarrollo manual conserva 8787 y `.wrangler/state`. Las alternativas `dev:pages` / `dev:pages:https` abren 8788 y usan esa misma base de desarrollo; detener el Worker antes de alternar para evitar dos procesos escribiendo el mismo SQLite. No cambiar `.wrangler/state` por las carpetas de pruebas ni copiar fixtures a producción.
