# AGENTS.md — inventory-v2

## Propósito

Este repositorio desarrolla `inventory-v2`: una aplicación web modular para gestionar inventario y, en una rama de trabajo separada, pedidos internos. No confundirlo con la aplicación anterior **Inventario Barra** ni trasladar automáticamente a esta rama sus límites de producto o su roadmap.

Para conocer estado, decisiones y trabajo pendiente, consulta `docs/project-context.md` y `docs/roadmap.md`. Este archivo contiene reglas de trabajo, no una copia del contexto completo.

## Cómo interpretar el proyecto

Antes de actuar, separa explícitamente:

- decisiones vigentes del usuario;
- comportamiento comprobable en el código de esta rama;
- trabajo pendiente o en exploración;
- contexto histórico de otras ramas y versiones.

El código muestra lo implementado, no necesariamente todas las decisiones de producto. La documentación expresa intención, pero puede quedar obsoleta. Si se contradicen, identifica la diferencia y no conviertas una inferencia en requisito.

## Ramas y alcance

El proyecto mantiene líneas de trabajo diferenciadas: `main` corresponde a la versión estable anterior de Inventario Barra; `warehouse-order` corresponde al trabajo de Pedido a Bodega; `inventory-v2` es la evolución del sistema de inventario. Comprueba la rama antes de tareas que dependan de esa separación y no mezcles cambios entre ramas por conveniencia.

El objetivo vigente de `inventory-v2` es contar Cocina, Panadería, Pastelería, Servicio y Bodega Principal, y generar el archivo `inventarios_og/11_10-INVENTARIO-totalizado.xlsx` conservando su estructura, identificadores y datos de referencia; solo deben actualizarse las cantidades contadas. Servicio se cuenta en Barra, Armado/Línea/Copería, Mercadito y Garzones; Garzones distingue Zona Privada, Salón y Terraza. Los catálogos y la navegación pueden avanzar por etapas. No confundas una lista cargada con un flujo completo ni con sincronización entre teléfonos.

El módulo de Pedido está separado del módulo de Inventario. No asumir que sus datos, flujos o decisiones son intercambiables.

## Inspección antes de editar

1. Lee las instrucciones aplicables y los archivos pertinentes.
2. Revisa rama, estado de Git y diff existente antes de modificar.
3. Inspecciona las rutas reales. No uses rutas, nombres de campos, claves de almacenamiento, versiones de esquema o cantidades del proyecto anterior sin verificarlas en este checkout.
4. Protege cambios del usuario. No reemplaces archivos con cambios previos sin entenderlos.
5. Si el alcance o una decisión de producto no está claro, continúa las comprobaciones independientes y pregunta solo cuando la respuesta cambie sustancialmente el resultado.

## Implementación

- Mantén cambios acotados al objetivo solicitado.
- Sigue la estructura modular existente bajo `pages/` y `data/`.
- Conserva HTML, CSS y JavaScript nativos mientras resuelvan el problema.
- No incorpores integraciones, persistencia remota o dependencias por anticipado. Las áreas y sus catálogos pertenecen al objetivo vigente.
- Mantén identificadores y datos existentes salvo que el cambio solicitado los requiera.
- Prioriza uso móvil, controles claros, lectura rápida y prevención de pérdida accidental de datos.

## Git y entrega

- No ejecutes `commit`, `push`, `reset`, limpieza destructiva ni publicación salvo solicitud explícita.
- Después de editar, revisa `git diff` y `git status`.
- Ejecuta solo las validaciones pertinentes y solicitadas para el cambio. Describe con precisión qué se comprobó y qué no.

## Documentación

- `README.md`: entrada breve y estructura real del repositorio.
- `docs/project-context.md`: contexto, decisiones, implementación observada y dudas abiertas.
- `docs/roadmap.md`: prioridades, dependencias y criterios de avance.
- `AGENTS.md`: reglas de trabajo para agentes.

Marca como pendiente lo que no esté implementado o decidido. Actualiza la documentación cuando cambie el estado o una decisión; no perpetúes cifras ni descripciones de versiones antiguas.
