# Roadmap — inventory-v2

## Propósito

Este roadmap corresponde a la evolución `inventory-v2`. No reutiliza como plan vigente las fases de la aplicación anterior **Inventario Barra**. Distingue la base ya visible en el checkout de trabajo que todavía necesita definición o implementación.

## Estado de referencia

En el checkout auditado:

- la aplicación raíz registra rutas independientes para Inventario y Pedido;
- Inventario tiene un catálogo de áreas y un catálogo de productos cargado para Barra;
- el módulo de inventario gestiona sesión local, vistas de categorías/conteo/resumen y persistencia con esquema 3;
- las otras áreas están declaradas, pero no tienen productos en el catálogo importado actualmente;
- la existencia de la ruta Pedido no demuestra que el módulo esté terminado.

## Líneas de trabajo

### 1. Consolidar el inventario actual

Usar el flujo existente con el catálogo presente y comprobar que las operaciones habituales sean coherentes: navegación, registro y edición de conteos, estados, resumen y recuperación de sesión local. Documentar problemas reproducibles y criterios de aceptación antes de ampliar alcance.

### 2. Definir el despliegue multiárea

Las áreas declaradas son Barra, Línea + Armado + Copería, Panadería, Pastelería y Cocina. Antes de cargar áreas adicionales, confirmar catálogo, responsables, orden de recorrido y cualquier diferencia operativa que afecte el modelo o la experiencia. Implementar y verificar la separación por área de extremo a extremo; no darla por terminada por la mera presencia de `areas.js`.

### 3. Aclarar el alcance de Pedido

Mantener el trabajo de Pedido separado del inventario y revisar la línea `warehouse-order` para recuperar su contexto. Definir qué pertenece a `inventory-v2` y qué permanece en la rama de pedidos antes de unir o duplicar funcionalidades.

### 4. Evolucionar datos y persistencia con cuidado

Mantener identificadores estables y revisar compatibilidad al modificar catálogo o esquema de sesión. La implementación observada guarda datos en el navegador; necesidades de sincronización, historial o backend requieren una decisión de producto explícita y un plan de migración, no se deducen del almacenamiento local.

## Dependencias y criterios de avance

- El trabajo multiárea depende de datos reales por área y de una definición del proceso operativo.
- Cambios de modelo o persistencia dependen de conocer cómo se conservarán las sesiones existentes.
- Una línea se considera lista cuando su comportamiento está implementado, sus datos corresponden al alcance aprobado y los criterios acordados se verificaron en el flujo afectado.
- No convertir preguntas abiertas en requisitos ni etiquetar como descartada una función sin decisión expresa.

## Fuera de este roadmap hasta decisión explícita

El código inspeccionado no basta para concluir compromisos sobre sincronización remota, historial central, autenticación, cámara, mínimos/bajo stock, integraciones externas o políticas de retención. No implementarlos por inferencia; recuperar la decisión del contexto del proyecto o consultarla cuando sea relevante.

## Mantenimiento

Revisa este roadmap cuando cambie una decisión o una dependencia. Mantén el plan centrado en el siguiente trabajo útil y en sus criterios observables. Recalcula el estado desde la rama y el código vigentes, no desde documentación histórica.
