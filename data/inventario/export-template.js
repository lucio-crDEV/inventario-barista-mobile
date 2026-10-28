import { excelRows } from './items/catalogo-excel.js';

// This registry describes the approved original; it never contains stock values.
// Updating the hash or destination list requires explicit template approval.
export const excelTemplate = Object.freeze({
  id: 'totalizado-11-10-v1',
  path: 'inventarios_og/11_10-INVENTARIO-totalizado.xlsx',
  sha256: '9c123ce93a01df5167c80339451d2ffa94e5f29e9260a24519879fb1b78a14e9',
  catalogVersions: Object.freeze(['inventory-v2-2026-10-21','inventory-v3-2026-10-22']),
  stockFormulaCells: Object.freeze({ cocina: Object.freeze(['C74']) }),
  // Approved on 2026-10-28. Reversal: docs/excepcion-stock-cocina-c74.md.
  replaceableStockFormulaCells: Object.freeze({ cocina: Object.freeze(['C74']) }),
  sheets: Object.freeze(Object.fromEntries(Object.entries(excelRows).map(
    ([name, rows]) => [name, Object.freeze(rows.map(row => 'C'+row[0]))],
  ))),
});
