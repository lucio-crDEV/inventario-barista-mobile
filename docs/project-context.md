# Contexto vigente

`inventory-v3` es la aplicación de inventario compartido. Pedido y las versiones anteriores permanecen en otras ramas. La raíz de trabajo es `/Users/lucio/workspace/inventario_brioche`; `sources/` es referencia de solo lectura.

## Producto

Se cuentan Cocina, Panadería, Pastelería, Servicio y Bodega Principal. Servicio distingue Barra, Línea/Armado, Copería, Mercadito y Garzones; Vitrina conserva sus conteos separados y Garzones sus zonas. La consolidación usa las referencias del libro aprobado, nunca el nombre visible del producto como clave.

Roles: Administrador, Jefa de servicio y Trabajador. La jefa se limita a Servicio; en cuentas mixtas gestiona únicamente esos accesos. Cada persona edita su nombre visible y Administración su usuario de ingreso. Eliminar cuentas conserva autoría y auditoría. Root no está implementado.

Conteo, borradores, conflictos, historial, actividad por área, supervisión y ciclos están implementados. Cierre para revisión y finalización son diferentes; la finalización con pendientes requiere advertencia. Solo Administración reabre finalizados con motivo. Los registros anteriores y los inventarios no se borran por antigüedad.

## Etapa 4

4A separó responsabilidades del backend y fijó el contrato del original. 4B captura en D1 un inventario globalmente finalizado. 4C consolida y genera el XLSX. 4D integra revisión, trabajo privado, historial y descarga exclusivamente en Mi perfil del Administrador.

La [regla de oro y contratos](etapa-4d-exportacion.md) mantienen el original inmutable. Se suman solo ubicaciones terminadas, inactivos excluidos, cero explícito y blancos sin aporte. Redondeo final a tres decimales. Cocina C74 tiene una [excepción autorizada y reversible](excepcion-stock-cocina-c74.md). El usuario autorizó dos opciones para que las nuevas copias recalculen los resultados de sus fórmulas al abrir.

Las cantidades contadas sin unidades, equivalencias o destino resueltos bloquean la generación. Las referencias pendientes se muestran al Administrador; no se inventan conversiones ni filas.

## Operación y publicación

Se mantiene Free. Pages/D1 resuelven el recorrido ordinario; los objetos privados ejecutan sincronización, Excel y bcrypt coste 12. Las copias Excel se guardan en R2 privado y se descargan tras nueva autorización. Los respaldos cifrados conservan su cadencia de noventa días. La purga diaria acotada solo elimina metadatos de autenticación vencidos.

0014 y 0015 se aplicaron remotamente y el preflight de exportación pasó. El Worker privado, la plantilla y los enlaces de Pages se prepararon; la evidencia de 4D identifica sus versiones. El código de Pages queda pendiente del push del usuario. No repetir bootstrap, fixtures ni migraciones previas.

El navegador recibe paquetes con hash/caché inmutable y precarga. Las lecturas de búsqueda/resumen y el contrato ligero de esquema están [explicados aquí](arquitectura-y-operacion.md). CI valida sin credenciales remotas. Dependabot queda pendiente por decisión del usuario.

## Decisiones abiertas

Offline completo, TOTP, nuevas políticas de contraseña/inactividad, cerrar otras sesiones, refactor progresivo de vistas/HTML y alertas externas se evalúan antes de activarse. No son continuación implícita de 4D. Las [consideraciones de arquitectura](arquitectura-y-operacion.md) describen beneficio, coste y límites de cada propuesta.

El comportamiento de un Microsoft Excel real y la aceptación operativa posterior al push siguen pendientes. Las pruebas locales no certifican CPU facturada ni un flujo productivo aún sin publicar.
