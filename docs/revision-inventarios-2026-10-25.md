# Inventarios, UX móvil y publicación — 25/10/2026

El usuario autorizó implementación y preparación de D1 online. Push y despliegue de la aplicación siguen pendientes; no confundir demo local con versión pública. Este documento sustituye propuestas anteriores sobre creación, predeterminado y telemetría.

## Decisiones implementadas

- Solo Administrador crea, activa y elimina inventarios. Eliminación archiva, conserva cantidades, historia y auditoría y bloquea cambios posteriores. La Jefa de servicio consulta únicamente Servicio, también en inventarios anteriores. Sus permisos existentes de revisión/reapertura de Servicio no se amplían a otras áreas.
- Tipos: Semanal, Fin de mes o ambos. Tres opciones directas sin dropdown: Semanal / Fin de mes / Ambos. El nombre es únicamente dd/mm/aaaa de la apertura, sin campos de nombre ni fecha editables; activar inmediatamente por defecto; desmarcar conserva preparado. Preparado no permite conteos. La configuración de catálogo anterior sigue siendo compatible.
- Inicio elige automáticamente el último creado entre activos (abierto o en revisión); sin activos, el último creado y finalizado. No obliga a escoger al ingresar. Sin activos ni finalizados muestra estado vacío y acceso administrativo a creación. Preparados se gestionan en Supervisión. La selección explícita viaja en la URL y aparece en contexto de trabajo. Cambiar inventario no traslada borradores.
- Crear/activar/reabrir advierte ante otros activos; semanal compara semana lunes-domingo, mensual compara mes, y ambos participa de ambos períodos. Puede continuarse expresamente. El servidor vincula confirmación a la revisión actual de la lista; cambios concurrentes exigen revisar otra vez. Motivo de reapertura sigue obligatorio. Comandos auditados e idempotentes; un resultado incierto exige reintentar el mismo comando.
- «últ. inventario» a la izquierda del botón usa la creación más reciente de cualquier tipo. Hoy; hace 1–6 días; desde siete días fecha dd/mm/aaaa, usando America/Santiago. Fechas heredadas desconocidas no se inventan.
- Domingo y último día del mes: recuadro ámbar solo para Administrador en Inicio, con recomendación única si coinciden. X superior derecha y colapso suave de 180 ms. Cierre por administrador y día se conserva entre sesiones/pestañas en el mismo navegador; no sincroniza otros dispositivos. Movimiento reducido evita animación.
- Servicio despliega sus subáreas; Garzones sus zonas, con anillos/contados/avances/pendientes/inactivos reales. Se conserva expansión y posición al refrescar. Por indicación posterior del usuario se retiran los enlaces redundantes «Ver resumen de Servicio/Garzones». La pestaña Áreas omite el selector redundante, otras pestañas conservan filtros útiles.
- Notificaciones accionables/errores persistentes al inicio del formulario o debajo de encabezado; éxito breve flotante arriba. Nunca bajo todo el contenido. Sincronización breve, sin detalles internos ni pérdida de borradores.
- Conteo compacto: estado a la derecha de metadatos, sin texto redundante sobre cero. Acciones Sin stock/Avance/Listo accesibles junto al teclado mediante visualViewport, sin duplicar formularios. Formularios no abren teclado por defecto; inputs de 16 px evitan zoom automático habitual en iOS. Se conservan zoom voluntario y foco accesible de teclado con cambios suaves de fondo o luminosidad, sin subrayados, sin bordes activos táctiles.

## Migraciones y preparación online

0008_inventory_cycles.sql es aditiva: metadatos de ciclos, registro de revisión, comandos y guardas. 0009_usage_metrics.sql crea solo agregados de uso. 0010_inventory_opening_date.sql actualiza el trigger para que un preparado adopte la fecha real al activarse, sin cambiar inventarios ya existentes. Se ejecutan después de 0007. No aplicar 0005 histórica ni fixtures a producción.

Antes de cambiar D1 se creó respaldo SQL privado con checksum, restaurado en destino local nuevo, con integridad y claves foráneas válidas y sesiones recuperadas revocadas. Rutas de los respaldos y evidencia agregada quedan en el informe JSON de verificación; el SQL no se incluye en Git ni assets.

