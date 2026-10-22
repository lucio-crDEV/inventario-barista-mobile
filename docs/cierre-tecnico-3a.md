# Cierre técnico de 3A y transición a 3B — 21-10-2026

Actualización del 22-10: Cloudflare confirmó `exceededCpu` en un ingreso real (503/1102). El pendiente de CPU ya tiene un fallo remoto reproducido; no se cambió facturación ni protección de contraseñas. Demo con D1/ciclo actualizados y siete cuentas preparada; [resultado y límites](verification.md). El [incremento de usuarios/Servicio de 3B](usuarios-y-servicio-3b.md) implementado y probado; los pendientes operativos de 3A permanecen. La restauración local usa Python 3 para ordenar una copia privada del dump: todas las tablas antes de datos y triggers al final. La reconstrucción de usuarios cambió su orden en el export de SQLite; el ensayo detectó el fallo y la corrección pasó la recuperación D1 completa. El respaldo original y su SHA-256 no se modifican; no se ejecuta SQL en Python. No se ensayó restauración remota.

La funcionalidad 3A está implementada y tiene pruebas locales de API, navegador, concurrencia y paquete Pages. El usuario publicó los cambios hasta `5d80658`; se verificaron ese despliegue, las rutas públicas y un recorrido administrativo básico del dominio. El piloto con trabajadores queda **aplazado por decisión del usuario**, sin fecha; no es un impedimento para desarrollar 3B. La aceptación operativa de 3A permanece abierta. El plan de Cloudflare se considera Free **provisionalmente**: el usuario lo deduce de no haber contratado pagos, sin confirmación del panel.

## Evidencia y pendientes

| Parte | Estado real |
| --- | --- |
| Cuentas, sesiones, permisos, guardados y resolución ajena | Implementados y probados localmente; recorridos detallados en [verificación](verification.md) |
| Skeletons, estados de envío y menos peticiones | Incluidos en `fb67ecb`, deployment exitoso aportado por el usuario |
| Menú, formularios, mínimo de ocho caracteres y refresco compacto limitado | Publicados hasta `5d80658`; archivos del ajuste coinciden con el commit local y recorrido básico del dominio comprobado |
| Aislamiento público de API/archivos | 16 rutas del sitio responden como se espera, sin sesión ni escrituras remotas |
| Cabeceras de seguridad en errores de API | Corrección publicada; verificador repetido contra `5d80658`: 16/16, incluidos los seis 401, `securityHeadersPassed: true` y `passed: true` |
| Respaldo, restauración y retención | Herramientas terminadas y ensayo real D1 **local** aprobado; falta ensayo de recuperación de la D1 remota en destino separado y copia externa privada |
| CPU y plan de autenticación | Pendiente técnico antes de uso real; la medida local indica incompatibilidad probable con Free, no certifica CPU de Cloudflare |
| Dominio autenticado | Ingreso/cierre administrativo, Cuenta, menú/temas, refresco con espera de 30 s y lectura de cuentas comprobados; faltan conteos/conflictos y permisos entre varias personas e inspección allí de atributos de cookie |
| Red y Android físicos | Pendientes; el recorrido de navegador del dominio no certifica dispositivo ni señal reales |
| Equipo durante inventario | Aplazado; quedan evaluación de claridad, señal y reparto físico |
| 3B | Alcance e incrementos preparados en [etapa-3b.md](etapa-3b.md); todavía sin tablero avanzado ni mutaciones administrativas de conteo |

## CPU: comprobación disponible y decisión pendiente

`npm run profile:local` ejecuta el módulo real de contraseñas, bcryptjs 3.0.3 con coste 12, sobre una contraseña ficticia y sin cuentas ni conexiones. Tres derivaciones y tres verificaciones consumieron **274–325 ms de CPU del proceso Node**, con **274–331 ms de tiempo transcurrido**. Informe: [perfil-local-3a.json](perfil-local-3a.json). No son CPU facturada de Workers, perfil de workerd ni latencia de producción; no incluyen D1.

Workers Free publica **10 ms de CPU por solicitud**; la espera de red no cuenta y el entorno local no aplica todos los límites del plan. Que un ingreso aislado funcione no acredita compatibilidad sostenida. Referencia: [límites de Workers](https://developers.cloudflare.com/workers/platform/limits/). Pages Functions consume el plan Workers: [cuotas Pages](https://developers.cloudflare.com/pages/functions/pricing/).

Antes del uso real, confirmar el plan en Workers & Pages y revisar CPU/errores `exceededCpu` o 1102 de ingreso, cambio y restablecimiento/creación de contraseñas; guardar fecha, versión y mediciones. La medición correcta se describe en [perfilado oficial](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/). No se accedió al panel privado ni se midió CPU remota. Si se confirma Free, debe resolverse el alojamiento de esta derivación: un plan adecuado para la arquitectura vigente o una revisión explícita de autenticación para mantener gratuidad. No se redujo el coste, cambió proveedor, habilitó facturación ni se compró nada.

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

No se ejecutó este comando remoto en la tarea. Elegir una ventana sin conteos: D1 puede pausar consultas durante la exportación. Ver [exportación D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/). El respaldo contiene hashes de contraseña, sesiones y datos internos; mantenerlo privado, cifrar la copia externa y comprobar su recuperación. No subirlo a GitHub ni adjuntarlo a esta documentación. El build excluye estas carpetas.

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

El cierre técnico y los ajustes de interfaz ya publicados no cambian esquema, catálogo, unidades ni contraseñas existentes. El usuario publicó hasta `5d80658`; para futuros cambios revisados y en commits, enviar `inventory-v3` con `git push origin inventory-v3`. Pages conserva build `npm run build:pages` y salida `dist`. No repetir migraciones ni primer administrador. Después del deployment, `npm run verify:public` hace únicamente 16 GET anónimos y falla si rutas, JSON/no-store o cabeceras no cumplen. No ejecuta ingreso, carga ni escrituras; el recorrido manual autenticado tiene el alcance descrito arriba.

Se puede comenzar 3B por supervisión de solo lectura sin esperar al equipo. Mantener visibles los pendientes de alojamiento, recuperación remota y aceptación operativa; no presentar 3A como habilitada para el día de inventario. Etapa 2 y exportación 4 conservan sus requisitos originales.
