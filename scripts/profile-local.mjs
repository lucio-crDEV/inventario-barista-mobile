import { writeFile } from "node:fs/promises";
import { hashPassword, checkPassword } from "../worker/password.js";
// Measure the exact password library/parameters, without accounts, requests or DB.
// Node process CPU is an indication, never Cloudflare's billed CPU measurement.
const samples = [];
let hash;
for (let round = 0; round < 3; round++) {
  for (const operation of ["hash", "verify"]) {
    const before = process.cpuUsage(),
      start = performance.now();
    if (operation === "hash") hash = await hashPassword("Solo-pruebas-2026");
    else if (!(await checkPassword("Solo-pruebas-2026", hash)))
      throw Error("No se verificó la contraseña ficticia.");
    const cpu = process.cpuUsage(before);
    samples.push({
      operation,
      round: round + 1,
      wallMs: Math.round(performance.now() - start),
      processCpuMs: Math.round((cpu.user + cpu.system) / 1000),
    });
  }
}
const report = {
  environment: `Node ${process.version}, bcryptjs 3.0.3 con el módulo real de contraseñas`,
  bcryptCost: 12,
  productionBillingMeasurement: false,
  warning:
    "CPU del proceso Node local. No equivale a CPU facturada de Workers, no incluye D1 y no certifica compatibilidad con el plan Free.",
  samples,
};
await writeFile(
  "docs/perfil-local-3a.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
