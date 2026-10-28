export const json = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
export const fail = (status, code, message = code, extra = {}) => {
  throw Object.assign(Error(message), { status, code, ...extra });
};
export async function body(req) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "JSON_REQUIRED");
  const reader = req.body?.getReader();
  const chunks = [];
  let size = 0;
  if (Number(req.headers.get("content-length")) > 16384) fail(413, "TOO_LARGE");
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        fail(413, "TOO_LARGE");
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const raw = new TextDecoder().decode(bytes);
  try {
    const b = JSON.parse(raw);
    if (!b || typeof b !== "object" || Array.isArray(b))
      fail(400, "INVALID_JSON");
    return b;
  } catch {
    fail(400, "INVALID_JSON");
  }
}
export function secured(res, req) {
  const socketOrigin=new URL(req.url);socketOrigin.protocol=socketOrigin.protocol==='https:'?'wss:':'ws:';
  const headers = new Headers(res.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${socketOrigin.origin}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  );
  return new Response(res.body, { status: res.status, headers,...(res.webSocket?{webSocket:res.webSocket}:{}) });
}

export function errorResponse(e) {
  const known = e.status || /LAST_ADMIN|UNIQUE constraint/.test(e.message);
  return json({
    code: e.code || (/LAST_ADMIN/.test(e.message) ? 'LAST_ADMIN' :
      /UNIQUE constraint/.test(e.message) ? 'DUPLICATE' : 'SERVER_ERROR'),
    message: e.status ? e.message : /LAST_ADMIN/.test(e.message)
      ? 'Debe quedar un administrador activo.' : 'No se pudo completar la operación.',
    ...(e.current !== undefined ? { current: e.current } : {}),
    ...(e.completion !== undefined ? {
      completion: e.completion, completionRevision: e.completionRevision,
    } : {}),
    ...(e.warnings !== undefined ? {
      warnings: e.warnings, confirmationRevision: e.confirmationRevision,
    } : {}),
  }, e.status || (known ? 409 : 500),
  e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : {});
}
