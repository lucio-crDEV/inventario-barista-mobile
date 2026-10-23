# Usuarios y Servicio — contrato del incremento del 22-10-2026

## Estado vigente — revisión UX local

Revisión UX implementada localmente el 23-10-2026: Panel de supervisión y resumen compactos, historial por producto y rol, perfil/menú y Gestionar usuarios y accesos. Finalizar y enviar es interno; solo Administrador reabre finalizados. Motivo obligatorio solo para reabrir. Activo/Inactivo persiste por área con fechas/auditoría; el informe de varios meses queda futuro. Altas de trabajadores con accesos en la misma transacción y claves temporales autogeneradas/copiar/compartir tras éxito. Sin nuevos roles ni ampliación de cuentas mixtas.

Requiere **0007_operation_ux.sql después de 0006 antes del deploy**. No aplicar 0005, fixtures, bootstrap ni crear otro ciclo en la demo. No se ejecutaron operaciones remotas ni push. [Decisiones vigentes](decisiones-ux-y-operacion-2026-10-23.md), [verificación](verification.md), [publicación manual](publicar-revision-ux-0007.md). Excel conserva la regla de oro; exportación en etapa 4 y adaptación de plantillas en fase 5, ambas pendientes. Root/telemetría siguen fuera de alcance.

## Registro histórico anterior

Actualización 23-10-2026: el contrato funcional de Administrador/Jefa/Trabajador y cuentas mixtas se conserva. Root es únicamente un diseño pendiente, sin ampliación de roles ni provisionamiento. Los roles actuales no acceden al endpoint técnico; telemetría persistente desactivada. [Diseño y estado real](seguridad-observabilidad-3a.md).

Proyecto: inventario brioche, rama técnica `inventory-v3`. Contrato escrito antes de implementar y actualizado con la revisión del 22-10-2026. Excel continúa en etapa 4. El incremento está recuperado/publicado en `cfece26`, confirmado en Pages (`7df21f3c`) y funcionando según el usuario. La reparación anterior de `94d3a83` preparó 0003/0004, ciclo `piloto-v3-servicio` y siete cuentas; no repetirlos. Las métricas posteriores muestran dos errores `exceededResources`, sin ruta ni resultado CPU individual. Mantener Free; Supabase no está integrado ni es obligatorio. Aceptación operativa todavía abierta. [Evidencia actual](revision-hermes-2026-10-22.md), [registro completo](verification.md).

## Decisiones confirmadas

- Jerarquía: Administrador, Jefa de servicio y Trabajador. El Administrador conserva acceso completo; la etiqueta del selector no añade «acceso global».
- Jefa de servicio tiene lectura/escritura únicamente en Servicio por su rol. Administra trabajadores de Servicio; no promueve roles ni administra otras jefas/administradores.
- En cuentas con accesos de Servicio y de otras áreas, la jefa solo modifica asignaciones de Servicio. No modifica usuario, contraseña, activación ni eliminación de esa cuenta; son acciones exclusivas del Administrador. No recibe asignaciones ni datos de otras áreas.
- «Activar/desactivar zonas» significa asignar/retirar accesos de cada trabajador, no deshabilitar una zona para todos.
- Al crear se introducen usuario de ingreso, nombre visible, rol y al menos un acceso para Trabajador; el campo de clave temporal se genera automáticamente y admite regeneración. Después el Administrador cambia usuario de ingreso, rol, activación y accesos; cada persona cambia su propio nombre visible. La jefa cambia el usuario/contraseña de trabajadores exclusivamente de Servicio. Nadie cambia su propio usuario mediante el perfil.
- Eliminar exige diálogo explícito irreversible con Cancelar como foco inicial y confirmación en servidor. Retira cuenta, sesiones y accesos; conserva UUID, nombre histórico, conteos, operaciones y auditoría mediante una marca irreversible de eliminación. La cuenta no puede reactivarse; reutilizar un nombre de ingreso crea otra identidad.
- Copería se separa de Línea/Armado y recibe los 32 productos de Aseo del sector combinado. Los otros 42 quedan en Línea/Armado. Se conserva el identificador técnico anterior para Línea/Armado; no se cambian ID ni referencias de los productos existentes.
- Vitrina es un lugar físico. Las 41 marcas del libro de reparto están contrastadas por producto y unidad con Mercadito; la prueba de contrato se repitió al retomar. Se presentan como categoría Vitrina con ubicación/conteo propios, separados del resto. Conservan referencia de salida para consolidar en etapa 4; no se suman a otra ubicación durante el guardado. El contraste documental no cierra la aceptación física de etapa 2.

