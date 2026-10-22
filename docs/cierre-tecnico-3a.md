# Cierre técnico de 3A y transición a 3B — 21-10-2026

Actualización del 22-10 al retomar: Pages confirma `cfece26` / `7df21f3c` correcto, 16 GET públicos y cinco assets coincidentes. El usuario confirmó funcionamiento. D1 ya está reparada; el `exceededCpu` histórico posterior fue un incidente distinto. Métricas después de la recuperación registran dos errores `exceededResources`, sin ruta ni resultado CPU individual: investigar sin presumir caída permanente. **Mantener Free; Supabase es alternativa sin integrar, no migración obligatoria.** [Evidencia nueva](revision-hermes-2026-10-22.md). Usuarios/Servicio de 3B implementados/publicados; aceptación operativa 3A y supervisión/resto 3B abiertas. Restauración local: Python ordena copia privada del dump, tablas antes de datos/triggers al final; ensayo histórico aprobado, respaldo original intacto. No se ensayó restauración remota.

La funcionalidad 3A está implementada, con pruebas locales históricas de API/navegador/concurrencia/Pages y recorrido administrativo básico del dominio hasta `5d80658`. La revisión actual de `cfece26` no repite ese recorrido autenticado. Piloto **aplazado por el usuario**, sin impedir desarrollar 3B. Aceptación operativa abierta. Free es la restricción de coste vigente; no se auditó facturación del panel ni se autoriza cambiarla.

## Evidencia y pendientes

| Parte | Estado real |
| --- | --- |
| Cuentas, sesiones, permisos, guardados y resolución ajena | Implementados y probados localmente; recorridos detallados en [verificación](verification.md) |
| Skeletons, estados de envío y menos peticiones | Incluidos en `fb67ecb`, deployment exitoso aportado por el usuario |
| Menú, formularios, mínimo de ocho caracteres y refresco compacto limitado | Publicados hasta `5d80658`; archivos del ajuste coinciden con el commit local y recorrido básico del dominio comprobado |
| Aislamiento público de API/archivos | 16 rutas del sitio responden como se espera, sin sesión ni escrituras remotas |
| Cabeceras de seguridad en errores de API | Corrección publicada; verificador repetido contra `5d80658`: 16/16, incluidos los seis 401, `securityHeadersPassed: true` y `passed: true` |
| Respaldo, restauración y retención | Herramientas terminadas y ensayo real D1 **local** aprobado; falta ensayo de recuperación de la D1 remota en destino separado y copia externa privada |
| Recursos/CPU y consumo Free | Dos errores `exceededResources` posteriores a `cfece26`; falta ruta/causa individual y presupuesto sostenido. El perfil Node no certifica CPU Cloudflare. No hay migración ni Paid autorizados |
| Dominio autenticado | Ingreso/cierre administrativo, Cuenta, menú/temas, refresco con espera de 30 s y lectura de cuentas comprobados; faltan conteos/conflictos y permisos entre varias personas e inspección allí de atributos de cookie |
| Red y Android físicos | Pendientes; el recorrido de navegador del dominio no certifica dispositivo ni señal reales |
| Equipo durante inventario | Aplazado; quedan evaluación de claridad, señal y reparto físico |
| 3B | Alcance e incrementos preparados en [etapa-3b.md](etapa-3b.md); todavía sin tablero avanzado ni mutaciones administrativas de conteo |

## CPU: comprobación disponible y decisión pendiente

`npm run profile:local` ejecuta el módulo real de contraseñas, bcryptjs 3.0.3 con coste 12, sobre una contraseña ficticia y sin cuentas ni conexiones. Tres derivaciones y tres verificaciones consumieron **274–325 ms de CPU del proceso Node**, con **274–331 ms de tiempo transcurrido**. Informe: [perfil-local-3a.json](perfil-local-3a.json). No son CPU facturada de Workers, perfil de workerd ni latencia de producción; no incluyen D1.

