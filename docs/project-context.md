### `docs/project-context.md`

# Contexto del proyecto

Este documento reúne el contexto que un agente necesita para trabajar correctamente en el repositorio sin depender de la conversación histórica completa.

## 1. Problema que se busca resolver

Brioche Bakery realiza un inventario semanal manual. El objetivo de este proyecto es construir una herramienta móvil sencilla que ayude a digitalizar ese conteo, empezando exclusivamente por Barra / Cafetería.

El proyecto es un ejercicio práctico que busca resolver primero el flujo útil y observable antes de desarrollar una plataforma de inventario completa.

## 2. Alcance actual

El MVP está limitado a Barra / Cafetería.

Quedan fuera del alcance actual, aunque pueden reconsiderarse más adelante:

- Panadería.
- Pastelería.
- Cocina.
- Copiaría u otras áreas operativas.
- Integración con GetJusto.
- Backend o base de datos.
- Historial permanente de inventarios.
- Cámara / reconocimiento visual.
- Stock mínimo.

No tratar estas exclusiones como prohibiciones permanentes. Son límites del MVP actual.

## 3. Proceso de negocio conocido

El inventario general se relaciona con el cierre semanal y con distintas áreas de operación. Se han mencionado estaciones como Terraza, Salón, Salón Privado y Línea / Armado.

La gestión de pedidos de proveedores pertenece a otro flujo y no forma parte del MVP de esta aplicación.

GetJusto es el POS / sistema de operación existente, pero el proyecto no busca integrarse con él en esta etapa.

Para este MVP, el detalle más importante es que el personal de Barra pueda realizar el conteo de forma clara, rápida y sin depender del sistema de proveedores ni del POS.

## 4. Secuencia de trabajo acordada

La evolución del proyecto sigue deliberadamente esta secuencia:

1. Revisar los inventarios fuente y filtrar los elementos que corresponden a Barra / Cafetería.
2. Construir un catálogo suficientemente útil para trabajar.
3. Conseguir una versión funcional del flujo de inventario.
4. Probarla y observar el uso real.
5. Refinar después el catálogo y la experiencia de uso.

Este orden es importante. No se debe convertir una cuestión de clasificación todavía abierta en un bloqueo artificial del MVP.

## 5. Historia y decisiones relevantes

### 5.1 Alcance inicialmente imaginado

Al comienzo se contempló una solución más amplia, con varias áreas y varias funcionalidades futuras.

### 5.2 Reducción del alcance

Se decidió reducir deliberadamente el MVP a Barra / Cafetería para mantenerlo pequeño, abordable y útil.

### 5.3 Trabajo con inventarios fuente

Se comenzó a filtrar los inventarios reales para identificar los ítems que corresponden a Barra. El catálogo actual deriva de ese trabajo y sigue sujeto a revisión.

### 5.4 Modelo inicial

En versiones anteriores se había considerado un modelo con campos como `category` y `area`. El modelo presente en `data/items.js` evolucionó y actualmente contiene `id`, `name`, `unit`, `order` y `active`.

No deben recuperarse automáticamente campos históricos como requisitos actuales.

### 5.5 Prioridad: funcional primero

La decisión fue trabajar primero en un flujo de inventario funcional. El refinamiento de la taxonomía del catálogo quedó como trabajo posterior.

### 5.6 Revisión de Fase 2

Las ideas agrupadas anteriormente como Fase 2 deben reevaluarse después de observar la utilidad real del MVP. No son compromisos irrevocables.

## 6. Estado actual de la implementación

Estructura principal:

- `index.html`: estructura de la interfaz y elementos de soporte del flujo.
- `styles.css`: presentación y comportamiento visual.
- `app.js`: lógica principal de sesión, conteo, navegación, persistencia y resumen.
- `data/items.js`: catálogo de productos.

La aplicación es actualmente HTML + CSS + JavaScript vanilla, sin framework ni backend.

## 7. Sesión y persistencia

La aplicación utiliza una sesión local de inventario y guarda su estado mediante `localStorage`.

Esto permite conservar progreso entre recargas dentro del mismo navegador / dispositivo, pero no equivale a una base de datos, historial centralizado ni sincronización entre usuarios.

La sesión actual incluye, entre otros datos, identificador, fecha, índice actual, vista, responsable y conteos.

