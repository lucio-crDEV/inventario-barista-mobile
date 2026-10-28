# Arquitectura y operación

Estado de trabajo: etapa 4D y revisión de rendimiento del 28-10-2026. La evidencia fechada de 4D identifica qué se preparó remotamente y qué sigue pendiente del push. No asumir que el código local ya está publicado.

## Recorrido actual

Pages sirve HTML protegido y recursos estáticos empaquetados. La ausencia de sesión redirige al ingreso antes de descargar el inventario. Los archivos públicos están limitados a HTML y paquetes JS/CSS generados; el catálogo completo, las migraciones, libros y código privado no se sirven como archivos.

El Worker valida entorno/origen, contrato de despliegue y sesión; después aplica autorización de la operación. Cada escritura mantiene idempotencia, revisión esperada, autorización transaccional y auditoría. D1 conserva usuarios, permisos, inventarios, conteos, historial y capturas inmutables. Los objetos privados ejecutan sincronización, exportación y trabajo costoso. R2 conserva respaldos cifrados y copias Excel en depósitos separados, privados.

La aplicación es de un local: las áreas y catálogos aprobados se concentran en `shared/deployment-domain.js`; los ítems y referencias pertenecen a `data/inventario/`. Centralizar estos datos no convierte la aplicación en una plataforma multilocal ni autoriza otras plantillas.

## Reglas y fronteras

| Responsabilidad | Fuente |
| --- | --- |
| Sesión, cuota y credenciales | `worker/session.js`, `worker/password.js` |
| Identidad y ámbitos | `worker/authorization.js`, vistas de permisos |
| Validación del comando de conteo | `worker/count-contract.js` |
| Coherencia, versión, idempotencia y auditoría atómicas | Triggers de operaciones, supervisión e inventarios |
| Interpretación de errores de D1 | `worker/db-errors.js` |
| Lecturas y proyección permitida | `worker/inventory-queries.js` |
| Catálogos aprobados y nombres históricos | `shared/deployment-domain.js` |
| Captura, consolidación y fidelidad | `worker/export-snapshots.js`, `export-plan.js`, `excel-generator.js` |
| Construcción pública | `scripts/build.mjs`, `build-pages.mjs` |

Los triggers no se eliminan para reducir su número: protegen transacciones y carreras que una validación previa en JS no puede impedir. Las reglas que cambian una guarda necesitan una migración revisada. El contrato de comandos, pruebas de concurrencia y esta tabla permiten localizar esa modificación. D1 entrega las excepciones de RAISE dentro de texto; un decodificador central acepta códigos completos y el formato del proveedor. Un texto que solo contenga una palabra como STALE no se convierte en un conflicto de negocio.

## Cambios de rendimiento y mantenimiento

- El navegador recibe paquetes minificados con hash y caché inmutable; `modulepreload` adelanta sus dependencias. Las hojas CSS se combinan por página. Solo `/assets/*` evita la invocación del Worker; se elimina el techo de una regla por archivo. HTML y API conservan comprobaciones y `no-store`.
- `/api/summary` usa agregación SQL; `/api/search` selecciona productos autorizados en SQL. No hidratan conteos, ámbitos e historial mediante `boot()`. Se conserva búsqueda literal, actividad, alcance y correspondencia de mayúsculas españolas.
- Un índice por versión y expresión de área evita cambiar la forma histórica del catálogo para optimizar sus lecturas. Promover más campos a columnas requiere medir antes el beneficio.
- El contrato 15 comprueba una versión explícita, contadores de catálogo y presencia de las guardas/vistas requeridas. Deja de serializar y comparar todas las definiciones SQL en cada petición. D1 no permite `PRAGMA schema_version`.
- El preflight sigue comparando las definiciones completas selladas y las cardinalidades reales. Un índice ajeno no derriba el servicio; una guarda ausente sí. Alterar una guarda conservando su nombre se detecta en el preflight, no comparando su definición en cada petición. Este es el límite deliberado de la comprobación ligera.
- Las cardinalidades aprobadas siguen existiendo como datos de despliegue: protegen la correspondencia del libro. No se eliminan ni se infieren para aceptar silenciosamente un catálogo diferente.
- `escapeHtml` tiene una única implementación compartida. La división por vistas y una plantilla con escape automático se evalúan como una refactorización posterior, con pruebas de interfaz; no se atribuye a esta entrega una conversión total de las pantallas.

