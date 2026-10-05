# Contexto del proyecto

## 1. Identidad y naturaleza del proyecto

Este repositorio contiene una aplicación web móvil experimental e independiente que reúne dos herramientas:

- **Inventario Barra**
- **Pedido a Bodega**

El proyecto nació como ejercicio práctico para aprender desarrollo web, modelado de datos, Git y trabajo con agentes, utilizando como referencia algunos flujos operativos observados durante una experiencia laboral.

El proyecto **no es un producto oficial de la empresa que sirvió como contexto para definir algunos de sus flujos**.

No existe autorización para utilizar su marca, nombre comercial, logotipo, identidad visual ni otros elementos que puedan hacer parecer que esta aplicación le pertenece, fue encargada por ella o cuenta con su respaldo.

Esta restricción es permanente mientras el usuario no indique explícitamente lo contrario.

La aplicación debe mantenerse visual, textual y técnicamente independiente.

---

# 2. Objetivo del proyecto

El objetivo es construir una herramienta pequeña, práctica y escalable para resolver problemas concretos de operación.

La filosofía principal es:

> resolver primero el flujo real, con la menor complejidad necesaria, y aumentar la complejidad únicamente cuando el uso demuestre que hace falta.

El proyecto no busca transformarse desde el inicio en un ERP, WMS o sistema empresarial completo.

---

# 3. Arquitectura actual

La rama de referencia para esta evolución es:

```text
warehouse-order
```

La arquitectura actual es modular:

```text
inventario-barista-mobile/
│
├── index.html
├── app.js
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

Existe todavía un `styles.css` en la raíz como residuo de la estructura anterior.

Su eliminación definitiva queda como tarea de limpieza independiente después de confirmar que no existe ninguna dependencia activa.

---

# 4. Responsabilidades de cada nivel

## Raíz

### `index.html`

Es la entrada general de la aplicación.

Presenta los dos módulos disponibles:

```text
Inventario Barra
Pedido a Bodega
```

No debe contener lógica de negocio específica.

### `app.js`

Es el punto de entrada global.

Su responsabilidad debe mantenerse pequeña.

No debe acumular la lógica de los módulos.

---

# 5. Módulo Inventario

Ubicación:

```text
pages/inventario/
```

Componentes:

```text
index.html
inventario.css
inventario.js
```

El módulo administra:

- categorías;
- conteo;
- estados;
- progreso;
- notas;
- responsable;
- resumen;
- copiar;
- compartir;
- nueva sesión;
- persistencia local.

---

# 6. Catálogo de Inventario

Fuente de verdad:

```text
data/items.js
```

Modelo actual:

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

Actualmente el catálogo contiene:

```text
70 ítems
67 activos
3 inactivos
```

Todos los ítems actuales están asociados al área:

```text
Barra
```

La categorización continúa siendo revisable.

El catálogo no debe considerarse una taxonomía definitiva mientras siga validándose con el uso real.

Los `id` deben tratarse como identificadores estables.

---

# 7. Motor de Inventario

El motor base dispone de:

```text
pending
partial
counted
```

Además dispone de:

- cantidades decimales;
- navegación;
- progreso;
- resumen;
- responsable;
- copiar;
- compartir;
- persistencia mediante `localStorage`.

## Estados

### `pending`

El ítem todavía no tiene un conteo completado.

### `partial`

Existe una cantidad registrada, pero el ítem continúa marcado como parcialmente procesado.

### `counted`

El ítem se considera completamente contado.

Representación visual:

```text
🔴 Pendiente
🟡 Parcial
🟢 Contado
```

---

# 8. Persistencia de Inventario

Clave actual:

```text
inventario-barra-session-v2
```

Versión de esquema:

```text
schemaVersion: 3
```

La sesión guarda información como:

- identificador;
- fecha;
- inicio;
- índice actual;
- vista;
- responsable;
- conteos.

La persistencia es local.

No existe actualmente:

- base de datos;
- backend;
- sincronización remota;
- historial permanente.

---

# 9. Navegación de Inventario

La navegación se basa en una flecha que representa siempre el nivel anterior.

Flujo:

```text
Inicio
  ↓
