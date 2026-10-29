Actualización 28/10: [4B/4C implementadas localmente](etapa-4bc-exportacion.md), requieren 0014. Las descripciones siguientes registran la entrega 4A; el generador ya tiene implementación técnica y 4D sigue pendiente.

# Etapa 4: backend y contratos de exportación

Estado vigente: 28-10-2026. Primera entrega local, sin publicación ni cambios de D1.
Base: inventory-v3, 2d94cf5. La salida Excel aún no está implementada.

Este documento concentra el estado actual de etapa 4. Los informes fechados anteriores conservan su evidencia histórica. Para producción prevalece la verificación del 27/10: 2d94cf5 publicado, sincronización entre teléfonos comprobada por el usuario, consumo sostenido y primera comprobación del nuevo respaldo aún abiertos.

## 1. Entrega 4A

Se conserva la arquitectura existente, el esquema 0013, los tres roles y las respuestas de API. No se añaden dependencias ni proveedores.

| Módulo | Responsabilidad |
| --- | --- |
| worker/index.js | Origen/configuración, preparación del entorno, orden de rutas, autorización inicial y observabilidad |
| worker/http.js | JSON acotado a 16 KiB, errores públicos estables y cabeceras de seguridad |
| worker/session.js | Sesión, cookies, ingreso/salida, cambio de contraseña, DTO público y cuotas persistentes de autenticación |
| worker/authorization.js | Fragmentos SQL comunes de actor habilitado y ámbitos autorizados |
| worker/inventory-queries.js | Producto autorizado, registro vigente y bootstrap filtrado por ciclo/área |
| worker/count-contract.js | Campos de conteo, cantidad y estado válidos; orden inmutable del fingerprint |
| worker/counts.js | Guardado y recuperación de una operación de conteo |
| worker/accounts.js | Administración atómica de cuentas/accesos y perfil |
| worker/inventory-cycles.js | Selección, creación, activación y retirada de inventarios |
| worker/supervision.js | Supervisión, corrección/anulación, actividad y estados |
| worker/runtime-readiness.js | Compatibilidad de esquema/catálogo y firma 0013 |
| operations/ | Sincronización compartida y respaldo privados |

El módulo de entrada pasa de 604 a 209 líneas. El objetivo es delimitar responsabilidades, no reducir el trabajo de seguridad. Los triggers SQL siguen siendo la autoridad transaccional de las escrituras.

Los fragmentos de autorización solo aceptan alias/roles internos de una lista cerrada y usan parámetros para la identidad. Se conservan la variante id de las lecturas de inventario y la variante scope_id de ciclos/supervisión. La administración mantiene el alias de actor que requieren sus guardas.

## 2. Contratos existentes conservados

### HTTP y sesión

- Configuración inválida o esquema no preparado: 503; no hay datos ficticios ni inicialización automática.
- JSON requerido, objeto no array y límite de 16 KiB comprobado en bytes, incluso sin Content-Length.
- Cookie HttpOnly, SameSite Strict y Secure en producción. Duración de sesión: 12 h.
- bcrypt coste 12 y política de contraseña intactos.
- Cambio obligatorio de contraseña limita el acceso hasta completarlo.
- POST comprueba origen. Las escrituras de cuenta/inventario comprueban también identidad de pestaña.
- Las respuestas de API usan no-store, códigos existentes y X-Request-ID. No se filtran mensajes internos del servidor.
- El endpoint de métricas técnicas sigue cerrado a todos los roles actuales. Root no se implementa.

### Identidad y ámbitos

Administrador, Jefa de servicio y Trabajador conservan sus permisos. /api/admin no implica exclusividad de Administrador: supervisión admite Jefa en su ámbito. La futura exportación debe exigir Administrador explícitamente en creación, consulta y descarga.

Cada lectura usa el inventario y catálogo correspondientes y aplica la proyección autorizada. No se cachean permisos ni sesiones. Los triggers revalidan permisos al aceptar una escritura, cubriendo cambios entre la primera comprobación y la ejecución.

### Conteo

POST /api/count mantiene exactamente este orden de campos para su fingerprint:

id, cycleId, itemId, locationId, expectedVersion, action, quantity, unit, status, note, outOfStock.

- IDs de operación únicos, payload completo, sin campos adicionales.
- Cantidad entre 0 y 1.000.000, finita y con hasta tres decimales; almacenamiento entero en milésimas.
- direct, add y overwrite conservan su significado.
- expectedVersion protege contra una lectura antigua. ID repetido con intención distinta se rechaza.
- Un reintento autorizado recupera el resultado aceptado sin duplicar cantidades.
- Conteo, historial y resultado se aplican en la misma operación SQL.
- partial no es counted. Cero contado y Sin stock siguen siendo estados explícitos.
- Anular no borra el registro ni crea un cero definitivo.
- Las reglas comunes de cantidad/estado se comparten con rectificación de Supervisión.

No se sumará el historial para exportar: se usa el conteo vigente de cada ubicación.

## 3. Decisiones de exportación confirmadas

| Decisión del 28/10 | Contrato |
| --- | --- |
| Estado habilitado | Solo inventario finalizado globalmente |
| Ubicaciones incompletas en Servicio | Sumar únicamente las ubicaciones terminadas |
| Ninguna ubicación terminada | Celda en blanco |
| Cero confirmado en ubicación terminada | Aporte 0 válido |
| Producto inactivo | Excluir su aporte de la suma, aunque conserve un conteo anterior |
| Todas las ubicaciones excluidas | Celda en blanco |
| Fórmula de STOCK cocina!C74 | Se autoriza sustituirla por el nuevo conteo o blanco en la copia |
| Acceso | Botón únicamente para Administrador en Supervisión, con autorización de servidor |
| Original | Inmutable; mismas hojas, filas, referencias, unidades, estilos e impresión |

