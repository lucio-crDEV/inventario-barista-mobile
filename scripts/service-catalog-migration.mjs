import { writeFile } from 'node:fs/promises';
import { catalog, catalogVersion } from '../worker/catalog.js';
const q = (x) => `'${String(x).replaceAll("'", "''")}'`;
let sql = `-- Catálogo nuevo para ciclos nuevos. No modifica cantidades ni catálogos anteriores.
INSERT INTO scopes VALUES('servicio:coperia','Copería','servicio');
INSERT INTO scopes VALUES('servicio:mercadito:vitrina','Vitrina','servicio:mercadito');
UPDATE scopes SET name='Línea / Armado' WHERE id='servicio:armado-linea-coperia';
INSERT INTO scope_closure VALUES('servicio:coperia','servicio:coperia'),('servicio','servicio:coperia'),('servicio:mercadito:vitrina','servicio:mercadito:vitrina'),('servicio:mercadito','servicio:mercadito:vitrina'),('servicio','servicio:mercadito:vitrina');
-- Un acceso anterior al sector combinado ya incluía Aseo; conservar ese alcance.
UPDATE users SET revision=revision+1 WHERE deleted_at IS NULL AND id IN(SELECT user_id FROM grants WHERE scope_id='servicio:armado-linea-coperia');
INSERT INTO grants SELECT user_id,'servicio:coperia' FROM grants WHERE scope_id='servicio:armado-linea-coperia';
INSERT INTO admin_audit(actor,target,action,detail) VALUES('schema-migration','servicio','split-service-layout','{"catalogVersion":"${catalogVersion}","coperiaItems":32,"vitrinaItems":41}');
`;
for (const x of catalog)
  sql += `INSERT INTO catalog_items VALUES(${q(catalogVersion)},${q(x.id)},${q(x.locationId)},${q(x.unit || '')},${q(JSON.stringify(x))});\n`;
await writeFile(new URL('../migrations/0004_service_catalog.sql', import.meta.url), sql);
