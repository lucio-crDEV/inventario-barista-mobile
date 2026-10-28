# Etapas 4B y 4C: capturas y generación fiel del Excel

Este documento conserva el contrato de 4B/4C y la evidencia de su entrega original. La continuación vigente es [4D](etapa-4d-exportacion.md): captura y motor integrados, 0014/0015 aplicadas remotamente, almacenamiento privado preparado y publicación de Pages pendiente del push. La autorización posterior de recálculo se describe allí; prevalece sobre la política inicial indicada más abajo.

## Qué queda implementado

4B captura en D1 una versión inmutable del inventario finalizado, con su catálogo, actividad, conteos, plantilla y política. 4C consolida esa captura y genera una copia XLSX verificable sin reconstruir el libro.

El esquema requiere 0014_export_snapshots.sql después de 0013. La aplicación habitual conserva compatibilidad con 0013; las rutas de captura fallan con EXPORT_NOT_READY mientras falte 0014. Un preflight general de inventario no sustituye el preflight --exports.

No se añaden dependencias, proveedores, variables, bindings ni recursos remotos para esta entrega. La compresión no se ejecuta en una petición normal de Pages. El generador usa APIs compatibles con workerd, listo para que 4D lo invoque en un trabajo privado.

## Reglas vigentes

- Solo Administrador puede crear o leer capturas.
- Solo se captura un inventario globalmente finalizado, activo y sin un ámbito abierto/en revisión.
- Servicio suma únicamente ubicaciones terminadas. Una suma parcial queda identificada en la revisión.
- Inactivos, avances, pendientes y anulaciones no aportan a la suma.
- Si no hay un aporte terminado válido, el destino queda en blanco.
- Cero confirmado permanece como número 0.
- Se convierte con las equivalencias aprobadas y se redondea una sola vez, después de sumar, a tres decimales. Los empates se redondean hacia arriba para cantidades no negativas.
- Un positivo que redondee a cero queda identificado en la revisión.
- Una cantidad contada sin unidad, conversión o destino resueltos bloquea la generación completa. No se omite silenciosamente ni se añade una fila.
- Todos los destinos STOCK se resuelven a un número nuevo o blanco. No queda el stock antiguo por falta de datos.
- La sustitución de la fórmula de cocina!C74 sigue limitada a la excepción aprobada y reversible.

Se conserva la configuración de cálculo original. El permiso para marcar recálculo al abrir sigue pendiente; la política activa es stock-v1-3dp-preserve-calc. El motor dispone de una opción técnica de dos flags para una aprobación futura, pero la API no acepta una política ni un flag arbitrarios del cliente.

Las fórmulas ajenas a C74 y sus caches permanecen intactas. El motor no recalcula las fórmulas de Excel; los resultados calculados pueden requerir recálculo en Excel. No se certifica todavía el comportamiento de un visor o versión de Excel particular.

## Captura: transacción, inmutabilidad y versión

La entrada de captura incluye ID del comando, inventario, revisión esperada y revisión de completitud esperada. La política y la plantilla se eligen en el servidor.

Un INSERT en export_snapshot_commands ejecuta dentro de una misma operación SQL:

1. Comprobación de sesión, rol, revisión de cuenta y cambio obligatorio de contraseña.
2. Recuperación idempotente de un comando ya aceptado, sin recuperar datos para una sesión revocada.
3. Límite global de diez comandos nuevos por administrador y minuto; reintentos aceptados no consumen otro cupo.
4. Comprobación de estado global, revisiones y catálogo.
5. Captura coherente de los datos, resultado del comando y auditoría.

Dos comandos para la misma revisión/catálogo/plantilla/política reutilizan una sola captura. Si ya existe, no se vuelve a recorrer ni serializar el catálogo. Se conserva un resultado por comando para resolver respuestas inciertas.

Los datos contienen cantidades enteras en milésimas, estados, actividad, unidad, referencias y versión de cada conteo. Se omiten notas y credenciales. La captura registra el momento conocido de exportación: no inventa una instantánea del cierre histórico.

Una reapertura o un cambio posterior no reescribe la captura. Una nueva captura necesita volver a estar finalizado y produce una versión distinta cuando cambiaron las revisiones.

## Almacenamiento y recuperación

- export_snapshot_commands: intención, sesión/revisión autorizadas, resultado y fecha.
- export_snapshots: cabecera inmutable, identidad de plantilla/política y revisiones.
- export_snapshot_chunks: cuerpo JSON en fragmentos ordenados e inmutables de hasta 8.192 caracteres.

El cuerpo está limitado a 1 MB. Los fragmentos evitan que un respaldo SQL genere una sentencia de restauración superior al límite de 100 KB de D1, incluso con UTF-8. El registro sintético v3 medido contiene 1.268 ítems, 322.004 bytes y 40 fragmentos.

Las guardas impiden editar/borrar capturas o agregar fragmentos después del sellado. La recuperación instala los triggers después de restaurar datos, conservando inmutabilidad y firma del esquema. Se ensaya en otra D1 local con sesiones recuperadas revocadas.

El hash SHA-256 identifica exactamente el JSON almacenado y la salida generada. No constituye una firma de autenticidad si alguien con acceso al archivo cambia a la vez datos y hash. La autorización y la inmutabilidad de D1 protegen la fuente servida por la API.

No se borran capturas por antigüedad en esta entrega. Su retención y el almacenamiento de XLSX en R2 se decidirán en 4D.

