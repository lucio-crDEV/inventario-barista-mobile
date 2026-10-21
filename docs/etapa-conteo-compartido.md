> **Estado vigente 21-10-2026:** las decisiones de 3A sustituyen las alternativas de autenticación, asignaciones y tratamiento de registros ajenos de este análisis histórico. Usuario personal y contraseña, permisos múltiples administrables, sin asignaciones = sin acceso, propios directos y ajenos mediante Descartar/Sumar/Sobrescribir. Administración mínima está implementada en 3A. Ver [contrato vigente](contrato-3a.md), [operación](operacion-3a.md), [accesos](accesos-y-administracion.md) y [roadmap](roadmap.md). La validación operativa/producción sigue pendiente.

# Siguiente etapa: conteo compartido y cierre

Revisión: 20-10-2026. Estado: propuesta actualizada, pendiente de validación operativa e implementación. No constituye una decisión ya aprobada de autenticación o reglas de conteo.

## Punto de partida comprobado

Rama `inventory-v2`, sin cambios locales al comenzar la revisión. Catálogo, navegación, estados, resumen y almacenamiento local implementados. `registerCount` reemplaza el registro de un ítem dentro de la sesión del navegador; no envía operaciones a un servidor. «Responsable» es texto de la sesión usado en el resumen, no una identidad autenticada por registro. No hay Worker, esquema D1 ni exportador en este checkout. No se inspeccionó la cuenta Cloudflare ni el despliegue remoto.

Se repitieron las 12 pruebas Node y el contrato de 1.151 filas del Excel: todas pasan. Esto no verifica concurrencia, autenticación ni exportación. Siguen pendientes la validación física de unidades/asignaciones y las pruebas en teléfonos.

## Recomendación y comparación con la propuesta anterior

Mantener la interfaz nativa y añadir una API en Workers con D1. La propuesta previa sigue siendo adecuada para centralizar ciclos e historial. Ajustar su regla de sumar deltas: cada aporte debe representar existencias físicas diferentes, nunca simplemente otra persona contando el mismo stock. Los usuarios aportan autoría y permisos; por sí solos no evitan duplicados ni pérdidas.

Recomendar para el primer piloto un conteo total por producto y ubicación, con asignación de responsables por área/sector/zona y revisión de conflictos. Sumar automáticamente solo ubicaciones distintas que convergen en la misma fila de salida. Si dos personas deben dividir un mismo lugar, definir antes sububicaciones o lotes físicos sin solapamiento; no crear una cantidad independiente por usuario y sumarlas indiscriminadamente. La asignación reduce errores de coordinación, pero el servidor debe proteger igualmente cada escritura.

Ejemplos: 4 unidades en Barra y 3 en Terraza pueden consolidarse en 7 si tienen la misma referencia y unidad compatible. Dos trabajadores registrando las mismas 4 unidades de Barra deben producir un conflicto o una revisión, nunca 8. Cambiar de trabajador no crea stock nuevo. «Sin stock» en una ubicación no anula cantidades de otra.

## Usuarios e ingreso

**Actualización de alcance:** el sistema de ingreso sigue abierto. La preferencia anterior por cuentas individuales es una recomendación, no una decisión del usuario. Consultar [accesos y administración](accesos-y-administracion.md) para las alternativas y los permisos confirmados.

Recomendar usuarios individuales habilitados por administración, sin registro público. Dos roles operativos iniciales: trabajador (cuenta en sus ubicaciones asignadas) y encargado (asigna, revisa, corrige con motivo, cierra y exporta). La administración de accesos puede ser un permiso separado del encargado. Conservar el autor histórico al desactivar una cuenta.

| Alternativa | Evaluación |
| --- | --- |
| Nombre libre o cuenta compartida | Fácil, pero no identifica de manera fiable quién cambió qué. No recomendada para operación compartida. |
| Cuenta individual mediante proveedor de identidad / Access | Preferida si todos pueden acceder a su correo o cuenta desde el teléfono. Reduce la gestión propia de credenciales. Requiere probar ingreso, caducidad y dispositivos compartidos. |
| Usuario individual y PIN propio | Cómodo para el equipo, pero exige autenticación propia, protección contra intentos, recuperación, revocación y almacenamiento seguro. Alternativa si el correo resulta impráctico; un PIN compartido no sirve. |

Cloudflare Access puede evaluarse con lista explícita de correos permitidos y código por correo. No basta permitir cualquier correo que reciba un código. El Worker debe validar la identidad autenticada y resolver los permisos en servidor, sin confiar en un `userId` enviado por el navegador. Verificar cobertura de todos los accesos a la API, incluidas direcciones alternativas. Confirmar plan y número de personas antes de adoptarlo. En equipos compartidos, mostrar claramente quién está conectado y ofrecer cambio de usuario con autenticación; los borradores conservan su autor y no se transfieren silenciosamente.

## Datos y protección de registros simultáneos

Modelo mínimo propuesto: usuarios; ciclos con versión de catálogo; ubicaciones y asignaciones; conteos actuales; operaciones históricas. La clave del conteo es ciclo + ítem de conteo/ubicación, sin usar únicamente el ID externo: existen IDs ausentes y filas repetidas entre sectores.

Cada operación conserva ID único, autor resuelto por servidor, fecha de recepción del servidor, ciclo, ubicación, cantidad/unidad, estado, marca de cero, nota y versión previa. Mantener las referencias de exportación y conversiones en el catálogo versionado. Validar cantidades y precisión según unidad, evitando errores de redondeo acumulados.

