# Inventario Barra

MVP web móvil para digitalizar el inventario semanal del área de Barra / Cafetería de Brioche Bakery.

## Estado actual

El proyecto está en desarrollo activo. La aplicación ya implementa el flujo base de inventario, con sesión local, estados de conteo, progreso, notas, responsable, resumen y persistencia mediante `localStorage`.

El catálogo actual está en `data/items.js`.

## Estructura

```text
.
├── AGENTS.md
├── README.md
├── app.js
├── index.html
├── styles.css
├── data/
│   └── items.js
└── docs/
    ├── project-context.md
    └── roadmap.md
```

## Documentación para trabajar con Codex

- `AGENTS.md`: reglas generales que el agente debe seguir en este repositorio.
- `docs/project-context.md`: contexto consolidado del producto y de la implementación.
- `docs/roadmap.md`: secuencia de trabajo y posibles evoluciones.

## Principio de desarrollo

Primero se busca una versión funcional y útil del MVP. El refinamiento del catálogo —por ejemplo, categorías, nombres y unidades— se realiza después, utilizando lo aprendido durante el uso real.

## Git

Los cambios deben mantenerse pequeños y revisables. Revisa siempre `git diff` y `git status` antes de aceptar o publicar cambios.