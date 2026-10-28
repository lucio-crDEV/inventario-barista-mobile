import { catalogVersion } from '../worker/catalog.js';
const id = process.argv[2],
  name = process.argv[3];
if (!/^[a-z0-9-]{3,64}$/.test(id || '') || !name?.trim() || name.length > 100)
  throw Error('Uso: node scripts/create-cycle.mjs piloto-v3 "Inventario piloto v3"');
const quote = (x) => `'${x.replaceAll("'", "''")}'`;
// Explicit, one-time cycle creation; never deletes counts or reopens old cycles.
console.log(
  `INSERT INTO cycles(id,name,catalog_version,state) VALUES(${quote(id)},${quote(name)},${quote(catalogVersion)},'open');`,
);
