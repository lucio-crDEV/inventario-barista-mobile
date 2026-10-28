Etapas 4B/4C — 28/10: [contrato vigente](docs/etapa-4bc-exportacion.md). Captura inmutable y motor XLSX implementados localmente. Requiere 0014 después de 0013; no aplicada remotamente. Solo finalizados, suma de ubicaciones terminadas, inactivos excluidos y redondeo final a 3 decimales. Se conserva calcPr hasta autorización expresa. No ejecutar compresión en Pages ni publicar archivos privados. 4D pendiente.

Estado vigente de etapa 4 — 28/10: [backend y contratos](docs/etapa-4-backend-y-contratos.md). Refactor local sin cambios de esquema. Decisiones aprobadas: solo finalizados globalmente; Servicio suma ubicaciones terminadas; inactivos excluidos; excepción de STOCK cocina!C74 documentada con reversión. La exportación aún no está implementada. Para publicación prevalece la evidencia productiva del 27/10 sobre notas históricas de preparación.

Estado vigente 27/10: [preparación remota completada](docs/consumo-activacion-2026-10-27.md). 0013 aplicada y preflight remoto aprobado; Workers privados publicados y REALTIME preparado en Pages. Entrega incluida en un commit local; push por SSH reservado al usuario. Pages se publica con ese push. No repetir migraciones. Verificación pública bloqueada por Cloudflare1010; comprobación funcional posterior al push pendiente. Esta nota sustituye estados anteriores que decían que no había cambios remotos.

# AGENTS.md — inventory-v3

Actualización vigente 27/10: [corrección integral del consumo crítico](docs/consumo-critico-2026-10-27.md). Código local de métricas, consultas, cliente, canal compartido y respaldo por flujo implementado. Requiere 0013 después de 0012 y activación explícita de los dos objetos privados (REALTIME y BACKUP_JOBS); no se migró ni desplegó producción. La compatibilidad sin binding conserva el sondeo, sin eliminar su volumen. Esta nota sustituye los pendientes locales de consultas/sincronización/R2 de la primera etapa; la publicación y medición online siguen pendientes.

Actualización vigente 27/10: [corrección de métricas y cuotas del recolector](docs/metricas-correccion-2026-10-27.md). Primera etapa local: entrega real de INP/CLS, recolector diario/horario unificado, depuración horaria acotada y diagnóstico D1 muestreado al 0,1 %. Sin dependencias ni migraciones nuevas, sin cambios remotos ni despliegue. Las optimizaciones de consultas, sincronización y R2 siguen pendientes por etapas. Esta actualización sustituye las descripciones anteriores del recolector; las verificaciones fechadas siguen siendo históricas.

Actualización 26/10: [finalización con pendientes y opciones de inventario](docs/finalizacion-con-pendientes-2026-10-26.md). Requiere 0012 después de 0011. Se permite continuar tras advertencia; pendientes/avances se reservan como blanco para el futuro Excel, conservando ceros confirmados y todos los registros. Esta decisión sustituye el requisito anterior de completar todos los activos. La exportación sigue pendiente.

## Ampliación autorizada — 26-10-2026

Errores técnicos/versión, Web Vitals estándar sin atribución, histogramas y salud del recolector implementados con 0011 después de 0010. El receptor POST /api/telemetry solo recibe agregados validados; no da acceso de lectura, no requiere identidad ni registra contenido personal. Root permanece sin implementar. Estado de pruebas/publicación y límites en docs/observabilidad-2026-10-26.md. No confundir acumulados diarios anteriores con datos desde la hora exacta de un despliegue.

## Actualización autorizada — 25-10-2026

El usuario autorizó implementar creación/activación solo por Administrador, selección automática del inventario, jerarquía de Servicio y correcciones UX móvil. Métricas agregadas vuelven a estar autorizadas con 0009 y `METRICS_ENABLED=1`; Root sigue sin implementar. Respaldos privados cifrados cada 90 días operativos con Worker separado y R2 privado; primera copia real recuperada y verificada el 25-10-2026. Esta decisión sustituye la pausa de telemetría del 23-10, sin autorizar telemetría personal ni borrar inventarios por antigüedad. 0008, 0009 y 0010 se aplican después de 0007; nunca 0005.

Contrato vigente y estado de publicación en [revisión del 25-10](docs/revision-inventarios-2026-10-25.md) y [métricas y respaldos](docs/metrics-backup-2026-10-25.md). Mantener el foco accesible de teclado mediante cambios suaves de fondo o luminosidad, sin subrayados; los toques no añaden bordes de selección.