Al existir ubicaciones activas pendientes junto a otras terminadas, la revisión previa debe advertir que algunas filas contienen una suma parcial. No se agregan etiquetas, hojas ni columnas al Excel para expresar esa advertencia.

La excepción C74 tiene su propia [trazabilidad y reversión](excepcion-stock-cocina-c74.md). No autoriza cambiar otras fórmulas ni su configuración/caches.

## 4. Base comprobable de fidelidad

data/inventario/export-template.js registra el original por hash y obtiene la lista de 1.151 destinos desde las referencias ya existentes. El permiso para sustituir la fórmula de STOCK queda separado de la descripción del original.

scripts/verify-excel-template.py es de solo lectura. Comprueba identidad del original y, opcionalmente, el alcance de una copia candidata:

- Mismos miembros ZIP y orden, sin miembros duplicados.
- Partes ajenas a las cinco hojas de áreas idénticas byte por byte.
- Dentro de esas hojas, todo lo ajeno a las celdas autorizadas idéntico byte por byte.
- Estilo y atributos de las celdas STOCK preservados. Solo tipo numérico o blanco.
- No se permiten fórmulas nuevas, números no finitos, negativos ni texto como cantidad.
- Se permite retirar la fórmula de cocina!C74 solo mediante su autorización explícita.
- Tamaños acotados para la inspección de la copia.

Esta herramienta verifica alcance y fidelidad. No demuestra que las cantidades sean correctas, que todos los stocks antiguos se hayan reemplazado, que una instantánea sea coherente ni que Excel haya recalculado. Esos controles corresponden al generador, al plan de consolidación y a la aceptación en Excel.

Uso:

```sh
npm run verify:excel-template
python3 scripts/verify-excel-template.py --candidate /ruta/a/copia.xlsx
python3 -m unittest discover -s tests -p excel_template_test.py -v
```

No es un endpoint ni una exportación al usuario. El build mantiene libros, scripts, documentos y catálogo fuera de los recursos públicos.

## 5. Pasos siguientes

1. Instantánea autorizada y consistente: conteos vigentes, actividad, catálogo, plantilla, revisiones, fecha, política y actor. La actividad actual es compartida entre ciclos y no debe reinterpretar silenciosamente una salida histórica.
2. Resolver o aprobar tratamiento de las 5 unidades ausentes, 2 conversiones y 18 productos sin destino. No agregar filas ni inferir equivalencias.
3. Definir precisión después de convertir y sumar. La regla de tres decimales del conteo no resuelve automáticamente la precisión de una conversión.
4. Definir recálculo y caches de las fórmulas del original. Cambiar propiedades de cálculo requiere una decisión específica.
5. Prototipo del generador que solo cambie STOCK y pase el verificador independiente.
6. Medir CPU/memoria con el runtime real. Si corresponde, trabajo privado separado del conteo; recursos gratuitos y configuración revisados antes de activación.
7. Persistencia del trabajo y archivo privado, idempotencia, recuperación y descarga autorizada.
8. Botón de perfil y revisión previa móvil, seguida de aceptación del archivo en Excel.

Las migraciones futuras deben validar el esquema y actualizar su firma al final. No recalcular firmas para ocultar un esquema incompleto. No se aplican migraciones ni se crean recursos remotos en esta entrega.

## 6. Pendientes previos que siguen abiertos

- Validación física de ubicaciones/unidades con el equipo.
- Piloto aplazado, Android/red reales y conflictos/revocación con varios roles en dominio.
- Consumo sostenido y CPU/cuotas del proveedor; métricas locales no certifican Free.
- Muestra CLS elevada en Supervisión: comprobar cambios de altura al cargar/refrescar.
- Primera comprobación programada del nuevo respaldo, custodia de clave y recuperación periódica.
- Retención de futuros archivos de exportación y pérdida de trabajo tolerable con respaldo cada 90 días.
- Informe de antigüedad de inactivos, Root y evolución de plantillas: trabajos posteriores, sin implementación implícita.

## 7. Popups

Se unifican fondo y sombra mediante tokens: opacidad 16 % en claro y 22 % en oscuro, desenfoque de 8 px y sombra leve. La reducción de transparencia desactiva el desenfoque. No se cambian controles, foco, Escape, animaciones ni el menú lateral.

La comprobación visual completa y las pruebas nativas se registran con sus resultados reales en la verificación de esta entrega, sin dar por comprobado lo que el entorno no permitió ejecutar.

## 8. Publicación y reversión

Entrega local sin push, despliegue, cambios de datos, facturación ni esquema. No requiere una migración para el refactor.

Para revertir, restaurar como conjunto los módulos extraídos, sus imports y los estilos desde la versión anterior. Preservar cambios previos de documentación y cualquier trabajo posterior. No usar un reset general ni revertir D1: este cambio no la modifica.

La excepción C74 puede retirarse por separado siguiendo su documento. Retirarla no restaura stock antiguo ni modifica archivos ya descargados.

Antes de publicar: pruebas de API y paquete en entorno aislado, revisión de diff/archivos públicos y prueba posterior del despliegue autorizado. Los datos, las migraciones y el código tienen procedimientos de recuperación distintos.
