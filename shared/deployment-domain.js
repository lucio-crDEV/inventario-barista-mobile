// Approved deployment data only. Adding a catalog here does not approve an Excel template.
export const legacyCatalogVersion = 'inventory-v2-2026-10-21';
export const catalogVersion = 'inventory-v3-2026-10-22';
export const catalogCardinalities = Object.freeze({
  [legacyCatalogVersion]: 1227,
  [catalogVersion]: 1268,
});
export const catalogVersions = Object.freeze(Object.keys(catalogCardinalities));
export const catalogVersionsSQL = catalogVersions.map((version) => `'${version}'`).join(',');
export const catalogCountSQL = (column) =>
  `CASE ${column} ${Object.entries(catalogCardinalities)
    .map(([version, count]) => `WHEN '${version}' THEN ${count}`)
    .join(' ')} ELSE 0 END`;
export const areas = Object.freeze(
  [
    { id: 'cocina', name: 'Cocina', order: 1, active: true },
    { id: 'panaderia', name: 'Panadería', order: 2, active: true },
    { id: 'pasteleria', name: 'Pastelería', order: 3, active: true },
    { id: 'servicio', name: 'Servicio', order: 4, active: true },
    { id: 'principal', name: 'Bodega / Principal', order: 5, active: true },
  ].map(Object.freeze),
);
export const allowedArea = (area) => areas.some((candidate) => candidate.id === area);
const historicalScopeNames = Object.freeze({
  [legacyCatalogVersion]: Object.freeze({
    'servicio:armado-linea-coperia': 'Armado / Línea / Copería (ciclo anterior)',
  }),
});
export const catalogScope = (scope, version) =>
  historicalScopeNames[version]?.[scope.id]
    ? { ...scope, name: historicalScopeNames[version][scope.id] }
    : scope;
