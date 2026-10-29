import assert from 'node:assert/strict';
import { PasswordWork } from '../../operations/auth-worker/password-work.js';
import { hashPassword } from '../../worker/password.js';
import { LOGIN_PASSWORD_LANES } from '../../worker/session.js';
import { passwordLoginScenario } from './password-login-scenario.mjs';

const providers = new Map(),
  seen = new Set();
const namespace = {
  idFromName(key) {
    assert.match(key, /^[a-f0-9]{64}$/);
    return key;
  },
  get(key) {
    if (!providers.has(key)) providers.set(key, new PasswordWork());
    return {
      fetch(request) {
        seen.add(key);
        return providers.get(key).fetch(request);
      },
    };
  },
};
const password = 'Synthetic-only-password-2026',
  hash = await hashPassword(password);
const result = await passwordLoginScenario(namespace, hash, password);
// Scenario uses a second IP only at the end: <=4+1 objects, never one per name.
assert.ok(seen.size <= LOGIN_PASSWORD_LANES + 1);
assert.ok([...providers.values()].every((p) => p.pending === 0));
console.log(JSON.stringify({ runner: 'in-process-private-core', ...result }));
