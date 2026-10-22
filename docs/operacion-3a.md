# Operación local y preparación de producción — 3A

Estado al retomar el 22-10-2026: [usuarios, jefatura, perfil, eliminación y Copería/Vitrina](usuarios-y-servicio-3b.md) recuperados/publicados en `cfece26`, confirmado en Pages (`7df21f3c`). La demo ya se preparó con 0003/0004 y `piloto-v3-servicio`; no repetir fixtures, ciclo ni administrador. Otros entornos deben comprobar su estado antes de aplicar pendientes. [Revisión actual de solo lectura](revision-hermes-2026-10-22.md). Restaurar localmente requiere Python 3; se ordena una copia privada del SQL sin alterar el respaldo. Los comandos de inicialización/modificación son referencia, no autorización automática.


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
| multiple | Fixture nuevo: Barra y Línea/Armado. Una cuenta existente migrada desde el sector combinado conserva además Copería por una asignación añadida por 0004 |
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
5. Entrar como `multiple` en fixtures nuevos: solo Barra y Línea/Armado, sin Copería heredada. Si la cuenta existía al aplicar 0004, tendrá además una asignación explícita a Copería para conservar su alcance anterior; comprobar ese estado, no asumirlo por el nombre. `terraza` muestra Servicio → Garzones → Terraza sin zonas hermanas; `sin-areas`, «No tienes áreas asignadas. Contacta al administrador».
6. En otro perfil, `admin-prueba` → Usuarios y accesos. Editar los ámbitos de Bruno y guardar. El servidor aplica el cambio desde la siguiente solicitud; la pantalla visible lo recoge con la consulta periódica (5 s). Al retirar Barra desaparecen sus datos; los borradores quedan aislados, sin reenvío. Volver a otorgar el acceso permite recuperarlos bajo el mismo usuario y ciclo. Asignar Servicio indica explícitamente que incluye todas sus subáreas.
7. Crear un trabajador sin permisos; iniciar sesión, cambiar contraseña temporal y volver a ingresar. Otorgar áreas, cambiar username desde administración y nombre visible desde el perfil propio; restablecer o desactivar. Cambiar username, restablecer/desactivar revoca sesiones; cambiar ámbitos no exige nuevo ingreso. Último Administrador activo protegido. Una jefa solo administra Servicio y en cuentas mixtas solo sus accesos, no credenciales/activación/eliminación.
8. Escribir sin guardar, navegar y volver: se recupera el borrador. Tras cerrar sesión, otra persona no recibe esos campos ni operaciones. Ante respuesta perdida, Reintentar envío pendiente recupera la operación original; mientras el resultado sea incierto, los campos se protegen contra nuevas ediciones. No existe envío automático al reconectar.

## Primer administrador, sin registro público

La app no ofrece registro, promoción inicial ni endpoint de bootstrap. El operador con acceso administrativo a **la base D1 seleccionada** genera SQL fuera de línea:

```sh
python3 scripts/first-admin.py /tmp/primer-admin.bootstrap.sql
```

El script pregunta usuario, nombre y contraseña con entrada oculta; no pasa la contraseña en argumentos ni la guarda. Crea un archivo nuevo con permisos 0600 que contiene el hash bcrypt con sal, UUID y una auditoría de bootstrap. El SQL exige una tabla de usuarios vacía; no se usa para añadir o promover cuentas en una instalación ya inicializada. Para ensayar con una base local vacía usar `wrangler d1 execute ... --local --file /tmp/primer-admin.bootstrap.sql`; no ejecutar además los fixtures sobre esa base.

Para el sitio del usuario, `wrangler.pages.production.jsonc` identifica D1 `inventario-login-v3`, ciclo actual `piloto-v3-servicio` y origen HTTPS exacto; `piloto-v3` queda como ciclo anterior conservado. [Despliegue](despliegue-pages.md). Bootstrap de `admin` aplicado el 21-10 (cuatro consultas), actualización 0003/0004/ciclo nuevo preparada el 22-10; no repetirlos. Ingreso/cierre administrativo y lectura de cuentas del 21-10 son evidencia histórica; el recorrido completo con trabajadores permanece pendiente. Para otra instalación, generar y aplicar son pasos distintos: `&&` impide ejecutar SQL tras validación fallida. No ejecutar SQL remoto ni retirar archivos existentes sin autorización específica. Nunca usar fixtures en la base pública.

Para otro despliegue Workers, partir de `wrangler.production.example.jsonc`; para Pages, de `wrangler.pages.example.jsonc`. El archivo principal sigue sin DB de producción ni origen válido por defecto. Las configuraciones de ejemplo no habilitan recursos ni usuarios por sí mismas.

El ciclo inicial real se crea explícitamente por el operador de D1, con ID propio, nombre, `catalog_version='inventory-v3-2026-10-22'` para ciclos nuevos y `state='open'`; `ACTIVE_CYCLE_ID` debe coincidir. La interfaz de ciclo/revisión/cierre es 3B. No usar el nombre ni los usuarios de prueba en producción. Retirar el SQL temporal tras su aplicación y conservar el acceso administrativo a D1 para recuperación de desastre.

## Separación y publicación

`npm run build` copia a `dist/` una lista explícita de archivos públicos. No copia libros, `sources/`, documentación interna, fixtures, migraciones, servidor ni el catálogo global. El Worker restringe también las rutas estáticas. Servir **Worker + dist del mismo origen**. En Pages, `npm run build:pages` genera `_worker.js` y `_routes.json` junto con los assets permitidos; configurar esa compilación y salida `dist` en la integración Git. Una publicación estática sin el Worker no implementa autorización. El panel aporta DB y variables en este flujo; el archivo de configuración con nombre personalizado se usa explícitamente por los comandos D1. No publicar la raíz del repositorio.

