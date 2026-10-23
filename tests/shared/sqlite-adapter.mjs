import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
// Real SQLite adapter for HTTP contract/failure injection tests. D1/workerd is tested separately.
export function sqliteDB(through = 4) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const db = {
    sqlite,
    prepare(sql) {
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() { const r = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return statement;
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const rows = [];
        for (const statement of statements) rows.push(await statement.all());
        sqlite.exec("COMMIT");
        return rows;
      } catch (e) { sqlite.exec("ROLLBACK"); throw e; }
    },
    migrate(from = 1, to = through) {
      for (const file of readdirSync("migrations").sort()) {
        const n = Number(file.slice(0, 4));
        if (n < from || n > to) continue;
        sqlite.exec("BEGIN");
        try { sqlite.exec(readFileSync(`migrations/${file}`, "utf8")); sqlite.exec("COMMIT"); }
        catch (e) { sqlite.exec("ROLLBACK"); throw e; }
      }
    },
  };
  db.migrate();
  return db;
}
