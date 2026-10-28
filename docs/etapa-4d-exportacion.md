# Etapa 4D: revisión, generación y descarga

La etapa integra las capturas de 4B y el motor de 4C con el perfil del Administrador. El estado remoto y las pruebas de esta entrega se registran en `etapa-4d-verificacion-2026-10-28.json`. No confundir preparación remota con publicación de Pages: el push queda al usuario.

## Uso

Mi perfil → Exportar Excel → elegir inventario finalizado → Revisar Excel → Generar Excel → Descargar Excel.

Solo aparece para Administrador y todas las rutas vuelven a exigir ese rol en el servidor. La revisión muestra destinos con conteo, blancos, sumas parciales, redondeos a cero y productos que bloquean la generación. No permite generar mientras falte resolver una cantidad contada sin destino o conversión.

La captura usa las revisiones mostradas. Si el inventario cambia, se pide actualizar. Una respuesta incierta conserva el ID del comando en esa pestaña: el reintento recupera la captura aceptada. No se guarda el contenido del conteo en ese estado de interfaz.

Copias anteriores conserva el acceso a capturas históricas, incluso después de reabrir el inventario. Se paginan de veinte en veinte. Reabrir no modifica una captura ni su archivo; una captura nueva exige volver a finalizar.

## Dónde se genera y guarda

El navegador solicita, consulta el estado y descarga. El trabajo pesado se ejecuta en `InventoryExport`, un objeto SQLite privado del Worker `inventory-exports`. Pages no comprime el libro. Esto utiliza la capacidad de Durable Objects disponible en Free; no cambia la suscripción a Paid.

- D1: cabecera, fuente inmutable en fragmentos y comando de captura.
- R2 privado `inventario-exports`: original bajo `template/<SHA-256>` y copia bajo `exports/v1/<snapshot>/<hash-fuente>.xlsx`.
- Objeto privado: estado del trabajo, intentos, huellas y tamaño; no guarda contraseñas ni tokens de sesión.
- Dispositivo: recibe una copia descargada cuando el administrador la solicita.

El depósito tiene desactivado r2.dev y no tiene dominios públicos. El Worker no tiene ruta pública, workers.dev ni URL de vista previa. Un enlace de descarga no es público ni firmado por tiempo: atraviesa autorización de la app en cada acceso. Una baja, sesión vencida o cambio de rol impide nuevas descargas.

La copia se escribe una vez y se vuelve a servir con el mismo contenido. La generación verifica la plantilla, fuente capturada y archivo almacenado antes de marcarlo listo. Se conserva el original y los miembros ZIP que no contienen STOCK autorizado, incluyendo formato, impresión, fórmulas ajenas a C74 y caches.

## Trabajo, fallos y recuperación

Un objeto por captura serializa solicitudes simultáneas. Una alarma persistida inicia o recupera la generación; otra vigila una interrupción. Cada ronda tiene hasta tres intentos automáticos. Un fallo recuperable permite un reintento explícito tras una espera de un minuto, con un administrador vigente; una incoherencia de datos o integridad se bloquea.

Una carga completada antes de una interrupción se verifica y recupera; no se vuelve a escribir el archivo existente. El estado listo solo aparece después de comprobar el objeto almacenado. Los mensajes públicos no incluyen celdas, contraseñas, tokens ni excepciones internas.

Cada inicio, consulta y descarga valida sesión, actividad, rol, cambio obligatorio y revisión de la cuenta; la descarga vuelve a validar después de esperar a R2. Un trabajo ya admitido puede continuar sin conservar el token original, siempre que su actor siga autorizado. Los archivos permanecen privados en cualquier estado.

La interfaz consulta durante una espera acotada y pausa al ocultarse; después ofrece Comprobar. La generación continúa en el servidor aunque el teléfono abandone la página. No se exige mantener la pantalla abierta.

## Contratos

| Ruta | Resultado |
| --- | --- |
| POST `/api/admin/export-snapshots` | Captura inmutable/idempotente, solo finalizado globalmente |
| GET `/api/admin/export-snapshots/:id` | Revisión y bloqueos sin devolver la fuente completa |
| POST `…/:id/generate`, cuerpo `{}` | Admite o recupera el trabajo; no acepta celdas ni política del navegador |
| GET `…/:id/artifact` | `not_started`, `queued`, `generating`, `ready` o `failed`, con metadatos acotados |
| GET `…/:id/file` | XLSX privado, attachment y no-store; exige estado listo |
| GET `/api/admin/exports?cursor=…&cycle=…` | Hasta veinte cabeceras con paginación; filtro de ciclo opcional |

`include=source` sigue reservado al Administrador para operación privada. El navegador no lo usa para generar el Excel.

## Cálculo y pendientes de datos

Se respeta la política almacenada en cada captura. El usuario autorizó actualizar automáticamente los totales al abrir las nuevas copias. La política activa es `stock-v1-3dp-recalc-on-open`: solo se añaden `fullCalcOnLoad="1"` y `forceFullCalc="1"` al elemento `calcPr` de la copia. Las fórmulas y el original permanecen intactos. Las capturas con la política anterior `preserve-calc` y sus archivos no se reescriben. Para verificar una copia nueva, el guard independiente requiere `--recalculate-on-open`; sin ese permiso rechaza el cambio de configuración. El motor no calcula las fórmulas de Excel: la configuración al abrir y la verificación de un Excel real son asuntos distintos.

Siguen sin inventarse cinco unidades de Pastelería, las equivalencias de Rinza/Chocolate líquido y los destinos de ítems antiguos de Barra. Si alguno tiene cantidad terminada que necesita esas referencias, la revisión bloquea la exportación y muestra qué resolver. No bloquea una cantidad inexistente ni la sustituye por una equivalencia supuesta.

No hay eliminación automática de archivos por antigüedad. Se mantiene el historial y las capturas. La restauración de D1 conserva sus fuentes; el depósito privado de Excel es un recurso separado y no se certifica un respaldo adicional de todos sus archivos.

## Preparación y publicación

0014 y 0015 son aditivas y están preparadas/aplicadas según la evidencia. El preflight remoto de exportación debe devolver `ready:true` y contrato `runtime-capabilities-0015`. No repetir inicialización ni fixtures.

El Worker privado se despliega antes de enlazar `EXPORTS` y `PASSWORDS` en Pages. `PASSWORD_WORK_REQUIRED=1` impide volver por accidente al bcrypt costoso en Pages si falta el binding. La verificación y creación de hashes conservan bcrypt coste 12 y corren en `PasswordWork`; las cuotas durables y la creación/revocación atómica de sesiones siguen en el backend habitual. No se guardan ni registran contraseñas en el objeto privado.

La cuota de ingreso reserva intentos por IP y por par IP/usuario; devuelve solo la reserva de un ingreso aceptado, preservando fallos concurrentes y cambios de ventana. Una IP atacante no puede agotar un bloqueo global por conocer el nombre de otra cuenta. Se mantiene el límite de fallos del mismo par/IP; una red compartida sigue compartiendo el presupuesto de IP.

La limpieza diaria de autenticación usa la política ya existente: vencido desde hace dos días, máximo mil filas por tabla. No cambia el respaldo de noventa días. La configuración y límites operativos están en [arquitectura y operación](arquitectura-y-operacion.md).

Después del push, esperar el build de Pages y comprobar con una sesión real: ingreso, perfil admin, revisión, generación y descarga; confirmar que un trabajador no puede acceder. Las pruebas locales y los bindings preparados no sustituyen esa comprobación productiva. CI valida automáticamente, pero la integración Git actual de Pages no espera por sí sola el resultado del workflow.