## Cambiar el esquema o el catálogo

1. Crear una migración aditiva y sus pruebas sobre SQLite y D1 local. No editar migraciones históricas ni borrar datos para que las pruebas pasen.
2. Si cambia una capacidad requerida, actualizar contrato/manifest y comprobar compatibilidad con la versión publicada. La versión no sustituye las guardas de permisos.
3. Sellar la definición completa al final de la migración revisada, nunca mediante un arreglo genérico que acepte DDL desconocido.
4. Ejecutar preflight completo antes y después de la migración; no publicar con un fallo. Los fixtures y bootstrap son exclusivamente locales.
5. Los cambios de catálogo futuros deben importarse mediante una herramienta de datos validada y transaccional, separando contenido y esquema. Las dos migraciones históricas con catálogo no se reescriben: instalaciones existentes dependen de ellas.

## Entrega y operación

GitHub Actions usa Node 24, `npm ci`, pruebas unitarias y la batería aislada con navegador/base ficticios. No recibe credenciales de producción ni despliega. Publicar sigue siendo un push del usuario; un fallo del workflow informa del problema, pero no bloquea por sí solo un despliegue Git integrado de Pages. Una regla de protección o publicación condicionada a CI es una decisión separada.

Solo `dist` se entrega a Pages. No se genera un ZIP de la carpeta de trabajo; los respaldos, capturas privadas, `.git`, dependencias y credenciales quedan fuera. Los IDs de cuenta/base/bindings de la configuración no son secretos. No se trasladan sin necesidad a variables; los tokens y claves permanecen en secretos del proveedor o en archivos locales ignorados. No se rota una clave a ciegas: una exposición confirmada exige revocación y un plan para las copias cifradas anteriores.

La limpieza diaria elimina como máximo 1.000 sesiones y 1.000 claves de intentos vencidas desde hace dos días. No elimina usuarios, inventarios, historial, comandos idempotentes, capturas ni Excel. La cadencia de respaldos sigue siendo de 90 días y no cambia por la nueva limpieza.

## Decisiones y propuestas evaluadas

| Propuesta | Estado y motivo |
| --- | --- |
| Workers Paid | Rechazado por ahora: se mantiene Free. No se cambia la suscripción. |
| Dependabot | Pendiente por decisión del usuario. No hay configuración ni activación remota. CI sí está autorizado. |
| Alertas 1102 | Los límites del proveedor pueden terminar la petición antes de que se registre la métrica propia. Consultar errores/CPU en Cloudflare; no afirmar cobertura de alertas automáticas ni medición productiva por una prueba local. Definir canal y mecanismo antes de activar avisos externos. |
| Offline y app shell | Pendiente: definir caché por identidad, borrado al salir, información permitida en teléfonos compartidos y comportamiento de escritura/reconexión. Los borradores actuales no equivalen a abrir sin red. |
| TOTP, mínimo 12 para admin, claves comunes e inactividad | Pendiente: definir recuperación y transición de cuentas, sesiones y pantallas; no aplicar requisitos nuevos silenciosamente. |
| «Cerrar otras sesiones» | Pendiente de diseño de sesión/dispositivo y confirmación; no confundir con cambiar contraseña, que ya revoca todas. |
| Plantilla `html` y lint para HTML dinámico | Pendiente de refactorización progresiva; requiere inventariar los puntos existentes para no prometer protección que aún no cubra la aplicación. |
| Partir vistas de inventario | Próximo refactor si aporta cambios más pequeños; debe conservar borradores, foco, navegación, resumen y sincronización. El empaquetado ya evita la cascada de descargas. |
| Campos JSON a columnas | Área optimizada con índice de expresión; promover el resto solo con una consulta y medición que lo justifiquen. |
| Retención de Excel | Se conservan las copias; no se aprueba borrado automático ni archivo por antigüedad en esta entrega. |

Referencias del proveedor: [límites de Workers](https://developers.cloudflare.com/workers/platform/limits/), [objetos SQLite y plan Free](https://developers.cloudflare.com/durable-objects/platform/pricing/), [error 1102](https://developers.cloudflare.com/workers/observability/errors/), [bindings de Pages](https://developers.cloudflare.com/pages/functions/bindings/).
