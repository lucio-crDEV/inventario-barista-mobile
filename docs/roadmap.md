# Roadmap — Inventario Barra

Este documento define la secuencia de evolución acordada para el producto.

Las fases son prioridades de desarrollo.

Una funcionalidad perteneciente a una fase futura no debe adelantarse simplemente porque sea técnicamente posible.

---

# FASE 1 — Motor de inventario ✅

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

La Fase 1 establece la base funcional del producto.

---

# FASE 2 — Inventario Barra ← ACTUAL

**Estado: EN DESARROLLO**

Objetivo:

Convertir el motor existente en una herramienta realmente adecuada para el inventario de Barra.

---

## 2.1 Catálogo real de Barra

**Estado: EN DESARROLLO**

Trabajar con los inventarios reales y asegurar que el catálogo corresponda efectivamente a Barra.

Tareas:

- revisar selección de productos;
- depurar catálogo;
- revisar nombres;
- revisar unidades;
- trabajar categorización.

La clasificación de categorías todavía puede evolucionar.

No bloquear el desarrollo funcional por no tener una taxonomía perfecta.

---

## 2.2 Orden físico real

**Estado: PENDIENTE / EN TRABAJO**

Ajustar `order` para que represente el recorrido físico utilizado durante el inventario.

Objetivos:

- reducir desplazamientos;
- reducir búsquedas;
- hacer natural la secuencia.

El orden físico tiene prioridad sobre un orden alfabético arbitrario.

---

## 2.3 Título "Inventario Barra"

**Estado: ✅ IMPLEMENTADO**

La aplicación utiliza actualmente:

**Inventario Barra**

El cambio reemplazó la denominación anterior:

`Inventario Barista`

El cambio también se refleja en el resumen y en el nombre utilizado al compartir.

---

## 2.4 UX móvil definitiva

**Estado: EN DESARROLLO**

Refinar la interfaz para uso real desde teléfono.

Prioridades:

- controles táctiles;
- lectura rápida;
- ingreso claro de cantidades;
- navegación;
- comprensión de estados;
- mínima fricción.

---

## 2.5 Progreso

**Estado: ✅ IMPLEMENTADO / REFINAMIENTO F2**

Ya existe:

- texto de progreso;
- barra visual;
- contador de procesados;
- porcentaje.

La Fase 2 busca determinar si esta presentación es adecuada para el uso real.

No reconstruir innecesariamente el motor existente.

---

## 2.6 Feedback

**Estado: ✅ IMPLEMENTADO / REFINAMIENTO F2**

Ya existe feedback para:

- conteo guardado;
- avance parcial;
- errores;
- copiar;
- compartir;
- otras acciones relevantes.

Fase 2 busca refinarlo para que sea:

- claro;
- útil;
- visible;
- poco intrusivo.

---

## 2.7 Compactación visual

**Estado: EN DESARROLLO**

Optimizar la densidad visual para mostrar más información útil en pantalla.

No reducir tamaños indiscriminadamente.

Preservar:

- legibilidad;
- accesibilidad;
- controles táctiles;
- comprensión.

---

## 2.8 Resolver discrepancia del modelo

**Estado: IDENTIFICADO**

`app.js` todavía referencia:

```text
item.category
item.area
```

pero `data/items.js` actualmente no contiene esas propiedades.

La solución debe determinarse durante Fase 2.

No restaurar automáticamente campos antiguos sin justificar su utilidad actual.

---

## 2.9 Pruebas con inventario completo

**Estado: PENDIENTE**

Probar el flujo con todos los ítems actuales de Barra.

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

# FASE 3 — PWA

**Estado: FUTURA**

Objetivo:

Convertir la versión estabilizada de Inventario Barra en una Progressive Web App.

Incluye:

```text
manifest
instalación
offline
```

No adelantar esta fase mientras la experiencia principal de Barra continúe cambiando significativamente.

---

# FASE 4 — Optimización post-uso real

**Estado: FUTURA**

Objetivo:

Mejorar exclusivamente problemas observados durante inventarios reales.

Regla:

> **No optimizar por especulación. Optimizar problemas reales.**

Las mejoras pueden surgir de:

- pasos innecesarios;
- errores frecuentes;
- confusión;
- problemas de navegación;
- problemas de lectura;
- problemas con cantidades;
- problemas con persistencia;
- problemas con PWA/offline;
- otras fricciones observadas.

No crear una lista cerrada de problemas antes de utilizarlos en la práctica.

---

# FASE 5 — V2

**Estado: FUTURA / CONDICIONADA A UTILIDAD**

Objetivo:

Incorporar únicamente funciones adicionales que demuestren utilidad real.

Primeras ideas consideradas:

```text
mínimos
bajo stock
otras necesidades descubiertas
```

Estas ideas no forman parte del MVP actual.

No implementarlas antes de su momento.

---

# DESCARTADO

Actualmente están fuera del proyecto:

```text
historial
DB
cámara
login
PIN
otras áreas
```

No deben tratarse como pendientes.

No deben reaparecer automáticamente en propuestas del agente.

Solo pueden regresar mediante una decisión explícita posterior.

---

# Secuencia global

```text
FASE 1 ✅
Motor de inventario
├── pending
├── partial
├── counted
├── localStorage
├── navegación
├── resumen
├── responsable
├── copiar / compartir
└── decimales

        ↓

FASE 2 ← ACTUAL
Inventario Barra
├── catálogo real de Barra
├── orden físico real
├── título "Inventario Barra" ✅
├── UX móvil definitiva
├── progreso → refinamiento
├── feedback → refinamiento
├── compactación visual
├── resolver discrepancia del modelo
└── pruebas con inventario completo

        ↓

FASE 3
PWA
├── manifest
├── instalación
└── offline

        ↓

FASE 4
Optimización post-uso real
└── solo problemas observados
    durante inventarios reales

        ↓

FASE 5 — V2
Funciones adicionales que demuestren utilidad
├── mínimos
├── bajo stock
└── otras necesidades descubiertas
```

---

# Regla del roadmap

La prioridad siempre sigue esta secuencia:

**1. Hacer que funcione.**

**2. Hacer que funcione bien para Barra.**

**3. Probarlo en condiciones reales.**

**4. Aprender de los problemas reales.**

**5. Agregar solo aquello que demuestre utilidad.**

Una fase futura puede cambiar, eliminarse o redefinirse si la experiencia real demuestra que ya no tiene sentido.

El roadmap no es una obligación de construir todo.

Es una guía de evolución.