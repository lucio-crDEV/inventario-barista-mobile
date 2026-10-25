# Roadmap — inventory-v3

Actualización vigente 25-10-2026: [inventarios y UX móvil](revision-inventarios-2026-10-25.md), [métricas y respaldos](metrics-backup-2026-10-25.md). Requiere 0008/0009; sustituye la pausa previa de telemetría, sin implementar Root. Ver esos documentos para estado y verificación nuevos; las cifras inferiores son históricas.

## Estado vigente — revisión UX local

Revisión UX implementada localmente el 23-10-2026: Panel de supervisión y resumen compactos, historial por producto y rol, perfil/menú y Gestionar usuarios y accesos. Finalizar y enviar es interno; solo Administrador reabre finalizados. Motivo obligatorio solo para reabrir. Activo/Inactivo persiste por área con fechas/auditoría; el informe de varios meses queda futuro. Altas de trabajadores con accesos en la misma transacción y claves temporales autogeneradas/copiar/compartir tras éxito. Sin nuevos roles ni ampliación de cuentas mixtas.

Requiere **0007_operation_ux.sql después de 0006 antes del deploy**. No aplicar 0005, fixtures, bootstrap ni crear otro ciclo en la demo. No se ejecutaron operaciones remotas ni push. [Decisiones vigentes](decisiones-ux-y-operacion-2026-10-23.md), [verificación](verification.md), [publicación manual](publicar-revision-ux-0007.md). Excel conserva la regla de oro; exportación en etapa 4 y adaptación de plantillas en fase 5, ambas pendientes. Root/telemetría siguen fuera de alcance.

## Registro histórico anterior

## Decisión previa a este incremento — b24403d

Persistencia de uso desactivada; sin nueva migración ni infraestructura. Root/Desarrollador, su provisionamiento y métricas exclusivas quedan solo diseñados por elección expresa del usuario. Roles actuales y cuentas mixtas sin ampliaciones. Próxima decisión: destino/cifrado/custodia/retención y objetivos de recuperación antes de implementar histórico o automatizar copias diarias. La pantalla Root sigue pospuesta; supervisión/resto 3B y Excel 4 fuera de este encargo. [Contrato vigente](seguridad-observabilidad-3a.md).

## Refuerzo 3A posterior al traspaso — 22-10-2026

Controles de publicación/esquema, abuso, privacidad y ensayos aislados de concurrencia/recuperación implementados. Las métricas administrativas del 22-10 quedan retiradas por la decisión del 23-10: telemetría persistente desactivada y Root solo diseñado. Se mantienen usuarios/Servicio sin desarrollar nuevos flujos 3B. [Seguridad/observabilidad y preparación sin 0005](seguridad-observabilidad-3a.md). Preflight remoto y publicación siguen requiriendo autorización; no aplicar 0005. Aceptación 3A abierta: recursos Free, varias personas/cookies del dominio, recuperación remota/copia externa y Android/piloto. Automatización de respaldo operativo y exportación Excel siguen en 4, separadas; integridad y restauración local necesarias para 3A ya se ejercitaron.

Última revisión 22-10-2026: `cfece26` confirmado en producción (`7df21f3c`), funcionamiento informado por el usuario y 16 GET públicos aprobados. Métricas posteriores: dos errores `exceededResources`, sin ruta ni resultado individual `exceededCpu`; investigar antes de decidir cambios de autenticación. Supabase es una alternativa sin integrar; **Free se mantiene**. 3A operativa y el resto de 3B siguen abiertos; Excel permanece en 4. [Evidencia nueva](revision-hermes-2026-10-22.md), [traspaso](traspaso-hermes.md).

> Referencia histórica del 20-10-2026 (sustituida en 3A el 21-10-2026): consultar [la siguiente etapa de conteo compartido](etapa-conteo-compartido.md). Precisa usuarios, reparto físico, conflictos y cierre; revisa la suma indiscriminada de aportes de esta propuesta. Son recomendaciones aún no implementadas.

La etapa 3A y siguientes se desarrollan en `inventory-v3`. `inventory-v2` permanece en su commit anterior al trabajo compartido. La separación no cambia la numeración de etapas: versión 3 de la aplicación y etapa 3A del roadmap son conceptos distintos. Ver [separación de ramas](separacion-inventory-v3.md).