## Decisiones de revisión y regla de oro — obligatorias, 23-10-2026

Lee [las decisiones vigentes y su implementación local](docs/decisiones-ux-y-operacion-2026-10-23.md). Cierre para revisión y finalización son distintos; solo Administrador reabre finalizados, con motivo. Reabrir es el único motivo obligatorio. Activo/Inactivo persiste por área con historial, sin borrar conteos. Se conservan los tres roles actuales. Esta versión requiere 0007 después de 0006; no confundir implementación local con despliegue.

**Regla de oro mandatoria:** el libro original es de solo lectura. La salida se genera en una copia con la misma estructura, hojas, filas, ID, unidades, referencias, fórmulas y formatos; únicamente se actualizan las celdas de conteo autorizadas. Desactivar o reagrupar productos nunca elimina ni modifica filas. No cambiar/adaptar una plantilla silenciosamente. La adaptación a futuras versiones del Excel queda para fase 5 o autorización explícita posterior; hasta entonces esta regla prevalece.

## Etapa 3B vigente — 23-10-2026

[Contrato 3B](docs/etapa-3b.md): Panel de supervisión compacto, historial por ítem/rol, corrección/anulación y estados global/Servicio. Jefa solo reabre Servicio en revisión; Administrador puede reabrir finalizados. Rectificar/anular tienen motivo opcional; cerrar/finalizar/actividad no solicitan motivo ni checkbox. El cierre final exige todos los activos contados. Actividad persistente por área; alta de trabajadores con accesos atómicos. Mantener versiones, idempotencia, auditoría y borradores. Publicación manual en [guía 0007](docs/publicar-revision-ux-0007.md); nunca aplicar 0005 ni fixtures remotos. Root/métricas y Excel siguen pendientes.

## Decisiones del 23-10-2026

Telemetría persistente desactivada. `0005` es una propuesta histórica fuera de `migrations/`, no se aplica. Root/Desarrollador queda **solo diseñado** por decisión expresa; los roles implementados siguen siendo Administrador > Jefa de servicio > Trabajador. Ninguno accede al endpoint técnico de métricas, que queda cerrado hasta aprobar Root y su fuente de datos. No implementar Root, almacenamiento ni automatización como continuación implícita. [Estado, diseño y publicación](docs/seguridad-observabilidad-3a.md).

## Ubicación y continuidad entre agentes — 22-10-2026

La raíz local es `/Users/lucio/workspace/inventario_brioche`; el remoto de GitHub y los nombres técnicos `inventory-v3`, Workers/D1 y claves de datos se conservan. Para retomar con Hermes u otro agente, lee primero [el traspaso actualizado](docs/traspaso-hermes.md), además de contexto, roadmap y verificación. No crees un HERMES.md que sustituya estas reglas. `sources/`, cuando esté presente, es referencia sincronizada de solo lectura. La elección de Supabase no obliga a migrar: primero contrastar el funcionamiento actual y los errores CPU con mediciones reales.

La continuidad del refuerzo 3A está en [seguridad y observabilidad](docs/seguridad-observabilidad-3a.md). Las decisiones del usuario del 23-10-2026 sustituyen las propuestas anteriores sobre telemetría, retención y métricas administrativas. En esta sesión se usa Codex; el nombre histórico del traspaso no obliga a invocar otro agente.

## Propósito

Este repositorio desarrolla `inventory-v3`: una aplicación web modular para gestionar inventario y, en una rama de trabajo separada, pedidos internos. No confundirlo con la aplicación anterior **Inventario Barra** ni trasladar automáticamente a esta rama sus límites de producto o su roadmap.

Para conocer estado, decisiones y trabajo pendiente, consulta `docs/project-context.md` y `docs/roadmap.md`. Para cambios de interfaz, lee también `docs/style-guide.md` y `docs/verification.md`. Este archivo contiene reglas de trabajo, no una copia del contexto completo.

## Cómo interpretar el proyecto

Antes de actuar, separa explícitamente:

- decisiones vigentes del usuario;
- comportamiento comprobable en el código de esta rama;
- trabajo pendiente o en exploración;
- contexto histórico de otras ramas y versiones.

El código muestra lo implementado, no necesariamente todas las decisiones de producto. La documentación expresa intención, pero puede quedar obsoleta. Si se contradicen, identifica la diferencia y no conviertas una inferencia en requisito.

## Ramas y alcance

