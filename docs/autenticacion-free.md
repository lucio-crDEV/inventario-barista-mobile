# Autenticación en Workers Free — punto de continuación 22-10-2026

Refuerzo posterior local: cuotas a derivación administrativa y peticiones autenticadas, Retry-After/backoff, logs mínimos; las métricas para admin de esa revisión se retiran el 23-10, con persistencia desactivada y Root solo diseñado. No cambia bcrypt 12 ni resuelve/certifica CPU Free. [Pruebas, riesgos y medición remota pendiente](seguridad-observabilidad-3a.md). No integración Supabase ni cambios de facturación.

## Estado vigente — 22-10-2026

El usuario publicó `cfece26` y confirmó funcionamiento. Pages confirma ese commit en el despliegue canónico `7df21f3c`, terminado correctamente; los 16 GET públicos pasan. D1 ya se reparó. Las métricas posteriores de Pages muestran dos errores `exceededResources` a las 17:18 UTC / 14:18 -03; no incluyen ruta ni `outcome=exceededCpu`, por lo que no prueban que fueran ingresos ni precisan la causa individual. **Free se mantiene; Supabase sigue como alternativa sin integrar, no una tarea obligatoria.** [Evidencia nueva y límites](revision-hermes-2026-10-22.md), [traspaso](traspaso-hermes.md).

La recurrencia de errores por recursos sí tiene evidencia posterior a la recuperación, pero falta correlacionar solicitudes/CPU concretas. Esta sesión solo leyó metadatos/métricas y rutas anónimas: no ejecutó ingresos, altas, cambios ni restablecimientos remotos. Esos ensayos escriben estado y requieren autorización específica antes de realizarlos. No se cambian proveedor, coste bcrypt ni facturación a partir de agregados.

## Estado anterior a la publicación de cfece26 (histórico)

En la propuesta anterior se consideró preparar Supabase Free; esa decisión quedó subordinada a comprobar el comportamiento actual. No hay integración en el código ni se configuró el proyecto durante esa revisión. La recuperación no incorpora un cambio de derivación ni una corrección específica de CPU. No convierte esa alternativa en la próxima tarea aprobada.

El usuario revirtió y subió `55dfc2b`, cuyo árbol coincidía con `5d80658`. Después aclaró que la reversión era temporal y pidió recuperar todos los cambios. Se restituyeron localmente los cambios de `9dfef56`, `94d3a83` y `2c284cd`: Jefa de servicio, gestión de cuentas, reparto de Servicio, diseño móvil y documentación. No se hizo push ni despliegue en esta revisión. `inventory-v2` no se modifica.

La comprobación pública después del push de reversión obtuvo Cuenta 200 y `/api/me` 401 JSON. Los archivos Cuenta y cliente compartido coincidían con el código revertido; no se probó ingreso autenticado en esa comprobación. Antes de revertir, una solicitud real produjo 503/1102 y el log confirmó `exceededCpu`; tanto la versión anterior como la recuperada usan bcryptjs coste 12.

Git no retrocedió D1/Pages. La corrección remota previa conserva migraciones 0003/0004, ciclo `piloto-v3-servicio` y siete cuentas mínimas. Los informes del diagnóstico están en [despliegue-demo-3b.json](despliegue-demo-3b.json) y [verificación](verification.md). No repetir primer administrador, fixtures ni migraciones ya aplicadas.

Hubo dos fallos distintos: el primer `NOT_INITIALIZED` ocurrió porque el nuevo código exigía una vista que aún no existía en D1; el posterior `exceededCpu` ocurrió en un ingreso real después de corregir la inicialización. El módulo de contraseñas es idéntico entre `5d80658` y `2c284cd`. La reversión elimina dependencias nuevas, pero no bcrypt; una sesión ya abierta no vuelve a derivar la contraseña. No hay perfil remoto comparativo que pruebe por qué un ingreso anterior concreto funcionó y otro no.

## Alternativa estudiada, condicionada a la evaluación actual

