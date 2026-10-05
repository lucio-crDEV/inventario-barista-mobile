# AGENTS.md

## Propósito

Este repositorio contiene una aplicación web móvil experimental e independiente para apoyar dos flujos operativos:

- **Inventario Barra**: inventario semanal del área de Barra / Cafetería.
- **Pedido**: preparación de pedidos internos y generación de un mensaje para mensajería.

El proyecto es de carácter personal, experimental y educativo.

No debe presentarse como software oficial de la empresa que sirvió como contexto para desarrollar estos flujos.

Este archivo define cómo debe trabajar un agente en el repositorio.

Para producto, decisiones y planificación consultar:

- `docs/project-context.md`
- `docs/roadmap.md`

No duplicar aquí todo el contexto del producto.

---

## 1. REGLA CRÍTICA: MARCA, IDENTIDAD Y PRESENTACIÓN

### Esta regla es obligatoria y no negociable.

Este proyecto **NO está autorizado a utilizar la marca, nombre comercial, identidad visual ni elementos de branding de la empresa que sirvió como contexto para desarrollar estos flujos**.

El usuario ha indicado expresamente que no posee derechos para utilizar esa marca y que el proyecto no es un producto oficial ni un desarrollo encargado por dicha empresa.

Por lo tanto, un agente **NO DEBE**:

- agregar el nombre de la empresa;
- agregar variantes del nombre;
- agregar formas como “La [marca]”;
- agregar abreviaciones o nombres derivados que puedan confundirse con la marca;
- agregar logotipos;
- reproducir identidad visual corporativa;
- incorporar colores, slogans o elementos gráficos destinados a hacer parecer oficial la aplicación;
- presentar la aplicación como perteneciente, desarrollada para, autorizada por o respaldada por esa empresa;
- utilizar el nombre de la empresa en la interfaz;
- utilizarlo en títulos, textos, mensajes generados, metadata, `title`, `alt`, placeholders o contenido de prueba;
- utilizarlo en nombres de archivos, componentes, variables o identificadores cuando eso implique branding;
- agregarlo a documentación, README, comentarios o ejemplos salvo que sea estrictamente necesario para documentar contexto histórico y el usuario lo haya autorizado expresamente.

### Regla de propagación

Una vez corregido un nombre de marca existente, **ningún cambio futuro debe volver a introducirlo**.

Si un requisito, mockup, referencia, texto heredado o código existente contiene la marca prohibida, el agente debe:

1. evitar reproducirla en código nuevo;
2. mantener el comportamiento mediante un nombre neutral;
3. señalar la existencia del elemento si afecta la tarea;
4. no restaurarlo durante refactors, reescrituras o reorganizaciones.

### Identidad neutral

La aplicación debe mantenerse con una identidad genérica e independiente.

No inventar una nueva marca comercial para reemplazarla salvo decisión explícita del usuario.

Cuando sea necesario mencionar el proyecto, utilizar términos funcionales o neutrales como:

```text
Inventario Barra
Pedido
Inventario
Gestión de stock
```

El repositorio puede mantener su nombre técnico actual:

```text
inventario-barista-mobile
```

siempre que no se utilice para presentar el proyecto como software oficial de la empresa.

---

## 2. Fuente de verdad y prioridad

Antes de modificar algo, distinguir entre:

- instrucción explícita del usuario;
- decisión vigente del proyecto;
- implementación actual;
- pendiente;
- futuro;
- histórico;
- descartado.

Una decisión posterior reemplaza una decisión anterior.

Una idea futura no es un requisito actual.

Un pendiente no implica que exista una solución definida.

Una funcionalidad descartada no debe reaparecer automáticamente.

Cuando código y documentación difieran, identificar la discrepancia antes de decidir cuál refleja la intención correcta.

---

## 3. Branch de trabajo actual

La rama de trabajo de esta línea de desarrollo es:

```text
warehouse-order
```

Esta rama incorpora el módulo **Pedido** y la reorganización modular de la aplicación.

No asumir que sus cambios ya están fusionados en `main`.

No cambiar de rama, fusionar, rebasear ni hacer operaciones destructivas de Git sin una instrucción explícita.

---

## 4. Arquitectura actual

La raíz debe mantenerse pequeña:

```text
inventario-barista-mobile/
├── index.html
├── app.js
├── data/
│   ├── items.js
│   └── warehouse-order-items.js
├── docs/
└── pages/
    ├── inventario/
    │   ├── index.html
    │   ├── inventario.css
    │   └── inventario.js
    └── pedido/
        ├── index.html
        ├── pedido.css
        └── pedido.js
```