El proyecto mantiene líneas de trabajo diferenciadas: `main` corresponde a la versión estable anterior de Inventario Barra; `warehouse-order` corresponde al trabajo de Pedido a Bodega; `inventory-v2` conserva la versión anterior al conteo compartido; `inventory-v3` continúa desde esa base e incorpora usuarios, permisos y conteo compartido con Workers + D1. Todo nuevo trabajo de esta funcionalidad pertenece a `inventory-v3`; no moverlo ni fusionarlo a `inventory-v2` sin solicitud explícita. Comprueba la rama antes de tareas que dependan de esa separación y no mezcles cambios entre ramas por conveniencia.

El objetivo vigente de `inventory-v3` es contar Cocina, Panadería, Pastelería, Servicio y Bodega Principal, y generar en etapa 4 el archivo `inventarios_og/11_10-INVENTARIO-totalizado.xlsx` conservando estructura, identificadores y datos de referencia. Servicio distingue Barra, Línea/Armado, Copería, Mercadito y Garzones; Garzones distingue Zona Privada, Salón y Terraza. Copería recibe Aseo y Mercadito separa Vitrina como ubicación/categoría. El identificador técnico anterior `armado-linea-coperia` se conserva para Línea/Armado. No trasladar cantidades de ciclos anteriores al nuevo reparto. No confundir catálogo cargado, flujo terminado y aceptación operativa.

Roles vigentes: Administrador > Jefa de servicio > Trabajador. La jefa solo opera en Servicio. En cuentas mixtas solo administra accesos de Servicio; usuario, contraseña, activación y eliminación quedan al Administrador. Después del alta, la administración cambia el username y cada persona su nombre visible. Eliminar una cuenta es irreversible, exige confirmación/versionado y conserva autoría, conteos y auditoría. Ver `docs/usuarios-y-servicio-3b.md`.

El módulo de Pedido está separado del módulo de Inventario. No asumir que sus datos, flujos o decisiones son intercambiables.

## Decisiones vigentes de interfaz en esta rama

- Inicio omite selectores de área/sector con una sola opción; Garzones conserva sus zonas. La jefa entra directamente a Servicio sin flecha al selector global. Con varias áreas se mantiene Inicio. Mi perfil permite cambiar el nombre visible; los ámbitos y la identidad se resuelven siempre en servidor.

- La referencia visual vigente usa blanco crema en modo claro y carbón profundo en modo oscuro, con acentos cian y superficies uniformes sin degradados. Las tarjetas de Inicio llevan tintes por área; no copies cifras de la imagen de referencia. Un icono SVG de cuatro cuadros redondeados arriba a la derecha abre el panel de cuenta y ajustes desde la derecha; el cambio de tema está dentro de ese panel. En ingreso sin sesión solo aparece el toggle de tema, sin menú. Rojo identifica pendiente y el botón «Sin stock» antes de guardar; amarillo identifica avance; verde/teal identifica contado y «Sin stock» ya guardado. Conserva las etiquetas de texto junto al color y el comportamiento de ambos temas. El detalle está en `docs/style-guide.md`.
- «Sin stock» guarda cantidad cero como contado y marca `outOfStock`; la insignia, el panel, el resumen y el aviso de guardado usan verde. El aviso dice «Sin stock guardado.». Un cero guardado con «Listo» no lleva esa marca.
- Al volver a un grupo se prioriza el primer ítem pendiente o con avance. La barra superior de conteo mantiene «Anterior / Ver ítems / Siguiente» y el panel de ítems permite acceder también a los ya contados.
- «Ver ítems» abre el panel sin enfocar el buscador ni activar el teclado móvil; la lupa del encabezado sí enfoca la búsqueda. En cada apertura, solo se despliega la categoría del producto actual y se sitúa el producto a la vista; desde una vista sin producto actual todos los grupos empiezan cerrados. Los botones no cambian color ni relieve al pasar el puntero o al pulsarlos; se conserva el foco visible para teclado. Volver y el toggle liberan el foco tras un toque. La luna y el sol se dibujan con SVG para conservar su apariencia entre plataformas. Al cambiar de producto se vuelve al inicio de la página; al regresar al resumen o al Panel de supervisión se restaura su contexto y posición.
- En el resumen, el encabezado solo conserva título y controles: no repetir allí la barra ni el contador y no añadir el subtítulo descriptivo. El progreso se concentra en la tarjeta de avance.
- El indicador breve del resumen es decorativo: el contenido está disponible de inmediato, no intercepta interacción y se omite con movimiento reducido. Los avisos superiores usan color uniforme translúcido, sin degradados; duran cuatro segundos, entran desde arriba y salen hacia arriba, no bloquean gestos y tienen alternativa opaca para transparencia reducida.
- En `inventory-v3` no existen estados AM/PM ni el flujo de Pedido; verifica la rama correspondiente antes de cambiar esas funciones. No incluyas el nombre del empleador en textos de la app o documentación pública.

