# AGENTS.md

## Propósito

Este repositorio contiene una aplicación web móvil experimental e independiente para apoyar dos flujos operativos que fueron observados en un contexto de trabajo:

- **Inventario Barra**: inventario semanal del área de Barra / Cafetería.
- **Pedido**: preparación de pedidos internos y generación de un mensaje para mensajería.

El proyecto es de carácter personal, experimental y educativo.

No debe presentarse como software oficial de la empresa cuyo funcionamiento inspiró estos flujos.

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