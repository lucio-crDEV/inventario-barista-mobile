import { checkPassword, hashPassword, validPassword, dummyHash } from './password.js';
import { fail } from './http.js';

const bcrypt12 = /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/;
function unavailable() {
  fail(503, 'PASSWORD_SERVICE_UNAVAILABLE', 'No se pudo comprobar el acceso. Intenta nuevamente.');
}
async function requestWork(env, path, payload, partitionKey) {
  if (!/^[a-f0-9]{64}$/.test(partitionKey || '')) unavailable();
  const controller = new AbortController();
  let timer;
  try {
    const stub = env.PASSWORDS.get(env.PASSWORDS.idFromName(partitionKey));
    return await Promise.race([
      (async () => {
        const response = await stub.fetch(
          new Request('https://passwords.internal' + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          }),
        );
        if (!response.ok) unavailable();
        const text = await response.text();
        if (text.length > 256) unavailable();
        return JSON.parse(text);
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(Error('timeout'));
        }, 10000);
      }),
    ]);
  } catch {
    unavailable();
  } finally {
    clearTimeout(timer);
  }
}
function useService(env) {
  if (env.PASSWORDS) return true;
  // Mandatory in the new production profile. Older/local profiles retain their
  // cost-12 compatibility until the private binding is provisioned explicitly.
  if (env.PASSWORD_WORK_REQUIRED === '1') unavailable();
  return false;
}
export async function checkPasswordWithService(env, password, serverHash, partitionKey) {
  const supported = typeof serverHash === 'string' && bcrypt12.test(serverHash);
  const value =
    typeof password === 'string' && new TextEncoder().encode(password).length <= 72
      ? password
      : 'invalid-password';
  // A missing/corrupt account hash still performs cost-12 dummy verification.
  // Neither username existence nor arbitrary stored work factors select cheaper
  // or more expensive verification, and malformed hashes can never authenticate.
  const hash = supported ? serverHash : dummyHash;
  const valid = value === password;
  if (!useService(env)) return (await checkPassword(value, hash)) && supported && valid;
  const result = await requestWork(env, '/verify', { password: value, hash }, partitionKey);
  if (Object.keys(result || {}).length !== 1 || typeof result.match !== 'boolean') unavailable();
  return result.match && supported && valid;
}
export async function hashPasswordWithService(env, password, partitionKey) {
  if (!validPassword(password))
    fail(400, 'PASSWORD_POLICY', 'Usa al menos 8 caracteres y un máximo de 72 bytes.');
  if (!useService(env)) return hashPassword(password);
  const result = await requestWork(env, '/hash', { password }, partitionKey);
  if (
    Object.keys(result || {}).length !== 1 ||
    typeof result.hash !== 'string' ||
    !bcrypt12.test(result.hash)
  )
    unavailable();
  return result.hash;
}
