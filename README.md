# inventory-v2

Aplicación web modular para la evolución del sistema de inventario de Brioche Bakery. Este repositorio corresponde a la línea `inventory-v2`; no es la versión anterior de **Inventario Barra**.

## Estado del checkout

El checkout auditado está en la rama `inventory-v2`. La aplicación raíz dirige a módulos separados de inventario y pedido. El módulo de inventario importa un catálogo y una lista de áreas desde `data/inventario/`, conserva una sesión local en `localStorage` y usa un esquema de sesión versión 3.

El catálogo actual contiene 74 registros: 72 activos y 2 inactivos. Los registros presentes pertenecen al área Barra. El catálogo de áreas declara cinco áreas, pero esa declaración por sí sola no implica que haya productos o un flujo completo para cada área.

## Estructura principal

```text
.
├── AGENTS.md
├── README.md
├── app.js
├── index.html
├── styles.css
├── data/
│   └── inventario/
│       ├── areas.js
│       └── items/
│           ├── index.js
│           └── barra.js
├── pages/
│   ├── inventario/
│   │   ├── index.html
│   │   ├── inventario.css
│   │   └── inventario.js
│   └── pedido/
└── docs/
    ├── project-context.md
    └── roadmap.md
```

## Documentación

- `AGENTS.md`: reglas de trabajo en este repositorio.
- `docs/project-context.md`: decisiones, estado observado y cuestiones abiertas.
- `docs/roadmap.md`: orden de trabajo y criterios para avanzar.

## Trabajo en el repositorio

Comprueba la rama y `git status` antes de editar; revisa `git diff` después. No hagas commit ni push sin solicitud explícita. Consulta `AGENTS.md` para las instrucciones completas.
