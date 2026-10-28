Etapas 4B/4C — 28/10: [capturas y generación fiel](etapa-4bc-exportacion.md). Implementación local; requiere 0014 para la captura. No se aplicó a producción. UI/descarga/R2 quedan en 4D.

Estado vigente de etapa 4 (28/10): [backend y contratos](etapa-4-backend-y-contratos.md). Primera entrega local, sin migraciones ni publicación. El estado productivo más reciente sigue en [verificación del 27/10](verificacion-produccion-2026-10-27.md). Las notas fechadas anteriores son evidencia histórica y no instrucciones para repetir migraciones.

Estado vigente 27/10: [preparación remota completada](consumo-activacion-2026-10-27.md). 0013 aplicada y preflight remoto aprobado; Workers privados publicados y REALTIME preparado en Pages. Entrega incluida en un commit local; push por SSH reservado al usuario. Pages se publica con ese push. No repetir migraciones. Verificación pública bloqueada por Cloudflare1010; comprobación funcional posterior al push pendiente. Esta nota sustituye estados anteriores que decían que no había cambios remotos.

Actualización 27/10: [corrección integral del consumo crítico](consumo-critico-2026-10-27.md) y [evidencia consolidada](consumo-verificacion-2026-10-27.json). Implementación local completa de las causas críticas; requiere 0013 y despliegue/bindings privados. Producción no modificada. Sin frameworks ni dependencias nuevas.

# Contexto del proyecto — inventory-v3

Actualización vigente 27/10: [corrección de métricas y cuotas del recolector](metricas-correccion-2026-10-27.md). Primera etapa local: entrega real de INP/CLS, recolector diario/horario unificado, depuración horaria acotada y diagnóstico D1 muestreado al 0,1 %. Sin dependencias ni migraciones nuevas, sin cambios remotos ni despliegue. Las optimizaciones de consultas, sincronización y R2 siguen pendientes por etapas. Esta actualización sustituye las descripciones anteriores del recolector; las verificaciones fechadas siguen siendo históricas.

Actualización 26/10: [finalización con pendientes y opciones de inventario](finalizacion-con-pendientes-2026-10-26.md). Requiere 0012 después de 0011. Se permite continuar tras advertencia; pendientes/avances se reservan como blanco para el futuro Excel, conservando ceros confirmados y todos los registros. Esta decisión sustituye el requisito anterior de completar todos los activos. La exportación sigue pendiente.

Actualización vigente 25-10-2026: [inventarios y UX móvil](revision-inventarios-2026-10-25.md), [métricas y respaldos](metrics-backup-2026-10-25.md). Requiere 0008/0009/0010; sustituye la pausa previa de telemetría, sin implementar Root. Ver esos documentos para estado y verificación nuevos; las cifras inferiores son históricas.

Estado actualizado 25/10: app publicada en producción con d4c50da; métricas activas y escritura real verificada a las 12:45 (Chile). Respaldo cifrado remoto activo y recuperación comprobada. [Evidencia de métricas](metrics-production-verification-2026-10-25.json).
## Estado vigente — revisión UX local

Revisión UX implementada localmente el 23-10-2026: Panel de supervisión y resumen compactos, historial por producto y rol, perfil/menú y Gestionar usuarios y accesos. Finalizar y enviar es interno; solo Administrador reabre finalizados. Motivo obligatorio solo para reabrir. Activo/Inactivo persiste por área con fechas/auditoría; el informe de varios meses queda futuro. Altas de trabajadores con accesos en la misma transacción y claves temporales autogeneradas/copiar/compartir tras éxito. Sin nuevos roles ni ampliación de cuentas mixtas.

Requiere **0007_operation_ux.sql después de 0006 antes del deploy**. No aplicar 0005, fixtures, bootstrap ni crear otro ciclo en la demo. No se ejecutaron operaciones remotas ni push. [Decisiones vigentes](decisiones-ux-y-operacion-2026-10-23.md), [verificación](verification.md), [publicación manual](publicar-revision-ux-0007.md). Excel conserva la regla de oro; exportación en etapa 4 y adaptación de plantillas en fase 5, ambas pendientes. Root/telemetría siguen fuera de alcance.

