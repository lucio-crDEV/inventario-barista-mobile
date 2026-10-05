# Roadmap del proyecto

Este documento define la secuencia de evolución acordada para el proyecto.

Las fases y líneas de trabajo representan prioridades de desarrollo.

Una funcionalidad futura no debe adelantarse simplemente porque sea técnicamente posible.

Una decisión posterior puede modificar, reemplazar o eliminar cualquier punto del roadmap.

---

# PRINCIPIOS DEL ROADMAP

El proyecto sigue una filosofía de evolución incremental:

```text
1. Hacer que funcione.
2. Hacer que funcione bien.
3. Probarlo en uso real.
4. Detectar problemas reales.
5. Mejorar aquello que demuestre utilidad.
```

No construir funcionalidades solamente porque sean posibles.

No convertir el proyecto en un sistema empresarial por anticipación.

No confundir arquitectura escalable con necesidad de implementar más funcionalidades.

---

# RESTRICCIÓN CRÍTICA DE IDENTIDAD

El proyecto es independiente y experimental.

No existe autorización para utilizar la marca, nombre comercial, logotipo, identidad visual o elementos de branding de la empresa que sirvió como contexto original.

Por lo tanto, ninguna fase o línea de trabajo debe:

- introducir esa marca;
- introducir variantes del nombre;
- reproducir logotipos;
- incorporar identidad visual corporativa;
- presentar el proyecto como software oficial;
- sugerir que fue encargado, autorizado o respaldado por dicha empresa.

Cualquier branding heredado debe considerarse residuo a eliminar.

Esta restricción es permanente mientras el usuario no indique explícitamente lo contrario.

---

# FASE 1 — MOTOR DE INVENTARIO ✅

**Estado: COMPLETADA**

Objetivo:

Construir el motor funcional básico del inventario.

Incluye:

```text
pending
partial
counted
localStorage
navegación
resumen
responsable
copiar / compartir
decimales
```

La Fase 1 establece la base funcional del módulo de Inventario.

---

# FASE 2 — INVENTARIO BARRA ← ACTUAL

**Estado: EN DESARROLLO**

Objetivo:

Convertir el motor existente en una herramienta realmente adecuada para el inventario de Barra.

Esta fase pertenece específicamente al módulo:

```text
pages/inventario/
```

No debe mezclarse innecesariamente con el módulo Pedido.

---

## 2.1 Catálogo real de Barra

**Estado: EN DESARROLLO**

Trabajar con el catálogo real utilizado para Inventario Barra.

Objetivos:

- revisar selección de productos;
- depurar catálogo;
- revisar nombres;
- revisar unidades;
- trabajar categorización;
- validar que los productos correspondan efectivamente al área de Barra.

La clasificación de categorías puede continuar evolucionando.

No bloquear el desarrollo funcional por no tener una taxonomía perfecta.

---

## 2.2 Orden físico real

**Estado: EN TRABAJO / PENDIENTE DE VALIDACIÓN**

Ajustar `order` para que represente el recorrido físico utilizado durante el inventario.

Objetivos:

- reducir desplazamientos;
- reducir búsquedas;
- hacer natural la secuencia;
- mantener el orden útil durante el trabajo real.

El orden físico tiene prioridad sobre un orden alfabético arbitrario.

---

## 2.3 Título "Inventario Barra"

**Estado: IMPLEMENTADO**

La aplicación utiliza:

```text
Inventario Barra
```

como nombre funcional del módulo.

La denominación anterior:

```text
Inventario Barista
```

ya no forma parte del nombre actual del módulo.

---

## 2.4 UX móvil

**Estado: EN DESARROLLO**

Refinar la interfaz para uso real desde teléfono.

Prioridades:

- controles táctiles;
- lectura rápida;
- ingreso claro de cantidades;
- navegación mediante categorías;
- comprensión de estados;
- mínima fricción;
- densidad útil sin sacrificar legibilidad.

La experiencia debe evaluarse mediante uso real y no solamente mediante criterios visuales.

---

## 2.5 Progreso

**Estado: IMPLEMENTADO / REFINAMIENTO F2**

Ya existe:

- texto de progreso;
- barra visual;
- contador;
- porcentaje;
- diferenciación visual de estados.

La Fase 2 busca determinar si la presentación realmente ayuda durante un inventario completo.

No reconstruir innecesariamente el motor existente.

---

## 2.6 Feedback