## Contratos de API

POST /api/admin/export-snapshots

Cuerpo exacto: id, cycleId, expectedRevision, expectedCompletionRevision. La respuesta contiene commandId, snapshotId, revisiones, plantilla, política y capturedAt. Repetir el mismo comando conserva ese resultado. Un ID reutilizado para otra intención devuelve conflicto.

GET /api/admin/export-snapshots/:id

Devuelve metadatos y revisión de generación: preparada o bloqueada, cantidades de destinos numéricos/blancos, filas parciales, redondeos a cero y problemas concretos. No incluye el cuerpo completo por defecto.

GET /api/admin/export-snapshots/:id?include=source

Exclusivo del Administrador. Devuelve además snapshot y payload, junto con el hash del payload exacto, para el operador o una futura ejecución privada. La respuesta usa no-store; no hay archivo público ni acceso anónimo.

Errores relevantes: INVENTORY_NOT_FINALIZED, EXPORT_SOURCE_CHANGED, ID_REUSED, EXPORT_RATE_LIMIT, EXPORT_NOT_READY y EXPORT_DATA_UNRESOLVED. Los errores inesperados conservan la respuesta pública saneada existente.

## Generación y fidelidad

- worker/export-plan.js verifica la captura y produce 1.151 destinos.
- worker/export-service.js valida su hash, construye el plan y rechaza datos sin resolver.
- worker/excel-generator.js verifica el hash del original antes de analizar ZIP/XML.
- worker/excel-zip.js procesa únicamente el formato ZIP32 del original registrado, con límites, validación de cabeceras y CRC.
- Solo se parchean contenidos de celdas STOCK autorizadas. Se conservan atributos/estilos y todo lo ajeno a esas celdas.
- Las demás partes se copian comprimidas sin modificarlas. No se renombran, ordenan ni reconstruyen hojas.
- El verificador Python independiente comprueba preservación. Otra comprobación compara cada valor generado con el plan.

Node y workerd pueden producir compresión diferente y, por tanto, un hash ZIP final distinto. Las partes descomprimidas deben coincidir. Para descargar exactamente el mismo archivo después, 4D debe conservar el artefacto generado; regenerar desde la misma captura garantiza los datos y la estructura, no identidad binaria entre runtimes.

## Herramienta local de operador

La generación ya se puede ejecutar técnicamente con una captura privada autorizada. Dentro del repositorio solo permite .exports/, ignorada por Git y excluida del paquete público.

```sh
npm run export:local -- --snapshot .exports/captura.export-snapshot.json --output .exports/inventario.xlsx
python3 scripts/verify-excel-template.py --candidate .exports/inventario.xlsx
```

La captura debe provenir de include=source y conservar payload/hash. No pegar capturas reales, cookies ni cantidades privadas en documentación o chats.

El destino debe ser nuevo. La herramienta valida primero, escribe un temporal 0600, sincroniza y publica sin sobrescribir archivos existentes. El original siempre es de solo lectura. No se genera un archivo si quedan datos contados sin resolver.

Esto no añade todavía un botón ni una descarga al perfil. No se han exportado datos reales de producción en estas pruebas.

## Publicación de esta entrega

**A diferencia de 4A, esta entrega requiere 0014 para habilitar la captura.**

1. Conservar un punto de recuperación y revisar el respaldo privado según la operación existente.
2. Revisar las migraciones pendientes en la D1 correcta. No repetir 0001–0013 ni ejecutar fixtures/bootstrap.
3. Aplicar únicamente la nueva 0014 con el procedimiento de migraciones. No ejecutar un listado de SQL histórico por copia.
4. Ejecutar el preflight de lectura con requisito de exportación:

```sh
node scripts/preflight.mjs --remote --config wrangler.pages.production.jsonc --cycle piloto-v3-servicio --exports
```

Debe informar ready y exportSnapshotsReady verdaderos, con contrato export-snapshots-0014.
5. Hacer push de inventory-v3 y esperar el despliegue automático de Pages. No aplicar migraciones dentro del build.
6. Comprobar el commit publicado y los flujos habituales; las capturas reales requieren una operación administrativa explícita.

Las operaciones remotas y el push no se ejecutaron en esta entrega. Los cambios no alteran plan ni facturación. La prueba local no certifica CPU, cuota o capacidad productiva.

Rollback de código: 4A conserva los datos/tablas de 0014 e ignora las rutas nuevas. No eliminar la migración aplicada, las capturas o los fragmentos para revertir una pantalla. Una recuperación de datos es una operación distinta.

## Trabajo restante: 4D

Botón en Mi perfil del Administrador, selección y revisión previa, ejecución privada con presupuesto suficiente, archivo privado reutilizable, historial y descarga autorizada. Hay que acordar retención, resolver unidades/conversiones/destinos operativos y validar recálculo/impresión en Excel del negocio.

## Referencias

- [Límites de D1](https://developers.cloudflare.com/d1/platform/limits/): filas/valores de hasta 2 MB y sentencias de hasta 100 KB.
- [APIs de compresión de Workers](https://developers.cloudflare.com/workers/runtime-apis/web-standards/#compression-streams): deflate-raw nativo.
- [Excepción y reversión de C74](excepcion-stock-cocina-c74.md).
- [Evidencia de 4B/4C](etapa-4bc-verificacion-2026-10-28.json).
