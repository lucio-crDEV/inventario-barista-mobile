import { checkPassword, hashPassword, validPassword } from '../../worker/password.js';

export const bcrypt12 = /^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/;
const reply = (value, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
async function boundedJSON(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw Error('invalid');
  const reader = request.body?.getReader();
  if (!reader) throw Error('invalid');
  const chunks = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 1024) {
      await reader.cancel();
      throw Error('invalid');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
// Private, stateless password computation only. No storage, session, user, audit,
// logging or cache access. The caller owns durable quotas and atomic identity checks.
export class PasswordWork {
  constructor() {
    this.tail = Promise.resolve();
    this.pending = 0;
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (request.method !== 'POST' || !['/verify', '/hash'].includes(path))
      return reply({ code: 'NOT_FOUND' }, 404);
    let input;
    try {
      input = await boundedJSON(request);
      const fields = path === '/verify' ? ['password', 'hash'] : ['password'];
      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.keys(input).length !== fields.length ||
        fields.some((key) => !Object.hasOwn(input, key)) ||
        typeof input.password !== 'string' ||
        new TextEncoder().encode(input.password).length > 72 ||
        (path === '/hash'
          ? !validPassword(input.password)
          : typeof input.hash !== 'string' || !bcrypt12.test(input.hash))
      )
        throw Error('invalid');
    } catch {
      return reply({ code: 'INVALID_PASSWORD_WORK' }, 400);
    }
    // Bound work per hashed-IP partition. Serialized bcrypt avoids a CPU burst;
    // excess requests fail closed instead of retaining an unbounded credential queue.
    if (this.pending >= 16) return reply({ code: 'PASSWORD_WORK_BUSY' }, 503);
    this.pending++;
    const task = this.tail.then(async () =>
      path === '/verify'
        ? reply({ match: await checkPassword(input.password, input.hash) })
        : reply({ hash: await hashPassword(input.password) }),
    );
    this.tail = task.then(
      () => {},
      () => {},
    );
    try {
      return await task;
    } catch {
      return reply({ code: 'PASSWORD_WORK_UNAVAILABLE' }, 503);
    } finally {
      this.pending--;
    }
  }
}