Estado al 22-10-2026: 3A conserva aceptación operativa abierta; **3B en curso**, con incremento usuarios/Servicio implementado, probado localmente y recuperado/publicado en `cfece26`. Tablero y administración avanzada de conteos siguen pendientes. La inicialización D1 ya se reparó; el funcionamiento confirmado no certifica estabilidad sostenida ni elimina los errores por recursos observados después. [Diagnóstico](verification.md), [contrato](usuarios-y-servicio-3b.md), [diagrama y tecnologías](tecnologias-y-roadmap.md).

La revisión móvil de Usuarios y accesos separa Cuenta/Accesos/Seguridad y agrupa las zonas; ya tiene comprobaciones locales históricas de formularios, teclado y ambos temas. Está incluida en la recuperación publicada. 0003/0004 y `piloto-v3-servicio` ya se prepararon en la demo; no repetirlos ni reinicializar cuentas. Otros entornos requieren revisar primero sus migraciones/ciclos.

## Meta

Generar desde la app un inventario completo con la estructura de `inventarios_og/11_10-INVENTARIO-totalizado.xlsx`. La experiencia de conteo se organiza por área, sector y zona cuando corresponde; las categorías prácticas se usan donde simplifican la búsqueda. Garzones abre directamente sus 16 ítems por zona.

## Etapas

1. **Catálogo y navegación:** filas del Excel como referencia de salida; Cocina, Panadería, Pastelería, Servicio y Bodega Principal; dentro de Servicio, Barra, Línea/Armado, Copería, Garzones y Mercadito (con ubicación Vitrina); dentro de Garzones, sus tres zonas. Mantener ID originales y conversiones explícitas sin adivinar equivalencias. Estructura incorporada: catálogo nuevo con 1.268 entradas; las zonas de Garzones omiten categorías. Bodega / Principal organiza sus 288 filas en 14 grupos independientes de las categorías del Excel.
2. **Revisión operativa:** confirmar las asignaciones físicas y unidades, con atención a los productos sin ID, las conversiones pendientes y los productos nuevos. La organización de Mercadito se acordará con la jefa de turno.
3. **Conteo compartido:**
   - **3A — funcionalidad implementada y verificada localmente; aceptación operativa abierta:** usuario personal y contraseña; cambio y restablecimiento; administración mínima de usuarios y permisos múltiples por ámbito; ausencia de asignaciones = ausencia de inventario; administrador global; Worker + D1; aislamiento de lectura/escritura; sincronización incremental, borradores por identidad/ciclo e historial. Propios se actualizan directamente con versión; ajenos se resuelven mediante Descartar, Sumar o Sobrescribir, con confirmación vinculada a versión, acción y resultado. Reintentos no duplican aportes. Se añadieron respaldo/restauración ensayados y retención de metadatos, exclusivamente comprobados localmente. El piloto con equipo se aplazó por decisión del usuario; CPU/plan y recuperación remota siguen pendientes técnicos. Ver [cierre y evidencia](cierre-tecnico-3a.md).
   - **3B — implementada localmente, aceptación abierta:** Panel de supervisión, historial por producto/rol, corrección/anulación, actividad persistente por área, revisión/finalización y reapertura final exclusiva de Administrador; cuentas/accesos con altas atómicas y credenciales asistidas. Pendientes: publicar0007 y validar el recorrido en dominio/dispositivos reales. El informe de antigüedad de inactivos queda para gestión posterior con historia ya registrada. Desactivar no implica cero ni elimina filas. [Contrato vigente](etapa-3b.md).
4. **Salida Excel:** ofrecer **Exportar** al final del inventario. Solo al elegir esa opción, partir del archivo totalizado de referencia, escribir los stocks contados en las filas correspondientes, consolidar Servicio y revisar el archivo generado antes de entregarlo.
5. **Evolución futura de plantillas — solo diseño:** estudiar versiones actualizadas o libros similares, con identificación de plantilla, revisión de diferencias, correspondencias validadas y trazabilidad histórica. Cualquier rediseño del Excel requiere autorización expresa posterior; hasta entonces rige la regla de oro sin excepciones implícitas.

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

Criterios operativos todavía abiertos: conteos/conflictos y retirada de permisos entre varias personas en el dominio, atributos de cookie allí, atribución de errores por recursos y presupuesto CPU/consumo **manteniendo Free**, recuperación remota/copia externa, Android y piloto. El perfil Node histórico no mide CPU Cloudflare; los agregados remotos actuales tampoco identifican rutas individuales. No marcar aceptación operativa terminada por pruebas locales, GET públicos o ingreso aislado, ni convertir ese pendiente en migración obligatoria. El piloto aplazado no bloquea desarrollar 3B. Etapa 2 continúa sin inventar equivalencias.
