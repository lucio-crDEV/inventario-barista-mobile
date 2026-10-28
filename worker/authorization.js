// Server-owned SQL fragments. Session hash always binds to ?1.
// Triggers retain transactional authorization for accepted writes.
export function actorSQL(alias = 'u', roles = []) {
  if (
    !['u', 'a'].includes(alias) ||
    !Array.isArray(roles) ||
    roles.some((role) => !['admin', 'service_lead', 'worker'].includes(role))
  )
    throw new TypeError('Unsupported authorization fragment');
  const filter = roles.length
    ? ' AND ' + alias + '.role IN (' + roles.map((role) => "'" + role + "'").join(',') + ')'
    : '';
  return (
    'SELECT ' +
    alias +
    '.* FROM users ' +
    alias +
    ' JOIN sessions s ON s.user_id=' +
    alias +
    '.id WHERE s.hash=?1 AND s.expires>unixepoch() AND ' +
    alias +
    '.active=1 AND ' +
    alias +
    '.deleted_at IS NULL AND ' +
    alias +
    '.must_change=0' +
    filter
  );
}
export function permissionsSQL({ supervisor = false, column = 'scope_id' } = {}) {
  if (!['id', 'scope_id'].includes(column)) throw new TypeError('Unsupported scope column');
  return (
    'WITH actor AS (' +
    actorSQL('u', supervisor ? ['admin', 'service_lead'] : []) +
    '), allowed AS (SELECT p.scope_id' +
    (column === 'id' ? ' id' : '') +
    ' FROM inventory_permissions p JOIN actor a ON a.id=p.user_id) '
  );
}
