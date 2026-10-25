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
- Conteo compacto: estado a la derecha de metadatos, sin texto redundante sobre cero. Acciones Sin stock/Avance/Listo accesibles junto al teclado mediante visualViewport, sin duplicar formularios. Formularios no abren teclado por defecto; inputs de 16 px evitan zoom automático habitual en iOS. Se conservan zoom voluntario y foco accesible de teclado con fondo/subrayado, sin bordes activos táctiles.

## Migraciones y preparación online

0008_inventory_cycles.sql es aditiva: metadatos de ciclos, registro de revisión, comandos y guardas. 0009_usage_metrics.sql crea solo agregados de uso. 0010_inventory_opening_date.sql actualiza el trigger para que un preparado adopte la fecha real al activarse, sin cambiar inventarios ya existentes. Se ejecutan después de 0007. No aplicar 0005 histórica ni fixtures a producción.

Antes de cambiar D1 se creó respaldo SQL privado con checksum, restaurado en destino local nuevo, con integridad y claves foráneas válidas y sesiones recuperadas revocadas. Rutas de los respaldos y evidencia agregada quedan en el informe JSON de verificación; el SQL no se incluye en Git ni assets.

0008, 0009 y 0010 ya se aplicaron a D1 online y la comprobación completa de esquema/catálogo pasó, sin migraciones pendientes. Production de Pages ya tiene METRICS_ENABLED=1 y se conservaron las variables y binding DB existentes. El código nuevo aún no está desplegado; la recolección empezará al publicar esta versión. Archivo wrangler.pages.production.jsonc actualizado. El bucket inventario-backups está creado y se verificó que no tiene URL pública ni dominios. Hay configuración privada y clave local de cifrado en .backups/automation-20261025, excluidas de Git. Worker inventory-private-backup ya desplegado sin URL pública y con BACKUP_ENABLED=0; clave cargada como secreto. Falta token dedicado CF_BACKUP_TOKEN (D1 Edit) y activar/ensayar el respaldo; los respaldos programados todavía no están operativos. Instrucciones: [instrucciones](metrics-backup-2026-10-25.md). No se activa facturación ni se copian credenciales a archivos versionados.

## Verificación y límites

70/70 pruebas Node, 7/7 Python y contrato Excel sin diferencias. Las 24 etapas de seguridad/API/navegador/Pages/recuperación pasan considerando la ejecución completa y las repeticiones focalizadas después de corregir dos fallos. Suites nuevas mobile-ux/cycle-ui y revisión de cuenta/supervisión aprobadas. Simulación: 15 clientes, 528 solicitudes, 151 escrituras, 150 reintentos deduplicados, 14 conflictos esperados, cero errores inesperados. No se ejecutó carga sobre producción.

Resultados nuevos y estado remoto en revision-inventarios-verificacion-2026-10-25.json. Las simulaciones usan bases desechables independientes de demo y producción. El teclado se verifica con visualViewport simulado: Android/iOS físicos y aceptación operativa siguen pendientes. Tiempos locales no certifican cuotas CPU de Cloudflare Free.

La recuperación de contraseña de admin-prueba se hizo únicamente en la base de demo autorizada, con respaldo previo y auditoría. No se cambiaron credenciales reales ni se debilitó la revocación de sesiones al cambiar contraseña.

## Publicar

1. Revisar diff y ejecutar verificación documentada. Comprobar 0008/0009/0010 y METRICS_ENABLED=1 en D1/Pages.
2. Crear commit y hacer push a inventory-v3 por decisión del usuario. Build Pages: npm run build:pages; salida dist. No publicar raíz ni libros.
3. Verificar deployment y comprobaciones públicas. No ensayar escrituras ni carga sobre cuentas reales por este paso.
4. Activar Worker de respaldos separado una vez creado bucket y configurados secretos. Validar primer respaldo cifrado y recuperación antes de considerarlo operativo.

No revertir migraciones borrando tablas/ciclos. Un rollback de assets exige comprobar compatibilidad del esquema; las estructuras aditivas preservan la información anterior.
