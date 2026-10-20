// Grupos para contar en Bodega / Principal. Los números son filas de la hoja
// `principal`; la categoría, unidad, ID y posición de exportación siguen en
// `catalogo-excel.js` y no cambian al reorganizar la pantalla.
const rowRange = (first, last) =>
  Array.from({ length: last - first + 1 }, (_, index) => first + index);

export const principalCountGroups = [
  {
    name: "Abarrotes, granos y semillas",
    rows: [7, 10, 11, 12, 13, 15, 22, 23, 25, 31, 34, 36, 44, 48,
      55, 62, 63, 64, 65, 276],
  },
  {
    name: "Aceites, salsas y condimentos",
    rows: [3, 4, 5, 6, 19, 20, 30, 32, 38, 41, 42, 43, 45, 46,
      56, 57, 58, 59, 60, 61, 67, 69],
  },
  {
    name: "Harinas, mezclas y panificación",
    rows: [35, 37, 39, 47, 49, 50, 51, 52, 53, 54, 218, 219, 220, 221],
  },
  {
    name: "Carnes, aves y pescados",
    // Los atunes figuran en Abarrotes en el Excel, pero aquí se cuentan
    // junto al jamón; cada uno conserva su fila y categoría de salida.
    rows: [8, 9, 288],
  },
  {
    name: "Lácteos, cremas y grasas",
    rows: [29, 33, ...rowRange(222, 239), 289, 290],
  },
  {
    name: "Helados, pulpas y congelados",
    rows: [26, 27, 28, ...rowRange(111, 121), 216, 217],
  },
  {
    name: "Bebidas envasadas",
    rows: [...rowRange(104, 108), 110, 122, 123],
  },
  {
    name: "Café, chocolate y syrups",
    rows: [14, ...rowRange(124, 128), 130, ...rowRange(132, 139)],
  },
  {
    name: "Té e infusiones",
    rows: [66, ...rowRange(277, 287)],
  },
  {
    name: "Repostería y dulces",
    rows: [16, 17, 18, 21, 24, 40, 68, 129, 131,
      ...rowRange(240, 275).filter(row => row !== 261 && row !== 264)],
  },
  {
    name: "Aseo e higiene",
    rows: [...rowRange(70, 103), 163, 165, 166, 171],
  },
  {
    name: "Bolsas, cajas y envases",
    rows: [140, ...rowRange(142, 155), ...rowRange(157, 162), 164,
      167, 168, 172, ...rowRange(176, 179), 201, 202, 206],
  },
  {
    name: "Vasos, tapas y servicio",
    rows: [156, 173, 175, ...rowRange(185, 195), ...rowRange(203, 205),
      ...rowRange(207, 215)],
  },
  {
    name: "Rotulación y operación",
    rows: [109, 141, 169, 170, 174, ...rowRange(180, 184),
      ...rowRange(196, 200), 261, 264],
  },
];
