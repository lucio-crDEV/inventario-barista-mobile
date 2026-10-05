# Inventario Barra / Pedido a Bodega

Aplicación web móvil experimental e independiente para apoyar dos flujos operativos:

- Inventario Barra
- Pedido a Bodega

El proyecto busca resolver necesidades concretas con una implementación simple, móvil y modular, evitando incorporar complejidad antes de que el uso real la justifique.

## Naturaleza del proyecto

Este repositorio es un proyecto personal, experimental y educativo.

No es un producto oficial de la empresa que sirvió como contexto para definir algunos de sus flujos.

El proyecto **no cuenta con autorización para utilizar su marca, nombre comercial, logotipo, identidad visual ni elementos que puedan hacer parecer que la aplicación es oficial, fue encargada por ella o cuenta con su respaldo**.

La interfaz, documentación, mensajes, metadata y código nuevo deben mantenerse neutrales e independientes.

## Estado actual

La rama de trabajo actual es:

```text
warehouse-order
```

Esta rama incorpora:

- reorganización modular del proyecto;
- módulo Inventario Barra;
- módulo Pedido a Bodega;
- catálogo independiente para Pedido;
- búsqueda;
- selección de cantidades;
- pedido actual;
- resumen editable;
- responsable opcional;
- generación de mensaje para WhatsApp;
- persistencia local.

El flujo funcional de Pedido está en un checkpoint estable para comenzar una nueva etapa de pruebas, UX y refactorización.

## Estructura

```text
.
├── AGENTS.md
├── README.md
├── app.js
├── index.html
│
├── data/
│   ├── items.js
│   └── warehouse-order-items.js
│
├── docs/
│   ├── project-context.md
│   └── roadmap.md
│
└── pages/
    ├── inventario/
    │   ├── index.html
    │   ├── inventario.css
    │   └── inventario.js
    │
    └── pedido/
        ├── index.html
        ├── pedido.css
        └── pedido.js
```

Existe actualmente un `styles.css` heredado en la raíz. Su eliminación definitiva queda pendiente de una comprobación de referencias y una limpieza separada.

## Módulos

### Inventario Barra

Ubicación:

```text
pages/inventario/
```

Fuente de datos:

```text
data/items.js
```

El módulo administra:

- categorías;
- conteo;
- estados pendiente/parcial/contado;
- progreso;
- notas;
- responsable;
- resumen;
- copiar/compartir;
- persistencia local.

### Pedido a Bodega

Ubicación:

```text
pages/pedido/
```

Fuente de datos:

```text
data/warehouse-order-items.js
```

El módulo administra:

- zonas;
- búsqueda;
- cantidades;
- pedido actual;
- edición;
- responsable opcional;
- resumen;
- generación del mensaje;
- envío por WhatsApp;
- persistencia local.

## Modelos de datos

Inventario y Pedido utilizan modelos separados deliberadamente.

### Inventario

```js
{
  id,
  name,
  category,
  area,
  unit,
  order,
  active
}
```

Fuente:

```text
data/items.js
```

### Pedido

```js
{
  id,
  name,
  zone,
  unit,
  order,
  active
}
```

Fuente:

```text
data/warehouse-order-items.js
```

No convertir ambos catálogos en un modelo único salvo que exista una necesidad real y una decisión explícita.

## UX de Pedido

La vista principal muestra las zonas y un buscador global.

Sin búsqueda:

```text
Barra
Servicio / Linea / Armado
Copería
Bebidas y aguas
Generales
```

Con una búsqueda activa:

- las zonas desaparecen;
- se muestran solamente los resultados;
- al limpiar el campo, las zonas vuelven.

Los productos utilizan controles compactos:

```text
[ − ] 0 [ + ]
```

Una cantidad de `0` significa que el producto no está seleccionado.

Una cantidad mayor que `0` significa que forma parte del pedido.

El resumen permite editar cantidades y continuar agregando productos.

## Navegación

La flecha superior representa siempre el nivel anterior.

### Inventario

```text
Inicio
  ↓
Inventario Barra
  ← Inicio

Inventario Barra
  ↓
Categoría / conteo
  ← Categorías

Resumen
  ← Categorías
```

### Pedido

```text
Inicio
  ↓
Pedido a Bodega
  ← Inicio

Pedido a Bodega
  ↓
Zona / resultados
  ← Pedido a Bodega

Pedido actual
  ← Zonas
```

No agregar un enlace adicional de "Inicio" en la esquina superior derecha.

## Persistencia

Inventario:

```text
localStorage
inventario-barra-session-v2
schemaVersion: 3
```

Pedido:

```text
localStorage
pedido-bodega-session-v1
```

Ambos almacenamientos son independientes.

Actualmente no existe sincronización remota, backend ni base de datos.

## WhatsApp

Pedido genera un mensaje agrupado por zona.

Ejemplo conceptual:

```text
📦 PEDIDO A BODEGA

Responsable: Nombre

BARRA
• Café: 2
• Leche entera: 3

COPERÍA
• Lavaloza: 2

Total: 3 productos
```

WhatsApp funciona como canal y registro operativo.

La aplicación no mantiene estados internos de enviado, recibido, preparado o entregado.

## Desarrollo

Tecnologías actuales:

```text
HTML
CSS
JavaScript
localStorage
Web Share API
```

No se utilizan frameworks ni dependencias externas para el funcionamiento principal.

La prioridad es mantener el proyecto simple y fácil de modificar.

## Documentación

### `AGENTS.md`

Reglas que debe seguir cualquier agente que trabaje en el repositorio.

### `docs/project-context.md`

Contexto consolidado del producto, arquitectura, decisiones y estado actual.

### `docs/roadmap.md`

Fases, líneas de desarrollo y próximos pasos.

## Principios

```text
Primero utilidad.
Después evidencia.
Después mejora.
Después escalabilidad cuando sea necesaria.
```

La arquitectura debe permitir crecer sin obligar al proyecto a implementar hoy funcionalidades que todavía no necesita.

Preferir:

- cambios pequeños;
- módulos independientes;
- modelos separados;
- bajo acoplamiento;
- HTML/CSS/JavaScript vanilla;
- mobile first;
- refactorizaciones justificadas.

## Fuera del alcance actual

No forman parte de la implementación actual:

```text
backend
base de datos
cuentas
login
PIN
historial de pedidos
estados de pedidos
mínimos de stock
bajo stock
GetJusto
cámara
IA visual
sincronización remota
otras áreas de Inventario
PWA/offline
```

Estas funcionalidades solamente podrán incorporarse mediante una decisión posterior explícita.

## Git

La rama actual de esta línea de desarrollo es:

```text
warehouse-order
```

Antes de aceptar cambios:

```bash
git status
git diff
git diff --check
```

Los cambios deben mantenerse revisables y los commits deben representar unidades funcionales claras.

No realizar automáticamente operaciones destructivas, merges, rebases, commits o pushes sin instrucción explícita.