## Registro histórico anterior

## Decisión vigente — 23-10-2026, continuidad con Codex

Por decisión explícita del usuario, persistencia de telemetría desactivada y Root **solo diseñado**. Se conservan diagnóstico saneado, correlación, cuotas/backoff y auditoría transaccional existente. GET `/api/admin/metrics` queda cerrado a todos los roles actuales (`403 ROOT_NOT_ENABLED` con sesión habilitada; sin sesión `401`). No hay histórico de uso, cuentas activas estimadas ni nuevas métricas funcionales disponibles. No se crea rol/cuenta Root ni se amplían permisos de la jefa.

`0005_activity.sql` pasa de `migrations/` a `docs/propuestas/` como propuesta histórica fuera de las migraciones automáticas. Readiness y preflight validan contrato de usuarios/Servicio, catálogo y ciclo, sin exigir tabla activity; la base actual 0001–0004 y el catálogo legado están soportados; mantenimiento solo consulta/poda autenticación vencida, sin tocar telemetría existente. No hay cambios de esquema o datos necesarios para este código. Las instrucciones anteriores que exigían 0005, métricas para Administrador o retención de 14 días quedan sustituidas por esta decisión. [Estado, diseño Root, almacenamiento y publicación](seguridad-observabilidad-3a.md).


## Refuerzo local de 3A — posterior al traspaso, 22-10-2026

Readiness/preflight de esquema/catálogo/ciclo, JSON limitado por bytes, paquete público restringido, cuotas autenticadas aproximadas, backoff, métricas mínimas solo admin y telemetría horaria best-effort implementados localmente. Usuarios/Servicio se conservan; resto 3B y Excel no se desarrollan. Registro histórico: 0005 fue probada localmente y no se aplicó en demo; su publicación quedó descartada el 23-10. [Informe, riesgos y procedimiento](seguridad-observabilidad-3a.md), [evidencia nueva](seguridad-observabilidad-local-2026-10-22.json). Sin solicitudes a la app remota ni cambios remotos. 3A operativa sigue pendiente.

## Última decisión y traslado local — 22-10-2026

Raíz trasladada de `/Users/lucio/workspace/inventario-barista-mobile` a `/Users/lucio/workspace/inventario_brioche`, sin cambiar remoto, rama, identificadores, bases ni credenciales. HEAD y seguimiento local `origin/inventory-v3` coinciden en `cfece26`; la lectura viva de GitHub falló por clave SSH. Pages sí confirma `cfece26`, despliegue canónico `7df21f3c` correcto; el usuario confirmó funcionamiento. D1 ya se reparó y hubo un `exceededCpu` histórico distinto. La revisión actual encuentra dos errores posteriores `exceededResources` a las 17:18 UTC, sin ruta ni diagnóstico individual; no prueba fallo permanente ni causa exacta. Free se mantiene y Supabase no está integrado ni es obligatorio. [Evidencia y límites actuales](revision-hermes-2026-10-22.md), [traspaso](traspaso-hermes.md).

## Estado local actualizado — 22-10-2026

Revisión móvil de Usuarios y accesos: cuenta desplegada con pestañas Cuenta/Accesos/Seguridad; permisos agrupados por área y ramas plegables; contraseña y eliminación separadas. Total filtrado junto a Cuentas existentes, sin subtítulo descriptivo y con los avisos de creación en líneas distintas. Cambiar de pestaña conserva campos/asignaciones; la jefa en cuentas mixtas mantiene únicamente el editor de accesos de Servicio. Ajuste de presentación y validación HTML del usuario, sin cambios de API, permisos, esquema o catálogo. [Guía visual](style-guide.md), [pruebas de esta revisión](verification.md).

Se confirmó conservar el cambio obligatorio de contraseña temporal sin regreso al inventario; el menú permite Cerrar sesión. No se modificó ese flujo tras la revisión visual.

