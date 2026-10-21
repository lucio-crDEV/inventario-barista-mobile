/** Absence, zero in progress and confirmed zero have different meanings. */
export function describeCountValue(record, unit) {
  if (!record) return "Sin conteo";
  if (record.outOfStock) return "Sin stock · cero confirmado";
  const suffix =
    record.quantity === 0
      ? record.status === "counted"
        ? " · cero confirmado"
        : " · en avance"
      : "";
  return `${record.quantity} ${unit || "(unidad pendiente)"}${suffix}`;
}
