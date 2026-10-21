# inventory-v3

Aplicación web móvil para contar el inventario por área y generar, en una etapa posterior, el libro `inventarios_og/11_10-INVENTARIO-totalizado.xlsx` con las cantidades nuevas y el resto de su estructura intacta.

La pantalla inicial muestra las áreas autorizadas entre Bodega / Principal, Cocina, Panadería, Pastelería y Servicio. Servicio se cuenta por Barra, Armado / Línea / Copería, Mercadito y Garzones; Garzones distingue Zona Privada, Salón y Terraza. Cocina, Panadería, Pastelería, Bodega y los sectores de Servicio salvo Garzones muestran categorías prácticas; al elegir una zona de Garzones se entra directamente a sus 16 ítems.

Al abrir un grupo se muestra primero el siguiente ítem pendiente o con avance. «Sin stock» guarda explícitamente un cero como contado; «Guardar avance» y «Listo» conservan sus respectivos estados. El panel de ítems y el resumen permiten volver a cualquier producto.

«Ver ítems» abre el panel sin activar el buscador ni el teclado móvil. Solo despliega la categoría del producto actual y deja ese producto a la vista; las demás categorías se pueden abrir manualmente. La lupa del encabezado abre el mismo panel con la búsqueda enfocada. La navegación vuelve al inicio de la página al cambiar de vista o de producto. El selector claro/oscuro usa iconos SVG para mantener su apariencia en Android.

La interfaz usa blanco crema en modo claro y carbón profundo en modo oscuro, con acentos cian y superficies uniformes sin degradados. El rojo indica pendiente y distingue el botón «Sin stock» antes de guardar; el ámbar indica avance y el verde identifica tanto un conteo normal como «Sin stock» ya guardado. Los avisos superiores usan esos colores sobre vidrio translúcido, duran cuatro segundos y entran y salen con movimiento vertical breve; respetan las preferencias de movimiento y transparencia reducidos.

Las listas de productos se derivan de los dos inventarios originales en `inventarios_og/`. `data/inventario/items/catalogo-excel.js` contiene las filas e ID de la salida y las asignaciones de Servicio. `data/inventario/items/barra.js` conserva los ID internos del catálogo anterior de Barra.

El modo compartido usa Cloudflare Workers + D1: usuarios personales, contraseñas, ámbitos múltiples, administración mínima, historial y resolución de registros ajenos con Descartar, Sumar o Sobrescribir. Los guardados propios son directos con control de versión. Las pantallas muestran skeletons mientras cargan, transiciones breves y estados claros de envío; Inicio obtiene solo los ámbitos autorizados sin descargar el catálogo. Los datos locales anteriores permanecen intactos y no se importan automáticamente. No se implementó exportación Excel ni el flujo de Pedido.

## Entorno compartido local

```sh
npm ci
npm run db:local
npm run seed:local
npm run dev
```

Abrir `http://127.0.0.1:8787/`. Inicializar fixtures solo una vez en una base local vacía. Usuarios ficticios: `admin-prueba`, `ana`, `bruno`, `cocina`, `multiple`, `terraza`, `garzones`, `sin-areas`; contraseña local: `Solo-pruebas-2026`. Un servidor estático no basta para esta versión. No publicar la raíz. Para Workers, `npm run build` prepara los assets públicos. Para Cloudflare Pages, usar **`npm run build:pages` y salida `dist`**: incluye el Worker que protege API y rutas. [Configuración del sitio publicado y primer administrador](docs/despliegue-pages.md).

[Guía completa: inicio, primer administrador sin registro público, pruebas manuales y pendientes de producción](docs/operacion-3a.md). [Contrato técnico](docs/contrato-3a.md). [Contexto](docs/project-context.md), [roadmap](docs/roadmap.md), [accesos](docs/accesos-y-administracion.md) y [verificación](docs/verification.md).

## Pruebas

```sh
npm test
python3 tests/workbook_contract.py
```

Preparar bases de pruebas desechables, separadas de los datos de desarrollo:

```sh
npm run test:prepare
npm run test:server
```

Con ese servidor abierto en otra terminal, ejecutar en secuencia:

```sh
npm run test:integration
npm run test:extended
npm exec playwright install chromium
npm run test:browser
npm run test:views
npm run test:ux
npm run test:sync
npm run test:load
npm run test:bootstrap
```

Para el paquete de Pages por HTTPS: `npm run build:pages`, abrir `npm run test:pages:server` en otra terminal y ejecutar `npm run test:pages`. Puertos 8790/8791; bases `.wrangler/test-state` y `.wrangler/pages-test-state`. Detener esos servidores antes de repetir `test:prepare` (reinicia únicamente esas dos bases ficticias).

No ejecutar simultáneamente los conjuntos que modifican fixtures. Las pruebas locales no certifican capacidad ni habilitación de producción. La revisión de asignaciones/unidades (2), supervisión/cierre avanzado (3B), exportación fiel (4) y offline completo siguen pendientes.

## Cierre técnico y recuperación

3A tiene funcionalidad y pruebas locales; el piloto con el equipo está aplazado por decisión del usuario. Antes del uso real falta resolver CPU/plan: Free se supone provisionalmente y la derivación de contraseñas todavía no está validada contra su presupuesto de CPU. [Estado, evidencia y guía de recuperación](docs/cierre-tecnico-3a.md). [Incrementos siguientes de 3B](docs/etapa-3b.md).

```sh
npm run test:operations
npm run profile:local
npm run backup -- --local --directory .backups/ensayo-3a
npm run restore:local -- --directory .backups/ensayo-3a --state .wrangler/recovery-3a
npm run maintenance -- --local
```

El ensayo de operaciones crea y elimina únicamente bases temporales. El respaldo exige destino nuevo y privado; la restauración solo admite un destino local nuevo y revoca sesiones recuperadas. `maintenance` solo consulta salvo `--apply`; conserva historial, conteos e IDs/resultados de operaciones. No hay mantenimiento programado ni escrituras remotas en build. Los comandos remotos explícitos y límites de recuperación están en la guía.

Después de un deployment, `npm run verify:public` realiza 16 GET anónimos al sitio, sin ingresar ni modificar datos; falla si rutas/JSON/no-store/cabeceras no cumplen. La evidencia actual distingue el sitio publicado del Worker local corregido. No ejecutar pruebas con fixtures o carga contra el sitio.

## Rama y envío

`inventory-v3` parte de `inventory-v2` en `3d2331919ea8bdf39daf1f095ea09877d69e6dd0` y añade toda la etapa 3A. `inventory-v2` permanece en ese commit anterior; no recibe usuarios, Workers ni los cambios de colaboración. El paquete y los Workers se identifican como `inventory-v3` / `inventory-v3-local`.

La rama v3 ya tiene seguimiento remoto. Para enviar los nuevos commits sin actualizar `inventory-v2`:

```sh
git push -u origin inventory-v3
```

El usuario publicó hasta `fb67ecb` en un proyecto Pages separado, incluidas las mejoras UX. Este cierre técnico no ejecutó push, despliegue ni cambios remotos; deja las herramientas y la corrección de cabeceras de errores listas localmente. No requiere nuevas migraciones ni bootstrap. Ver [separación de versiones y despliegues](docs/separacion-inventory-v3.md).
