throw Error(
  '0002 es un catálogo histórico aplicado. Para el reparto nuevo usar scripts/service-catalog-migration.mjs y una migración nueva.',
);
import { writeFile } from 'node:fs/promises';
import { catalog, catalogVersion, scopes } from '../worker/catalog.js';
export const quote = (x) => `'${String(x).replaceAll("'", "''")}'`;
let sql =
  '-- Catálogo fijo; referencias originales intactas. Generado por scripts/catalog-migration.mjs\n';
for (const s of scopes)
  sql += `INSERT INTO scopes VALUES(${quote(s.id)},${quote(s.name)},${s.parent ? quote(s.parent) : 'NULL'});\n`;
for (const s of scopes) {
  let n = s;
  while (n) {
    sql += `INSERT INTO scope_closure VALUES(${quote(n.id)},${quote(s.id)});\n`;
    n = scopes.find((x) => x.id === n.parent);
  }
}
for (const x of catalog)
  sql += `INSERT INTO catalog_items VALUES(${quote(catalogVersion)},${quote(x.id)},${quote(x.locationId)},${quote(x.unit || '')},${quote(JSON.stringify(x))});\n`;
await writeFile(new URL('../migrations/0002_catalog.sql', import.meta.url), sql);