Proyecto «inventario brioche», rama `inventory-v3`. Incremento de usuarios y Servicio implementado: roles Administrador/Jefa de servicio/Trabajador; edición administrativa del username, nombre visible propio en Mi perfil y eliminación irreversible con historial conservado. La jefa solo ve inventario de Servicio y administra sus trabajadores; para una cuenta mixta solo cambia sus accesos de Servicio, sin alterar cuenta, contraseña ni accesos exteriores. El alcance se revalida dentro de las mutaciones transaccionales y los guardados.

Inicio entra directamente al área/sector único; Garzones conserva sus zonas y varias áreas conservan Inicio. Jefa entra a Servicio sin flecha global. Copería cuenta los 32 productos de Aseo; Línea/Armado los otros 42 y conserva el ID técnico anterior. Mercadito añade 41 conteos independientes de Vitrina, cotejados contra las marcas del libro de reparto. Se conservan las referencias; exportar/consolidar Excel sigue en etapa 4.

Migraciones `0003_users_service.sql` y `0004_service_catalog.sql`; catálogo `inventory-v3-2026-10-22`, **1.268 entradas**, conservando las **1.227** del anterior sin mover cantidades/borradores. En la reparación histórica de `94d3a83` se aplicaron 0003/0004, ciclo `piloto-v3-servicio` y siete cuentas mínimas; después de la reversión temporal se recuperó/publicó `cfece26`, ahora comprobado en Pages. Los GET públicos pasan **16/16**; cinco assets coinciden. Los errores por recursos actuales requieren seguimiento sin confundirlos con D1 ni negar el funcionamiento informado. Sin cambios de bcrypt/facturación/proveedor; [diagnóstico](verification.md), [contrato](usuarios-y-servicio-3b.md). 3B continúa abierta: supervisión, historial avanzado, rectificación/anulación, activación operativa y cierre/reapertura pendientes; aceptación 3A abierta.

Las secciones fechadas el 21-10-2026 describen el estado previo; las decisiones de este incremento sustituyen sus referencias al sector combinado, dos roles y edición administrativa del nombre visible.

## Separación de versiones — 21-10-2026

Por decisión del usuario, la etapa 3A y todo este avance continúan en `inventory-v3`, creada desde `inventory-v2` en `3d23319`. La rama `inventory-v2` conserva íntegro su commit anterior sin estas modificaciones. Se trasladaron también los cambios de documentación que ya existían antes de implementar 3A. El catálogo versionado y las claves de datos mantienen sus identificadores originales por compatibilidad. Ver [separacion-inventory-v3.md](separacion-inventory-v3.md).

## Objetivo vigente

`inventory-v3` debe permitir contar el inventario completo desde la app y producir un archivo con la misma estructura que `inventarios_og/11_10-INVENTARIO-totalizado.xlsx`. El archivo `inventarios_og/INVENTARIOS_2026-2027_jefa-turno.xlsx` describe el reparto manual del conteo. El archivo totalizado es la referencia de salida: se conservan hojas, filas, identificadores, nombres, unidades, fórmulas y presentación; las cantidades de stock proceden del nuevo conteo.

El uso operativo puede organizarse de forma distinta del Excel. Cada producto debe vincularse a una fila de salida y contar con una conversión explícita entre su unidad en pantalla y la unidad de esa fila. Una cantidad pendiente no equivale a cero confirmado. Los productos nuevos o sin correspondencia requieren revisión antes de incluirlos en la salida.

En la etapa 4, aún no implementada, el Excel final se generará únicamente cuando se elija explícitamente **Exportar** al terminar el inventario. Los conteos por área forman parte del trabajo previo y no generan archivos por sí solos.

## Áreas y sectores de conteo

- Cocina → hoja `cocina`.
- Panadería → hoja `panaderia`.
- Pastelería → hoja `pasteleria`.
- Bodega / Principal → hoja `principal`.
- Servicio → hoja `servicio`; en etapa 4 se consolidarán por producto los conteos físicos separados de Barra, Línea/Armado, Copería, Mercadito/Vitrina y Garzones, con conversiones aprobadas. Esta suma/exportación aún no está implementada.
- Garzones se cuenta en Zona Privada, Salón y Terraza.