0008, 0009 y 0010 ya se aplicaron a D1 online y la comprobación completa de esquema/catálogo pasó, sin migraciones pendientes. Production de Pages ya tiene METRICS_ENABLED=1 y se conservaron las variables y binding DB existentes. Código d4c50da publicado en producción; registro real de métricas comprobado el 25/10 a las 12:45 Chile. Archivo wrangler.pages.production.jsonc actualizado. El bucket inventario-backups está creado y se verificó que no tiene URL pública ni dominios. Hay configuración privada y clave local de cifrado en .backups/automation-20261025, excluidas de Git. Worker inventory-private-backup activo con BACKUP_ENABLED=1 y secretos configurados; copia cifrada real recuperada y verificada (19 tablas, 2.755 filas, integridad/FK correctas). Cron diario 05:17 UTC; crea copia cada 90 días desde el último éxito. Instrucciones: [instrucciones](metrics-backup-2026-10-25.md). No se activa facturación ni se copian credenciales a archivos versionados.

## Verificación y límites

70/70 pruebas Node, 7/7 Python y contrato Excel sin diferencias. Las 24 etapas de seguridad/API/navegador/Pages/recuperación pasan considerando la ejecución completa y las repeticiones focalizadas después de corregir dos fallos. Suites nuevas mobile-ux/cycle-ui y revisión de cuenta/supervisión aprobadas. Simulación: 15 clientes, 528 solicitudes, 151 escrituras, 150 reintentos deduplicados, 14 conflictos esperados, cero errores inesperados. No se ejecutó carga sobre producción.

Resultados nuevos y estado remoto en revision-inventarios-verificacion-2026-10-25.json. Las simulaciones usan bases desechables independientes de demo y producción. El teclado se verifica con visualViewport simulado: Android/iOS físicos y aceptación operativa siguen pendientes. Tiempos locales no certifican cuotas CPU de Cloudflare Free.

La recuperación de contraseña de admin-prueba se hizo únicamente en la base de demo autorizada, con respaldo previo y auditoría. No se cambiaron credenciales reales ni se debilitó la revocación de sesiones al cambiar contraseña.

## Publicar

1. Revisar diff y ejecutar verificación documentada. Comprobar 0008/0009/0010 y METRICS_ENABLED=1 en D1/Pages.
2. Crear commit y hacer push a inventory-v3 por decisión del usuario. Build Pages: npm run build:pages; salida dist. No publicar raíz ni libros.
3. Verificar deployment y comprobaciones públicas. No ensayar escrituras ni carga sobre cuentas reales por este paso.
4. El Worker de respaldo separado ya está activo y recuperado. Custodiar la clave fuera del equipo/Cloudflare y revisar fallos y antigüedad de copias.

No revertir migraciones borrando tablas/ciclos. Un rollback de assets exige comprobar compatibilidad del esquema; las estructuras aditivas preservan la información anterior.

## Ajustes posteriores de navegación — 25/10/2026

«Inventario seleccionado» reemplaza «Inventario de trabajo». Inicio muestra un selector compacto y botón cian suave con + Crear inventario. El selector abre un diálogo con activos primero (punto verde y texto pequeño Activo), históricos agrupados por mes/año, búsqueda por fecha/nombre, filtro de año y páginas de 24 filas. No se montan todos los años en el DOM. Utiliza los metadatos ya autorizados por /api/cycles, sin ampliar permisos ni paginar conteos. Cambiar requiere confirmación, conserva borradores por ciclo y parámetros área/sector/zona; cancelar conserva la búsqueda y posición. El inventario actual también se identifica en el listado. Preparados/eliminados no son inventarios de trabajo; su gestión continúa en Supervisión.

Dentro de áreas, subáreas y zonas, selector y creación pasan al menú derecho. Sus filas comparten inset de 12 px y mínimos táctiles de 44 px. Perfil y cierre de sesión mantienen jerarquía sin bordes activos. Advertencias de posible duplicado van inmediatamente antes de las acciones, junto a Continuar de todas formas; los errores de ejecución siguen al inicio.

Al entrar desde una categoría, abrir una zona de Garzones o recargar una ficha de conteo, el listado izquierdo se abre automáticamente con foco en el panel, sin teclado. Al recargar se restaura la ficha por ID autorizado y el borrador asociado; solo se guarda presentación en sessionStorage por usuario/inventario/ámbito. Entrar de nuevo desde otra página mantiene el selector de categorías. Elegir un producto lo cierra; Siguiente, guardados y consultas desde Resumen conservan la navegación directa y no lo reabren en cada actualización. Borradores y conteos permanecen aislados por inventario.

