Actualización 27/10: [corrección integral de consumo](consumo-critico-2026-10-27.md). Sustituye el recorrido local anterior por recolector unificado, consultas optimizadas y respaldo IBK2 por flujo/objeto privado; conserva los estados remotos fechados como históricos. Publicación pendiente.

# Ampliación de observabilidad — 26-10-2026

Actualización vigente 27/10: [corrección de métricas y cuotas del recolector](metricas-correccion-2026-10-27.md). Primera etapa local: entrega real de INP/CLS, recolector diario/horario unificado, depuración horaria acotada y diagnóstico D1 muestreado al 0,1 %. Sin dependencias ni migraciones nuevas, sin cambios remotos ni despliegue. Las optimizaciones de consultas, sincronización y R2 siguen pendientes por etapas. Esta actualización sustituye las descripciones anteriores del recolector; las verificaciones fechadas siguen siendo históricas.

Implementación autorizada: errores técnicos normalizados y versión; experiencia móvil LCP/INP/CLS; distribución de latencias; salud del recolector. Root sigue sin implementar. Ninguna API entrega estadísticas a los usuarios de la aplicación. El endpoint nuevo solo recibe agregados limitados.

## Implementación y límites

Migración aditiva 0011 después de 0010: `telemetry_hourly` y `collector_health`. No cambia inventarios, cuentas, auditoría ni la tabla previa `usage_daily`. Los informes anteriores continúan funcionando. [Consultas nuevas](metricas-ampliadas-consultas.sql).

El build genera la misma versión para navegador y Worker: revisión Git/CF_PAGES_COMMIT_SHA + fecha UTC del build. Cada lanzamiento separa sus datos, incluso un redeploy de la misma revisión. En ejecución local sin build Pages el Worker usa `development`; no confundirlo con una medición productiva. El cliente rechaza versiones distintas de la del servidor, para impedir dimensiones arbitrarias: pestañas antiguas pueden perder sus informes hasta recargarse.

Las solicitudes API, excluyendo el propio receptor de telemetría, aportan histogramas por hora UTC/versión/función/familia HTTP. Intervalos: <100, 100–<300, 300–<1000, 1000–<3000, 3000–<10000, 10000–<60000, >=60000 ms. La duración se limita a 60 s. No reconstruir percentiles exactos con estos intervalos: solo se conoce en qué intervalo cae un percentil aproximado. Errores 5xx aportan códigos o clases de una lista fija; no se conserva el mensaje ni la pila.

El navegador usa la biblioteca oficial [web-vitals 5.1.0, build estándar](https://github.com/GoogleChrome/web-vitals/tree/v5.1.0), empaquetada localmente, sin CDN ni servicio externo. LCP representa carga del contenido principal; INP, respuesta a interacciones; CLS, inestabilidad visual. Se almacenan las categorías good/needs_improvement/poor, cantidad y suma, sin IDs de métricas, DOM, elementos, búsquedas, URL, notas o cantidades. `mobile` solo significa ancho inicial <=767 px; no identifica dispositivo ni sistema operativo. INP ausente no se convierte en cero: puede faltar interacción o soporte del navegador.

Los errores de JavaScript no capturados/rechazos de promesas se reducen al nombre estándar TypeError/ReferenceError/SyntaxError/RangeError/Error/other. Los errores manejados por la interfaz y los ocurridos antes de cargar el módulo no están cubiertos. Máximo 20 errores por documento. El informe se envía al primer ocultamiento de cada visita/restauración BFCache, máximo cuatro por documento, sin reintentos ni almacenamiento persistente. Interacciones posteriores a volver a mostrar el mismo documento quedan fuera de esa muestra para evitar duplicar distribuciones sin identificadores. No equivale a seguimiento de usuarios únicos ni un censo completo de sesiones.

`POST /api/telemetry` solo acepta su origen configurado, JSON <=2048 bytes, versión actual, campos y dimensiones de listas fijas; rechaza extras y valores inválidos. Límite de 120 informes/minuto por isolate: protección acotada, no un límite global antiabuso. Transporte con credenciales omitidas y sin referrer; no consulta cuentas ni genera una cookie. No envía pilas, mensajes, texto, atributos ni IDs. Las capacidades técnicas del proveedor para procesar una conexión no cambian por este diseño. Desactivar METRICS_ENABLED evita la persistencia del recolector.

Ambos agregadores son aproximados. El nuevo limita memoria a 512 grupos y escribe por lotes al llegar una petición después de un minuto; el primero se envía inmediatamente. La salud se actualiza atómicamente en el lote exitoso: último envío correcto, observaciones guardadas, descartes conocidos, fallos de lotes anteriores y mayor espera del lote. Un fallo ambiguo se descarta sin reintentar para evitar duplicados. El siguiente lote exitoso registra esa pérdida como límite inferior. Una caída del isolate puede perder también los contadores pendientes: **no se puede conocer ni prometer la pérdida total**. Tampoco hay un heartbeat independiente: sin tráfico, una fecha antigua no demuestra fallo.

Se depuran solo estos agregados anteriores al corte por fecha de 90 días, en lotes limitados. Respaldos cifrados pueden conservarlos más tiempo. No se añade vigilancia personal, GPS, identificadores, capturas ni rankings. No se modifica la política de usuarios/roles.

## Validación y publicación

Pruebas de histogramas, privacidad, origen, validación atómica, versiones, recuperación tras fallo, lifecycle de navegador y ausencia de APIs de rendimiento. Build Pages con versión compartida y biblioteca alojada por el propio sitio. La simulación no certifica experiencia en dispositivos físicos ni implica que ya existan muestras de campo.

Antes de publicar: respaldo privado, aplicar 0011 a D1 y verificar tablas; ejecutar tests/build. Los nuevos datos empiezan cuando se publica este código: no reconstruyen métricas anteriores. Push/despliegue de aplicación sigue pendiente de autorización explícita.

## Estado comprobado de esta entrega

83 pruebas unitarias aprobadas; build Pages y allowlist de empaquetado aprobados; Chromium real capturó Web Vitals y error normalizado sin cookie, referrer ni contenido privado. Migración 0011 aplicada a D1 de producción después de respaldo privado `.backups/pre-observability-20261026`. Las cinco consultas nuevas funcionan sin escribir filas; tablas vacías, como corresponde antes de publicar la ampliación. Código aún sin commit/push/despliegue. El informe de producción distingue expresamente el acumulado diario del intervalo solicitado, que Workers Analytics no permitió obtener por cuota temporal.