Desde el reparto del 22-10-2026, Línea/Armado y Copería son sectores separados; Copería cuenta Aseo. Vitrina es una ubicación física separada en Mercadito. Otras dudas físicas se revisarán con el equipo. Cada ítem distingue `countCategory` (grupo que se muestra para contar) de `exportCategory` (categoría de su fila en el Excel).

Cocina se cuenta en ocho grupos prácticos: Verduras y frutas; Carnes, aves y pescados; Lácteos y huevos; Abarrotes; Aceites, salsas y condimentos; Elaborados y productos listos; Panes y masas; Aseo, protección y envases. Sus 171 filas se asignan una sola vez. Porotos verdes queda provisionalmente en Abarrotes. Cocina cuenta todos los productos de su hoja que tenga físicamente, aunque esos productos también aparezcan en otras áreas. Por ahora muestra y registra las unidades del Excel final; las mejoras de unidades se revisarán después con feedback del equipo. La agrupación no modifica filas, ID ni categorías de salida.

Pastelería se cuenta en once grupos prácticos que separan ingredientes, bases, rellenos, coberturas y familias de productos terminados. Sus 246 filas se asignan una sola vez. Cinco filas del Excel final carecen de unidad; la app conserva ese dato ausente y queda pendiente definirlo con el equipo antes de exportar cantidades de esas filas.

Panadería se cuenta en siete grupos prácticos: Harinas y levaduras; Abarrotes, semillas y saborizantes; Refrigerados y huevos; Panes y bollería; Galletas y dulces; Aseo y protección; Envases y rotulación. Sus 151 filas se asignan una sola vez. Aseo y envases se separan aquí porque juntos abarcarían 48 productos.

Bodega / Principal se cuenta en catorce grupos prácticos que separan abarrotes, condimentos, panificación, carnes y pescados, lácteos, congelados, bebidas, cafetería, té, repostería, aseo, envases, artículos de servicio y suministros de operación. Sus 288 filas se asignan una sola vez. Los dos atunes se muestran junto al jamón en «Carnes, aves y pescados», aunque el Excel mantenga los atunes bajo «Abarrotes» y el jamón bajo «Carnes y Aves». Los grupos de pantalla no cambian la fila, el ID, la unidad ni la categoría de exportación. Bodega cuenta solo los productos de su hoja; no se copian aquí los de Cocina por compartir tipo de producto.

## Registro histórico — etapa 3A, 21-10-2026

Las secciones fechadas el 21-10 conservan la evidencia de aquella revisión. `5d80658` ya no es el último commit publicado y sus indicaciones sobre 3B sin implementar o plan/alojamiento no sustituyen el estado actual descrito arriba.

El panel de cuenta muestra el punto verde y «Sincronizado» primero, con un icono cian de refrescar de 18 px, sin fondo, al extremo derecho. La comprobación manual admite un intento cada 30 segundos por usuario en el navegador, incluso después de un error; comparte la espera entre páginas/pestañas mediante un timestamp sin credenciales ni datos de inventario. Inventario reutiliza consultas en curso o aceptadas en los últimos cinco segundos y consulta únicamente cambios incrementales sin enviar ni eliminar borradores; otras vistas verifican sesión/conexión sin recargar formularios. Los estados pendiente, actualizando y error tienen texto y color propios. Este límite del control no es una cuota global del servidor; no añade escrituras ni contadores en D1 ni cambia el sondeo existente. El ajuste de 3A está publicado en `5d80658` y comprobado en el dominio real. La pausa para revisar ese despliegue ya cumplió su objetivo; En esa revisión del 21-10, 3B aún no tenía implementación; el incremento local del 22-10 se describe arriba.

