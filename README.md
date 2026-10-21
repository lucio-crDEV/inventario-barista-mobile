# inventory-v3

Aplicación web móvil para contar el inventario por área y generar, en una etapa posterior, el libro `inventarios_og/11_10-INVENTARIO-totalizado.xlsx` con las cantidades nuevas y el resto de su estructura intacta.

La pantalla inicial muestra Bodega / Principal, Cocina, Panadería, Pastelería y Servicio. Servicio se cuenta por Barra, Armado / Línea / Copería, Mercadito y Garzones; Garzones distingue Zona Privada, Salón y Terraza. Cocina, Panadería, Pastelería, Bodega y los sectores de Servicio salvo Garzones muestran categorías prácticas; al elegir una zona de Garzones se entra directamente a sus 16 ítems.

Al abrir un grupo se muestra primero el siguiente ítem pendiente o con avance. «Sin stock» guarda explícitamente un cero como contado; «Guardar avance» y «Listo» conservan sus respectivos estados. El panel de ítems y el resumen permiten volver a cualquier producto.

«Ver ítems» abre el panel sin activar el buscador ni el teclado móvil. Solo despliega la categoría del producto actual y deja ese producto a la vista; las demás categorías se pueden abrir manualmente. La lupa del encabezado abre el mismo panel con la búsqueda enfocada. La navegación vuelve al inicio de la página al cambiar de vista o de producto. El selector claro/oscuro usa iconos SVG para mantener su apariencia en Android.

La interfaz usa blanco crema en modo claro y carbón profundo en modo oscuro, con acentos cian y superficies uniformes sin degradados. El rojo indica pendiente y distingue el botón «Sin stock» antes de guardar; el ámbar indica avance y el verde identifica tanto un conteo normal como «Sin stock» ya guardado. Los avisos superiores usan esos colores sobre vidrio translúcido, duran cuatro segundos y entran y salen con movimiento vertical breve; respetan las preferencias de movimiento y transparencia reducidos.

Las listas de productos se derivan de los dos inventarios originales en `inventarios_og/`. `data/inventario/items/catalogo-excel.js` contiene las filas e ID de la salida y las asignaciones de Servicio. `data/inventario/items/barra.js` conserva los ID internos del catálogo anterior de Barra.

El modo compartido usa Cloudflare Workers + D1: usuarios personales, contraseñas, ámbitos múltiples, administración mínima, historial y resolución de registros ajenos con Descartar, Sumar o Sobrescribir. Los guardados propios son directos con control de versión. Los datos locales anteriores permanecen intactos y no se importan automáticamente. No se implementó exportación Excel ni el flujo de Pedido.

## Entorno compartido local

```sh
npm ci
npm run db:local
npm run seed:local
npm run dev
```

Abrir `http://127.0.0.1:8787/`. Inicializar fixtures solo una vez en una base local vacía. Usuarios ficticios: `admin-prueba`, `ana`, `bruno`, `cocina`, `multiple`, `terraza`, `garzones`, `sin-areas`; contraseña local: `Solo-pruebas-2026`. Un servidor estático no basta para esta versión. No publicar la raíz: `npm run build` prepara únicamente los assets públicos de `dist/`.

[Guía completa: inicio, primer administrador sin registro público, pruebas manuales y pendientes de producción](docs/operacion-3a.md). [Contrato técnico](docs/contrato-3a.md). [Contexto](docs/project-context.md), [roadmap](docs/roadmap.md), [accesos](docs/accesos-y-administracion.md) y [verificación](docs/verification.md).

## Pruebas

```sh
npm test
python3 tests/workbook_contract.py
```

Con el Worker local abierto y fixtures ficticios (estas pruebas modifican solo D1 local):

```sh
npm run test:integration
npm exec playwright install chromium
npm run test:browser
npm run test:load
```

No ejecutar simultáneamente los conjuntos que modifican fixtures. Las pruebas locales no certifican capacidad ni habilitación de producción. La revisión de asignaciones/unidades (2), supervisión/cierre avanzado (3B), exportación fiel (4) y offline completo siguen pendientes.

## Rama y envío

`inventory-v3` parte de `inventory-v2` en `3d2331919ea8bdf39daf1f095ea09877d69e6dd0` y añade toda la etapa 3A. `inventory-v2` permanece en ese commit anterior; no recibe usuarios, Workers ni los cambios de colaboración. El paquete y los Workers se identifican como `inventory-v3` / `inventory-v3-local`.

Los cambios están en commits locales. Para subir esta rama nueva sin actualizar `inventory-v2`:

```sh
git push -u origin inventory-v3
```

No se ejecutó push ni despliegue. Se necesita acceso SSH al remoto. Ver [separación de versiones y despliegues](docs/separacion-inventory-v3.md).