`app.js` es el punto de entrada global.

La lógica de negocio debe vivir dentro de su módulo correspondiente.

No volver a convertir `app.js` en un archivo con lógica específica de Inventario o Pedido.

`data/items.js` pertenece a Inventario.

`data/warehouse-order-items.js` pertenece a Pedido.

No fusionar ambos modelos solamente para reutilizar estructuras.

---

## 5. Responsabilidad de los módulos

### Raíz

`index.html` presenta la selección de módulo.

`app.js` contiene comportamiento verdaderamente global y rutas del nivel raíz.

### Inventario

`pages/inventario/` administra toda la experiencia de Inventario Barra:

- categorías;
- conteo;
- estados;
- progreso;
- notas;
- responsable;
- resumen;
- copiar/compartir;
- nueva sesión;
- persistencia local de inventario.

### Pedido

`pages/pedido/` administra toda la experiencia de Pedido:

- zonas;
- búsqueda;
- cantidades;
- pedido actual;
- edición;
- responsable opcional;
- resumen;
- generación del mensaje;
- envío a WhatsApp;
- persistencia local del pedido.

---

## 6. Estado funcional actual

La línea `warehouse-order` ya tiene un flujo funcional para Pedido.

Flujo esperado:

```text
Inicio
  ↓
Pedido
  ↓
Zona
  ↓
Productos
  ↓
Cantidad
  ↓
Pedido actual
  ↓
Resumen / edición
  ↓
WhatsApp
```

Inventario mantiene su flujo propio:

```text
Inicio
  ↓
Inventario Barra
  ↓
Categorías
  ↓
Conteo
  ↓
Resumen
```

Ambos módulos utilizan navegación por flecha hacia el nivel anterior.

---

## 7. Pedido: decisiones vigentes

El módulo se denomina **Pedido** dentro de la estructura técnica y puede utilizar el texto funcional **Pedido a Bodega** cuando sea necesario para describir claramente su propósito.

No solicitar el área de quien hace el pedido.

No implementar estados como enviado, recibido, preparado o entregado dentro de la aplicación.

WhatsApp funciona como registro operativo del pedido.

El responsable es opcional.

La búsqueda es una parte central del flujo.

Las zonas actuales son:

```text
Barra
Servicio / Linea / Armado
Copería
Bebidas y aguas
Generales
```

El catálogo actual contiene 124 ítems y usa `order` como orden lógico de navegación, agrupando familias y evitando intercalar variantes de familias distintas.

---

## 8. UX de Pedido

En la vista principal existe un buscador global y las zonas.

Cuando el buscador contiene texto:

- las tarjetas de zona desaparecen;
- se muestran únicamente los resultados;
- al limpiar la búsqueda vuelven las zonas.

Esta decisión es intencional para evitar que los resultados queden ocultos en pantallas pequeñas.

Dentro de una zona, la búsqueda filtra los productos de esa zona.

Los productos usan controles compactos:

```text
[ − ] 0 [ + ]
```

También se puede editar la cantidad directamente.

Una cantidad de `0` significa que el producto no forma parte del pedido.

Una cantidad mayor que `0` significa que el producto está seleccionado.

No agregar un estado adicional por producto sin una decisión de producto explícita.

La barra inferior muestra el pedido actual y la cantidad de productos seleccionados.

El contador representa ítems/productos distintos, no la suma de unidades solicitadas.

---

## 9. Navegación

La flecha debe representar siempre "volver al nivel anterior".

### Inventario

```text
Categorías
  ← vuelve a Inicio

Categoría / conteo
  ← vuelve a Categorías

Resumen
  ← vuelve a Categorías
```

### Pedido

```text
Zonas / búsqueda global
  ← vuelve a Inicio

Zona / resultados
  ← vuelve a Zonas

Resumen
  ← vuelve a Zonas
```

No agregar un enlace `Inicio` adicional en la esquina superior derecha.

Mantener este patrón al agregar nuevas pantallas.

---

## 10. Persistencia

Inventario utiliza:

```text
inventario-barra-session-v2
```

con:

```text
schemaVersion: 3
```

Pedido utiliza:

```text
pedido-bodega-session-v1
```

No mezclar ambas sesiones.

La persistencia actual es local mediante `localStorage`.

No interpretarla como base de datos, sincronización remota ni historial.

---

## 11. Catálogo de Inventario

`data/items.js` es la fuente canónica de Inventario Barra.

El modelo vigente es:

```text
id
name
category
area
unit
order
active
```

No cambiar IDs gratuitamente.

La categorización y las unidades pueden seguir evolucionando mientras se validan con el uso real.

