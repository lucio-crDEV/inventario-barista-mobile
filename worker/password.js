import bcrypt from "bcryptjs";
export function validPassword(value) {
  return (
    typeof value === "string" &&
    [...value].length >= 12 &&
    new TextEncoder().encode(value).length <= 72
  );
}
export const hashPassword = (value) => bcrypt.hash(value, 12);
export const checkPassword = (value, hash) => bcrypt.compare(value, hash);
// Valid bcrypt hash for equal-cost verification when a username is absent.
export const dummyHash =
  "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
