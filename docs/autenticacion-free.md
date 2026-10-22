# Autenticación en Workers Free — punto de continuación 22-10-2026

## Estado al detener el trabajo

El usuario pidió mantener Free y aceptó preparar un proyecto Supabase gratuito. La configuración se aplazó hasta la próxima sesión. **Supabase no está integrado, no hay claves configuradas y el fallo de ingreso no está resuelto.** No publicar esta recuperación de funciones como si corrigiera CPU.

El usuario revirtió y subió `55dfc2b`, cuyo árbol coincidía con `5d80658`. Después aclaró que la reversión era temporal y pidió recuperar todos los cambios. Se restituyeron localmente los cambios de `9dfef56`, `94d3a83` y `2c284cd`: Jefa de servicio, gestión de cuentas, reparto de Servicio, diseño móvil y documentación. No se hizo push ni despliegue en esta revisión. `inventory-v2` no se modifica.

La comprobación pública después del push de reversión obtuvo Cuenta 200 y `/api/me` 401 JSON. Los archivos Cuenta y cliente compartido coincidían con el código revertido; no se probó ingreso autenticado en esa comprobación. Antes de revertir, una solicitud real produjo 503/1102 y el log confirmó `exceededCpu`; tanto la versión anterior como la recuperada usan bcryptjs coste 12.

Git no retrocedió D1/Pages. La corrección remota previa conserva migraciones 0003/0004, ciclo `piloto-v3-servicio` y siete cuentas mínimas. Los informes del diagnóstico están en [despliegue-demo-3b.json](despliegue-demo-3b.json) y [verificación](verification.md). No repetir primer administrador, fixtures ni migraciones ya aplicadas.

Hubo dos fallos distintos: el primer `NOT_INITIALIZED` ocurrió porque el nuevo código exigía una vista que aún no existía en D1; el posterior `exceededCpu` ocurrió en un ingreso real después de corregir la inicialización. El módulo de contraseñas es idéntico entre `5d80658` y `2c284cd`. La reversión elimina dependencias nuevas, pero no bcrypt; una sesión ya abierta no vuelve a derivar la contraseña. No hay perfil remoto comparativo que pruebe por qué un ingreso anterior concreto funcionó y otro no.

## Solución acordada para desarrollar

Usar **Supabase Auth Free para verificar contraseñas**, manteniendo nuestro formulario. Workers/D1 conservan cookies HttpOnly, identidad estable, roles, permisos, conteos e historial. No se migrará el inventario a Supabase. El usuario continúa escribiendo username y contraseña; no necesita correo ni teléfono. La correspondencia con un identificador interno de Auth está pendiente de implementar y ensayar; Supabase usa email/teléfono de forma nativa. [Contraseñas](https://supabase.com/docs/guides/auth/passwords).

Workers Free limita CPU a 10 ms por petición; esperar red no consume ese presupuesto. Delegar la derivación evita ejecutarla en JavaScript dentro del Worker, pero la compatibilidad deberá comprobarse realmente en Free. [Límites](https://developers.cloudflare.com/workers/platform/limits/). No reducir bcrypt ni sustituirlo por un hash rápido. El PBKDF2 nativo tampoco está aprobado: límite predeterminado de 100.000 iteraciones frente a las recomendaciones OWASP de 600.000 SHA-256 o 220.000 SHA-512. [Runtime](https://github.com/cloudflare/workerd/blob/main/src/workerd/io/limit-enforcer.h), [ampliación aún pendiente en esta revisión](https://github.com/cloudflare/workerd/pull/7550), [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Supabase Free publica 50.000 usuarios mensuales, pero puede pausar el proyecto tras siete días de poca actividad; revisar disponibilidad antes de la reunión/inventario. [Precios](https://supabase.com/pricing), [pausas](https://supabase.com/docs/guides/platform/free-project-pausing). Auth0 se investigó como alternativa, pero implicaría usar su pantalla Universal Login; no es la vía elegida para conservar el formulario actual.

## Preparación pendiente del usuario

1. Crear organización Free y proyecto `inventario-auth-v3` en [Supabase](https://supabase.com/dashboard/new), sin contratar un plan; región São Paulo si está disponible.
2. Authentication → Sign In / Providers: desactivar Allow new users to sign up y acceso anónimo; proveedor Email: desactivar Confirm email y configurar mínimo ocho caracteres. [Configuración](https://supabase.com/docs/guides/auth/general-configuration).
3. Obtener Project URL y claves Publishable/Secret. Guardarlas **solo** en `.dev.vars.supabase` en la raíz del repositorio; `.gitignore` ya excluye `.dev.vars*`. Archivo privado, permisos 0600; no pegar claves secretas en el chat.

```dotenv
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

Estas variables son el contrato propuesto; todavía no hay código que las consuma. Las claves nuevas se envían mediante `apikey`, no como `Authorization: Bearer`. La clave Secret nunca llega al navegador ni al build. [Claves oficiales](https://supabase.com/docs/guides/getting-started/api-keys). Todavía no cambiar configuración de Pages.

## Trabajo concreto para retomar

- Implementar adaptador Auth REST con plazo de espera, errores genéricos, límites y rechazo seguro ante configuración/fallo; nunca recurrir a bcrypt en producción Free ni a fixtures. Mantener bcrypt únicamente en el entorno local explícito mientras se migra.
- Preservar UUID D1, autoría y borradores al vincular credenciales; decidir y ensayar importación o restablecimiento de las siete cuentas. [Importación documentada de hashes](https://supabase.com/docs/guides/platform/migrating-to-supabase/auth0); no asumir que ya se ejecutó ni que la prueba remota pasó.
- Resolver altas, cambio propio, restablecimiento, desactivación, username y eliminación con sesiones revocadas y permisos revalidados. La API externa y D1 no comparten una transacción. Una respuesta perdida o solicitud retrasada no puede volver a publicar una contraseña anterior. Evaluar credenciales candidatas con identidad de Auth nueva por cambio y publicación mediante CAS en D1; retirar candidatos antiguos con una cola segura. Diseñar y probar esa garantía antes de elegir la implementación.
- Deshabilitar registro público también en el proveedor; no conservar tokens del proveedor en localStorage ni devolverlos al navegador. Mantener el cambio obligatorio de contraseña temporal y la protección del último administrador.
- Repetir pruebas locales relevantes, sesiones independientes y simulación de 15 clientes. Después probar el proveedor real y CPU en Free con una cuenta de ensayo, migrar explícitamente la demo y configurar secretos de Pages. Separar resultados locales/remotos y no declarar corregido el ingreso antes de comprobarlo.
- Solo después dejar el commit de corrección listo para push/despliegue automático. El commit de recuperación actual es un punto de trabajo, **no una solución publicable al fallo CPU**.

3A mantiene abierta la aceptación operativa. El incremento de usuarios/Servicio de 3B se conserva; tablero, rectificaciones, cierre/reapertura y demás pendientes siguen abiertos. Excel permanece en etapa 4.
