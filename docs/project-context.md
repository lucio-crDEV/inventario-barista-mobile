# Contexto del proyecto — Inventario Barra

## 1. Identidad

**Nombre actual:** Inventario Barra

**Tipo:** aplicación web móvil

**Proyecto:** ejercicio práctico para digitalizar el inventario semanal de Barra / Cafetería de Brioche Bakery.

El objetivo no es construir inicialmente un sistema completo de gestión de inventario.

El objetivo es resolver correctamente el flujo de inventario de Barra y aprender de su uso real.

---

# 2. Problema que se busca resolver

El inventario requiere recorrer físicamente productos y registrar cantidades.

La herramienta debe reducir la fricción del proceso y facilitar:

- navegación;
- conteo;
- seguimiento del avance;
- revisión;
- conservación del progreso;
- generación del resumen.

La interfaz debe adaptarse al trabajo real de quien realiza el inventario.

---

# 3. Contexto operativo

El inventario semanal se realiza al cierre del domingo, alrededor de las 22:00.

El negocio cuenta con distintos sectores y flujos operativos.

Existen procesos separados para pedidos de proveedores y otros pedidos internos.

La gestión de proveedores no forma parte de este proyecto.

GetJusto es parte de la operación del negocio, pero no se integra con la aplicación en el alcance actual.

El proyecto se concentra exclusivamente en el inventario de Barra.

---

# 4. Alcance actual

El MVP trabaja únicamente con:

**Barra / Cafetería.**

No incluye actualmente:

- Panadería;
- Pastelería;
- Cocina;
- Coparía;
- otras áreas operativas.

La decisión de reducir el alcance fue deliberada.

Primero se busca validar una solución concreta y pequeña.

---

# 5. Historia resumida

## 5.1 Estructura inicial

El repositorio se inició el 7 de julio de 2026 como una estructura vacía.

## 5.2 Primer MVP

El 27 de septiembre de 2026 se creó el primer MVP funcional.

Ese desarrollo estableció el motor del inventario:

- sesión;
- conteo;
- estados;
- navegación;
- persistencia local;
- resumen;
- responsable;
- copiar / compartir;
- decimales.

## 5.3 Ajustes posteriores

El 28 de septiembre se eliminaron acciones innecesarias del resumen y se ajustó visualmente el modal de nuevo inventario.

El 30 de septiembre se cambió la denominación de:

`Inventario Barista`

a:

`Inventario Barra`

Ese cambio también actualizó:

- título de la página;
- encabezado;
- título al compartir;
- texto del resumen;
- clave utilizada para `localStorage`.

## 5.4 Catálogo

El 1 de octubre se actualizó `data/items.js` con el catálogo operativo actual de Barra.

Ese cambio representa la transición desde un catálogo de prueba muy pequeño hacia el catálogo real utilizado para la siguiente etapa.

## 5.5 Ajustes de resumen y responsable

El 2 de octubre se simplificó la información secundaria del resumen cuando todavía hay ítems por completar y se compactó la sección del responsable. El campo ahora explica directamente quién debe ingresar su nombre y muestra `Nombre` como placeholder. También se acortó el mensaje de error de cantidad inválida.

---

# 6. Estado auditado

La versión de referencia utilizada para esta documentación corresponde al commit:

`32b7fd5 — update items`

El repositorio auditado contiene:

```text
README.md
app.js
index.html
styles.css
data/items.js
```

La estructura no requiere actualmente frameworks ni backend.

---

# 7. Arquitectura actual

## `index.html`

Contiene:

- estructura base;
- encabezado;
- progreso;
- contenedor principal;
- modal de confirmación para nuevo inventario;
- carga de `app.js` como módulo.

## `styles.css`

Contiene la presentación visual de:

- aplicación;
- navegación;
- tarjeta de ítem;
- estados;
- campos;
- botones;
- feedback;
- resumen;
- modal;
- comportamiento móvil.

## `app.js`

Contiene la lógica de:

- sesión;
- persistencia;
- estados;
- cantidades;
- navegación;
- progreso;
- renderizado;
- resumen;
- responsable;
- copiar;
- compartir;
- nueva sesión.

## `data/items.js`

Contiene el catálogo operativo.

---

# 8. Motor de inventario

La Fase 1 está completada.

El motor actual dispone de:

- `pending`;
- `partial`;
- `counted`;
- `localStorage`;
- navegación;
- resumen;
- responsable;
- copiar;
- compartir;
- cantidades decimales.

---

# 9. Estados

Los estados actuales son:

### `pending`

Ítem sin conteo completado.

### `partial`

Existe una cantidad registrada, pero el ítem todavía se considera parcialmente procesado.

### `counted`