## 8. Estados de conteo

Los estados funcionales actuales son:

- `pending`: todavía no se ha registrado un conteo suficiente.
- `partial`: existe un registro, pero sigue marcado como parcial.
- `counted`: el ítem está marcado como contado.

La interfaz utiliza iconografía para diferenciarlos visualmente.

No asumir cambios de semántica solo por preferencias de nomenclatura.

## 9. Catálogo actual

`data/items.js` contiene actualmente el catálogo operativo del MVP.

Cada ítem tiene:

- `id`: identificador estable del ítem.
- `name`: nombre que se muestra al usuario.
- `unit`: unidad actualmente asociada al ítem.
- `order`: orden de presentación.
- `active`: indica si el ítem participa actualmente.

El catálogo actual tiene 68 ítems activos y utiliza `order` del 1 al 68.

### 9.1 `category`

`category` es importante para una futura organización del catálogo, pero su clasificación todavía necesita refinamiento con los inventarios fuente y con el uso real.

No inventar una taxonomía definitiva solo para rellenar el campo.

### 9.2 `area`

`area` fue parte de ideas / modelos anteriores, pero no es actualmente un campo presente en `data/items.js`.

No asumir que debe reincorporarse al modelo sin una decisión explícita.

### 9.3 Nombres y unidades

Los nombres actuales pueden conservar diferencias de ortografía, mayúsculas, abreviaturas o formato porque parte del catálogo todavía está en proceso de normalización.

Las unidades también pueden requerir revisión. Una futura normalización debe considerar cómo se realiza físicamente el conteo, no solo cómo queda más limpio el código.

## 10. Discrepancia técnica conocida

Existe una discrepancia entre el modelo actual de `items.js` y partes del código que históricamente esperan propiedades que ya no están en todos los ítems, especialmente `category` y `area`.

Esta discrepancia debe analizarse antes de concluir que alguno de esos campos debe volver al modelo. El objetivo es entender primero si la referencia en el código sigue siendo necesaria o es residuo de una versión anterior.

## 11. Flujo funcional actual

La aplicación trabaja sobre la lista de ítems activos ordenados por `order` y permite avanzar por el inventario, registrar cantidades y notas, cambiar estados, conservar el responsable y consultar un resumen.

La implementación también dispone de acciones de copia / compartir y de creación de una nueva sesión.

## 12. Arquitectura actual y límites

La aplicación está diseñada como una página web pequeña y autocontenida.

No existe todavía:

- API propia.
- servidor de aplicación.
- autenticación real.
- base de datos.
- sincronización remota.
- integración con sistemas externos.

La arquitectura puede evolucionar cuando exista una necesidad demostrada, pero no se debe añadir infraestructura por anticipación.

## 13. Principios de producto

### KISS

La solución debe ser lo más simple posible sin sacrificar utilidad.

### Mobile first

El flujo está pensado para uso desde teléfono en un contexto operativo, donde importan la lectura rápida, los controles grandes y la poca fricción.

### Funcional antes que perfecto

Es preferible validar un flujo útil y luego refinarlo basándose en el uso real antes que intentar cerrar todos los detalles de datos desde el principio.

### No confundir futuro con requisito

Historial, cámara, stock mínimo, otras áreas e integraciones son ideas de evolución, no comportamientos que el agente deba implementar por defecto.

## 14. Pendientes actuales

Los temas abiertos más relevantes son:

- Refinar `category`.
- Revisar el catálogo contra los inventarios fuente.
- Normalizar nombres visibles donde tenga sentido.
- Revisar la semántica de ciertas unidades.
- Determinar si `area` tiene utilidad real en el modelo final.
- Revisar la experiencia de uso real.
- Revisar qué partes del flujo conviene automatizar o probar.

Estos pendientes no tienen todos la misma urgencia ni todos bloquean el desarrollo funcional.

## 15. Cómo usar este documento

Este documento no es un contrato de requisitos inmutables. Es una memoria consolidada del proyecto.

Cuando una nueva decisión cambie el rumbo del proyecto, actualiza esta documentación para que el repositorio vuelva a representar la realidad.

Cuando solo cambie la implementación sin cambiar una decisión de producto, actualiza el estado correspondiente sin convertir automáticamente ese cambio en una nueva regla.

