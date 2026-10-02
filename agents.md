# AGENTS.md — Inventario Barra

## Propósito

Este repositorio contiene un MVP web móvil para digitalizar el inventario semanal del área de Barra / Cafetería de Brioche Bakery.

La prioridad del agente es ayudar a evolucionar el producto sin ampliar accidentalmente su alcance y sin convertir decisiones todavía provisionales en reglas definitivas.

## Contexto de trabajo

`docs/project-context.md` contiene el contexto consolidado del proyecto: problema, proceso de negocio conocido, estado actual, arquitectura, modelo de datos, decisiones, historia y pendientes.

`docs/roadmap.md` contiene la secuencia de trabajo acordada y posibles evoluciones futuras.

No es necesario leer todos los documentos o toda la historia para cada tarea. Consulta la sección pertinente de `docs/project-context.md` según el trabajo que vayas a realizar.

## Cómo interpretar la documentación

Distingue entre:

- **Implementado:** comportamiento comprobable en el código actual.
- **Decidido:** dirección acordada que sigue vigente.
- **Pendiente:** cuestión abierta.
- **Histórico:** algo que se consideró anteriormente y que no debe tratarse como requisito actual.

Cuando código y documentación discrepen, no ocultes la discrepancia. Describe primero qué hace realmente el código y, por separado, qué intención o decisión está documentada.

No cierres una cuestión marcada como pendiente sin una instrucción o evidencia suficiente.

## Alcance del MVP

El MVP está limitado a Barra / Cafetería.

No agregues por iniciativa propia otras áreas, integración con GetJusto, backend, base de datos, historial de inventarios, cámara ni stock mínimo. Estas ideas pueden reconsiderarse posteriormente.

La existencia de una idea futura no constituye un requisito actual.

## Prioridad actual del producto

La secuencia de trabajo acordada es:

1. Conseguir y mantener un flujo de inventario funcional.
2. Probarlo y observar su utilidad real.
3. Refinar posteriormente el catálogo, sus categorías, nombres, unidades y otros detalles.

Una clasificación de catálogo pendiente no bloquea por sí sola una mejora funcional del MVP.

En particular, `category` está pendiente de refinamiento. No inventes una taxonomía definitiva solo para completar datos.

## Principios de implementación

- Aplica KISS: soluciones simples y directas.
- Mantén HTML, CSS y JavaScript vanilla mientras siga siendo suficiente.
- No introduzcas frameworks, dependencias, bundlers o nuevas capas arquitectónicas sin una razón concreta.
- Prioriza uso móvil y rapidez en un contexto operativo.
- Prefiere cambios pequeños, reversibles y fáciles de revisar.
- Reutiliza la estructura existente antes de crear abstracciones nuevas.
- No hagas refactors amplios como efecto colateral de una tarea pequeña.
- Trata los `id` de `data/items.js` como identificadores estables; no los cambies gratuitamente.

## Catálogo

`data/items.js` es el catálogo actual.

Los campos actualmente presentes son:

- `id`
- `name`
- `unit`
- `order`
- `active`

No asumas que `category` o `area` son campos definitivos del modelo actual solo porque hayan existido en una versión anterior o aparezcan referenciados por código que todavía necesita revisión.

Antes de normalizar nombres, categorías o unidades, distingue entre una corrección técnica necesaria y una decisión de negocio pendiente.

## Estado de la aplicación

La implementación actual usa una sesión local y `localStorage`.

Los estados funcionales son:

- `pending`
- `partial`
- `counted`

No cambies su significado sin revisar la decisión correspondiente en `docs/project-context.md`.

## Flujo de trabajo con Codex

Para una tarea pequeña:

1. Inspecciona los archivos relevantes.
2. Explica brevemente lo que vas a cambiar.
3. Haz el cambio más pequeño que resuelva la tarea.
4. Verifica el resultado.
5. Revisa `git diff` y `git status` antes de concluir.

Para cambios grandes, refactors o trabajo con varias partes acopladas, usa `/plan` antes de implementar.

No hagas commits ni pushes automáticamente salvo que el usuario lo solicite.

No sobrescribas cambios no relacionados del usuario.

## Verificación

Después de modificar código:

- revisa el diff;
- ejecuta las validaciones disponibles;
- comprueba al menos la sintaxis JavaScript cuando corresponda;
- verifica el flujo afectado si el entorno lo permite;
- informa claramente qué se comprobó y qué no pudo comprobarse.

No declares algo verificado solo porque el código parezca correcto.

## Documentación

Actualiza `docs/project-context.md` cuando cambie el estado, el modelo, una decisión o una cuestión pendiente relevante.

Actualiza `docs/roadmap.md` solo cuando cambie la secuencia de trabajo o la planificación futura.

No edites este `AGENTS.md` por cada cambio del proyecto. Solo modifícalo cuando cambien las reglas generales que deben seguir los agentes.

## Si falta información

No inventes reglas de negocio, datos de inventario ni decisiones de producto.

Implementa lo que esté definido y deja explícita la parte que siga abierta.

Cuando una ambigüedad afecte materialmente al resultado, detén esa parte y solicita el dato necesario en lugar de asumirlo.

## Documentación oficial de OpenAI

Cuando una tarea dependa de Codex, su CLI, API, herramientas o productos de OpenAI, consulta la documentación oficial actual disponible para el agente (por ejemplo, el OpenAI Developer Docs MCP si está configurado).