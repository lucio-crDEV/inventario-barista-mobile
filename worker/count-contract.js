// Field order is part of persisted command fingerprints. Never reorder.
export const countFields = Object.freeze([
  'id',
  'cycleId',
  'itemId',
  'locationId',
  'expectedVersion',
  'action',
  'quantity',
  'unit',
  'status',
  'note',
  'outOfStock',
]);
export function validQuantity(value) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1000000 &&
    Math.abs(value * 1000 - Math.round(value * 1000)) <= 1e-6
  );
}
export const validCountStatus = (value) => ['partial', 'counted'].includes(value);
export function validCountCommand(value) {
  return (
    ['cycleId', 'itemId', 'locationId'].every(
      (key) => typeof value[key] === 'string' && value[key] && value[key].length <= 150,
    ) &&
    Object.keys(value).every((key) => countFields.includes(key)) &&
    countFields.every((key) => key in value) &&
    typeof value.id === 'string' &&
    /^[a-zA-Z0-9-]{16,80}$/.test(value.id) &&
    Number.isSafeInteger(value.expectedVersion) &&
    value.expectedVersion >= 0 &&
    ['direct', 'add', 'overwrite'].includes(value.action) &&
    validQuantity(value.quantity) &&
    validCountStatus(value.status) &&
    typeof value.note === 'string' &&
    value.note.length <= 1000 &&
    typeof value.outOfStock === 'boolean' &&
    typeof value.unit === 'string'
  );
}
