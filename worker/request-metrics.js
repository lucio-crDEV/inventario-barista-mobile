// Request-local numbers only. Never retain SQL, bindings, results or identities.
const phases = ['preflight', 'auth', 'cycle', 'handler'];
export function requestMetrics(db, clock = () => performance.now(), sample = Math.random() < .001) {
  const stats = { calls: 0, statements: 0, rows_read: 0, rows_written: 0,
    metadata_missing: 0, sql_ms: 0, binding_ms: 0 };
  const elapsed = Object.fromEntries(phases.map(name => [name, 0]));
  let current = 'preflight', since = clock(), stopped = false;
  const originals = new WeakMap();
  const phase = name => {
    if (stopped || !phases.includes(name)) return;
    const now = clock(); elapsed[current] += Math.max(0, now - since);
    current = name; since = now;
  };
  async function execute(count, task) {
    stats.calls++; stats.statements += count;
    const start = clock();
    try {
      const value = await task();
      const results = Array.isArray(value) ? value : [value];
      for (let i = 0; i < count; i++) {
        const meta = results[i]?.meta;
        if (Number.isFinite(meta?.rows_read) && Number.isFinite(meta?.rows_written)) {
          stats.rows_read += Math.max(0, meta.rows_read);
          stats.rows_written += Math.max(0, meta.rows_written);
        } else stats.metadata_missing++;
        const ms = meta?.timings?.sql_duration_ms ?? meta?.duration;
        if (Number.isFinite(ms)) stats.sql_ms += Math.max(0, ms);
      }
      return value;
    } catch (error) { stats.metadata_missing += count; throw error; }
    finally { stats.binding_ms += Math.max(0, clock() - start); }
  }
  const wrap = raw => {
    const statement = {
      bind(...args) { return wrap(raw.bind(...args)); },
      all() { return execute(1, () => raw.all()); },
      run() { return execute(1, () => raw.run()); },
      async first(column) {
        // D1 first() executes the same SQL, but discards its metadata. Execute
        // once via all(), retain only metadata, and preserve the first-row DTO.
        const result = await execute(1, () => raw.all());
        const row = result.results?.[0] ?? null;
        if (row === null || column === undefined) return row;
        if (!Object.hasOwn(row, column)) throw Error('D1_ERROR: Column not found');
        return row[column];
      },
    };
    originals.set(statement, raw);
    return statement;
  };
  return {
    DB: {
      prepare(sql) { return wrap(db.prepare(sql)); },
      batch(statements) { return execute(statements.length, () => db.batch(statements.map(s => originals.get(s) ?? s))); },
    },
    phase,
    finish() {
      if (!stopped) { phase(current); stopped = true; }
      return { sampled: sample, stats: { ...stats }, phases: { ...elapsed } };
    },
    serverTiming() {
      const row = this.finish();
      return [...phases.map(name => `${name};dur=${row.phases[name].toFixed(1)}`),
        `d1;dur=${stats.binding_ms.toFixed(1)}`, `sql;dur=${stats.sql_ms.toFixed(1)}`,
        ...['calls','statements','rows_read','rows_written','metadata_missing'].map(name => `d1_${name};desc="${stats[name]}"`)].join(', ');
    },
  };
}
