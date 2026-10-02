# AGENTS.md

## Propósito

Este repositorio contiene **Inventario Barra**, una aplicación web móvil para digitalizar el inventario semanal del área de Barra / Cafetería de Brioche Bakery.

Este archivo define **cómo debe trabajar un agente en este repositorio**.

Para entender el producto, sus decisiones y su planificación, consultar según necesidad:

- `docs/project-context.md`
- `docs/roadmap.md`

No duplicar aquí todo el contexto del proyecto.

---

## 1. Prioridad de información

Antes de modificar algo, distinguir entre:

- instrucción explícita del usuario;
- decisión vigente del proyecto;
- implementación actual;
- pendiente;
- idea futura;
- histórico;
- descartado.

Una decisión posterior reemplaza una decisión anterior.

Una idea futura no es un requisito actual.

Un pendiente no implica una solución definida.

Una funcionalidad descartada no debe reaparecer como sugerencia automática.

Cuando exista contradicción entre código y documentación, identificarla antes de asumir cuál de los dos representa la intención correcta.

---

## 2. Fase actual

El proyecto está actualmente en:

**FASE 2 — Inventario Barra**

Consultar `docs/roadmap.md` antes de implementar algo que pudiera pertenecer a una fase posterior.

No adelantar por iniciativa propia:

- PWA;
- manifest;
- instalación;
- offline;
- optimización post-uso;
- mínimos;
- bajo stock;
- funcionalidades de V2.

---

## 3. Alcance

El producto actual está limitado a:

**Barra / Cafetería.**

No ampliar espontáneamente a:

- Panadería;
- Pastelería;
- Cocina;
- Coparía u otras áreas.

Tampoco introducir espontáneamente:

- historial;
- base de datos;
- backend;
- cámara;
- login;
- PIN;
- integración con GetJusto.

Estas funcionalidades están actualmente fuera del alcance o descartadas. Solo deben volver a evaluarse mediante una decisión explícita.

---

## 4. Estrategia del proyecto

El proyecto sigue una evolución deliberadamente incremental:

```text
FASE 1
motor funcional
    ↓
FASE 2
Inventario Barra
    ↓
FASE 3
PWA
    ↓
FASE 4
uso real → problemas reales
    ↓
FASE 5
V2 si demuestra utilidad
```

La prioridad no es maximizar funcionalidades.

La prioridad es obtener utilidad real con la menor complejidad necesaria.

---

## 5. Fase 1 vs. Fase 2

La Fase 1 está completada.

La Fase 2 adapta y refina lo construido para el contexto real de Barra.

No asumir que porque una función ya exista técnicamente está completamente cerrada para producto.

Por ejemplo:

- progreso ya existe → puede requerir refinamiento;
- feedback ya existe → puede requerir refinamiento;
- título `Inventario Barra` ya existe → no hay que volver a diseñarlo;
- resumen ya existe → debe probarse y pulirse, no rehacerse sin necesidad.

---

## 6. Catálogo

`data/items.js` es la fuente canónica del catálogo **actual del repositorio**.

Los `id` son identificadores estables.

No cambiarlos gratuitamente.

El catálogo continúa siendo parte del trabajo de Fase 2.

Especialmente:

- confirmar que los ítems correspondan a Barra;
- revisar el orden físico;
- revisar nombres;
- revisar unidades;
- trabajar la categorización.

### Sobre `category`

`category` es relevante para la evolución del catálogo, pero todavía no debe tratarse como una taxonomía cerrada.

Se ha trabajado una clasificación de forma separada al código actual.

No incorporar automáticamente esa clasificación ni crear una nueva solo para completar propiedades.

Primero entender la intención del usuario y el estado del catálogo.

---

## 7. Modelo de datos

El modelo actualmente presente en `data/items.js` utiliza:

- `id`
- `name`
- `unit`
- `order`
- `active`

No asumir `category` ni `area` como propiedades vigentes del modelo actual.

Si el código referencia propiedades que no existen en el modelo actual, tratarlo como una discrepancia a investigar.

No restaurar automáticamente campos históricos.

---

## 8. Principios de implementación

Aplicar **KISS**.

Preferir:

- cambios pequeños;
- soluciones simples;
- comportamiento explícito;
- reutilización razonable;
- bajo acoplamiento innecesario.

