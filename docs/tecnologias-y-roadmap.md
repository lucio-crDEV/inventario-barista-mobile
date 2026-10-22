# Tecnologías y recorrido hasta la primera versión funcional

Estado comprobado el **22-10-2026**, rama `inventory-v3`, código recuperado/publicado `cfece26`, despliegue canónico `7df21f3c` correcto. Funcionamiento informado por el usuario; aceptación operativa abierta. Free se mantiene y Supabase no está integrado ni es obligatorio. [Revisión nueva](revision-hermes-2026-10-22.md), [roadmap](roadmap.md), [verificación](verification.md).

## Qué usa la aplicación y para qué

| Tecnología | Función en este proyecto |
| --- | --- |
| HTML, CSS y JavaScript nativos | Pantallas móviles, formularios, navegación, temas, skeletons y transiciones. Sin framework de interfaz. |
| SVG | Iconos y progreso con apariencia consistente, incluidos menú, ojos y controles. |
| API HTTP/JSON y Fetch | Comunicación del navegador con el servidor del mismo origen; cantidades confirmadas solo después de respuesta aceptada. |
| Cloudflare Pages | Publicación del sitio desde GitHub: compila con `build:pages` y sirve `dist`. |
| Cloudflare Workers | Ejecuta la API y protege rutas: identidad, permisos, validaciones, guardados y sincronización. En Pages se empaqueta como `_worker.js`. |
| Cloudflare D1 / SQLite | Persistencia compartida de usuarios, sesiones, ámbitos, ciclos, conteos, operaciones, historial y auditoría. Triggers validan y aplican cada conteo atómicamente. |
| bcryptjs 3.0.3 | Contraseñas con sal y coste 12, mínimo ocho caracteres. `exceededCpu` histórico tras reparar D1; dos errores `exceededResources` posteriores a `cfece26`, sin ruta ni diagnóstico CPU individual. Falta atribución/presupuesto sostenido Free, no se presume caída permanente. |
| Cookies HttpOnly/Secure/SameSite | Sesión autenticada; el navegador no guarda su secreto en localStorage. El servidor resuelve rol y permisos. |
| localStorage | Borradores aislados por usuario/ciclo, preferencia de tema y espera del refresco. Conserva datos locales antiguos sin importarlos. No sustituye D1. |
| Consultas incrementales con cursor | Sincronización de cambios autorizados, cada cinco segundos con pantalla visible; se pausa al ocultarse. Sin WebSockets ni Durable Objects. |
| Node.js 24, npm, Wrangler y workerd | Herramientas de desarrollo, dependencias, compilación y ejecución local del entorno Workers/D1. |
| esbuild 0.28.2 | Empaqueta el servidor para Pages, sin cambiar la interfaz a otro framework. |
| Playwright 1.56.1, pruebas Node y Python | Recorridos de navegador, API/integración, concurrencia, contrato del libro y primer administrador. Bases de ensayo separadas de desarrollo/producción. |
| Git y GitHub | Historia y ramas. Los pushes de `inventory-v3` disparan la integración de Pages; `inventory-v2` conserva la base anterior. |
| Libros Excel originales | Referencia de filas, identificadores, unidades y reparto físico; no se modifican. El generador de salida es futuro, etapa 4. |

Las versiones de dependencias están fijadas en `package.json`; Node es una herramienta local/build y Workers usa su propio runtime en producción. La arquitectura actual no promete conteo offline completo. El refresco manual del menú admite un intento cada 30 segundos por usuario en el navegador; reutiliza sincronización reciente/en curso y no envía borradores. Ese control no equivale a una cuota global del servidor.

## Recorrido de una operación

```mermaid
flowchart LR
    U[Teléfono o navegador] --> P[Pages: HTML, CSS, JS]
    U -->|Cookie y solicitud JSON| W[Worker: sesión y permisos]
    W -->|Validación y escritura atómica| D[(D1: conteos e historial)]
    D -->|Resultado y versión| W
    W -->|Solo datos autorizados| U
    U -.-> B[Borradores locales por usuario y ciclo]
    G[GitHub: inventory-v3] -->|Build automático| P
    G -->|Worker empaquetado| W
```

## Dónde vamos

