# Accesos, autoría y administración — decisiones vigentes 22-10-2026

Refuerzo 3A local posterior: GET `/api/admin/metrics` exclusivamente Administrador; Jefa y Trabajador 403. Informe limitado de actividad horaria muestreada, cuentas observadas, sesiones no vencidas y últimos 100 eventos administrativos (actor/objetivo UUID separados). Sin contraseñas/cookies/tokens ni cantidades/notas. No es tablero 3B. Altas/restablecimientos comparten cuota de diez derivaciones por actor/15 min; cuotas de lecturas aproximadas por isolate/UUID, no IP compartida. [Significado, retención y límites](seguridad-observabilidad-3a.md). Requiere 0005 antes de publicación; ninguna cuenta/permisos remotos se modificó aquí.

Incremento recuperado/publicado en `cfece26`, confirmado en Pages (`7df21f3c`): Administrador > Jefa de servicio > Trabajador. La jefa tiene todo Servicio por rol, sin acceso a Cocina/Pastelería/Panadería/Bodega. Administra trabajadores de Servicio, incluidas altas sin asignación inicial; no promueve roles ni administra jefas/administradores. En cuentas mixtas solo cambia accesos de Servicio, conservando los exteriores; no cambia username, contraseña, activación ni eliminación. «Activar/desactivar zonas» significa gestionar asignaciones por persona. [Contrato](usuarios-y-servicio-3b.md), [evidencia actual y límites](revision-hermes-2026-10-22.md).

Al crear se eligen username y nombre visible. Después, la administración modifica el username y cada persona su nombre visible desde Mi perfil; el perfil no modifica usuario ni rol. Cambiar username revoca sesiones y conserva UUID/autoría. Eliminar requiere confirmación irreversible y revisión vigente: se retira cuenta/sesiones/accesos, sin borrar conteos, operaciones o auditoría. La marca de eliminación no se puede revertir; reutilizar un username crea otro UUID. El último Administrador activo continúa protegido.

Reparto nuevo: Línea/Armado conserva su ID anterior; Copería recibe Aseo; Mercadito distingue Vitrina como ubicación/categoría. Un acceso anterior al sector combinado conserva su alcance mediante una asignación adicional a Copería. Los ciclos anteriores mantienen sus cantidades; los nuevos usan catálogo versionado distinto. Las referencias históricas siguientes se subordinan a estas decisiones.

Implementación 3A con Worker + D1, probada localmente y publicada hasta `5d80658`. Revisión básica del dominio aprobada; aceptación operativa abierta. Guía: [operacion-3a.md](operacion-3a.md). Contrato: [contrato-3a.md](contrato-3a.md).

- Usuario personal y contraseña; UUID estable independiente del nombre visible. Mínimo de nuevas contraseñas: 8 caracteres por decisión del usuario (sustituye 12); se conservan bcrypt coste 12 y máximo técnico de 72 bytes sin truncar. No hay cuentas compartidas por área, registro público ni recuperación por correo/SMS. Administrador crea y restablece cuentas con cambio obligatorio de contraseña.
- Roles Trabajador, Jefa de servicio y Administrador. Cuenta inactiva no ingresa; desactivación o restablecimiento revoca sesiones. Cambio propio exige contraseña actual y también revoca sesiones. Último administrador activo protegido en la base.
- Varias asignaciones forman una unión. Un nodo incluye descendientes, nunca hermanos. Sin ámbitos asignados puede ingresar, pero no ve catálogo, conteos, progreso, historial ni áreas. Mensaje: «No tienes áreas asignadas. Contacta al administrador». No hay área por defecto. Administrador tiene acceso global por rol sin asignaciones operativas.
- Servicio incluye Barra, Línea/Armado, Copería, Mercadito (con Vitrina) y Garzones; Garzones incluye Zona privada, Salón y Terraza. Dar Servicio completo se explica explícitamente en la administración. Barra + Armado no revela Mercadito/Garzones. Solo Terraza muestra únicamente los contenedores Servicio/Garzones y esa zona.
- Lecturas y escrituras se autorizan en servidor, incluidas API de catálogo, búsqueda, resumen, sincronización e historial. El catálogo global y referencias de exportación no se publican como assets. Los permisos se revalidan en cada operación, también sumas, sobrescrituras y reintentos. Los cambios de ámbito no obligan a iniciar sesión de nuevo; el sondeo recoge el cambio en hasta cinco segundos con pantalla visible.
- Registros ajenos se resuelven mediante **Descartar, Sumar o Sobrescribir**, incluidos avance, contado y cero. Actualizaciones propias se guardan **sin ese diálogo**, con control de versión. La cantidad es total salvo al confirmar Sumar. Confirmaciones se vinculan a la versión mostrada; no existe forzar genérico. Una suma conserva las notas y añade autor/fecha, mantiene avance si cualquiera está en avance y elimina Sin stock si el total es positivo. Unidad ausente no es unidad compatible para sumar.
- Cambiar nombre o contraseña conserva autoría histórica. Historial retiene ID, fecha de servidor, acción, versiones, antes/aporte/después, estados, marcas y notas. Administración guarda auditoría de cuentas y ámbitos sin contraseñas.
- Al retirar acceso desaparecen los datos y se avisa de borradores aislados conservados. No hay envío automático. Cerrar sesión/cambiar usuario no transfiere caché ni borradores; los conteos remotos solo se mantienen en memoria y borradores se separan por UUID/ciclo.