## Inspección antes de editar

1. Lee las instrucciones aplicables y los archivos pertinentes.
2. Revisa rama, estado de Git y diff existente antes de modificar.
3. Inspecciona las rutas reales. No uses rutas, nombres de campos, claves de almacenamiento, versiones de esquema o cantidades del proyecto anterior sin verificarlas en este checkout.
4. Protege cambios del usuario. No reemplaces archivos con cambios previos sin entenderlos.
5. Si el alcance o una decisión de producto no está claro, continúa las comprobaciones independientes y pregunta solo cuando la respuesta cambie sustancialmente el resultado.

## Coste de delegación — decisión actualizada del usuario, 25-10-2026

El objetivo prioritario es ahorrar tokens totales, no solo tiempo: delegar únicamente si el ahorro esperado supera el coste de arrancar el agente, transferir contexto, coordinarlo y revisar su respuesta. Si consume más tokens que resolverlo directamente, no delegar. Ajustar modelo/esfuerzo a cada tarea; no elegir Medio para todo ni repetir lecturas o pruebas sin motivo nuevo. Esta preferencia vale para todos los trabajos con el usuario.

### Regla conservada del 23-10-2026

No lanzar subagentes con una configuración costosa heredada (GPT-6.1 Sol / Ultra). Ajustar siempre modelo y esfuerzo a la tarea: modelo económico y razonamiento bajo para lecturas, comprobaciones y trabajos acotados; mayor capacidad solo cuando la complejidad lo justifique. No usar Ultra por defecto ni multiplicar agentes de alto coste. Resolver directamente las tareas simples y limitar el número de delegaciones.

Cuando el padre tenga configuración costosa, iniciar el subagente con contexto mínimo y una tarea autosuficiente para poder seleccionar explícitamente modelo y razonamiento económicos. No heredar todo el historial si impide ese ajuste. Esta regla persiste para futuras tareas del proyecto.

## Implementación

- **KISS obligatorio:** usa la solución nativa más simple que resuelva el recorrido; no añadas dependencias, carruseles o infraestructura para animaciones y pequeños ajustes.
- Mantén cambios acotados al objetivo solicitado.
- Sigue la estructura modular existente bajo `pages/` y `data/`.
- Conserva HTML, CSS y JavaScript nativos mientras resuelvan el problema.
- Workers + D1, autenticación y colaboración 3A ya forman parte de esta rama. No incorpores integraciones o dependencias adicionales por anticipado. Las áreas y sus catálogos pertenecen al objetivo vigente.
- Mantén identificadores y datos existentes salvo que el cambio solicitado los requiera.
- Mantén separados los grupos para contar (`countCategory`) de la categoría y demás datos de salida (`exportCategory`, hoja, fila, ID y unidad). En Bodega / Principal, Cocina, Panadería y Pastelería los grupos prácticos se definen por fila en `data/inventario/items/`; cada fila de su hoja debe aparecer exactamente una vez. Reorganizar la pantalla nunca debe cambiar la referencia del Excel.
- Prioriza uso móvil, controles claros, lectura rápida y prevención de pérdida accidental de datos.

## Git y entrega

- No ejecutes `commit`, `push`, `reset`, limpieza destructiva ni publicación salvo solicitud explícita.
- Después de editar, revisa `git diff` y `git status`.
- Ejecuta solo las validaciones pertinentes y solicitadas para el cambio. Describe con precisión qué se comprobó y qué no.

## Documentación

- `README.md`: entrada breve y estructura real del repositorio.
- `docs/project-context.md`: contexto, decisiones, implementación observada y dudas abiertas.
- `docs/roadmap.md`: prioridades, dependencias y criterios de avance.
- `docs/verification.md`: comandos, resultados comprobados y límites de las pruebas.
- `docs/style-guide.md`: identidad visual, componentes, estados, tamaños y accesibilidad.
- `AGENTS.md`: reglas de trabajo para agentes.

Marca como pendiente lo que no esté implementado o decidido. Actualiza la documentación cuando cambie el estado o una decisión; no perpetúes cifras ni descripciones de versiones antiguas.
