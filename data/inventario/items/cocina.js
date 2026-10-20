// Grupos de conteo de Cocina. Los números son filas de la hoja `cocina`
// del Excel final; solo ordenan la app y no alteran las referencias de salida.
const rowRange = (first, last) =>
  Array.from({ length: last - first + 1 }, (_, index) => first + index);

export const cocinaCountGroups = [
  {
    name: "Verduras y frutas",
    rows: rowRange(84, 118),
  },
  {
    name: "Carnes, aves y pescados",
    rows: [...rowRange(61, 74), 127, 128, 172],
  },
  {
    name: "Lácteos y huevos",
    rows: [20, ...rowRange(120, 126)],
  },
  {
    name: "Abarrotes",
    // Porotos verdes queda aquí provisionalmente, hasta recibir feedback.
    rows: [5, 7, 8, 9, 10, 11, 12, 13, 16, 17, 18, 19, 22, 24, 25,
      27, 33, 34, 35, 119, 170],
  },
  {
    name: "Aceites, salsas y condimentos",
    rows: [3, 4, 6, 14, 15, 21, 23, 26, 28, 29, 30, 31, 32, 36,
      37, 38, 39, 40, 41, 42, 43],
  },
  {
    name: "Elaborados y productos listos",
    rows: [129, 130, 131, 132, 133, 134, 138, 140, 141, 142, 143,
      144, 145, 146, 147, 148, 151, 153, 154, 156, 157, 158, 159,
      160, 161, 162, 163, 164, 165, 166, 167, 168, 169],
  },
  {
    name: "Panes y masas",
    rows: [135, 136, 137, 139, 149, 150, 152, 155, 171],
  },
  {
    name: "Aseo, protección y envases",
    rows: [...rowRange(44, 60), ...rowRange(75, 83), 173],
  },
];
