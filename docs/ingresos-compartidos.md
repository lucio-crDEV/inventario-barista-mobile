# Ingresos desde una misma Wi-Fi

## Diseño acotado

Antes: una IP pública seleccionaba una sola instancia privada de `PasswordWork`, con dieciséis trabajos pendientes como máximo. Treinta cuentas podían respetar la cuota de ingreso y aun así recibir 503 de esa cola.

Ahora: `worker/session.js` deriva cuatro nombres opacos fijos por IP, con prefijo versionado. El digest del par IP/usuario selecciona el carril de forma estable. Los nombres nuevos y las cuentas inexistentes usan esos mismos cuatro destinos, nunca un objeto por nombre. Cambiar de carril no divide las cuotas.

| Control | Contrato conservado |
| --- | --- |
| IP | 100 reservas por ventana de quince minutos |
| IP/usuario | 10 reservas por ventana de quince minutos |
| Verificación | bcrypt coste 12, incluido trabajo ficticio para cuenta ausente/hash incompatible |
| Cola | 16 trabajos por carril, incluido el activo; máximo 64 por IP |
| Trabajo | Serial dentro de cada carril; sin reintentos automáticos |
| Espera en cola | No iniciar bcrypt tras ocho segundos o cancelación observable |
| Solicitante privado | Diez segundos; error 503 genérico si falla o vence |
| Sesión | Inserción atómica compara hash, nombre, actividad y existencia actuales |
| Reserva aceptada | Devolver solo la propia y solo en su ventana, preservando fallos concurrentes |

El reparto reduce concentración; no promete que treinta cuentas arbitrarias nunca colisionen o que todo hardware complete bcrypt antes del timeout. El exceso sigue fallando de forma acotada y admite reintento explícito. Un error del servicio no crea sesión ni devuelve su reserva de fallo. No se conserva contenido de credenciales, no hay cache de verificaciones y no se añaden logs.

La arquitectura usa las clases/bindings SQLite privados ya existentes, compatibles con Free. No aumenta una cuota ni cambia suscripción. Se mantienen las protecciones contra carreras y el backend de cuotas en D1. El cambio no afecta el particionado existente de cambios/restablecimientos de contraseña autenticados.

## Pruebas aisladas

- `node --test tests/password-concurrency.test.mjs`: 2.048 nombres dentro de cuatro carriles, estabilidad/aislamiento de IP, cola real limitada, vencimiento, cancelación y recuperación.
- `npm run test:login:core`: treinta peticiones HTTP del Worker contra SQLite desechable y el núcleo privado real `PasswordWork.fetch`, usando bcrypt12. Comprueba credenciales erróneas/ausentes, éxito concurrente que conserva fallos, cuotas por IP/par, recuperación de ventana, timeout sin reintento/sesión y baja durante verificación. El transporte del binding es un adaptador local, no Workerd.
- `npm run test:login:runtime`: el mismo escenario contra el binding de un objeto SQLite real en Workerd/Miniflare, sin salidas a Internet. Además retiene dieciséis trabajos, comprueba saturación y su traducción a 503 por el solicitante productivo, espera el vencimiento real de ocho segundos y verifica recuperación. Una segunda retención prueba el timeout real de diez segundos del solicitante privado y su recuperación, sin sustituir ese binding ni acelerar el reloj. Las rutas `/fixture/*` existen únicamente en el envoltorio desechable de esta prueba, nunca en producción.

Las cuentas son ficticias y solo existen en memoria o en el proceso Workerd aislado; no se usan configuraciones, sesiones, filas ni cuentas productivas. Los resultados no incluyen hashes, cookies ni contraseñas. La prueba nativa forma parte de la batería aislada en CI.

## Aplicación y comprobación

No requiere DDL, migración 0016, nueva plantilla, clases, llaves o cambios de plan. Una vez revisadas y aprobadas las pruebas nativas, el usuario debe desplegar el código del Worker privado `inventory-exports` con la configuración existente **antes** del push que publica Pages. Esa actualización cambia también su módulo `PasswordWork`; conserva los módulos de exportación y monitor. Esta entrega prepara el código y no publica ese Worker.

El cambio del caller por sí solo reparte las peticiones entre cuatro objetos de la clase existente, pero la protección adicional contra trabajo vencido requiere actualizar el servicio privado. No afirmar que el push de Pages actualiza Workers privados.

Comprobar después la revisión de Pages/Actions y el binding PASSWORDS, sin repetir aprovisionamiento. Para aceptación operativa, probar ingresos reales de forma normal en la red del local y observar métricas de errores/CPU, sin convertir cuentas productivas en fixtures de carga.

Estado, cifras y bloqueos: [evidencia de la revisión](supervision-acceso-verificacion-2026-10-29.json). El ensayo local no certifica CPU, capacidad ni consumo facturado de Cloudflare. Una caída prolongada de WebSocket mantiene el costo de respaldo documentado; este ajuste de ingreso no lo modifica.