### Verificación de esta continuación

- `npm test`: **72/72**; conserva las 70 anteriores y añade historial por varios años/páginas/estado por ámbito.
- `node tests/shared/cycle-ui.mjs`: aprobado, incluidos 182 inventarios, búsqueda, año, 24/48 filas, cancelación y permisos.
- `node tests/shared/mobile-ux.mjs`: aprobado, error persistente al inicio, foco sin teclado, campos 16 px y acciones con visualViewport simulado.
- `node tests/shared/inventory-navigation.mjs`: 3 grupos aprobados contra D1 local aislada; categoría/recarga/zona, borradores, menú, advertencia junto a acciones, 320/390/654 y ambos temas, cero errores de página.
- `node tests/shared/ux.mjs`: 8 grupos aprobados, permisos retirados, skeletons, guardado sin duplicar, historial y respuesta perdida; cero errores de página.
- `npm run build:pages` y `node tests/shared/package-security.mjs`: aprobados, sin archivos internos/secretos/symlinks en assets.
- Revisión visual en navegador adjunto de Inicio, selector, menú derecho y apertura automática del listado. Teclado y zoom reales en teléfono físico siguen pendientes.
- Recuperación cifrada real y activación del Worker verificadas según el documento de respaldo. No se desplegó la app ni se hizo push.

El servidor de pruebas se reinició después de preparar su base: no usar una conexión workerd anterior a la recreación del estado local, porque mantiene referencias al archivo antiguo. La demo y D1 remota permanecen separadas de esas pruebas.

## Verificación de métricas online — 25/10/2026, 12:45 Chile

Producción publica d4c50da (deployment b06ff3d2-e56b-4c0c-8596-e50576b0f780). Se comprobó por API la variable METRICS_ENABLED=1 y el binding de D1 esperado. Había 52 solicitudes agregadas en la lectura de base; al terminar, 64 en 12 grupos. Dos GET /api/status sin sesión devolvieron 401 como estaba previsto y aumentaron exactamente en dos el agregado status/GET/4xx, después de esperar el intervalo de un minuto. El resto del incremento corresponde a otras peticiones observadas; no se atribuye a personas ni a nuestra prueba. No se iniciaron sesiones ni se alteraron cuentas/inventarios.

Tabla con solo las siete columnas previstas, cero agregados inválidos; las dos pruebas focalizadas de opt-in/agregación/retención y aislamiento de fallos pasaron. La agrupación es aproximada por isolate y se vacía cuando llega otra petición tras un minuto; no es tiempo real garantizado ni mide usuarios únicos o CPU. [Evidencia agregada](metrics-production-verification-2026-10-25.json).

## Corrección de foco y selección — posterior al despliegue d4c50da

El subrayado provenía de la regla global :focus-visible que incluía cualquier [tabindex]. Al enfocar programáticamente un panel, text-decoration se propagaba visualmente a sus descendientes. Se retiraron los subrayados de foco en toda la app, incluido el selector de tipo de inventario. Los contenedores dejan de recibir ese tratamiento; los controles con teclado usan luminosidad o fondo suaves. No se añaden bordes ni cambios de tamaño/posición al recibir foco. Se conserva el foco programático del panel para no abrir el teclado móvil.

También se retiraron el borde cian y la línea lateral del ítem seleccionado: se conserva únicamente el fondo suave. El selector antiguo .is-active no correspondía al estado real .is-current; se eliminó esa regla sobrante. Esta corrección de CSS está preparada localmente para el siguiente push/despliegue; producción d4c50da todavía contiene el estilo anterior.

Comprobación: mobile-ux aprobado con foco explícito de panel/ítem/menú, búsqueda/teclado, 320/390/654 y temas claro/oscuro; ausencia de subrayado en toda la cadena de ancestros, borde transparente y ausencia de línea lateral en el seleccionado, foco de teclado visible en el control. cycle-ui aprobado con el tipo semanal enfocado sin subrayado y recorridos de selección/creación conservados. No se modifican API, permisos, conteos ni esquema D1.