El ítem se considera completamente contado.

Visualmente se muestran como:

```text
🔴 Pendiente
🟡 Parcial
🟢 Contado
```

El motor utiliza los identificadores:

```text
pending
partial
counted
```

---

# 10. Cantidades y decimales

La aplicación acepta cantidades no negativas.

La entrada admite tanto:

```text
1.4
```

como:

```text
1,4
```

El mensaje de error para una cantidad inválida es breve y no repite ejemplos de formato.

El valor se normaliza internamente a número.

La presentación utiliza formato `es-CL`.

Actualmente se muestran hasta tres decimales.

---

# 11. Persistencia

La aplicación utiliza:

```text
localStorage
```

La clave actual es:

```text
inventario-barra-session-v2
```

La sesión utiliza:

```text
schemaVersion: 3
```

La sesión guarda, entre otros:

- `id`;
- fecha;
- inicio;
- índice actual;
- vista;
- responsable;
- conteos.

La versión 3 abre las sesiones que estaban contando con la versión anterior en la cuadrícula de categorías. Conserva los conteos existentes.

Esto es persistencia local.

No equivale a:

- base de datos;
- backend;
- sincronización remota;
- historial permanente.

No existe actualmente un historial de sesiones anteriores.

---

# 12. Nueva sesión

La acción de nuevo inventario solicita confirmación antes de eliminar la sesión actual.

La eliminación afecta el progreso local, incluidos:

- cantidades;
- notas;
- estados;
- progreso.

La acción no es reversible mediante un historial.

Esto es consistente con que el historial esté descartado.

---

# 13. Responsable

El inventario utiliza un campo de responsable.

Su propósito es identificar a la persona que realiza y envía el inventario.

El nombre se conserva en la sesión.

El resumen compartido incluye el responsable.

Esto **no es autenticación**.

No introducir login ni PIN como continuación natural de esta funcionalidad.

---

# 14. Navegación

El inventario comienza con una cuadrícula de categorías derivadas de los ítems activos. En teléfono se muestran dos categorías por fila y la cuadrícula se adapta al número de categorías disponible.

Cada categoría muestra:

- ítems contados / total de ítems;
- ítems parciales cuando existen.

Al seleccionar una categoría, la vista de conteo permite:

- seleccionar un ítem de esa categoría;
- ir al anterior o siguiente dentro de la misma categoría;
- volver a las categorías mediante la flecha ubicada a la izquierda del título;
- seleccionar un ítem desde un menú desplegable que ocupa todo el ancho;
- ir al resumen.

Al guardar un ítem como contado o parcial, la aplicación avanza al siguiente ítem de la categoría. Al guardar el último ítem de esa categoría, vuelve a la cuadrícula. Si con el guardado ya no quedan ítems pendientes (incluidos los parciales), abre directamente el resumen. En el resumen, el botón `Ver categorías` permite volver a la cuadrícula; los ítems del resumen también se pueden abrir para editarlos dentro de su categoría.

La acción central del flujo es recorrer las categorías y registrar el conteo.

---

# 15. Progreso

El progreso ya está implementado.

Se representa mediante:

- texto de ítems contados / total;
- barra visual debajo del título y encima del texto.

El texto superior muestra los ítems `counted` sobre el total. La barra distingue los contados en verde, los parciales en amarillo y deja el espacio pendiente en gris claro. Los parciales también siguen visibles por separado en cada categoría y en el resumen.

El resumen conserva la estadística de procesados, que suma parciales y contados:

```text
processed = partial + counted
```

Fase 2 no debe reconstruir el motor de progreso desde cero.

La finalidad es revisar su presentación y comportamiento para el inventario real.

---

# 16. Feedback

Existe feedback para acciones relevantes.

Actualmente se utiliza para confirmar o comunicar, entre otras cosas:

- guardado de conteo;
- guardado parcial;
- errores de cantidad;
- copiado;
- compartido.

Fase 2 busca refinar este feedback según su utilidad real en teléfono.

No hacerlo más llamativo simplemente por hacerlo.

---

# 17. Resumen

El resumen actual presenta estadísticas de:

- pendientes;
- parciales;
- contados.

También agrupa los ítems por estado.

Los ítems del resumen se pueden seleccionar para volver a editarlos.

Cuando el inventario está completo, el resumen cambia su estado visual a:

**Inventario completo**

y comunica que todos los ítems están contabilizados.

---

# 18. Copiar y compartir

El resumen puede:

- copiarse al portapapeles;
- compartirse mediante `navigator.share` cuando el dispositivo lo permite.

La acción requiere que exista un responsable.

El contenido compartido utiliza:

**INVENTARIO BARRA**

e incluye:

- fecha;
- responsable;
- estadísticas;
- detalle de los ítems;
- cantidades;
- unidades;
- notas;
- estado parcial cuando corresponde.

---

# 19. Catálogo actual

La versión actual de `data/items.js` contiene:

**70 ítems activos.**

Los `order` actuales van del:

`1 → 70`

El modelo vigente contiene:

```text
id
name
category
area
unit
order
active
```

## Significado

### `id`

Identificador estable del producto.

No debe cambiarse gratuitamente.

### `name`

Nombre visible del producto.

Puede requerir normalización posterior.

### `unit`

Unidad con la que actualmente se registra el conteo.

Debe revisarse respecto del proceso físico real.

### `order`

Orden de presentación del inventario.

En Fase 2 debe avanzar hacia el orden físico real.

### `active`

Determina si el ítem participa en el inventario actual.

---

# 20. Categorías

Las categorías son un trabajo activo del catálogo y ya están incorporadas en `data/items.js`.

La aplicación las utiliza para organizar el inicio del conteo y limitar la navegación y el selector de ítems a la categoría elegida.

No existe todavía una taxonomía definitiva aceptada como fuente única.

La clasificación todavía no constituye una taxonomía definitiva y puede evolucionar con el uso.

La intención es:

```text
catálogo real
    ↓
organización razonable
    ↓
uso / revisión
    ↓
refinamiento
```

No completar categorías únicamente para satisfacer al código.

La categoría debe tener sentido operativo y facilitar realmente la lectura o futura organización del inventario.

---

# 21. `area`

Todos los ítems activos pertenecen actualmente al área `Barra`.

El campo se incluye en cada objeto de `data/items.js` para que la aplicación pueda mostrar el área. Si se incorporan otras áreas en el futuro, cada ítem deberá indicar la que corresponda.

---

# 22. Discrepancia técnica conocida

La discrepancia entre `app.js` y el catálogo por las propiedades `category` y `area` quedó resuelta: ambos campos están presentes en los objetos de `data/items.js`.


---

# 23. Orden físico

El orden actual está almacenado mediante `order`.

El siguiente objetivo del catálogo es hacer que dicho orden coincida con el recorrido físico que se utiliza al inventariar Barra.

El objetivo no es simplemente obtener un orden alfabético o visualmente bonito.

Se busca:

- menos desplazamiento;
- menos búsqueda;
- menos interrupción;
- flujo más natural.

---

# 24. UX

La aplicación está orientada a teléfono.

Fase 2 debe llevar la interfaz a una versión adecuada para uso real.

Las principales preocupaciones son:

- controles fáciles de tocar;
- lectura rápida;
- entrada de cantidad clara;
- navegación evidente;
- feedback útil;
- progreso visible;
- poca fricción;
- densidad de información adecuada.

---

# 25. Compactación visual

Compactar significa aprovechar mejor el espacio disponible.

No significa hacer todos los elementos pequeños.

La optimización debe preservar:

- legibilidad;
- accesibilidad;
- tamaño táctil;
- comprensión.

---

# 26. Qué no debe inferirse del código

El código actual puede contener restos de etapas anteriores.

Especialmente:

- propiedades `category`;
- propiedades `area`;
- decisiones de nomenclatura antiguas.

La existencia de una referencia antigua no significa que la decisión de producto siga vigente.

---

# 27. Decisiones descartadas

Actualmente están descartados:

- historial;
- DB;
- cámara;
- login;
- PIN;
- otras áreas.

No son simplemente "pendientes".

No deben reaparecer automáticamente como tareas.

---

# 28. Principios de producto

## KISS

Mantener la solución simple.

## Mobile first

El teléfono es el entorno principal de uso.

## Funcional antes que perfecto

Primero conseguir un flujo que funcione y pueda probarse.

## Real antes que especulativo

Las mejoras posteriores deben surgir del trabajo real.

## No construir por posibilidad técnica

Que algo pueda hacerse no significa que deba hacerse.

---

# 29. Regla de interpretación

### Implementado

Puede comprobarse en el código actual.

### Decidido

Existe una decisión explícita que sigue vigente.

### Pendiente

Existe una cuestión que requiere trabajo o definición.

### Futuro

Pertenece a una fase posterior.

### Descartado

Actualmente no debe implementarse.

### Histórico

Existió en una versión anterior pero no representa necesariamente el estado actual.

---

# 30. Principio final

El producto debe evolucionar de forma incremental:

```text
hacerlo funcionar
      ↓
hacerlo adecuado para Barra
      ↓
probarlo en condiciones reales
      ↓
observar problemas
      ↓
mejorar lo que realmente importe
```

La complejidad debe aumentar únicamente cuando la utilidad lo justifique.
