# Roadmap — inventory-v3

> Referencia histórica del 20-10-2026 (sustituida en 3A el 21-10-2026): consultar [la siguiente etapa de conteo compartido](etapa-conteo-compartido.md). Precisa usuarios, reparto físico, conflictos y cierre; revisa la suma indiscriminada de aportes de esta propuesta. Son recomendaciones aún no implementadas.

La etapa 3A y siguientes se desarrollan en `inventory-v3`. `inventory-v2` permanece en su commit anterior al trabajo compartido. La separación no cambia la numeración de etapas: versión 3 de la aplicación y etapa 3A del roadmap son conceptos distintos. Ver [separación de ramas](separacion-inventory-v3.md).

Estado local al 22-10-2026: 3A conserva aceptación operativa abierta; **3B en curso**, con el incremento de usuarios/Servicio probado localmente. Tablero y administración avanzada de conteos siguen pendientes. Último sitio revisado `5d80658`, anterior a ese incremento. [Contrato y publicación del incremento](usuarios-y-servicio-3b.md), [diagrama y tecnologías](tecnologias-y-roadmap.md).

## Meta

Generar desde la app un inventario completo con la estructura de `inventarios_og/11_10-INVENTARIO-totalizado.xlsx`. La experiencia de conteo se organiza por área, sector y zona cuando corresponde; las categorías prácticas se usan donde simplifican la búsqueda. Garzones abre directamente sus 16 ítems por zona.

## Etapas

1. **Catálogo y navegación:** cargar las filas del Excel como referencia de salida; abrir Cocina, Panadería, Pastelería, Servicio y Bodega Principal; dentro de Servicio, Barra, Armado / Línea / Copería, Garzones y Mercadito; dentro de Garzones, sus tres zonas. Mantener los ID originales y declarar conversiones sin adivinar equivalencias. Esta estructura ya está incorporada en el checkout actual; las zonas de Garzones omiten la pantalla de categoría. Bodega / Principal organiza sus 288 filas en 14 grupos de conteo independientes de las categorías del Excel.
2. **Revisión operativa:** confirmar las asignaciones físicas y unidades, con atención a los productos sin ID, las conversiones pendientes y los productos nuevos. La organización de Mercadito se acordará con la jefa de turno.
3. **Conteo compartido:**
   - **3A — funcionalidad implementada y verificada localmente; aceptación operativa abierta:** usuario personal y contraseña; cambio y restablecimiento; administración mínima de usuarios y permisos múltiples por ámbito; ausencia de asignaciones = ausencia de inventario; administrador global; Worker + D1; aislamiento de lectura/escritura; sincronización incremental, borradores por identidad/ciclo e historial. Propios se actualizan directamente con versión; ajenos se resuelven mediante Descartar, Sumar o Sobrescribir, con confirmación vinculada a versión, acción y resultado. Reintentos no duplican aportes. Se añadieron respaldo/restauración ensayados y retención de metadatos, exclusivamente comprobados localmente. El piloto con equipo se aplazó por decisión del usuario; CPU/plan y recuperación remota siguen pendientes técnicos. Ver [cierre y evidencia](cierre-tecnico-3a.md).
   - **3B — en curso:** incremento local de Jefa de servicio, cuentas acotadas, edición de username/perfil, eliminación irreversible, navegación directa y catálogo nuevo Copería/Vitrina. Pendientes: tablero de supervisión e historial administrativo avanzado; rectificaciones/anulaciones auditadas de conteos, activación/desactivación operativa de productos y revisión/cierre/reapertura. Desactivar nunca implica cero ni elimina filas del Excel. Eliminar cuentas conserva autoría; no autoriza borrar conteos o auditoría. [Incrementos y criterios](etapa-3b.md).
4. **Salida Excel:** ofrecer **Exportar** al final del inventario. Solo al elegir esa opción, partir del archivo totalizado de referencia, escribir los stocks contados en las filas correspondientes, consolidar Servicio y revisar el archivo generado antes de entregarlo.

La propuesta detallada de UX, colaboración y alternativas gratuitas está en `docs/propuesta-ux-colaboracion.md`. Es una propuesta para evaluar antes de implementar nuevas etapas. Las preguntas de reunión viven en `archivos-externos/reuniones/dudas_inventario_por_area.xlsx`.

La cobertura del catálogo y el contrato de referencia del Excel tienen pruebas repetibles en `tests/`. La revisión de resultados y simulaciones está en `docs/verification.md`. El panel lateral, la búsqueda, sus categorías plegables, la cuadrícula móvil, el modo oscuro y la guía visual de vidrio ya existen. El conteo distingue pendiente, avance, contado y «Sin stock» explícito; al reabrir un grupo prioriza el trabajo pendiente. La colaboración 3A ya tiene pruebas de API y sesiones independientes de navegador; continúan pendientes el teléfono físico, el piloto real aplazado, la validación operativa de producción y la exportación.

## Criterios de avance

- Ningún producto se vincula a otro ID o fila por parecido de nombre sin validación.
- Una conversión pendiente o un producto nuevo se informa antes de la salida; no se omite silenciosamente.
- Una fila compartida entre sectores suma existencias físicas distintas.
- La exportación conserva la estructura y los datos de referencia del totalizado; solo cambia el stock del nuevo inventario.
- Contar o terminar un área no genera el Excel; la generación requiere elegir **Exportar** al final.
- El módulo Pedido permanece separado de Inventario.

## Alcance de accesos y administración

Decisiones confirmadas: usuario personal y contraseña; permisos múltiples administrables por ámbito; sin asignaciones no hay inventario; registros ajenos requieren Descartar, Sumar o Sobrescribir; actualizaciones propias sin ese diálogo. Administración mínima de cuentas y accesos pertenece a 3A. Ver [accesos](accesos-y-administracion.md), [contrato](contrato-3a.md) y [verificación](verification.md).

El paquete de Cloudflare Pages con Worker y D1 se verificó por HTTPS local. El usuario preparó D1/ciclo/administrador y publicó los cambios hasta `5d80658`. Se confirmó ese despliegue, la coincidencia de cuatro archivos públicos con el código local y **16/16 comprobaciones anónimas** de rutas, cabeceras y privacidad. En el dominio se revisaron ingreso/cierre del administrador, login/cuenta, menú/temas, refresco con espera de 30 segundos y lectura de Usuarios y accesos. No se cambiaron conteos, cuentas ni permisos en esa revisión. Ver [evidencia exacta](verification.md) y [despliegue Pages](despliegue-pages.md).

Criterios operativos todavía abiertos: conteos/conflictos y retirada de permisos entre varias personas en el dominio, inspección allí de atributos de cookie, presupuesto CPU/consumo del plan Workers, recuperación remota y copia externa privada, Android físico y piloto con trabajadores. Workers Free se supone provisionalmente; bcrypt coste 12 mostró 274–325 ms de CPU Node local frente al límite Free de 10 ms/solicitud consultado para el cierre técnico. No es CPU facturada, pero exige resolver alojamiento antes del uso real. No marcar la etapa operativa terminada a partir de pruebas locales ni del ingreso aislado en producción. El piloto aplazado no bloquea desarrollar 3B. Etapa 2 continúa sin inventar equivalencias.