1. El teléfono envía la cantidad y versión que estaba viendo.
2. El servidor verifica identidad, asignación, ciclo abierto, catálogo y versión vigente dentro de la operación atómica.
3. Si coincide, guarda el cambio y su historial juntos. Si otro teléfono ya modificó ese registro, devuelve un conflicto y conserva el borrador para comparar con el valor actual; no sobrescribe automáticamente ni suma dos totales.
4. Un reintento con el mismo ID y contenido devuelve el resultado anterior sin repetir el cambio. Reutilizar ese ID con otro contenido se rechaza. La deduplicación, la revisión de versión y la escritura deben ser atómicas, no una secuencia de lectura y escritura desprotegida.

D1 ofrece lotes transaccionales con `batch()`. Diseñar las condiciones SQL, restricciones y registro histórico de manera que un rechazo por versión no deje un historial de éxito ni un total parcial. Un `UPDATE` que afecta cero filas no es por sí solo un error que revierta el lote: este caso necesita diseño y pruebas explícitas. No depender de transacciones interactivas arbitrarias desde el Worker.

## Sincronización y cierre

Comenzar con consultas incrementales mientras la pantalla esté activa, con cursor del servidor, índices y pausa al ocultarse; medir el intervalo en el piloto. No se necesita incorporar Durable Objects o WebSockets inicialmente. Workers KV no es el registro principal de cantidades.

Distinguir «Guardado en este teléfono», «Pendiente de enviar», «Sincronizado» y «Conflicto». Guardar localmente el borrador y el ID antes de enviar. Para el primer piloto se recomienda conexión para confirmar guardados: la recuperación de borradores no equivale a prometer conteo completo sin conexión. Si se implementa cola, conservar autor/ciclo y revisar permisos, versión y estado del ciclo al reconectar. No reenviar operaciones del usuario anterior bajo otra identidad.

Recomendar un ciclo activo por local inicialmente: abierto → revisión → cerrado. El encargado inicia revisión, se detienen nuevas escrituras operativas, se verifican pendientes y se cierra una versión estable. Resolver la carrera entre guardado y cierre en el servidor. Un teléfono desconectado puede tener borradores desconocidos para el servidor: el cierre requiere comprobar que los participantes sincronizaron o registrar explícitamente su exclusión. Reapertura controlada con motivo y nueva revisión; las exportaciones anteriores siguen identificadas con su versión.

«Nuevo inventario» debe pasar a crear un ciclo autorizado conservando el anterior. No convertir el borrado local actual en un borrado compartido. Los datos locales anteriores necesitan una importación explícita, revisada y deduplicada; no se suman automáticamente al iniciar sesión.

## Orden de implementación y criterios de salida

1. **Definir el piloto:** cantidad de personas/teléfonos, correo disponible, dispositivos compartidos, señal, asignaciones y autoridad de cierre. Resolver dudas de catálogo en paralelo. Comprobar que el despliegue publique solo los archivos necesarios y excluya materiales internos.
2. **Primer recorrido completo:** dos usuarios de prueba, un ciclo, dos ubicaciones, Worker + D1, guardado con versión, historial y reintentos. Separar pruebas y producción. Criterio: dos teléfonos conservan sus registros y un conflicto sobre el mismo registro nunca se pierde silenciosamente.
3. **Integración operativa:** áreas completas, asignaciones, estado de sincronización, borradores, tablero, revisión y cierre. Probar sesión caducada, usuario desactivado, red cortada, respuesta perdida después de guardar, doble toque, versión antigua y guardado concurrente con cierre. Probar que un trabajador no pueda cerrar o escribir fuera de sus permisos.
4. **Excel final:** exportar explícitamente una versión cerrada, con cantidades consolidadas y conversiones aprobadas. Conservar hojas, filas, IDs, nombres, unidades, fórmulas y presentación. Bloquear pendientes, unidades/conversiones indefinidas y correspondencias no resueltas; no convertir ausencia de conteo en cero. La excepción a cualquier bloqueo requiere una política expresa y trazable.
5. **Piloto sostenido:** al menos dos ciclos con varios trabajadores, recuperación de incidentes, respaldo/restauración comprobados y consumo observado. Evitar prometer gratuidad sin medir solicitudes, filas e historial.

La prueba técnica del Excel debe adelantarse mientras se desarrolla la colaboración: validar una copia de ejemplo y comprobar qué importa GetJusto, especialmente fórmulas y valores calculados almacenados. Su integración final queda después del cierre compartido. No decidir todavía una biblioteca exportadora ni su lugar de ejecución sin verificar la fidelidad del libro.

## Decisiones todavía abiertas

Se prevén aproximadamente 15 personas durante el día de inventario. Falta confirmar si usan teléfonos propios o compartidos, si todos tienen correo accesible y si dos personas cuentan simultáneamente el mismo sector físico. Estas respuestas condicionan el ingreso y la división del trabajo; no impiden preparar el modelo de ciclos y concurrencia. Siguen vigentes las dudas de la planilla de reunión, las 18 entradas de Barra sin fila y las dos conversiones pendientes documentadas, además de las cinco filas de Pastelería sin unidad.

## Fuentes técnicas consultadas

- [API D1 y lotes transaccionales](https://developers.cloudflare.com/d1/worker-api/d1-database/).
- [Políticas Access y restricción de códigos por correo](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/).
- [Consumo y precios D1](https://developers.cloudflare.com/d1/platform/pricing/): plan gratuito con límites diarios; dimensionar con mediciones. Esta revisión no revalida todas las cifras históricas de los otros proveedores.