**Estado: IMPLEMENTADO / REFINAMIENTO F2**

Ya existe feedback para acciones relevantes como:

- conteo guardado;
- avance parcial;
- errores;
- copiar;
- compartir.

La prioridad es mantenerlo:

- claro;
- útil;
- visible;
- poco intrusivo.

---

## 2.7 Compactación visual

**Estado: EN DESARROLLO**

Optimizar la cantidad de información visible en pantalla.

No reducir tamaños indiscriminadamente.

Preservar:

- legibilidad;
- controles táctiles;
- accesibilidad;
- comprensión.

---

## 2.8 Modelo de datos de Inventario

**Estado: RESUELTO**

El modelo actual utiliza:

```text
id
name
category
area
unit
order
active
```

El módulo consume `data/items.js`.

La categorización puede continuar siendo revisada según la experiencia real.

---

## 2.9 Pruebas con inventario completo

**Estado: PENDIENTE**

Probar el flujo con el catálogo completo de Barra.

Verificar:

- navegación;
- orden;
- cantidades;
- decimales;
- estados;
- progreso;
- feedback;
- persistencia;
- resumen;
- copiar;
- compartir;
- nueva sesión;
- comportamiento general con todo el catálogo.

La prueba debe aproximarse al uso real.

---

# LÍNEA DE DESARROLLO — PEDIDO A BODEGA

**Branch:**

```text
warehouse-order
```

**Estado: CHECKPOINT FUNCIONAL**

Esta línea de desarrollo incorpora:

1. el módulo independiente de Pedido a Bodega;
2. la reorganización modular del proyecto;
3. la separación entre los modelos de Inventario y Pedido.

Esta línea no reemplaza la Fase 2 de Inventario.

Su objetivo es desarrollar y validar de forma independiente el flujo de pedidos internos.

---

## P1. Arquitectura modular

**Estado: IMPLEMENTADO**

Estructura:

```text
pages/
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

La raíz contiene únicamente comportamiento global y entrada general.

Los módulos administran su propia lógica, interfaz y estilos.

Los modelos permanecen separados:

```text
data/items.js
data/warehouse-order-items.js
```

---

## P2. Catálogo de Pedido

**Estado: IMPLEMENTADO / VALIDACIÓN ABIERTA**

Fuente:

```text
data/warehouse-order-items.js
```

Modelo:

```text
id
name
zone
unit
order
active
```

Catálogo actual:

```text
124 ítems
```

Zonas actuales:

```text
Barra
Servicio / Linea / Armado
Copería
Bebidas y aguas
Generales
```

`order` representa el orden lógico de navegación y debe mantener agrupadas las familias relacionadas.

No intercalar innecesariamente variantes de familias diferentes.

Las unidades y el orden pueden seguir ajustándose manualmente según uso real.

---

## P3. Flujo funcional de Pedido

**Estado: CHECKPOINT FUNCIONAL**

Flujo actual:

```text
Inicio
  ↓
Pedido a Bodega
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

La aplicación guarda el pedido localmente.

No existe actualmente persistencia remota.

---

## P4. Búsqueda

**Estado: IMPLEMENTADO**

La búsqueda global funciona como un modo de navegación independiente.

### Sin búsqueda

Se muestran las zonas.

### Con búsqueda

Las zonas desaparecen y se muestran únicamente los resultados.

### Al limpiar

Las zonas vuelven automáticamente.

Esta decisión existe específicamente para mejorar la experiencia móvil y evitar que los resultados queden ocultos debajo de las tarjetas de zona.

---

## P5. Selección de cantidades

**Estado: IMPLEMENTADO**

Los productos utilizan controles compactos:

```text
[ − ] 0 [ + ]
```

También pueden editarse mediante entrada directa.

Reglas:

```text
0    = no seleccionado
> 0  = incluido en el pedido
```

No existe un estado adicional por producto.

El contador del pedido representa productos distintos seleccionados y no la suma total de unidades.

---

## P6. Pedido actual

**Estado: IMPLEMENTADO**

La barra inferior permite acceder al pedido actual.

El resumen permite:

- revisar productos;
- agruparlos por zona;
- modificar cantidades;
- eliminar productos reduciendo su cantidad a cero;
- ingresar responsable;
- continuar agregando productos.

---

## P7. Responsable

**Estado: IMPLEMENTADO**

El responsable es opcional.

No se solicita área de origen.