La administración mínima de usuarios y ámbitos pertenece a **3A**. Tablero completo, historial administrativo avanzado, rectificaciones/anulaciones, activación operativa y revisión/cierre/reapertura son **3B**. Exportación fiel es **4**. Desactivar un producto no equivale a cero y no elimina ni cambia filas del Excel. Eliminar registros sigue exigiendo semántica que preserve auditoría.

La administración usa búsqueda y cuentas plegables, explica el alcance de cada ámbito y confirma el restablecimiento antes de revocar sesiones. Los nombres y contraseñas de fixtures pertenecen solo a desarrollo local; el primer administrador del sitio se crea con una cuenta personal y contraseña privada por el procedimiento fuera de línea de [despliegue-pages.md](despliegue-pages.md).

En la revisión histórica del 21-10-2026 se comprobaron ingreso/cierre del administrador y lectura de Usuarios y accesos, menú, temas y refresco, sin cambiar cuentas/ámbitos. Aceptación operativa abierta: conteos/conflictos y retirada de accesos con varias personas en producción, cookies allí, recursos/consumo Free, recuperación remota/copia externa y Android. El piloto está aplazado. Se conserva bcrypt coste 12 y **Free es la restricción vigente**, no capacidad certificada ni autorización para Paid. Ver [cierre técnico](cierre-tecnico-3a.md) y [verificación](verification.md).

Los respaldos son privados y no se sirven desde la app. Una restauración local ensayada revoca todas las sesiones recuperadas; no cambia la identidad estable de los autores. El mantenimiento explícito elimina únicamente sesiones e intentos vencidos según la política de dos días, con lotes limitados y auditoría. No elimina usuarios, ámbitos, conteos, historial ni IDs/resultados de operación. La futura administración 3B se define en [etapa-3b.md](etapa-3b.md).

## Preparación histórica de demo — 22-10-2026, anterior a cfece26

Preparación explícita autorizada: Administrador `admin` (contraseña conservada), Jefa de servicio `jefa-demo` y trabajadores `bodega-demo`, `cocina-demo`, `panaderia-demo`, `pasteleria-demo`, `servicio-demo`. Cada trabajador tiene su área; Servicio y la jefa incluyen sus subáreas/zonas. La jefa solicitada usa el rol vigente Jefa de servicio, limitado a Servicio. Se retiraron tres cuentas anteriores con auditoría, sin borrar autoría/conteos. Las seis cuentas nuevas tienen contraseñas temporales individuales y cambio obligatorio; el archivo privado de accesos no se publica ni versiona. No se cargaron los fixtures de desarrollo.

El alta de parte de las cuentas y algunos ingresos funcionaron; otras ejecuciones terminaron con 1102/`exceededCpu`. Se completó la inicialización con el mismo bcrypt coste 12 calculado fuera del Worker. Después el usuario publicó `cfece26` y confirmó funcionamiento. La revisión actual encuentra dos errores posteriores por recursos, sin atribución por ruta; no niega ese funcionamiento ni certifica estabilidad/carga. El recorrido autenticado completo del ciclo nuevo sigue pendiente. [Resultados concretos](verification.md).

<details>
<summary>Análisis histórico del 20-10-2026, conservado como referencia; las alternativas incompatibles siguientes están sustituidas</summary>

# Accesos, autoría y administración

Estado: análisis actualizado con decisiones del usuario; sin implementación. Este documento complementa la etapa de conteo compartido y corrige cualquier interpretación de que el ingreso individual por correo ya fue elegido.

## Decisiones confirmadas

- Unas 15 personas usarán la app durante el inventario.
- El método de ingreso sigue abierto: se evalúan cuenta por área más nombre, cuenta individual y alternativas mixtas. La verificación por teléfono no es una preferencia del usuario.
- El trabajador solo puede ver y modificar su ámbito autorizado: Cocina solo Cocina; barista solo Barra; Armado/Línea/Copería solo esa subárea; Garzones solo sus zonas. Aplicar el mismo principio a las demás áreas. Garzones accede a sus tres zonas salvo decisión posterior más restrictiva.
- Administradores pueden ver toda la app, modificar y rectificar conteos, consultar quién registró qué y cuándo, activar/desactivar productos en la app, eliminar según una semántica por definir, cerrar y exportar inventarios.
- Activar/desactivar productos no modifica el libro original ni elimina filas del archivo exportado. La exportación conserva la estructura y referencias originales y solo actualiza cantidades.
- Al reemplazar un registro de otro trabajador, mostrar diferencias y preguntar si sobrescribir el ítem o descartar el cambio. Las actualizaciones del propio trabajador no requieren esa pregunta. La confirmación se vincula a la versión comparada; si cambia, debe revisarse otra vez.