Propuesta no aprobada para implementar ahora: delegar verificación de contraseñas en **Supabase Auth Free**, conservando formulario, cookie HttpOnly, UUID D1, roles, permisos, conteos e historial. No sería una migración del inventario. El usuario seguiría usando username sin correo/teléfono obligatorio; su correspondencia con la identidad Auth todavía debe diseñarse y probarse, porque Supabase usa email/teléfono de forma nativa. [Referencia consultada durante la propuesta](https://supabase.com/docs/guides/auth/passwords).

Workers Free limita CPU a 10 ms por petición; esperar red no consume ese presupuesto. Delegar la derivación evita ejecutarla en JavaScript dentro del Worker, pero la compatibilidad deberá comprobarse realmente en Free. [Límites](https://developers.cloudflare.com/workers/platform/limits/). No reducir bcrypt ni sustituirlo por un hash rápido. El PBKDF2 nativo tampoco está aprobado: límite predeterminado de 100.000 iteraciones frente a las recomendaciones OWASP de 600.000 SHA-256 o 220.000 SHA-512. [Runtime](https://github.com/cloudflare/workerd/blob/main/src/workerd/io/limit-enforcer.h), [ampliación aún pendiente en esta revisión](https://github.com/cloudflare/workerd/pull/7550), [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

En la investigación anterior se consultaron cuotas y pausas de Supabase Free; revalidarlas si se elige esta alternativa, no tomarlas como garantía actual de capacidad/disponibilidad. [Precios](https://supabase.com/pricing), [pausas](https://supabase.com/docs/guides/platform/free-project-pausing). Auth0 también se estudió; no se seleccionó ni integró ningún proveedor nuevo.

## Preparación opcional si se decide continuar con Supabase

1. Crear organización Free y proyecto `inventario-auth-v3` en [Supabase](https://supabase.com/dashboard/new), sin contratar un plan; región São Paulo si está disponible.
2. Authentication → Sign In / Providers: desactivar Allow new users to sign up y acceso anónimo; proveedor Email: desactivar Confirm email y configurar mínimo ocho caracteres. [Configuración](https://supabase.com/docs/guides/auth/general-configuration).
3. Obtener Project URL y claves Publishable/Secret. Guardarlas **solo** en `.dev.vars.supabase` en la raíz del repositorio; `.gitignore` ya excluye `.dev.vars*`. Archivo privado, permisos 0600; no pegar claves secretas en el chat.

```dotenv
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

Estas variables son un contrato propuesto, sin código que las consuma. La clave Secret nunca debe llegar al navegador, build, chat ni informes. Si se decide integrar, verificar el uso de cabeceras según el tipo de clave en la [referencia oficial](https://supabase.com/docs/guides/getting-started/api-keys); no se implementa ahora ni se cambia Pages.

## Trabajo condicionado a decidir la integración

- Solo si se decide integrar: diseñar adaptador Auth REST con plazo de espera, errores genéricos, límites y rechazo seguro. No añadir fallback a fixtures ni a derivación local silenciosa cuando falle el proveedor. El código vigente todavía usa bcrypt; este texto no ordena deshabilitarlo ni migrarlo ahora.
- Preservar UUID D1, autoría y borradores al vincular credenciales; decidir y ensayar importación o restablecimiento de las siete cuentas. [Importación documentada de hashes](https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0); no asumir que ya se ejecutó ni que la prueba remota pasó.
- Resolver altas, cambio propio, restablecimiento, desactivación, username y eliminación con sesiones revocadas y permisos revalidados. La API externa y D1 no comparten una transacción. Una respuesta perdida o solicitud retrasada no puede volver a publicar una contraseña anterior. Evaluar credenciales candidatas con identidad de Auth nueva por cambio y publicación mediante CAS en D1; retirar candidatos antiguos con una cola segura. Diseñar y probar esa garantía antes de elegir la implementación.
- Deshabilitar registro público también en el proveedor; no conservar tokens del proveedor en localStorage ni devolverlos al navegador. Mantener el cambio obligatorio de contraseña temporal y la protección del último administrador.
- Si se aprueba esa implementación, repetir pruebas locales relevantes y sesiones independientes; cualquier prueba del proveedor, migración de demo, configuración remota o despliegue requiere autorización específica y verificación posterior. Separar resultados locales/remotos.
- `cfece26` ya está publicado y su funcionamiento fue confirmado; no documentarlo como recuperación pendiente de publicar. Tampoco presentarlo como corrección específica de CPU, porque no cambia el módulo de contraseñas.

3A mantiene abierta la aceptación operativa. El incremento de usuarios/Servicio de 3B se conserva; tablero, rectificaciones, cierre/reapertura y demás pendientes siguen abiertos. Excel permanece en etapa 4.