Implementados Worker + D1, usuarios personales con contraseña, sesión por cookie HttpOnly, cambio propio/temporal, administración mínima de cuentas y múltiples ámbitos, catálogo filtrado, conteo compartido con versiones, historial, reintentos idempotentes y borradores aislados por identidad/ciclo. Decisiones confirmadas: ausencia de asignaciones significa ausencia de acceso al inventario; administrador global por rol; registros ajenos requieren Descartar, Sumar o Sobrescribir; actualizaciones propias se guardan directamente con control de versión. El catálogo conserva sus identificadores, unidades y referencias originales. Pedido no se modificó.

Inicio y pantallas obtienen la proyección autorizada desde la API. Los contenedores solo conducen a descendientes permitidos. La sesión local anterior permanece sin leer ni importar; Nuevo inventario está deshabilitado en modo compartido. Contrato en [contrato-3a.md](contrato-3a.md), inicio y primer administrador en [operacion-3a.md](operacion-3a.md). 3A está implementada y probada localmente; el usuario aplazó el piloto operativo para más adelante. El desarrollo de 3B puede continuar, pero la aceptación operativa de 3A no está cerrada. Etapa 2 sigue con sus decisiones físicas/unidades pendientes; Excel en 4 sigue pendiente.

## Cierre técnico disponible y paso a 3B — 21-10-2026

Último despliegue comprobado el 21-10-2026: `5d80658`, posterior a UX (`fb67ecb`), cabeceras (`4aac9bc`) y menú/contraseñas (`2ac0e4c`). Se confirmó éxito en Pages y coincidencia exacta de los cuatro archivos públicos del ajuste de sincronización con el commit local. Se repitió `verify:public` contra el dominio: **16/16**, incluidas cabeceras, JSON/no-store y archivos privados inaccesibles; coincide con [publico-3a.json](publico-3a.json).

En navegador se comprobaron ingreso/cierre con el administrador existente, login sin menú, Cuenta, panel derecho, temas, refresco con espera de 30 segundos y lectura de Usuarios y accesos. No se cambiaron contraseñas, cuentas, permisos ni conteos; sí se crearon/revocaron las sesiones normales del recorrido. Quedan sin verificar en producción los conteos/conflictos con varias personas, revocación de accesos, atributos de cookie, CPU/carga y recuperación. [Alcance exacto de la revisión](verification.md). [Tecnologías y diagrama de etapas](tecnologias-y-roadmap.md).

Se implementaron herramientas explícitas de respaldo privado D1, restauración exclusivamente local en destino nuevo y mantenimiento de metadatos vencidos. El ensayo real local pasa siete grupos: datos/autoría/permisos idénticos, integridad, sesiones recuperadas revocadas, triggers y deduplicación conservados, corrupción rechazada y limpieza limitada sin borrar historial ni operaciones. No se exportó, restauró ni limpió D1 remota.

El usuario considera probable Workers Free por no haber contratado pagos; no se confirmó en el panel. bcrypt coste 12 consume 274–325 ms de CPU del proceso Node en seis muestras locales. Esa medida no es CPU facturada de Cloudflare, pero frente al límite Free publicado de 10 ms por solicitud **no permite dar por compatible el alojamiento actual**. Confirmar plan y resolver presupuesto de CPU antes de uso real; no se redujo la protección ni activó facturación. [Cierre, evidencia, recuperación y pendientes](cierre-tecnico-3a.md).

El piloto con trabajadores queda aplazado por decisión del usuario, sin bloquear el desarrollo. Tras el incremento usuarios/Servicio del 22-10, el siguiente trabajo funcional de [3B](etapa-3b.md) es tablero e historial administrativo de solo lectura; rectificación/anulación, activación y revisión/cierre/reapertura siguen sin implementar. No se declara 3A operativa ni 3B completada.

## Habilitación de Pages y revisión visual — 21-10-2026

El usuario publicó v3 en `https://inventario-login.pages.dev/` y creó D1 `inventario-login-v3`. Su salida de terminal confirma migraciones, ciclo `piloto-v3` y creación del primer administrador personal `admin` aplicados. La importación del bootstrap procesó cuatro consultas sin error el 21-10-2026. No repetir esa inicialización. El recorrido administrativo básico posterior está comprobado; el recorrido completo con trabajadores sigue pendiente. No registrar credenciales en archivos ni informes.