Inventario Barra
  ← vuelve a Inicio

Inventario Barra
  ↓
Categoría / conteo
  ← vuelve a Categorías

Resumen
  ← vuelve a Categorías
```

No debe agregarse un segundo enlace "Inicio" en la esquina superior derecha.

---

# 10. Experiencia de conteo

La experiencia está diseñada para uso móvil.

El flujo actual es:

```text
Categorías
    ↓
Ítem
    ↓
Cantidad
    ↓
Guardar como parcial / contado
    ↓
Siguiente ítem
```

Cada categoría muestra:

- total de ítems;
- contados;
- parciales;
- progreso visual.

Al terminar una categoría se regresa a la cuadrícula de categorías.

Cuando ya no quedan ítems pendientes, se puede llegar directamente al resumen.

---

# 11. Módulo Pedido a Bodega

El módulo se encuentra en:

```text
pages/pedido/
```

Componentes:

```text
index.html
pedido.css
pedido.js
```

El nombre técnico del módulo es:

```text
pedido
```

La denominación funcional puede ser:

```text
Pedido a Bodega
```

Su propósito es simplificar la preparación de pedidos internos y generar un mensaje que pueda enviarse por WhatsApp.

No intenta reemplazar el canal operativo de WhatsApp.

---

# 12. Catálogo de Pedido a Bodega

Fuente de verdad:

```text
data/warehouse-order-items.js
```

Modelo actual:

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

El catálogo contiene:

```text
124 ítems
```

Distribuidos actualmente en:

```text
Barra                         66
Servicio / Linea / Armado    30
Copería                       16
Bebidas y aguas                7
Generales                      5
```

El campo `order` representa el orden lógico de navegación.

No es un orden alfabético obligatorio ni necesariamente una copia de un documento histórico.

La prioridad es agrupar familias completas para facilitar la revisión manual.

Ejemplos conceptuales:

```text
tapas
vasos
guantes S/M/L
syrups
pulpas
```

Las variantes relacionadas deben permanecer agrupadas.

---

# 13. Zonas de Pedido

Las zonas actuales son:

```text
Barra
Servicio / Linea / Armado
Copería
Bebidas y aguas
Generales
```

No añadir nuevas zonas por iniciativa propia.

Las zonas deben corresponder al modelo operativo que realmente se desea representar.

---

# 14. UX de Pedido a Bodega

La pantalla principal presenta:

- buscador global;
- zonas;
- acceso al pedido actual.

## Búsqueda

La búsqueda tiene comportamiento específico para móvil.

### Sin texto

Se muestran las zonas.

### Con texto

Las zonas desaparecen completamente.

Se muestran únicamente los resultados de búsqueda.

### Al limpiar

Las zonas vuelven automáticamente.

Esta decisión evita que una lista de resultados quede visualmente enterrada debajo de las tarjetas de zona en pantallas pequeñas.

---

# 15. Selección de cantidades

Los productos utilizan controles compactos:

```text
[ − ] 0 [ + ]
```

También se permite editar la cantidad directamente.

Regla:

```text
0
```

significa que el producto no está en el pedido.

Un valor:

```text
> 0
```

significa que el producto está seleccionado.

No existe un estado adicional por producto.

El contador del pedido representa:

> cantidad de productos distintos seleccionados

No representa la suma total de unidades solicitadas.

---

# 16. Pedido actual

Existe una barra inferior persistente que permite acceder al pedido actual.

La vista de pedido permite:

- revisar productos;
- agrupar por zona;
- modificar cantidades;
- eliminar productos reduciendo la cantidad a cero;
- ingresar responsable;
- continuar agregando productos;
- preparar el mensaje para WhatsApp.

---

# 17. Responsable del Pedido

El campo de responsable es:

```text
opcional
```

No existe actualmente una cuenta de usuario ni autenticación.

No se solicita el área de quien realiza el pedido.

No agregar ese dato salvo una decisión explícita posterior.

---

# 18. WhatsApp

El objetivo es generar un mensaje limpio y directamente utilizable.

Estructura conceptual:

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

El responsable solo se incluye cuando existe.

La aplicación no necesita almacenar un estado:

```text
enviado
recibido
preparado
entregado
```

WhatsApp funciona como canal y registro operativo.

---

# 19. Persistencia de Pedido

Clave actual:

```text
pedido-bodega-session-v1
```

La sesión guarda:

- identificador;
- fecha;
- vista actual;
- zona actual;
- búsqueda;
- responsable;
- cantidades.

No se comparte la sesión con Inventario.

Inventario y Pedido tienen almacenamiento independiente.

---

# 20. Navegación de Pedido

La regla de navegación es consistente con Inventario:

```text
Inicio
  ↓