## Persistencia y seguridad

Migraciones nuevas `0003_users_service.sql` y `0004_service_catalog.sql`: ampliar roles y añadir eliminación/adscripción administrativa preservando claves, sesiones y referencias. Reconstruir `users` dentro de la transacción de migración con claves foráneas diferidas y recrear vistas/triggers. No se cambiaron `0001`/`0002`. [Claves foráneas en D1](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).

Permisos efectivos de inventario calculados en servidor y usados también por el trigger de conteo. Jefas no obtienen acceso exterior aunque se manipulen sus asignaciones. Las mutaciones administrativas usan un batch transaccional con guardias que fallan explícitamente si cambiaron sesión, rol, permiso del objetivo o revisión. Un UPDATE de cero filas no autoriza un historial de éxito. [Atomicidad de batch D1](https://developers.cloudflare.com/d1/worker-api/d1-database/).

Solicitudes de edición, restablecimiento y eliminación incluyen `expectedRevision`. Confirmaciones rechazadas conservan los campos y exigen recargar/revisar antes de reenviar. Modificar usuario de ingreso o contraseña revoca sesiones. Los cambios de perfil conservan UUID y snapshots históricos. Auditoría guarda antes/después sin contraseñas ni hashes.

API: POST `/api/admin/users` recibe `{username,name,role,password,grants}`. Trabajador exige al menos un grant; Administrador y Jefa usan `[]` y su alcance heredado. Alta y grants son atómicos. POST `/api/profile` recibe `{name, expectedRevision}` y solo edita al autenticado. POST `/api/admin/users/:id` recibe `{username, role, active, grants, expectedRevision}`; para cuentas mixtas administradas por jefa únicamente `{grants, expectedRevision}`. Restablecer usa `/:id/password` con `{password, expectedRevision}`; eliminar `/:id/delete` con `{confirm:true, expectedRevision}`. Se comprueba `X-Inventory-User` como aserción de pestaña; identidad/permisos proceden de la cookie/servidor. La cuenta eliminada conserva una fila histórica sin credenciales utilizables y no tiene ruta de restauración.

Catálogo nuevo inmutable por ciclo para Copería/Vitrina. Mantener catálogo y conteos de ciclos anteriores; no mover ni dividir cantidades anteriores automáticamente. Preparar un ciclo nuevo explícito para probar el reparto separado y documentar cómo seleccionarlo. El build no aplica migraciones ni inicializa datos remotos.

El catálogo `inventory-v3-2026-10-22` tiene 1.268 entradas, incluidas 41 de Vitrina; el anterior conserva sus 1.227. El alcance anterior de `servicio:armado-linea-coperia` se conserva añadiendo Copería a sus usuarios; desde entonces se administran por separado. El ID anterior representa Línea/Armado en el catálogo nuevo. Las 41 parejas Vitrina/resto tienen ID/ubicación distintos y la misma referencia/unidad de salida. No se ejecutó exportación ni suma automática entre ubicaciones.

## Actualizar desarrollo local existente

No ejecutar `seed:local` en una base ya usada. Detener el servidor y conservar datos/borradores:

```sh
npm run db:local
node scripts/create-cycle.mjs prueba-servicio-v3 "Prueba local de Servicio" > /tmp/prueba-servicio-v3.sql
npx wrangler d1 execute DB --local --env local --file /tmp/prueba-servicio-v3.sql
npm run dev -- --var ACTIVE_CYCLE_ID:prueba-servicio-v3
```

Crear ese ciclo una sola vez; repetir se rechaza sin borrar el anterior. En una base local vacía, `db:local` + `seed:local` prepara `prueba-compartida` con catálogo nuevo y dos jefas ficticias `jefa-servicio` / `jefa-servicio-2`, además de los fixtures anteriores. No se importan cantidades antiguas.

## Preparación histórica de la demo y referencia para otros entornos

Procedimiento reproducible para otro entorno. **Ya ejecutado en la demo el 22-10-2026 con autorización explícita**: no repetir ciclo/altas ni inicializaciones. No ejecutar comandos remotos de esta guía sin autorización específica; los identificadores siguientes pertenecen a la demo, no deben copiarse como destino de otra instalación. Las siete cuentas corresponden a la preparación histórica, no a un censo nuevo ni al seed local. Mantener separados rama y recursos de `inventory-v2`. `wrangler.pages.production.jsonc` contiene `piloto-v3-servicio`; las variables efectivas del deploy Git se guardan en Pages.

1. Conservar un respaldo privado. Restaurar localmente requiere Python 3: la herramienta ordena una copia temporal del SQL (tablas antes de datos, triggers después), sin ejecutar SQL en Python ni alterar el respaldo/checksum. La copia mantiene permisos privados y se elimina al terminar. [Recuperación y límites](cierre-tecnico-3a.md).

```sh
npm run backup -- --remote --config wrangler.pages.production.jsonc --directory .backups/pre-servicio-20261022
```

2. Aplicar solo migraciones pendientes y crear el ciclo nuevo una vez; conservar `piloto-v3`:

```sh
npx wrangler d1 migrations apply DB --config wrangler.pages.production.jsonc --remote
node scripts/create-cycle.mjs piloto-v3-servicio "Inventario de prueba - Servicio" > /tmp/piloto-v3-servicio.sql
npx wrangler d1 execute DB --config wrangler.pages.production.jsonc --remote --file /tmp/piloto-v3-servicio.sql
```

3. En Pages → inventario-login → variables Production, guardar `ACTIVE_CYCLE_ID=piloto-v3-servicio`; mantener `APP_ENV`, origen y DB. Después enviar los commits v3; el deployment automático toma las variables. No crear otro commit vacío, repetir bootstrap ni cargar fixtures. Sin las migraciones nuevas, el Worker falla cerrado con 503.
4. Comprobar commit y `npm run verify:public` (16 GET anónimos). Con el administrador existente, crear las dos jefas personales con contraseñas privadas y completar el cambio obligatorio. Probar el incremento con cuentas de ensayo elegidas expresamente, sin carga ni fixtures sobre producción.

Con el ciclo anterior, las cantidades conservan su reparto anterior; la interfaz etiqueta el sector combinado como «ciclo anterior». Las ubicaciones nuevas requieren seleccionar el ciclo nuevo. La revisión 0007 añade el ciclo de cierre/revisión/finalización; ver contrato vigente.

## Navegación e interfaz

Administración móvil: listado sin subtítulo, total junto a Cuentas existentes y avisos de alta en líneas distintas. Cada cuenta separa Cuenta/Accesos/Seguridad mediante pestañas accesibles que conservan el formulario. Accesos agrupa la jerarquía sin repetir rutas; Servicio, Garzones y Mercadito se despliegan cuando se necesitan. Seguridad separa restablecimiento y eliminación. La jefa en cuentas mixtas ve únicamente el editor permitido. Está incluido en `cfece26`; no añade migraciones ni exige repetir la preparación de la demo.

Inicio omite contenedores con una sola opción hasta el primer selector útil: solo Cocina/Pastelería/Panadería entra en sus categorías; varios ámbitos superiores mantienen Inicio; solo Servicio entra en sus subáreas; solo Garzones entra en sus zonas, incluso si solo tiene una. Jefa entra directamente a Servicio, sin flecha que vuelva al selector global. Las pantallas de conteo conservan regreso útil a categorías/zonas.

Mantener HTML/CSS/JS nativos, guía crema/carbón/cian, menú derecho, skeletons, movimiento reducido, errores recuperables y foco contenido en diálogos. El nombre propio se edita desde Mi cuenta; la contraseña conserva su pantalla. Nunca descargar catálogos de áreas ajenas para calcular el destino.

## Verificación requerida

Probar migración sobre una base con cuentas, sesiones y conteos; integridad/reintentos/autoría después. API: jerarquía, cuentas mixtas, intentos por URL/solicitud, perfil propio, username único, revocación, último administrador, eliminación irreversible, confirmación/revisión y carreras. Catálogo: 1.151 referencias intactas, separación 32/42 y las 41 ubicaciones de Vitrina con unidades/ref verificadas. Navegador: jefa, trabajador de área única, varias áreas, Garzones, edición propia y administración/confirmaciones en claro/oscuro móvil. Repetir regresiones y simulación local de 15 clientes; no usar fixtures contra producción.

Resultados históricos de implementación: 19 Node, 7 Python, 11 integración, 6 extended, 9 API nuevas, 6 grupos nuevos de navegador, regresiones browser/vistas/UX/sync/refresh y 6 HTTPS Pages, aprobados localmente. Migración D1 poblada y recuperación/retención local aprobadas. Carga local histórica: 15 clientes, 496 solicitudes, 6.695 ms, cero errores inesperados y 14 conflictos esperados. Al retomar se repitieron únicamente 19 Node, 7 Python, contrato de libros y build aislado, además de lectura pública/métricas; no se repitieron suites mutantes ni carga. [Resultados y límites](verification.md). No completa 3B ni cierra aceptación 3A.
