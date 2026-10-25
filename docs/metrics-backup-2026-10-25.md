# Métricas y respaldo — implementación 25-10-2026

La nueva solicitud autoriza implementar registro de métricas y respaldo periódico. Sustituye la desactivación de telemetría del 23-10 en este alcance; Root sigue sin implementar, los tres roles y la prohibición de publicar métricas por API se conservan. Este documento describe implementación preparada; no certifica publicación ni activación remota.

## Datos útiles y mínimos

Migración `0009_usage_metrics.sql`, después de 0008: `usage_daily`, clave primaria día UTC/ruta normalizada/método/clase HTTP. Guarda número de peticiones, suma de duración de pared y peticiones de ≥1 segundo. Las rutas de conteo, resumen, historial, búsqueda, supervisión y navegación permiten comparar uso de funciones; errores 4xx/5xx y duración orientan decisiones de rendimiento. Los sondeos sync/status cuentan como solicitudes y deben analizarse separados de acciones humanas. No se incorporan identificadores de cuenta/dispositivo/sesión, IP, user-agent, nombres, cantidades, notas, cuerpos, consultas, cookies ni secretos. No mide usuarios únicos, concurrencia, CPU ni experiencia visual del navegador. No se presentan solicitudes como personas.

El Worker requiere `METRICS_ENABLED="1"` después de aplicar 0009. Sin esa variable no escribe. En Pages se añade como variable del entorno de producción/preview deseado, antes del despliegue del código que la usa. Se acumula memoria acotada y se envía un lote como máximo por minuto **por isolate activo**, al llegar una petición; primer evento se escribe inmediatamente. No hay escritura D1 individual en cada sondeo. Cierres de isolate, ausencia de nuevas peticiones y fallos pueden perder observaciones. No es auditoría exacta. Errores de métricas no impiden guardar inventario. Crecimiento de isolates implica más lotes; revisar uso real Free en piloto.

Se depuran solo filas de métricas anteriores a 90 días, por rango indexado en lotes de 1.000 al vaciar agregados. Los otros datos permanecen. La ausencia de solicitudes puede retrasar esa depuración; no es una promesa de borrado a una hora exacta. Nunca se eliminan inventario, autoría, auditoría, resultados de operaciones ni IDs de deduplicación. La política de sesiones/attempts del mantenimiento existente no cambia.

Consulta privada de operador (sin nuevo rol ni endpoint):

```sh
node scripts/metrics.mjs --remote --config RUTA_CONFIG_PRIVADA
node scripts/metrics.mjs --local --state .wrangler/test-state
```

Promedio de pared = suma/número de solicitudes; no es percentil ni CPU. Comparar por ruta/día, revisar 5xx y peticiones lentas; contrastar con CPU/errores del proveedor antes de decidir migrar servicios. No hay todavía panel gráfico ni reporte de errores de JavaScript del navegador.

## Respaldo cada 90 días

Interpretación explícita: **crear un respaldo completo cada 90 días**, sin borrar datos al cumplir 90 días. `operations/backup-worker/` contiene un Worker independiente para Cron diario 05:17 UTC. Primer control habilitado genera copia; después comprueba la última copia exitosa y genera la siguiente cuando hayan transcurrido 90×24 horas. Un control retrasado ejecuta en la siguiente oportunidad. Un fallo no adelanta la fecha ni elimina copias. Una reserva R2 con escritura condicional y vencimiento de 30 minutos impide exportaciones simultáneas por entregas cron solapadas; no se usa una comprobación seguida de escritura sin protección. Cada petición externa tiene timeout y la exportación se sondea como máximo 25 veces; no se promete completar exportaciones grandes en un ciclo. Si falla/rebasa el límite se reintenta en el control siguiente, sin certificar copia nueva ni reanudar una URL firmada vencida. La base puede bloquear consultas brevemente durante la exportación; programar horario de poco uso. Exportación máxima 8 MiB SQL para limitar memoria; si excede, aborta y exige revisar tamaño y ejecución fuera de Worker.

Usa exportación SQL completa nativa D1, comprime y cifra con AES-256-GCM/nonce aleatorio/AAD versionado antes de escribir R2 privado. El archivo `.ibk` contiene SQL + manifiesto con tamaño y SHA-256 dentro del cifrado. Lee el objeto de vuelta y verifica SHA-256 antes de escribir `inventory/last-success.json`. El marcador es un control operativo; una copia solo se acepta como recuperable después de ensayar restauración. No hay endpoint para disparar/descargar backups. No se copia el libro Excel original: sigue siendo referencia inmutable del repositorio y debe conservarse por separado.

El SQL contiene datos sensibles, incluidos hashes de contraseña: acceso solo custodio. No poner archivos/clave/token en Git, dist, documentos públicos ni chat. R2 guarda una copia fuera de D1 pero en el mismo proveedor: descargar periódicamente una copia cifrada a otro dispositivo/proveedor privado protege además la pérdida de cuenta Cloudflare. No se autoeliminan respaldos: controlar tamaño acumulado y definir archivado antes de agotar cuota. Los 90 días de retención de métricas corresponden a la tabla activa; una instantánea cifrada puede conservar esos agregados más tiempo. Antes de ofrecer un plazo de eliminación global, hay que fijar también retención de copias con el custodio. Perder la clave impide recuperar; guardarla también fuera de Cloudflare.

### Configuración que falta para activar