Mantener HTML + CSS + JavaScript vanilla mientras siga siendo suficiente.

No introducir:

- frameworks;
- librerías;
- bundlers;
- backend;
- nuevas capas arquitectónicas;

sin una necesidad concreta y justificada.

No hacer refactors grandes como efecto secundario de una tarea pequeña.

---

## 9. Mobile first

La aplicación se utiliza principalmente desde teléfono durante un inventario.

Priorizar:

- controles táctiles;
- lectura rápida;
- cantidades fáciles de introducir;
- navegación clara;
- estados reconocibles;
- progreso comprensible;
- poca fricción.

La compactación visual debe aumentar la información útil visible sin perjudicar:

- legibilidad;
- tamaño de controles;
- accesibilidad;
- comprensión.

---

## 10. Trabajo con el usuario

El usuario está aprendiendo progresivamente programación, Git, terminales y agentes.

Cuando introduzcas una herramienta, concepto o patrón probablemente nuevo:

- explica brevemente qué es;
- explica para qué sirve;
- explica por qué se utiliza.

No convertir tareas rutinarias en tutoriales extensos.

### Tareas pequeñas

Si la tarea está claramente definida, actuar directamente.

### Tareas complejas

Para cambios de:

- arquitectura;
- modelo de datos;
- dependencias;
- comportamiento importante;
- refactors grandes;
- migraciones;
- alcance;

explicar primero brevemente qué se entendió y cuál es el enfoque.

Usar `/plan` cuando la tarea se beneficie realmente de una secuencia revisable.

No pedir confirmación para cada paso interno.

---

## 11. Ambigüedad

Si existe una ambigüedad menor y una interpretación razonable no cambia materialmente el resultado, puede hacerse la suposición y comunicarla.

Si la ambigüedad puede cambiar:

- el producto;
- el modelo;
- la arquitectura;
- los datos reales;
- el alcance;

no inventar una decisión.

Señalar primero la incertidumbre relevante.

---

## 12. Git

Trabajar de forma conservadora con Git.

Revisar `git status` cuando sea relevante.

No sobrescribir cambios no relacionados del usuario.

No ejecutar automáticamente operaciones destructivas como:

- `git reset --hard`;
- eliminación masiva;
- limpieza destructiva;
- descarte de cambios.

No ejecutar automáticamente:

- `git commit`;
- `git push`.

Commit y push requieren una solicitud explícita del usuario.

Después de cambios relevantes, revisar:

```text
git diff
git status
```

---

## 13. Validación

Después de modificar código:

1. revisar el diff;
2. ejecutar las validaciones pertinentes;
3. comprobar sintaxis cuando corresponda;
4. probar el comportamiento afectado cuando sea posible.

No afirmar que algo está verificado si no fue comprobado.

Indicar claramente qué se validó y qué no pudo validarse.

---

## 14. Dependencias y configuración

No instalar dependencias únicamente por conveniencia.

Antes de añadir una dependencia considerar:

- necesidad real;
- alternativas existentes;
- complejidad añadida;
- mantenimiento;
- impacto sobre el proyecto.

No modificar configuración global del sistema sin necesidad.

---

## 15. Documentación

Mantener la documentación pequeña y con responsabilidades claras:

- `AGENTS.md` → reglas para el agente en este repo.
- `docs/project-context.md` → contexto, decisiones, estado y cuestiones abiertas.
- `docs/roadmap.md` → fases y secuencia de evolución.
- `README.md` → entrada rápida para una persona.

No crear un Markdown nuevo para cada cambio.

Actualizar documentación cuando cambie realmente:

- una decisión;
- el alcance;
- el estado importante;
- el modelo;
- la fase;
- una cuestión abierta relevante.

No modificar `AGENTS.md` por cambios normales del código.

---

## 16. Documentación de OpenAI

Cuando una tarea dependa de Codex, herramientas, configuración, CLI o APIs de OpenAI, usar documentación oficial actual cuando sea necesario.

No asumir que una instrucción, opción o comportamiento antiguo sigue vigente sin verificarlo cuando la diferencia pueda importar.

---

## 17. Regla de oro

No construir por construir.

El objetivo es que Inventario Barra resuelva correctamente un problema real con el mínimo nivel de complejidad necesario.

**Primero utilidad.  
Después evidencia.  
Después mejoras justificadas.**