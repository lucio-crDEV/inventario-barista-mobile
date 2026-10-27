# Preparación remota completada — 27/10/2026

El usuario autorizó la preparación de Cloudflare y reservó el **push por SSH**. Pages conserva su integración Git, rama `inventory-v3`, build `npm run build:pages` y salida `dist`. La entrega queda incluida en un commit local por solicitud del usuario. No se ejecutó push ni despliegue manual de Pages.

- **D1:** esquema remoto anterior equivalente a las 57 definiciones esperadas de 0012. 0011 y 0012 ya estaban aplicadas y solo se registraron sus nombres; no se repitió su DDL. Se aplicó 0013 y pasó el preflight remoto. Catálogos 1227/1268 válidos. Antes/después: 209 conteos, 223 movimientos y 15 usuarios.
- **Recuperación previa:** bookmark interno D1 Time Travel guardado en la evidencia. La revisión automática rechazó descargar SQL completo por contener hashes y sesiones. No se descargó ni se intentó otra vía de descarga; se usó recuperación interna del proveedor. No se ensayó una restauración remota ni se forzó otro respaldo R2.
- **Avisos:** `inventory-realtime` publicado, objeto SQLite creado y sin URL pública. Binding `REALTIME` preparado en Pages Production y reflejado en `wrangler.pages.production.jsonc`. Variables, D1, preview y build preservados. El deployment actual de Pages no cambió.
- **Respaldos:** `inventory-private-backup` actualizado a `entry.js` con objeto SQLite `BACKUP_JOBS`; conserva bucket privado, ambos secretos, `BACKUP_ENABLED=1` y cron `17 5 * * *`. Se verificaron los bindings efectivos. Falta revisar una ejecución programada del nuevo código; publicar no certifica por sí solo un nuevo respaldo.
- **Paquete:** build de Pages aprobado, 45 recursos públicos exactos fuera del Worker. La batería local aprobada está en la evidencia previa; no se lanzó carga ni se crearon sesiones/cuentas de prueba en producción.

## Próximo paso del usuario

La entrega está preparada en un commit local. Desde la raíz del repositorio, hacer únicamente el push por SSH a `inventory-v3`. La carpeta `.backups/` sigue ignorada y nunca debe incluirse. No repetir migraciones ni desplegar manualmente Pages.

Después del push, comprobar Production/Success y el commit correcto. Verificar sesión, apertura WebSocket101, avisos entre teléfonos, métricas de la versión nueva y cuota efectiva. La configuración de avisos ya está preparada, pero el cliente nuevo entra en uso cuando termine ese deployment.

La comprobación pública anónima de esta sesión recibió **Cloudflare403/error1010** desde el entorno de ejecución. No se atribuyó a la app ni se certificó éxito del recorrido; esa verificación sigue pendiente. No se alteraron reglas de seguridad para evitar el bloqueo.

[Detalles y límites de la implementación](consumo-critico-2026-10-27.md). [Evidencia remota](consumo-activacion-2026-10-27.json). [Pruebas locales](consumo-verificacion-2026-10-27.json).
