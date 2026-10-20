// Grupos de conteo de Pastelería. Los números son filas de la hoja
// `pasteleria` del Excel final; no cambian sus referencias de salida.
const rowRange = (first, last) =>
  Array.from({ length: last - first + 1 }, (_, index) => first + index);

export const pasteleriaCountGroups = [
  {
    name: "Abarrotes y harinas",
    rows: [...rowRange(3, 17), 60],
  },
  {
    name: "Lácteos y cremas",
    rows: rowRange(61, 72),
  },
  {
    name: "Frutas y pulpas",
    rows: [42, ...rowRange(56, 59)],
  },
  {
    name: "Ingredientes de pastelería",
    rows: rowRange(73, 109).filter(row => ![90, 95, 96, 99].includes(row)),
  },
  {
    name: "Bases, masas y bizcochos",
    rows: [90, ...rowRange(118, 128), 165, 168, ...rowRange(178, 181), 247],
  },
  {
    name: "Rellenos y cremas",
    rows: [95, ...rowRange(115, 117), ...rowRange(145, 148),
      163, 164, 177, 193, 194, ...rowRange(205, 219), 244, 245, 246],
  },
  {
    name: "Coberturas, ganaches y salsas",
    rows: [...rowRange(138, 143), ...rowRange(169, 172), 220, 221, 248],
  },
  {
    name: "Dulces individuales",
    rows: [...rowRange(110, 114), ...rowRange(129, 135), 144,
      ...rowRange(149, 162), 166, 167, 182, 243],
  },
  {
    name: "Kuchen, pies y postres",
    rows: [136, 137, ...rowRange(173, 176), ...rowRange(195, 204)],
  },
  {
    name: "Tortas y moldes",
    rows: [...rowRange(183, 192), ...rowRange(222, 242)],
  },
  {
    name: "Aseo, protección y envases",
    rows: [...rowRange(18, 41), ...rowRange(43, 55), 96, 99],
  },
];