Las cookies reales usan `__Host-inventory_session`, Secure, HttpOnly, SameSite=Strict, Path=/ y caducidad de 12 horas. Solo `APP_ENV=local` con origen loopback usa una cookie local sin Secure. POST exige Origin exacto y JSON; no se habilita CORS. La cabecera X-Inventory-User en guardados es una comprobación de que no cambió la cuenta de la pestaña; nunca determina autoría ni permisos, que salen de la sesión del servidor.

Las nuevas contraseñas requieren al menos 8 caracteres; bcryptjs 3.0.3, coste 12 y sal individual, rechazando más de 72 bytes sin truncar. [bcryptjs](https://github.com/dcodeIO/bcrypt.js), [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). La portabilidad se probó en workerd; no certifica CPU/consumo Free. **Mantener Free y comprobar errores/CPU reales antes de cambiar arquitectura; no ajustar facturación ni reducir el coste.** El código aplica 10 intentos por usuario y 100 por IP cada 15 minutos antes de derivar; cambio de contraseña, 10 por usuario. Claves de cuotas con hash, sin contraseñas. Revisar umbral por IP en la red del piloto. La retención de metadatos ya tiene herramienta explícita y ensayo local; no se ejecuta mantenimiento remoto por defecto.

[D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/) documenta transacciones por lote. El conteo usa una única sentencia INSERT con validaciones y efectos atómicos en triggers; no depende de transacciones interactivas ni de que un UPDATE de cero filas revierta un lote. Las mutaciones administrativas usan batch, guardia de sesión/rol y auditoría en el mismo lote.

## Criterios que siguen pendientes

3A está implementada y verificada localmente, **aceptación operativa abierta**. Publicación actual `cfece26`; 16 GET públicos repetidos ahora. El recorrido autenticado de ingreso/cierre, cuenta/menú/temas/refresco y lectura administrativa pertenece al 21-10 (`5d80658`), no se repitió. Respaldo/restauración/retención tienen siete grupos D1 locales históricos; [guía](cierre-tecnico-3a.md). Faltan conteos/conflictos y permisos con varias personas en dominio, cookies allí, recuperación remota/copia externa, Android y validación sostenida de recursos/consumo Free. Piloto aplazado por el usuario sin bloquear [3B](etapa-3b.md).

El usuario exige mantener Free; la cuenta/facturación del panel no fue auditada. El perfil Node histórico no mide CPU Cloudflare. La revisión actual sí encuentra dos errores por recursos posteriores a `cfece26`, sin URL ni resultado individual CPU; falta atribución y validación sostenida. No cambiar coste, proveedor ni facturación por inercia. SMS/correo, Excel y offline completo no forman parte de esta entrega ni se declaran probados.

Las cinco unidades ausentes de Pastelería siguen ausentes. Se permite registrar el valor explícito sin inventar unidad, pero Sumar se bloquea cuando la unidad es desconocida. No se certifica ese dato para Excel. Continúan las 18 entradas de Barra sin referencia, dos conversiones pendientes y revisión física de etapa 2.

Los datos de `inventario-session-v2` permanecen intactos en su origen anterior. No se leen, migran ni consolidan automáticamente; la transición/importación revisada queda pendiente. No hay botón de borrado compartido. Los borradores son almacenamiento local por usuario/ciclo, no una bóveda frente al propietario del navegador; la interfaz impide transferirlos entre identidades. No se promete conteo completo sin conexión.


## Identidad de versión y despliegue

El paquete y Worker de esta rama se llaman `inventory-v3`; el entorno local, `inventory-v3-local`. El ejemplo genérico Workers usa `inventory-v3-production`; la configuración Pages del sitio usa la base separada `inventario-login-v3` con el UUID suministrado por el usuario. No reutilizar la aplicación, dominio o base de producción de `inventory-v2` al preparar v3. El UUID local ficticio se conserva para no perder los datos de ensayo ya preparados. El catálogo anterior `inventory-v2-2026-10-21` se conserva junto al nuevo: identifica los datos heredados, no el nombre de la rama o del Worker.

El usuario ya publicó `cfece26`. Para futuros cambios revisados y en commits, `git push origin inventory-v3` sigue siendo la referencia de envío; ejecutarlo requiere autorización específica y no se hace en esta revisión. [Separación de versiones](separacion-inventory-v3.md) y [despliegue](despliegue-pages.md).


## Pruebas sin alterar el desarrollo local

`npm run test:prepare` aplica migraciones y fixtures a `.wrangler/test-state` (Worker) y `.wrangler/pages-test-state` (Pages). **Reinicia solo esas dos bases desechables**; detener sus servidores antes de repetirlo. No apunta a `.wrangler/state` ni a D1 remota. El Worker de pruebas se abre con `npm run test:server` en 8790; ejecutar integración, extended, browser, views, ux, sync, refresh y load en secuencia. Las suites modifican únicamente los fixtures de esa base.

Para Pages: `npm run build:pages`, `npm run test:pages:server` en otra terminal y `npm run test:pages`. Usa 8791, HTTPS local y una base independiente. `npm run test:bootstrap` valida el generador del administrador. Comandos completos en README y resultados en [verification.md](verification.md).

El desarrollo manual conserva 8787 y `.wrangler/state`. Las alternativas `dev:pages` / `dev:pages:https` abren 8788 y usan esa misma base de desarrollo; detener el Worker antes de alternar para evitar dos procesos escribiendo el mismo SQLite. No cambiar `.wrangler/state` por las carpetas de pruebas ni copiar fixtures a producción.