## Alternativas de ingreso por evaluar

| Alternativa | Ventaja operativa | Coste o limitación |
| --- | --- | --- |
| Cuenta y contraseña por área + nombre declarado | Acceso por área sencillo; un trabajador puede cambiar de puesto usando otra cuenta sin reasignación individual | Autoría declarada, no verificada; nombres inconsistentes o suplantados; revocación de acceso exige cambiar la clave compartida |
| Cuenta individual + contraseña, con correo de recuperación opcional | Identidad estable sin correo en cada ingreso; baja individual; permisos por grupos | Gestión de altas, recuperación y pertenencias; cambiar de puesto requiere un mecanismo autorizado |
| Cuenta individual por correo verificado o código por correo | No requiere SMS; autoría vinculada al correo y posible proveedor externo | Depende de correo accesible; un correo verificado no concede por sí solo acceso a un área |
| Cuenta de área + credencial personal adicional | Mantiene ingreso por puesto y distingue trabajadores; evita una asignación diaria si el acceso al área se autoriza por su credencial | Dos pasos; una credencial corta exige controles contra intentos; compartir el acceso del área no puede permitir adoptar cualquier identidad |

Ninguna alternativa está aprobada. Recomendación para evaluar: identidad personal estable y permisos por grupos, con un mecanismo sencillo para autorizar cambios de área. Puede ser pertenencia permanente a varias áreas, código de área/turno o gestión por encargado; estos mecanismos tienen distintos grados de restricción y no son equivalentes. Elegir cualquier área en pantalla sin prueba de autorización contradice el aislamiento solicitado.

Si se elige cuenta compartida y nombre libre, registrar por separado la cuenta de acceso y el autor declarado. No presentar el nombre como identidad verificada. La regla de “mismo trabajador” queda limitada por esa identificación: no comparar únicamente la cuenta compartida ni tratar dos nombres iguales como prueba suficiente. Seleccionar personas de una lista evita variantes pero no acredita identidad; un PIN o credencial personal sí añade una comprobación, con controles apropiados.

## Aislamiento de áreas

No basta ocultar tarjetas: el servidor debe filtrar catálogo operativo, conteos, búsquedas, resúmenes, sincronización e historial según alcance y rechazar acceso por URL o solicitudes manipuladas. El catálogo completo de referencia puede permanecer en servidor para la exportación; no entregarlo íntegro al navegador de un usuario restringido. Aislar también caché y borradores al cambiar de usuario/área. Los nombres y existencia de otras áreas pueden formar parte del diseño de ingreso, pero sus datos no deben filtrarse.

## Administración sin alterar el Excel

Propuesta: conservar catálogo de referencia inmutable y guardar activación operativa en una capa separada, versionada por ciclo. Definir si cambios aplican al ciclo actual o a los siguientes; no cambiar silenciosamente el denominador de avance de un ciclo en marcha.

Desactivar no equivale a confirmar cero ni a borrar un conteo. Toda fila sigue presente al exportar. Debe acordarse cómo resolver filas inactivas sin conteo del ciclo: exigir revisión antes del cierre/exportación es la recomendación inicial. Nunca reutilizar cantidades antiguas ni poner cero silenciosamente.

Interpretación propuesta de eliminar: anular un conteo con motivo y conservar historial; el ítem vuelve a pendiente hasta una resolución válida. Ocultar o desactivar un producto de la app no borra su fila del Excel. No hay autorización definida para destruir auditoría. Las rectificaciones administrativas también conservan antes/después, autor y fecha.

## Ubicación en el roadmap

- Etapa 3A: elegir ingreso y autoría; permisos de lectura/escritura por área; persistencia, historial y protección de sobrescrituras.
- Etapa 3B: interfaz de administración, consulta de historial, rectificaciones, anulación, activación operativa versionada y cierre.
- Etapa 4: exportación fiel, con política explícita para productos inactivos y cantidades no resueltas.

Antes de ejecutar el prompt de desarrollo anterior, actualizarlo con la alternativa de ingreso elegida y estas restricciones. No implementar cuentas individuales por correo como si ya fueran una decisión confirmada.

## Referencias

- [OWASP: autorización](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): separar autenticación de autorización y comprobar permisos en cada solicitud.
- [Cloudflare: código por correo](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/): alternativa sin SMS para direcciones aprobadas.

</details>
