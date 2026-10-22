# inventory-v3

**Punto de continuación, 22-10-2026:** recuperados localmente todos los cambios tras la reversión temporal. El ingreso en Free sigue pendiente de integrar/probar Supabase Auth; el usuario configurará su proyecto en la próxima sesión. No hacer push de esta recuperación esperando que corrija el fallo CPU. [Preparación y pendientes](docs/autenticacion-free.md).

Aplicación web móvil para contar el inventario por área y generar, en una etapa posterior, el libro `inventarios_og/11_10-INVENTARIO-totalizado.xlsx` con las cantidades nuevas y el resto de su estructura intacta.

La navegación muestra únicamente ámbitos autorizados y omite selectores de área/sector con una sola opción. Con varias áreas conserva Inicio; Garzones mantiene su selector de zonas. Servicio distingue Barra, Línea / Armado, Copería, Mercadito y Garzones; las zonas son Privada, Salón y Terraza. Copería cuenta los 32 productos de Aseo y Línea/Armado los otros 42. Mercadito tiene Desechables, Productos Elaborados y 41 conteos separados de Vitrina. Sus referencias Excel se conservan; la consolidación de cantidades pertenece a etapa 4.

Al abrir un grupo se muestra primero el siguiente ítem pendiente o con avance. «Sin stock» guarda explícitamente un cero como contado; «Guardar avance» y «Listo» conservan sus respectivos estados. El panel de ítems y el resumen permiten volver a cualquier producto.

«Ver ítems» abre el panel sin activar el buscador ni el teclado móvil. Solo despliega la categoría del producto actual y deja ese producto a la vista; las demás categorías se pueden abrir manualmente. La lupa del encabezado abre el mismo panel con la búsqueda enfocada. La navegación vuelve al inicio de la página al cambiar de vista o de producto. El menú de cuatro cuadros arriba a la derecha abre cuenta y ajustes desde la derecha; allí se cambia entre claro y oscuro. El ingreso sin sesión conserva solo el toggle de tema. Los iconos son SVG para mantener su apariencia en Android.

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

[Tecnologías, arquitectura y diagrama del roadmap](docs/tecnologias-y-roadmap.md). Estado local al 22-10-2026: **3A implementada, con aceptación operativa abierta; 3B en curso, con el incremento de usuarios y Servicio; Excel reservado a etapa 4**. Administrador, Jefa de servicio y Trabajador tienen alcances distintos. La jefa entra a Servicio y administra sus trabajadores; en cuentas mixtas solo sus accesos de Servicio. La administración edita el usuario de ingreso; cada persona su nombre visible en Mi perfil. Eliminar exige confirmación irreversible y conserva historial. [Contrato y actualización de entornos](docs/usuarios-y-servicio-3b.md).

Último código comprobado en el sitio: `94d3a83`, publicado por el usuario. Migraciones 0003/0004, ciclo nuevo y siete cuentas mínimas preparados con autorización; despliegue `982d494e` y 16 comprobaciones públicas correctos. **El ingreso sigue sin ser estable por límite CPU (1102, `exceededCpu`)**; ver [evidencia y pendiente de alojamiento](docs/verification.md). No repetir el primer administrador ni cargar fixtures. El refresco manual conserva un intento cada 30 segundos por usuario en el navegador, sin reenviar borradores.

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
npm run test:users-service
npm exec playwright install chromium
npm run test:browser
npm run test:views
npm run test:ux
npm run test:sync
npm run test:refresh
npm run test:users-service:browser
npm run test:load
npm run test:bootstrap
```

Para el paquete de Pages por HTTPS: `npm run build:pages`, abrir `npm run test:pages:server` en otra terminal y ejecutar `npm run test:pages`. Puertos 8790/8791; bases `.wrangler/test-state` y `.wrangler/pages-test-state`. Detener esos servidores antes de repetir `test:prepare` (reinicia únicamente esas dos bases ficticias).

No ejecutar simultáneamente los conjuntos que modifican fixtures. Las pruebas locales no certifican capacidad ni habilitación de producción. La revisión de asignaciones/unidades (2), supervisión/cierre avanzado (3B), exportación fiel (4) y offline completo siguen pendientes.

## Cierre técnico y recuperación

3A tiene funcionalidad y pruebas locales; el piloto con el equipo está aplazado por decisión del usuario. Antes del uso real falta resolver CPU/plan: Free se supone provisionalmente y la derivación de contraseñas todavía no está validada contra su presupuesto de CPU. [Estado, evidencia y guía de recuperación](docs/cierre-tecnico-3a.md). [Incrementos siguientes de 3B](docs/etapa-3b.md).

```sh
npm run test:operations
npm run test:migration-service
npm run profile:local
npm run backup -- --local --directory .backups/ensayo-3a
npm run restore:local -- --directory .backups/ensayo-3a --state .wrangler/recovery-3a
npm run maintenance -- --local
```

El ensayo de operaciones crea y elimina únicamente bases temporales. El respaldo exige destino nuevo y privado; la restauración solo admite un destino local nuevo y revoca sesiones recuperadas. `maintenance` solo consulta salvo `--apply`; conserva historial, conteos e IDs/resultados de operaciones. No hay mantenimiento programado ni escrituras remotas en build. Los comandos remotos explícitos y límites de recuperación están en la guía.

Después de un deployment, `npm run verify:public` realiza 16 GET anónimos al sitio, sin ingresar ni modificar datos; falla si rutas/JSON/no-store/cabeceras no cumplen. Se repitió contra `5d80658`: **16/16**, incluidas las cabeceras de errores de API. También se revisaron ingreso/cierre, menú/temas, refresco y lectura administrativa en el navegador del dominio real. Los conteos y permisos entre varias personas en producción siguen pendientes; alcance en [verificación](docs/verification.md). No ejecutar pruebas con fixtures o carga contra el sitio.

## Rama y envío

`inventory-v3` parte de `inventory-v2` en `3d2331919ea8bdf39daf1f095ea09877d69e6dd0` y añade toda la etapa 3A. `inventory-v2` permanece en ese commit anterior; no recibe usuarios, Workers ni los cambios de colaboración. El paquete y los Workers se identifican como `inventory-v3` / `inventory-v3-local`.

La rama v3 ya tiene seguimiento remoto. Para enviar los nuevos commits sin actualizar `inventory-v2`:

```sh
git push -u origin inventory-v3
```

El usuario publicó hasta `5d80658` en un proyecto Pages separado; el verificador público de ese despliegue pasa. El incremento local del 22-10 sí requiere preparar migraciones 0003/0004, ciclo y variable antes del push, según [la guía](docs/usuarios-y-servicio-3b.md); no requiere otro bootstrap. Los pushes y despliegues los realiza el usuario. Ver [separación de versiones](docs/separacion-inventory-v3.md).