1. Activar R2 Standard y crear bucket **privado**, sin r2.dev ni dominio público. Confirmar disponibilidad del plan y método de pago si Cloudflare lo pide; no se contrata ningún servicio desde el código.
2. Copiar `operations/backup-worker/wrangler.example.jsonc` a una configuración privada; completar `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, bucket y ajustar `main` para apuntar al archivo real si se mueve la configuración. Dejar `BACKUP_ENABLED="0"` hasta ensayar.
3. Crear token de cuenta con permiso D1 Edit (requerido por exportación API), limitado a la cuenta seleccionada. Guardar como secret `CF_BACKUP_TOKEN` del Worker de respaldo. No usar Global API Key. El token no requiere permisos R2 porque se usa binding nativo; D1 Edit es más amplio que solo leer y su custodia es importante.
4. Generar 32 bytes aleatorios, codificar base64 y guardar como secret `BACKUP_ENCRYPTION_KEY` en ese Worker y en un gestor de secretos externo. Se introduce de forma privada, nunca como argumento o archivo versionado. Si cambia, conservar las claves de copias anteriores.
5. Publicar ese Worker separado, ensayar exportación/descifrado/restauración con la D1 elegida y medir CPU/memoria bajo Free antes de habilitar cron con `BACKUP_ENABLED="1"`. No añadirlo a Pages ni al build público. La implementación no garantiza presupuesto CPU para todas las bases: si Free no alcanza, usar ejecución privada fuera de Workers con el mismo formato, sin activar pagos automáticamente.
6. Comprobar primera copia y marcador en R2. Revisar estado/fallos en Cloudflare y asignar custodio; no hay notificación email/webhook configurada. Revisar diariamente el fallo mientras se ensaya y verificar periódicamente antigüedad del marcador; no confundir cron desplegado con respaldo exitoso.

### Recuperación verificable

Descargar privadamente el objeto `.ibk` señalado por el marcador (o una copia anterior), y cargar la clave correspondiente en `BACKUP_ENCRYPTION_KEY` del entorno del operador:

```sh
node scripts/decrypt-backup.mjs --file /ruta/privada/copia.ibk --directory .backups/recuperacion-NUEVA
npm run restore:local -- --directory .backups/recuperacion-NUEVA --state .wrangler/recuperacion-NUEVA
```

El descifrado autentica integridad antes de escribir y verifica el manifiesto. La restauración existente exige destino nuevo, ordena esquema/datos/triggers y revoca sesiones. Verificar integridad/FK, usuarios/permisos, catálogo/ciclo, historial y una escritura en esa base aislada antes de cualquier recuperación productiva. Nunca restaurar automáticamente producción ni sobrescribirla. Un ensayo local no demuestra que el Cron remoto ni las credenciales estén activos.

La cadencia de 90 días puede perder hasta 90 días de cambios ante pérdida total de D1; realizar además copia manual antes de migraciones y cambios sensibles con `npm run backup -- --remote --config CONFIG --directory .backups/NUEVA`. Esa copia local existente no está cifrada: custodia privada y cifrado externo si se transporta. Time Travel Free conserva siete días en el mismo proveedor y complementa esta política.

## Verificación y servicios

Pruebas `node --test tests/metrics-backup.test.mjs`: opt-in, agregación/normalización/retención, calendario exacto, exclusión de cron concurrente, cifrado y corrupción, fallos sin avance de marcador y exportación simulada/copia R2/recuperación SQLite. La compilación del Worker separado se verificó con `wrangler deploy --dry-run` y no hizo publicación remota. Los endpoints reales D1/R2 y CPU Free deben ensayarse al activar. No se afirman métricas históricas anteriores a la activación.

Referencias oficiales consultadas 25-10-2026: [exportación D1 API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/), [importación/exportación](https://developers.cloudflare.com/d1/best-practices/import-export-data/), [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), [R2 precios](https://developers.cloudflare.com/r2/pricing/), [límites Workers](https://developers.cloudflare.com/workers/platform/limits/). R2 Standard publica 10 GB-mes, 1 millón operaciones clase A y 10 millones clase B gratis por mes; el exceso se factura. Free no equivale a almacenamiento ilimitado ni garantiza cero gasto sin revisar uso. No se activan planes de pago automáticamente.

## Estado de configuración verificado — 25/10/2026

0008/0009/0010 aplicadas a D1 real; Production Pages METRICS_ENABLED=1 configurado y binding/variables conservados. Código todavía pendiente de push/despliegue; no afirmar que la versión pública ya escribe métricas. Bucket inventario-backups creado, r2.dev deshabilitado y cero dominios conectados. Configuración privada y clave generadas en .backups/automation-20261025 (chmod600, no Git); el usuario debe custodiar la clave fuera de Cloudflare y de este equipo. Respaldo previo0008 SQL+manifest conservado allí y restauración local comprobada.

Worker inventory-private-backup desplegado sin workers.dev ni URLs de preview, con cron diario y BACKUP_ENABLED=0. BACKUP_ENCRYPTION_KEY cargada como secreto, con custodia local privada. Pendiente para automatización: token dedicado Account/D1/Edit limitado a cuenta; cargar CF_BACKUP_TOKEN y BACKUP_ENCRYPTION_KEY como secretos; desplegar Worker separado inicialmente BACKUP_ENABLED=0, ensayar una copia cifrada real y recuperación, luego activar. No se usa OAuth temporal de Wrangler como credencial permanente. No se configuró facturación ni acceso público.
