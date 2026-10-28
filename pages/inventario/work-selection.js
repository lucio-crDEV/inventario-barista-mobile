/** Prioriza el primer ítem que aún requiere trabajo. */
export function nextWorkIndex(groupItems, counts) {
  const index = groupItems.findIndex((item) => counts[item.id]?.status !== 'counted');
  return index < 0 ? 0 : index;
}

/** Sin stock es un cero contado que se marcó con la acción explícita. */
export function isOutOfStockCount(count) {
  return count?.status === 'counted' && count.quantity === 0 && count.outOfStock === true;
}

export function feedbackToneForCount(status, outOfStock = false) {
  return status === 'partial' && !outOfStock ? 'advance' : 'counted';
}