Workers Free publica **10 ms de CPU por solicitud**; la espera de red no cuenta y el entorno local no aplica todos los límites del plan. Que un ingreso aislado funcione no acredita compatibilidad sostenida. Referencia: [límites de Workers](https://developers.cloudflare.com/workers/platform/limits/). Pages Functions consume el plan Workers: [cuotas Pages](https://developers.cloudflare.com/pages/functions/pricing/).

Antes de cerrar aceptación, correlacionar errores por recursos/CPU de ingreso y flujos de contraseña con fecha, versión y ruta. Esta revisión sí leyó métricas remotas Pages, pero sus agregados no localizan las dos solicitudes; no se obtuvo perfil de cada fase ni auditoría de facturación. [Perfilado oficial](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/). Mantener Free: primero medir/atribuir, después evaluar alternativas explícitas si hacen falta. No seleccionar Paid ni Supabase automáticamente, reducir protección o ejecutar cambios remotos. Un ensayo de ingreso/contraseña crea estado y requiere autorización específica.

Revisar también consumo diario. Como escenario aritmético, 15 pantallas visibles consultando cada 5 s durante 8 h producirían **86.400 consultas de sincronización**, antes de guardados, navegación y otras solicitudes, frente a 100.000 solicitudes/día de Workers Free. No es una simulación ni una medición de actividad real; las pantallas ocultas pausan el sondeo. Este escenario no acredita capacidad ni permite concluir que el total diario quepa en Free. [Cuotas Workers](https://developers.cloudflare.com/workers/platform/limits/).

## Respaldo reproducible

Desde la raíz del repositorio, con `npm ci` y Node 24. El destino debe ser nuevo. Dentro del repositorio solo se admite `.backups/`; también se admite un directorio privado externo. Se rechazan `dist/`, `sources/` y documentación incluso antes de exportar. No colocar respaldos en carpetas sincronizadas/publicadas.

```sh
npm run backup -- --local --directory .backups/ensayo-3a
```

Usa `.wrangler/state` por defecto; `--state .wrangler/test-state` selecciona explícitamente otra base local existente. La exportación guarda SQL, manifiesto con fecha, tamaño y SHA-256, carpeta 0700 y archivos 0600. No sobrescribe respaldos. Un fallo no genera un manifiesto de éxito. SHA-256 detecta alteraciones accidentales; no firma ni cifra el contenido.

Para que **el operador** exporte la base remota cuando corresponda:

```sh
npm run backup -- --remote --config wrangler.pages.production.jsonc --directory .backups/remoto-3a
```

No se ejecutó ese comando durante el cierre técnico del 21-10 ni en esta revisión. Sí consta un respaldo remoto autorizado durante la reparación histórica del 22-10, antes de `cfece26`; no equivale a ensayo de recuperación remota. Elegir ventana sin conteos para futuras exportaciones: D1 puede pausar consultas. [Exportación D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/). El respaldo contiene hashes/sesiones/datos internos; privado y copia externa cifrada, nunca GitHub ni adjuntos. El build lo excluye; esta tarea no lo lee ni lo borra.

## Restauración ensayada

```sh
npm run restore:local -- --directory .backups/ensayo-3a --state .wrangler/recovery-3a
```

El destino debe ser **nuevo**; nunca se sobrescribe una base existente ni se admite restauración remota en esta herramienta. Se validan tamaño/SHA-256 y privacidad del SQL antes de crear el destino. Se importa en otra D1 local, se eliminan todas las sesiones recuperadas y se agrega auditoría de restauración. Si falla algún paso, el comando falla: no exponer ni utilizar ese destino parcial.

`npm run test:operations` realiza exportación e importación reales con Wrangler sobre bases temporales. Compara cuentas, ámbitos/herencia, catálogo, ciclo, conteos, historial, resultados e IDs de operación; verifica `PRAGMA integrity_check`, claves foráneas, revocación de sesiones, triggers y reintentos después de recuperar. Prueba también SQL alterado, destinos existentes y rechazo de rutas públicas. Informe: [operaciones-local-3a.json](operaciones-local-3a.json).

Una recuperación remota debe prepararse primero en una D1 separada, sin servir usuarios: comprobar integridad, versiones de catálogo/esquema y conteos/historial/resultados; revocar sesiones y revisar cuentas, accesos y contraseñas que hayan cambiado desde el respaldo. Antes de sustituir el servicio, preservar el estado actual y decidir qué hacer con cambios posteriores al punto recuperado y operaciones pendientes de dispositivos. No reenviarlas automáticamente: una recuperación puede retroceder también la deduplicación. El ensayo local no certifica ese procedimiento remoto ni una recuperación sin pérdida de datos.

Time Travel es una segunda vía, no una copia externa: actualmente ofrece 7 días en Free y 30 en Paid; restaurar retrocede la base y cancela consultas en curso. Consultar [procedimiento oficial](https://developers.cloudflare.com/d1/reference/time-travel/), identificar el bookmark exacto y conservar el de retorno. No ejecutar una restauración remota como parte de build o prueba de aplicación.

## Retención implementada

La consulta no modifica datos:

```sh
npm run maintenance -- --local
```

La limpieza exige una acción explícita:

```sh
npm run maintenance -- --local --apply
```

Se selecciona otra base con `--state`; para remota se requiere `--remote --config wrangler.pages.production.jsonc` en lugar de `--local`. **No se ejecutó mantenimiento remoto.** La política `auth-metadata-v1` elimina como máximo 1.000 sesiones por ejecución que lleven vencidas al menos dos días, y 1.000 claves de intentos cuya ventana sea anterior al corte de dos días. Conserva cuota vigente/sesiones recientes y registra la ejecución en auditoría. Consultar de nuevo y repetir explícitamente si quedan filas. No hay cron ni borrado desde una ruta pública.

Conteos, historial, IDs/resultados de operación, cuentas, permisos, ciclos, catálogo y auditoría se conservan indefinidamente en esta entrega. **No podar deduplicación**: un ID antiguo no debe volver a producir una suma. Tampoco hay eliminación automática de respaldos. Una futura política de archivo/borrado debe acordar conservación y recuperación sin romper esa garantía.

## Entrega y siguiente etapa

El usuario publicó `cfece26`, con el incremento cuyo esquema/catálogo ya se preparó; no repetir migraciones ni primer administrador. Esta revisión solo cambia documentación, no esquema, catálogo ni contraseñas. Para futuros cambios revisados y en commits, `git push origin inventory-v3` es la referencia y requiere autorización específica. Pages conserva build `npm run build:pages`/salida `dist`. `verify:public` hace 16 GET, no ingreso/carga/escrituras; esta vez se ejecutó desde scratch para conservar el JSON histórico. Los recorridos autenticados anteriores no equivalen a una prueba nueva.

Se puede comenzar 3B por supervisión de solo lectura sin esperar al equipo. Mantener visibles los pendientes de alojamiento, recuperación remota y aceptación operativa; no presentar 3A como habilitada para el día de inventario. Etapa 2 y exportación 4 conservan sus requisitos originales.