Pedido a Bodega
  ← vuelve a Inicio

Pedido a Bodega
  ↓
Zona / resultados
  ← vuelve a Pedido a Bodega

Pedido actual
  ← vuelve a Zonas
```

La flecha es el único mecanismo visual de retroceso en la cabecera.

No agregar simultáneamente otro enlace de "Inicio" en la esquina superior derecha.

---

# 21. Separación de modelos

Los catálogos:

```text
data/items.js
data/warehouse-order-items.js
```

son deliberadamente independientes.

No convertirlos en un modelo universal solo para ahorrar código.

Inventario utiliza:

```text
category
area
```

Pedido utiliza:

```text
zone
```

Cada modelo debe evolucionar según sus propias necesidades.

---

# 22. Branding y propiedad intelectual

El proyecto es independiente.

No posee autorización para utilizar la marca, nombre, logotipo o identidad visual de la empresa del contexto original.

Por lo tanto:

- la interfaz debe utilizar identidad neutral;
- los documentos deben utilizar lenguaje neutral;
- los mensajes generados deben utilizar lenguaje neutral;
- las metadata deben utilizar lenguaje neutral;
- los nombres nuevos de componentes y archivos deben evitar branding;
- los refactors no deben reintroducir branding heredado;
- los agentes no deben "mejorar" la interfaz agregando branding;
- cualquier resto de branding heredado debe considerarse un residuo que debe eliminarse, no una funcionalidad que preservar.

La documentación del proyecto tampoco debe presentarlo como software oficial, contratado o respaldado por esa empresa.

---

# 23. Funcionalidades fuera del alcance actual

No forman parte de la implementación actual:

```text
historial de pedidos
estados de pedido
backend
base de datos
cuentas
login
PIN
mínimos de stock
bajo stock
integración con GetJusto
cámara
IA visual
sincronización remota
otras áreas de Inventario
PWA
offline
```

No deben tratarse como tareas pendientes.

Solo pueden volver al roadmap mediante una decisión explícita posterior.

---

# 24. Filosofía de escalabilidad

La escalabilidad buscada es principalmente arquitectónica y de mantenimiento, no acumulación de funcionalidades.

Principios:

```text
módulos independientes
modelos separados
bajo acoplamiento
raíz pequeña
responsabilidades claras
cambios incrementales
```

La existencia de una arquitectura modular no justifica crear abstracciones prematuras.

La complejidad debe aparecer cuando el proyecto la necesite.

---

# 25. Estado de la rama warehouse-order

Esta rama representa el primer checkpoint funcional del módulo Pedido a Bodega y de la reorganización modular del proyecto.

El objetivo de este checkpoint es permitir que futuras refactorizaciones puedan compararse contra una versión funcional conocida.

Antes de modificar comportamiento importante, preservar la posibilidad de identificar qué funcionaba en este estado.

---

# 26. Próximo enfoque de desarrollo

Después de este checkpoint, el trabajo puede continuar con:

1. pruebas reales de UX;
2. detección de fricciones;
3. refactorizaciones puntuales;
4. mejoras visuales;
5. revisión de catálogos;
6. mejoras de arquitectura cuando exista una necesidad concreta.

No empezar nuevas funcionalidades grandes simplemente porque la arquitectura ya permite incorporarlas.

---

# 27. Regla general

El proyecto debe seguir siendo:

```text
simple
útil
modular
móvil
independiente
```

La arquitectura debe facilitar el crecimiento futuro sin obligar al proyecto a asumir hoy una complejidad que todavía no necesita.
