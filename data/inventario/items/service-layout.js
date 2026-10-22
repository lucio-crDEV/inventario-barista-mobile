// Confirmado el 22-10-2026: Copería cuenta Aseo; Línea/Armado conserva el resto.
// Pares [fila del libro de reparto (hoja 9), fila de Servicio del totalizado].
// Todas las 41 correspondencias tienen nombre único y la misma unidad.
export const vitrinaReferences = [
  [4,153],[5,154],[6,155],[7,156],[8,157],[10,159],[11,160],[13,162],
  [19,168],[20,169],[25,174],[28,177],[29,178],[30,179],[40,189],
  [41,190],[42,191],[43,192],[44,193],[45,194],[46,195],[47,196],
  [48,197],[49,198],[50,199],[51,200],[53,202],[54,203],[55,204],
  [56,205],[57,206],[58,207],[59,208],[96,248],[97,249],[98,250],
  [99,251],[100,252],[101,253],[102,254],[107,259],
];
export function serviceLayout(items) {
  const revised = items.map(item => item.sectorId === "armado-linea-coperia" && item.countCategory === "Aseo"
    ? { ...item, sectorId: "coperia" } : item);
  const vitrina = vitrinaReferences.map(([manualRow, exportRow]) => {
    const base = items.filter(i => i.sectorId === "mercadito" && i.exportRow === exportRow);
    if (base.length !== 1) throw Error(`Referencia Vitrina ambigua: ${exportRow}`);
    return { ...base[0], id: `${base[0].id}:vitrina`, zoneId: "vitrina",
      countCategory: "Vitrina", countCategoryOrder: 2, physicalLocation: "Vitrina", manualRow };
  });
  return [...revised, ...vitrina];
}
