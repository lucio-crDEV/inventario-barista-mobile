// Áreas de salida del inventario totalizado.
export const areas = [
  { id: "cocina", name: "Cocina", order: 1, active: true },
  { id: "panaderia", name: "Panadería", order: 2, active: true },
  { id: "pasteleria", name: "Pastelería", order: 3, active: true },
  { id: "servicio", name: "Servicio", order: 4, active: true },
  { id: "principal", name: "Bodega / Principal", order: 5, active: true },
];

// Sectores de trabajo que se consolidan en la hoja «servicio».
export const serviceSectors = [
  { id: "garzones", name: "Garzones" },
  { id: "mercadito", name: "Mercadito" },
  { id: "barra", name: "Barra" },
  { id: "armado-linea-coperia", name: "Armado / Línea / Copería" },
];

export const garzonZones = [
  { id: "privada", name: "Zona privada" },
  { id: "salon", name: "Salón" },
  { id: "terraza", name: "Terraza" },
];
