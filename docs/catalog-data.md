# Catálogo como datos

`scripts/catalog-data.mjs` exporta e importa el catálogo v3 aprobado como un archivo JSON independiente de las migraciones SQL. El importador acepta únicamente `inventory-v3-2026-10-22` con cardinalidad y SHA-256 registrados en `scripts/operations/catalog-data.mjs`. El catálogo v2 continúa disponible en la base cuando existe; esta herramienta no lo reconstruye desde migraciones históricas.

Exporta una copia sin sobrescribir archivos existentes:

```sh
node scripts/catalog-data.mjs --export --output /tmp/catalog-v3.json
```

Importa solo contra un destino elegido de forma explícita:

```sh
node scripts/catalog-data.mjs --import --input /tmp/catalog-v3.json --local --state .wrangler/catalog-state
node scripts/catalog-data.mjs --import --input /tmp/catalog-v3.json --remote --config wrangler.jsonc
```

Antes de escribir valida el hash aprobado, las 1268 filas, la unicidad de ID/ubicación, las áreas, unidades, jerarquías, cierres de alcance y cobertura de referencias de exportación. También comprueba que el esquema y los alcances del destino estén preparados. Si la versión ya existe con el contenido exacto, termina sin cambios; si está incompleta o su contenido difiere, se detiene sin sobrescribirla.

El SQL de importación usa como máximo 50 sentencias por lote, mantiene cada sentencia bajo 90 KB y cada fila bajo 1,9 MB. La versión actual ocupa 26 sentencias y aproximadamente 631 KB en total. Wrangler procesa `--file` como una importación atómica en D1; un fallo deja la base en su estado previo. La herramienta solo inserta filas de `catalog_items`: no ejecuta DDL, no altera versiones existentes y no activa ciclos ni publica datos. Para aprobar otra versión habrá que añadir deliberadamente su cardinalidad, hash y datos canónicos; el importador no acepta plantillas futuras.

La prueba `tests/catalog-import.test.mjs` comprueba los límites, el rechazo de versiones alteradas y el rollback de un lote local de D1 con una sentencia final fallida.
