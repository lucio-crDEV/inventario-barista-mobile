// Temporary credentials stay in memory. Never write them to storage or URLs.
const words = Object.freeze(["Brioche", "Bakery", "Canela", "Avena", "Cacao", "Horno", "Miga", "Masa", "Trigo", "Molino", "Cafe", "Panera", "Cedazo", "Vainilla", "Semilla", "Levadura"]);
function randomInteger(max, cryptoAPI) {
  const limit = Math.floor(0x100000000 / max) * max;
  const value = new Uint32Array(1);
  do cryptoAPI.getRandomValues(value); while (value[0] >= limit);
  return value[0] % max;
}
export function temporaryPassword(cryptoAPI = globalThis.crypto) {
  if (!cryptoAPI?.getRandomValues) throw Error("El navegador no permite generar una contraseña segura.");
  const pick = values => values[randomInteger(values.length, cryptoAPI)];
  const first = pick(words), second = pick(words);
  // Recognizable words provide identity, not the security boundary. The random
  // suffix carries the entropy even when this short dictionary is public.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let suffix;
  do suffix = Array.from({ length: 12 }, () => pick(alphabet)).join(""); while (!/[2-9]/.test(suffix));
  return `${first}${pick(["-", "_", "$", "!"])}${second}-${suffix}`;
}
export const regenerateIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 6M20 4v7h-7"/></svg>';