La primera comprobación pública encontró HTML en `/api/me` y `/api/bootstrap` en lugar de API, además del catálogo global expuesto por la publicación estática de la raíz. Se corrigió con `build:pages`: assets permitidos, `_worker.js` y cobertura de todas las rutas en `dist`. El cliente presenta indisponibilidad clara ante HTML o D1 sin inicializar; no activa fixtures ni modo local. Se verificó el paquete con D1 aislado y cookies seguras por HTTPS **local**; la publicación posterior del usuario y la comprobación pública confirman API JSON protegida y archivos privados inaccesibles. Configuración e instrucciones en [despliegue-pages.md](despliegue-pages.md).

Ingreso, cambio de contraseña, identidad y administración se ajustaron a la guía visual vigente. Se ampliaron pruebas de contraseñas, sesiones, dos dispositivos, cantidades/cero, pantallas, visibilidad y Pages. La simulación de 15 clientes pasó con 151 escrituras, 150 reintentos sin duplicación y 14 conflictos esperados. Los ensayos automatizados usan bases desechables independientes de la base local de desarrollo; resultados y límites en [verification.md](verification.md).

## Respuesta de la interfaz — 21-10-2026

El usuario confirmó que funciona el sitio y aportó el log exitoso del deployment `ec80d9c`. Se observó públicamente la pantalla nueva, API JSON que exige sesión y catálogo global inaccesible. El aviso de configuración Wrangler del log no impidió la compilación ni la publicación del Worker de `dist`. La validación operativa completa sigue pendiente; el recorrido posterior y sus límites se registran en [verification.md](verification.md), sin incluir credenciales.

La revisión UX posterior añade skeletons inmediatos y uniformes en Cuenta, Inicio, Inventario, Administración e Historial; estados visibles de envío; fundidos de 180 ms y entrada breve de diálogos/menú, con alternativas para movimiento reducido. No se retrasa contenido listo ni se muestran cantidades/progreso ficticios. El historial abre antes de completar la lectura y puede cerrarse conservando el borrador.

Se redujeron viajes de red: Inicio consulta solo identidad y ámbitos en `/api/navigation`, sin descargar el catálogo; Inventario usa la identidad del bootstrap y Administración la de su respuesta. El guardado nuevo usa el registro aceptado de la respuesta; un reintento incierto sigue consultando el vigente después, para no restaurar datos superados. Toda autorización continúa en servidor, sin caché nueva de inventario ni cambios de contraseñas/esquema. La sincronización sin cambios no reconstruye la vista. Pruebas y tamaños reales del ensayo en [verification.md](verification.md) y [ux-local-v3.json](ux-local-v3.json). Publicada por el usuario en `fb67ecb`; el verificador posterior confirma también las cabeceras corregidas del cierre técnico.

## Ajustes de interfaz previos a 3B — 21-10-2026

Por solicitud del usuario, cuenta y sincronización dejan de ocupar una tarjeta sobre el contenido: se reúnen en el panel flotante derecho con el cambio de tema y las acciones personales. El icono SVG usa cuatro cuadros redondeados como la referencia adjunta. Se mantienen crema/carbón, superficies translúcidas, foco contenido y preferencias de movimiento/transparencia. El panel de ítems sigue entrando desde la izquierda. En ingreso sin sesión solo se muestra el toggle claro/oscuro, sin menú.

Ingreso y cambio de contraseña usan encabezado en fila con candado a la izquierda; se retira la explicación del ingreso, se centra la ayuda y se sustituyen Ver/Ocultar por ojos SVG. Las flechas superiores reemplazan los enlaces de regreso de Cuenta y Administración. Nuevas contraseñas con mínimo **8 caracteres**, decisión confirmada que sustituye el mínimo anterior de 12. Continúan bcrypt coste 12 y límite técnico de 72 bytes, sin mostrarlos en la ayuda de pantalla ni alterar credenciales existentes. Revisión publicada y comprobada como parte de `5d80658`.

