// Grupos de conteo de Panadería. Los números son filas de la hoja
// `panaderia` del Excel final; no cambian sus referencias de salida.
const rowRange = (first, last) =>
  Array.from({ length: last - first + 1 }, (_, index) => first + index);

const sweetRows = [106, 108, 110, 114, 115, ...rowRange(123, 130),
  136, 143, 147, 152];

export const panaderiaCountGroups = [
  {
    name: "Harinas y levaduras",
    rows: [18, ...rowRange(24, 29), ...rowRange(83, 86)],
  },
  {
    name: "Abarrotes, semillas y saborizantes",
    rows: [...rowRange(3, 33).filter(row =>
      ![16, 18, 24, 25, 26, 27, 28, 29].includes(row)),
      ...rowRange(95, 99)],
  },
  {
    name: "Refrigerados y huevos",
    rows: [16, 59, ...rowRange(87, 94)],
  },
  {
    name: "Panes y bollería",
    rows: rowRange(100, 153).filter(row => !sweetRows.includes(row)),
  },
  {
    name: "Galletas y dulces",
    rows: sweetRows,
  },
  {
    name: "Aseo y protección",
    rows: [...rowRange(34, 58), 70, 71],
  },
  {
    name: "Envases y rotulación",
    rows: rowRange(60, 82).filter(row => row !== 70 && row !== 71),
  },
];