---

## 12. Catálogo de Pedido

`data/warehouse-order-items.js` es la fuente canónica de Pedido.

El modelo vigente es:

```text
id
name
zone
unit
order
active
```

`zone` organiza el catálogo por zona operativa.

`order` define navegación y agrupación lógica de familias.

`active` permite ocultar temporalmente productos sin eliminarlos del catálogo.

No introducir `category`, `area` u otros campos del modelo de Inventario en este catálogo salvo que exista una necesidad concreta y una decisión explícita.

---

## 13. WhatsApp

El Pedido genera un mensaje de texto agrupado por zona.

Formato conceptual:

```text
📦 PEDIDO

Responsable: Nombre

BARRA
• Producto: 2

COPERÍA
• Producto: 1

Total: 2 productos
```

El responsable se incluye únicamente cuando existe.

No registrar dentro de la aplicación el estado posterior del pedido.

El mensaje generado tampoco debe introducir ninguna marca no autorizada.

---

## 14. Qué no implementar todavía

Salvo decisión explícita, no agregar:

- historial de pedidos;
- estados de pedido;
- backend;
- base de datos;
- cuentas/login;
- PIN;
- integración con GetJusto;
- mínimos de stock;
- bajo stock;
- cámara/IA;
- sincronización remota;
- nuevas áreas de Inventario;
- PWA/offline;
- branding o identidad visual de la empresa del contexto original.

La lista anterior es una restricción actual, no una lista de tareas pendientes.

---

## 15. Principios de implementación

Aplicar KISS.

Preferir:

- cambios pequeños;
- bajo acoplamiento;
- comportamiento explícito;
- HTML/CSS/JavaScript vanilla;
- reutilización razonable sin abstraer prematuramente.

No introducir frameworks, bundlers o librerías sin necesidad concreta.

No hacer un refactor arquitectónico grande como efecto secundario de un ajuste pequeño.

No mezclar cambios de Inventario y Pedido si no es necesario.

No introducir branding para "mejorar" la interfaz.

---

## 16. Mobile first

El teléfono es el entorno principal.

Priorizar:

- controles táctiles;
- lectura rápida;
- campos fáciles de usar;
- navegación evidente;
- densidad útil;
- poca fricción.

Compactar no significa hacer controles pequeños.

---

## 17. Estado técnico conocido

`styles.css` en la raíz puede existir temporalmente como residuo del proyecto anterior.

Si ya no es referenciado por las páginas activas, puede eliminarse como limpieza separada después de verificar todas las referencias.

No eliminarlo automáticamente dentro de una tarea no relacionada.

El `app.js` de la raíz mantiene un registro de rutas mediante `MODULE_ROUTES` y lógica para elementos `[data-module]`.

El `index.html` actual puede usar enlaces directos a las rutas y no necesariamente necesita `[data-module]`.

Esto no bloquea el funcionamiento actual y puede resolverse posteriormente como una limpieza/refactorización independiente.

---

## 18. Git

Trabajar de forma conservadora.

Revisar:

```text
git status
git diff
git diff --check
```

No ejecutar automáticamente:

- `git reset --hard`;
- limpieza destructiva;
- `git commit`;
- `git push`;
- merge/rebase.

Commit y push requieren solicitud explícita del usuario.

La rama actual de esta línea de trabajo es:

```text
warehouse-order
```

---

## 19. Validación

Después de modificar código:

1. revisar el diff;
2. ejecutar validaciones pertinentes;
3. comprobar sintaxis JavaScript;
4. probar el comportamiento afectado cuando sea posible.

No afirmar que algo fue probado si no lo fue.

Además, antes de finalizar una tarea, verificar que no se haya reintroducido accidentalmente la marca o identidad restringida.

---

## 20. Documentación

Responsabilidades:

- `AGENTS.md` → reglas de trabajo del agente.
- `docs/project-context.md` → contexto, arquitectura, decisiones y estado actual.
- `docs/roadmap.md` → fases y próximos pasos.
- `README.md` → entrada rápida para una persona.

No crear Markdown nuevo para cada cambio.

Actualizar documentación cuando cambien decisiones, alcance, arquitectura, estado importante o cuestiones abiertas.

La documentación tampoco debe presentar el proyecto como producto oficial de la empresa del contexto original.

---

## 21. Regla de oro

No construir por construir.

Primero utilidad.  
Después evidencia.  
Después mejoras justificadas.

La complejidad debe aumentar únicamente cuando el flujo real lo justifique.

Y ninguna mejora visual, técnica o funcional justifica introducir una marca o identidad para la cual el proyecto no tiene autorización.
