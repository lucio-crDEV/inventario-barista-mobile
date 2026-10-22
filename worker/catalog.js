import { items } from "../data/inventario/items/index.js";
import {
  areas,
  serviceSectors,
  garzonZones,
} from "../data/inventario/areas.js";
export const legacyCatalogVersion = "inventory-v2-2026-10-21";
export const catalogVersion = "inventory-v3-2026-10-22";
export const scopes = [
  ...areas.map((x) => ({ ...x, parent: null })),
  ...serviceSectors.map((x) => ({
    ...x,
    id: `servicio:${x.id}`,
    parent: "servicio",
  })),
  ...garzonZones.map((x) => ({
    ...x,
    id: `servicio:garzones:${x.id}`,
    parent: "servicio:garzones",
  })),
  { id: "servicio:mercadito:vitrina", name: "Vitrina", parent: "servicio:mercadito" },
];
export const locationOf = (x) =>
  [x.areaId, x.sectorId, x.zoneId].filter(Boolean).join(":");
export const catalog = items.map((x) => ({ ...x, locationId: locationOf(x) }));
