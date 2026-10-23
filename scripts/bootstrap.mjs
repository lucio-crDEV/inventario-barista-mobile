import { randomUUID } from "node:crypto";
import { hashPassword, validPassword } from "../worker/password.js";
import { catalogVersion } from "../worker/catalog.js";
const quote = (x) => `'${String(x).replaceAll("'", "''")}'`;
const fixtures = process.argv.includes("--fixtures");
let users;
if (fixtures) {
  users = [
    ["admin-prueba", "Administrador ficticio", "admin", []],
    ["jefa-servicio", "Jefa de servicio ficticia", "service_lead", []],
    ["jefa-servicio-2", "Segunda jefa ficticia", "service_lead", []],
    ["ana", "Ana ficticia", "worker", ["servicio:barra"]],
    ["bruno", "Bruno ficticio", "worker", ["servicio:barra"]],
    ["cocina", "Cocina ficticia", "worker", ["cocina"]],
    [
      "multiple",
      "Múltiple ficticio",
      "worker",
      ["servicio:barra", "servicio:armado-linea-coperia"],
    ],
    ["terraza", "Terraza ficticia", "worker", ["servicio:garzones:terraza"]],
    ["garzones", "Garzones ficticio", "worker", ["servicio:garzones"]],
    ["sin-areas", "Sin áreas ficticio", "worker", []],
    ...Array.from({ length: 15 }, (_, i) => [
      `carga${i + 1}`,
      `Carga ${i + 1}`,
      "worker",
      ["servicio:barra"],
    ]),
  ].map((u) => [...u, "Solo-pruebas-2026"]);
} else {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const u = JSON.parse(input);
  if (
    !/^[a-z0-9._-]{3,40}$/.test(u.username) ||
    typeof u.name !== "string" ||
    !u.name.trim() ||
    u.name.length > 80 ||
    !validPassword(u.password)
  )
    throw Error("Usuario o contraseña inválidos");
  users = [[u.username, u.name, "admin", [], u.password]];
}
// Output is SQL, never sent to a public endpoint. Run only against selected D1 database.
// D1/Wrangler executes the import; it does not accept interactive BEGIN/COMMIT.
if (!fixtures)
  console.log(
    "INSERT INTO guards SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users) THEN 1 ELSE 0 END;",
  );
for (const [username, name, role, grants, password] of users) {
  const id = randomUUID();
  const hash = await hashPassword(password);
  console.log(
    `INSERT INTO users(id,username,name,password_hash,role,must_change) VALUES(${quote(id)},${quote(username)},${quote(name)},${quote(hash)},${quote(role)},${fixtures ? 0 : 1});`,
  );
  for (const s of grants)
    console.log(`INSERT INTO grants VALUES(${quote(id)},${quote(s)});`);
  console.log(
    `INSERT INTO admin_audit(actor,target,action,detail) VALUES('offline-bootstrap',${quote(id)},'create','{}');`,
  );
}
console.log("DELETE FROM guards;");
if (fixtures)
  console.log(
    `INSERT INTO cycles(id,name,catalog_version,state) VALUES('prueba-compartida','Inventario compartido de prueba','${catalogVersion}','open');`,
  );