No existe autenticación ni cuenta de usuario.

---

## P8. WhatsApp

**Estado: IMPLEMENTADO**

El módulo genera un mensaje agrupado por zona.

Estructura conceptual:

```text
📦 PEDIDO A BODEGA

Responsable: Nombre

BARRA
• Producto: 2

COPERÍA
• Producto: 1

Total: 2 productos
```

WhatsApp funciona como canal y registro operativo.

No existe estado interno de:

```text
enviado
recibido
preparado
entregado
```

---

## P9. Persistencia de Pedido

**Estado: IMPLEMENTADO**

Clave actual:

```text
pedido-bodega-session-v1
```

Persistencia mediante:

```text
localStorage
```

No existe actualmente:

- base de datos;
- backend;
- sincronización remota;
- historial de pedidos.

---

# PRÓXIMO TRABAJO DE LA BRANCH warehouse-order

Después del checkpoint funcional, la prioridad es:

```text
1. Probar UX con uso real.
2. Detectar fricciones.
3. Hacer refactorizaciones puntuales.
4. Refinar UI.
5. Revisar catálogo.
6. Mejorar arquitectura solamente donde exista una necesidad concreta.
```

No asumir que todas las posibles mejoras deben implementarse.

Una refactorización debe preservar el comportamiento funcional salvo que exista una decisión explícita de cambiarlo.

---

# FASE 3 — PWA

**Estado: FUTURA**

Objetivo:

Convertir la versión estabilizada en una Progressive Web App cuando exista evidencia de que la experiencia principal está suficientemente estable.

Posibles componentes:

```text
manifest
instalación
offline
```

No adelantar esta fase mientras la arquitectura y UX principales continúen evolucionando.

---

# FASE 4 — OPTIMIZACIÓN POST-USO REAL

**Estado: FUTURA**

Objetivo:

Mejorar exclusivamente problemas observados durante el uso real.

Regla:

> No optimizar por especulación. Optimizar problemas reales.

Las mejoras pueden surgir de:

- navegación;
- densidad visual;
- errores de ingreso;
- búsqueda;
- persistencia;
- comportamiento en dispositivos reales;
- uso durante inventarios;
- uso del flujo de pedidos.

No crear una lista cerrada de problemas antes de observarlos.

---

# FASE 5 — V2

**Estado: FUTURA / CONDICIONADA A UTILIDAD**

Objetivo:

Agregar únicamente funciones que demuestren utilidad real.

Ideas actualmente consideradas para evaluación futura:

```text
mínimos
bajo stock
otras necesidades descubiertas
```

Estas ideas no forman parte de la implementación actual.

---

# DESCARTADO / FUERA DE ALCANCE ACTUAL

No forman parte del desarrollo actual:

```text
historial de pedidos
estados de pedido
backend
base de datos
cuentas
login
PIN
integración con GetJusto
cámara
IA visual
sincronización remota
otras áreas de Inventario
```

No deben tratarse como tareas pendientes.

Solo pueden volver al roadmap mediante una decisión explícita posterior.

---

# SECUENCIA GLOBAL

```text
FASE 1 COMPLETADA
Motor de inventario
│
├── pending
├── partial
├── counted
├── localStorage
├── navegación
├── resumen
├── responsable
├── copiar / compartir
└── decimales
│
▼
FASE 2 ACTUAL
Inventario Barra
│
├── catálogo real
├── orden físico
├── UX móvil
├── progreso
├── feedback
├── compactación visual
└── pruebas con inventario completo
│
├───────────────────────────────┐
│                               │
▼                               ▼
FASE 3                        warehouse-order
PWA                            CHECKPOINT FUNCIONAL
│                               │
├── manifest                    ├── arquitectura modular
├── instalación                 ├── catálogo de Pedido
└── offline                     ├── búsqueda
                                ├── cantidades
                                ├── pedido actual
                                ├── resumen
                                └── WhatsApp
│
▼
FASE 4
Optimización post-uso real
│
▼
FASE 5
V2
```

---

# REGLA DEL ROADMAP

El roadmap es una guía de evolución, no una obligación de construir todo.

Una fase futura puede:

- cambiar;
- reducirse;
- dividirse;
- eliminarse;
- reemplazarse;

si el uso real demuestra que ya no tiene sentido.

La prioridad continúa siendo:

**utilidad → evidencia → mejora → escalabilidad cuando corresponda.**
