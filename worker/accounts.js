import { hashPassword, validPassword } from "./password.js";

const serviceGrant = (alias) => `EXISTS(SELECT 1 FROM grants g JOIN scope_closure c ON c.descendant=g.scope_id WHERE g.user_id=${alias}.id AND c.ancestor='servicio')`;
const externalGrant = (alias) => `EXISTS(SELECT 1 FROM grants g WHERE g.user_id=${alias}.id AND NOT EXISTS(SELECT 1 FROM scope_closure c WHERE c.ancestor='servicio' AND c.descendant=g.scope_id))`;
const serviceMember = (alias) => `(${serviceGrant(alias)} OR (${alias}.managed_scope='servicio' AND NOT ${externalGrant(alias)}))`;
const actorSQL = `SELECT a.* FROM users a JOIN sessions s ON s.user_id=a.id WHERE s.hash=?1 AND s.expires>unixepoch() AND a.active=1 AND a.deleted_at IS NULL AND a.must_change=0`;
const managerial = `WITH actor AS (${actorSQL} AND a.role IN ('admin','service_lead')) `;
const roles = ["worker", "service_lead", "admin"];
const validUsername = value => typeof value === "string" && /^[a-z0-9._-]{3,40}$/.test(value);

export async function accountRequest(req, db, path, { u, hash }, helpers) {
  const { body, fail, json, userDTO, quota, event } = helpers;
  const guard = (target, revision, mode = "account", createRole = "worker") => {
    let condition;
    if (mode === "profile") condition = `a.id=?2 AND a.revision=?3`;
    else if (!target) condition = `(a.role='admin' OR (a.role='service_lead' AND ?2='worker'))`;
    else condition = `EXISTS(SELECT 1 FROM users t WHERE t.id=?2 AND t.deleted_at IS NULL AND t.revision=?3 AND (a.role='admin' OR (a.role='service_lead' AND t.role='worker' AND ${serviceMember("t")} ${mode === "grants" ? "" : `AND NOT ${externalGrant("t")}`})))`;
    const sql = `INSERT INTO guards SELECT CASE WHEN EXISTS(${actorSQL} AND a.revision=${Number(u.revision)} AND ${condition}) THEN 1 ELSE 0 END`;
    return db.prepare(sql).bind(hash, ...(target ? [target, revision] : [createRole]));
  };
  const write = async (target, revision, mode, action, detail, statements, createRole) => {
    try {
      await db.batch([
        guard(target, revision, mode, createRole),
        ...statements,
        db.prepare("INSERT INTO admin_audit(actor,target,action,detail) VALUES(?,?,?,?)").bind(u.id, target || detail.id, action, JSON.stringify(detail)),
        db.prepare("DELETE FROM guards"),
      ]);
      event.target = target || detail.id;
      event.action = action;
      if (["reset-password", "delete-user"].includes(action) ||
          (action === "update-user" && detail.after.username !== undefined && (detail.before.username !== detail.after.username || !detail.after.active)))
        event.sessionsRevoked = true;
    } catch (e) {
      if (/CHECK constraint failed: value=1/.test(e.message))
        fail(409, "ACCOUNT_CHANGED", "La cuenta o tus permisos cambiaron. Recarga y revisa antes de guardar.");
      throw e;
    }
  };
  const revision = b => {
    if (!Number.isSafeInteger(b.expectedRevision) || b.expectedRevision < 1)
      fail(400, "REVISION_REQUIRED", "Recarga la cuenta antes de guardar.");
    return b.expectedRevision;
  };
  if (path === "/api/profile" && req.method === "POST") {
    const b = await body(req), rev = revision(b);
    if (Object.keys(b).some(k => !["name", "expectedRevision"].includes(k)) || typeof b.name !== "string" || !b.name.trim() || b.name.trim().length > 80)
      fail(400, "INVALID_PROFILE", "Escribe un nombre visible de hasta 80 caracteres.");
    if (u.revision !== rev) fail(409, "ACCOUNT_CHANGED", "Tu cuenta cambió. Recarga y vuelve a intentarlo.");
    await write(u.id, rev, "profile", "rename-profile", { before: u.name, name: b.name.trim() }, [
      db.prepare("UPDATE users SET name=?,revision=revision+1 WHERE id=?").bind(b.name.trim(), u.id),
    ]);
    return json({ user: userDTO(await db.prepare("SELECT * FROM users WHERE id=?").bind(u.id).first()) });
  }
  if (!roles.slice(1).includes(u.role)) fail(403, "ADMIN_REQUIRED", "No tienes acceso a la administración.");
  if (path === "/api/admin/users" && req.method === "GET") {
    const rows = await db.batch([
      db.prepare(managerial + "SELECT * FROM actor").bind(hash),
      db.prepare(managerial + `SELECT t.*,CASE WHEN ${externalGrant("t")} THEN 1 ELSE 0 END mixed FROM users t,actor a WHERE t.deleted_at IS NULL AND (a.role='admin' OR (t.role='worker' AND ${serviceMember("t")})) ORDER BY t.username`).bind(hash),
      db.prepare(managerial + `SELECT g.* FROM grants g,actor a WHERE a.role='admin' OR EXISTS(SELECT 1 FROM scope_closure c WHERE c.ancestor='servicio' AND c.descendant=g.scope_id)`).bind(hash),
      db.prepare(managerial + `SELECT s.* FROM scopes s,actor a WHERE a.role='admin' OR EXISTS(SELECT 1 FROM scope_closure c WHERE c.ancestor='servicio' AND c.descendant=s.id)`).bind(hash),
    ]);
    const actor = rows[0].results[0];
    if (!actor) fail(403, "ADMIN_REQUIRED");
    return json({ user: userDTO(actor), users: rows[1].results.map(x => ({
      ...userDTO(x),
      limited: actor.role !== "admin" && !!x.mixed,
      grants: rows[2].results.filter(g => g.user_id === x.id).map(g => g.scope_id),
    })), scopes: rows[3].results });
  }
  if (path === "/api/admin/users" && req.method === "POST") {
    const b = await body(req);
    if (Object.keys(b).some(k => !["username", "name", "role", "password"].includes(k)) || !validUsername(b.username) || typeof b.name !== "string" || !b.name.trim() || b.name.length > 80 || !validPassword(b.password) || !roles.includes(b.role))
      fail(400, "INVALID_USER", "Revisa usuario, nombre, rol y contraseña temporal.");
    if (u.role === "service_lead" && b.role !== "worker") fail(403, "FORBIDDEN");
    await quota(db, "admin-password:" + u.id, 10);
    const id = crypto.randomUUID(), h = await hashPassword(b.password);
    await write(null, null, "create", "create", { id, username: b.username, name: b.name.trim(), role: b.role }, [
      db.prepare("INSERT INTO users(id,username,name,password_hash,role,managed_scope) VALUES(?,?,?,?,?,?)").bind(id, b.username, b.name.trim(), h, b.role, u.role === "service_lead" ? "servicio" : null),
    ], b.role);
    return json({ id }, 201);
  }
  const match = path.match(/^\/api\/admin\/users\/([a-f0-9-]+)(\/(?:password|delete))?$/);
  if (match && req.method === "POST") {
    const targetId = match[1], b = await body(req), rev = revision(b);
    const t = await db.prepare(`SELECT t.*,CASE WHEN ${externalGrant("t")} THEN 1 ELSE 0 END mixed,CASE WHEN ${serviceMember("t")} THEN 1 ELSE 0 END service_member FROM users t WHERE t.id=? AND t.deleted_at IS NULL`).bind(targetId).first();
    if (!t || (u.role === "service_lead" && (t.role !== "worker" || !t.service_member))) fail(404, "USER_NOT_FOUND");
    if (t.revision !== rev) fail(409, "ACCOUNT_CHANGED", "Esta cuenta cambió. Recarga y revisa antes de guardar.");
    const limited = u.role === "service_lead" && !!t.mixed;
    if (match[2]) {
      if (limited) fail(403, "SERVICE_GRANTS_ONLY", "Solo puedes cambiar los accesos de Servicio de esta persona.");
      if (match[2] === "/delete") {
        if (b.confirm !== true || Object.keys(b).some(k => !["confirm", "expectedRevision"].includes(k)))
          fail(400, "CONFIRMATION_REQUIRED", "Debes confirmar la eliminación irreversible.");
        await write(targetId, rev, "account", "delete-user", { username: t.username, name: t.name, role: t.role }, [
          db.prepare("UPDATE users SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),active=0,username=?,password_hash='!deleted',revision=revision+1 WHERE id=?").bind(`~deleted:${t.id}`, t.id),
          db.prepare("DELETE FROM grants WHERE user_id=?").bind(t.id),
        ]);
        return json({ ok: true, deleted: true });
      }
      if (!validPassword(b.password) || Object.keys(b).some(k => !["password", "expectedRevision"].includes(k))) fail(400, "PASSWORD_POLICY");
      await quota(db, "admin-password:" + u.id, 10);
      const h = await hashPassword(b.password);
      await write(targetId, rev, "account", "reset-password", {}, [
        db.prepare("UPDATE users SET password_hash=?,must_change=1,revision=revision+1 WHERE id=?").bind(h, t.id),
      ]);
      return json({ ok: true });
    }
    const fields = limited ? ["grants", "expectedRevision"] : ["username", "role", "active", "grants", "expectedRevision"];
    if (Object.keys(b).some(k => !fields.includes(k)) || !Array.isArray(b.grants) || b.grants.length > 25 || new Set(b.grants).size !== b.grants.length || (!limited && (!validUsername(b.username) || typeof b.active !== "boolean" || !roles.includes(b.role))))
      fail(400, "INVALID_USER", "Revisa el usuario y sus accesos; el nombre visible lo cambia cada persona desde Mi perfil.");
    if (u.role === "service_lead" && !limited && b.role !== "worker") fail(403, "FORBIDDEN");
    const scopes = (await db.prepare("SELECT id FROM scopes").all()).results.map(x => x.id);
    if (!limited && b.role !== "worker" && b.grants.length)
      fail(400, "ROLE_SCOPE", "Este rol obtiene su alcance por función y no usa asignaciones de trabajador.");
    if (b.grants.some(x => !scopes.includes(x))) fail(400, "INVALID_SCOPE");
    const serviceScopes = (await db.prepare("SELECT descendant id FROM scope_closure WHERE ancestor='servicio'").all()).results.map(x => x.id);
    if (u.role === "service_lead" && (b.grants.some(x => !serviceScopes.includes(x)) || (!limited && b.role !== "worker"))) fail(403, "FORBIDDEN");
    const priorGrants = (await db.prepare("SELECT scope_id FROM grants WHERE user_id=?").bind(t.id).all()).results.map(x => x.scope_id);
    const statements = limited ? [
      db.prepare("UPDATE users SET revision=revision+1 WHERE id=?").bind(t.id),
      db.prepare("DELETE FROM grants WHERE user_id=? AND scope_id IN(SELECT descendant FROM scope_closure WHERE ancestor='servicio')").bind(t.id),
    ] : [
      db.prepare("UPDATE users SET username=?,active=?,role=?,revision=revision+1,managed_scope=CASE WHEN ? THEN 'servicio' ELSE managed_scope END WHERE id=?").bind(b.username, b.active ? 1 : 0, b.role, b.grants.some(x => serviceScopes.includes(x)) ? 1 : 0, t.id),
      db.prepare("DELETE FROM grants WHERE user_id=?").bind(t.id),
    ];
    statements.push(...b.grants.map(s => db.prepare("INSERT INTO grants VALUES(?,?)").bind(t.id, s)));
    await write(t.id, rev, limited ? "grants" : "account", "update-user", {
      before: { username: t.username, active: !!t.active, role: t.role, grants: priorGrants.filter(s => u.role === "admin" || serviceScopes.includes(s)) },
      after: limited ? { grants: b.grants } : { username: b.username, active: b.active, role: b.role, grants: b.grants },
    }, statements);
    return json({ ok: true });
  }
  fail(404, "NOT_FOUND");
}