## Interfaz y catálogo conservados

La rama `inventory-v3` usa HTML, CSS y JavaScript nativos. La página inicial muestra únicamente las áreas autorizadas entre las cinco existentes. El módulo de inventario permite elegir sector en Servicio y zona en Garzones. En cada zona de Garzones se muestran directamente sus 16 ítems; las demás áreas y sectores conservan categorías prácticas antes de los productos. Durante el conteo, un botón abre un panel lateral con todos los ítems autorizados del área o zona activa, su estado y búsqueda por nombre. El catálogo de la app se deriva de las filas del archivo totalizado y de las asignaciones del libro manual. Se conservan los ID internos existentes de Barra cuando se puede vincular el mismo producto por nombre o por una equivalencia confirmada. Los ID de GetJusto y números de fila del Excel se guardan como referencias de salida sin modificarlos; los ID ausentes permanecen ausentes.

La interfaz usa un fondo blanco crema uniforme (#faf8f3), acentos cian y tarjetas de área con tintes propios en modo claro. El modo oscuro usa un fondo carbón profundo (#111315) y superficies oscuras uniformes. Fondos, tarjetas, botones y paneles no llevan degradados; se conservan transparencia y desenfoque moderados. Los botones no cambian color ni relieve al hover o al pulsarlos; el foco visible se reserva para teclado. Volver y el toggle liberan el foco tras un toque. El icono de cuatro cuadros arriba a la derecha abre desde la derecha el panel flotante de cuenta, sincronización, acciones y cambio de tema. La preferencia se guarda en el navegador y los iconos de luna y sol son SVG para evitar diferencias de fuente en Android. Las superficies compartidas de navegación, conteo y resumen emplean transparencia moderada con alternativa opaca para la preferencia de transparencia reducida; los encabezados y el botón de tema no tienen borde de tarjeta. El resumen muestra un anillo SVG calculado con los conteos reales. Su encabezado conserva título y controles, pero oculta la barra y el contador duplicados; se retiró el subtítulo descriptivo y se redujo el espacio anterior al contenido. El panel lateral de ítems conserva la transparencia, permite buscar y plegar categorías, y se abre también desde el botón de búsqueda en el encabezado de categorías. Al abrirlo, solo la categoría del producto actual queda desplegada y el producto se sitúa a la vista; en una vista sin producto todos los grupos empiezan cerrados. «Ver ítems» no enfoca el buscador ni activa el teclado; el botón de búsqueda sí enfoca el campo. En celulares, las categorías usan una cuadrícula compacta de dos columnas; los controles de conteo conservan separación y foco visible. La guía visual y de interacción está en `docs/style-guide.md`.

El resumen ya no queda sin encabezado cuando hay pendientes. Al abrirlo se muestra un indicador decorativo durante 800 ms después de dibujar el contenido; no retrasa las acciones y se omite con movimiento reducido. Al entrar en un grupo o volver a una zona se prioriza un ítem sin contar. La barra superior de conteo dispone «Anterior», «Ver ítems» y «Siguiente» en ese orden. La acción «Sin stock» guarda 0 como contado con una marca explícita que se muestra en el panel, la ficha, el resumen y el texto copiado. Una vez guardado, su estado se ve verde en esos lugares, como cualquier conteo confirmado; el botón de acción conserva el rojo antes de guardar. Los avisos de guardado aparecen arriba durante cuatro segundos: son verde/teal para «Listo» y «Sin stock», ámbar para avance y rosa rojizo para errores. Tienen una superficie translúcida más amplia, entrada desde arriba y salida hacia arriba; con movimiento o transparencia reducidos simplifican esos efectos. Esta rama no contiene estados AM/PM ni la vista de Pedido de la otra rama, por lo que sus flujos no se modificaron aquí.

Barra conserva las seis categorías de conteo de la versión anterior: Insumos, Syrups, Congelados, Té / Infusiones, Desechables y Limpieza (en el catálogo el nombre histórico es `Te / Infusiones`). Las filas adicionales del Excel se ubican dentro de estas categorías según el producto; las categorías de la hoja Servicio se guardan solo como referencia de salida. La falta de vínculo con el Excel y las conversiones pendientes son asuntos internos y no se muestran como categorías ni avisos en la pantalla de conteo.

Las bebidas envasadas de marca (Coca-Cola, Coca-Cola Zero, Fanta, Sprite y Sprite Zero) y las aguas con y sin gas se cuentan ahora en Línea/Armado (`armado-linea-coperia`), bajo «Bebidas», no en Copería. Las pulpas, porciones de jugo, hielo y Primaveral siguen en Barra. Las siete bebidas trasladadas conservan sus ID internos previos.

Históricamente, hasta el 20-10-2026, el conteo se guardaba en `localStorage` con la clave `inventario-session-v2` y esquema 3. Esa persistencia histórica es local al navegador y no se importa automáticamente al nuevo ciclo compartido. El generador del Excel final tampoco está implementado todavía. Las propuestas históricas de `docs/propuesta-ux-colaboracion.md` quedan subordinadas a las decisiones confirmadas de 3A. Las dudas de reunión se conservan en `archivos-externos/reuniones/dudas_inventario_por_area.xlsx`. La ruta de Pedido pertenece a un módulo separado y no forma parte de esta navegación de inventario.

La revisión del 20-10-2026 comprobó 1.151 filas de referencia contra el Excel original y encontró cero diferencias en ID, nombre, unidad y categoría. El catálogo tiene 1.227 entradas de conteo porque algunos productos aparecen en más de un sector o zona; 18 ítems anteriores de Barra siguen sin fila de salida y dos conversiones de Barra siguen sin equivalencia aprobada. Las pruebas y simulaciones, junto con su alcance, están en `docs/verification.md`.

## Conversiones conocidas y pendientes

- Chai en polvo: conteo y salida en KG. La migración del modo local anterior convertía gramos a kilos al cargar sus sesiones antiguas; 3A no importa ni convierte automáticamente esos datos al ciclo compartido.
- Syrups de 750 cc: conteo en CC; la salida en UN corresponde a `cc / 750`.
- Las unidades iguales, ignorando mayúsculas, mantienen factor 1; gramos a kilos tienen factor `0,001`.
- Las conversiones sin equivalencia confirmada se marcan como pendientes. No se inventan tamaños de envase.

## Contexto de ramas

`main` es la versión estable anterior de Inventario Barra; `warehouse-order` es la línea de Pedido a Bodega; `inventory-v2` conserva la base local anterior y `inventory-v3` es la evolución compartida actual. Las decisiones de `inventory-v2` reemplazan los límites de la versión anterior.

## Evaluación histórica de la siguiente etapa — 20-10-2026

La revisión de código confirma que Responsable es texto de sesión y no identidad por registro. La propuesta actualizada en [etapa-conteo-compartido.md](etapa-conteo-compartido.md) recomienda Workers + D1, usuarios individuales, conteo por ubicación con control de versión, historial y cierre previo a exportar. Son recomendaciones pendientes de implementación y validación operativa; no cambian todavía el funcionamiento local. Las 12 pruebas Node y el contrato de 1.151 filas volvieron a pasar en esta evaluación. No se verificó el despliegue remoto.

## Accesos y administración: análisis histórico, sustituido el 21-10-2026

En ese análisis previo el ingreso seguía abierto a evaluación. La decisión posterior confirmada es usuario personal y contraseña, sin verificación obligatoria por correo/teléfono. El usuario confirmó aislamiento de datos por área/subárea y administración global con historial, rectificaciones, activación operativa de productos, cierre y exportación. Ver [accesos-y-administracion.md](accesos-y-administracion.md), que distingue requisitos confirmados de alternativas. La estructura del Excel sigue siendo inmutable; desactivar un producto no autoriza eliminar su fila ni asignarle cero automáticamente.