```mermaid
flowchart TD
    E1["1 · Catálogo y navegación incorporados"] --> E2["2 · Revisión física y unidades pendiente"]
    E1 --> A["3A · Implementada y probada localmente"]
    A --> WEB["Demo cfece26: D1/ciclo listos, 16 GET aprobados; usuario confirma funcionamiento"]
    WEB --> OPS["Pendientes 3A: atribuir errores por recursos y validar Free, producción completa, recuperación, Android y piloto"]
    A --> B["3B · Usuarios/Servicio implementado y publicado; supervisión pendiente"]
    B --> ADMIN["3B · Rectificar/anular, activar, revisar, cerrar y reabrir"]
    ADMIN --> E4["4 · Exportación fiel de Excel, aún sin implementar"]
    E2 --> E4
    E4 --> V1["Primera versión funcional aceptada"]
    OPS --> V1
```

La revisión física de etapa 2 y los pendientes de aceptación de 3A pueden avanzar en paralelo al desarrollo de 3B. El piloto del equipo está aplazado por decisión del usuario; no impide implementar 3B. El diagrama muestra dependencias y trabajo pendiente, no fechas ni aprobación operativa.

| Etapa | Qué está incorporado o comprobado | Qué falta |
| --- | --- | --- |
| 1 — Catálogo y navegación | Jerarquía real y navegación móvil; contrato de **1.151 filas** sin diferencias y **41 referencias Vitrina** cotejadas. Catálogo nuevo: **1.268 entradas**; anterior: **1.227**, conservadas por ciclo. | Decisiones físicas/unidades en etapa 2. El contrato no prueba exportación. |
| 2 — Revisión operativa | Grupos prácticos separados de referencias de salida; pendientes identificados. | Cinco unidades de Pastelería, 18 entradas de Barra sin referencia, dos conversiones y organización física de Mercadito. Sin equivalencias inventadas. |
| 3A — Usuarios y conteo compartido | Cuentas/ámbitos, aislamiento, guardados propios, Descartar/Sumar/Sobrescribir, historial, reintentos, borradores y UX. Suites locales de API/navegador/HTTPS/recuperación. Simulación local: **15 clientes, 496 solicitudes, cero errores inesperados, 14 conflictos esperados**. | Aceptación operativa: CPU/plan/consumo, conteos y permisos entre varias personas en el dominio, atributos de cookie allí, recuperación remota/copia externa, Android y piloto. Transición revisada de datos locales antiguos pendiente. |
| Publicación actual | `cfece26` / `7df21f3c` confirmado, **16/16 GET** y cinco assets coincidentes. Usuario confirma funcionamiento; ingreso/cierre y recorrido administrativo del 21-10 son históricos. D1/ciclo ya preparados; siete cuentas en informe histórico. | Dos errores por recursos posteriores, sin ruta ni diagnóstico individual. No certifica estabilidad autenticada/carga ni completa aceptación operativa. |
| 3B — Supervisión y administración | Usuarios/Servicio implementado, probado localmente y recuperado/publicado en `cfece26`. [Contrato](usuarios-y-servicio-3b.md), [criterios](etapa-3b.md). El servidor rechaza operaciones nuevas en ciclo cerrado; recuperar un resultado idempotente anterior no escribe ni reabre. | Tablero, historial administrativo avanzado, rectificación/anulación auditadas, activación operativa y flujo de revisión/cierre/reapertura. **El tablero y esas mutaciones de conteo siguen sin implementar.** |
| 4 — Excel | Estructura original y referencias conservadas como contrato de salida. | Generación y validación del libro: solo cantidades, consolidación de ubicaciones con conversiones aprobadas, estructura/fórmulas/referencias intactas. **No implementada.** |

La primera versión funcional completa requiere terminar 3B y 4, resolver lo aplicable de etapa 2 y aprobar los pendientes operativos de 3A. Desactivar un producto no confirma cero ni borra filas del Excel. Anular o rectificar conservará auditoría; no se autoriza destruir historial. Pedido, SMS/correo y conteo offline completo quedan fuera de esta versión.

## Qué leer para continuar

- [Contexto y decisiones confirmadas](project-context.md), [accesos](accesos-y-administracion.md) y [guía visual](style-guide.md).
- [Pendientes y recuperación de 3A](cierre-tecnico-3a.md), [verificación detallada](verification.md) y [operación local](operacion-3a.md).
- [Primer incremento de 3B y sus límites](etapa-3b.md).
- [Despliegue automático y revisión del sitio](despliegue-pages.md). Los cambios solo documentales no requieren migraciones ni volver a crear el administrador.
