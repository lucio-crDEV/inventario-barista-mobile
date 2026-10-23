# Publicar la revisión UX 0007

**Preparación remota completada el 23-10-2026, después del commit bcae367, con autorización expresa del usuario.** Respaldo privado anterior y posterior verificados y restaurados; migración 0007 aplicada; ningún pendiente; preflight ready:true / operation-ux-0007. Las once tablas de datos preservadas coinciden exactamente por hash y pasan integridad/FK. Las 16 comprobaciones públicas posteriores pasan.

Production sigue sirviendo e1c8a06. El usuario hará únicamente el push SSH de inventory-v3. No repetir migración, bootstrap, fixtures, altas ni creación de ciclos. [Evidencia de esta preparación](preparacion-remota-ux-0007-2026-10-23.json).

Hasta completar el nuevo despliegue, evitar cambios de actividad/estado: el código anterior consulta la proyección histórica. La aceptación de la versión nueva y el recorrido físico solo pueden verificarse después del push. La guía siguiente queda como referencia del procedimiento ya realizado.

## Antes del push

Acordar una pausa breve de escrituras y guardar un respaldo privado en una carpeta nueva (el comando rechaza sobreescribirla):

```sh
npm run backup -- --remote --config wrangler.pages.production.jsonc --directory .backups/pre-ux-0007-20261023
npx wrangler d1 migrations list DB --config wrangler.pages.production.jsonc --remote
```

Comprobar el respaldo/checksum y las migraciones pendientes. Si 0006 ya está aplicada, solo debe quedar 0007; si no, revisar y aplicar 0006 seguida de 0007. La carpeta migrations no contiene 0005. Conservar los datos de conteo existentes.

```sh
npx wrangler d1 migrations apply DB --config wrangler.pages.production.jsonc --remote
npm run preflight -- --remote --config wrangler.pages.production.jsonc --cycle piloto-v3-servicio
```

Continuar únicamente con `ready:true` y `schemaContract:operation-ux-0007`. Si falla, mantener la pausa y revisar el diagnóstico. Confirmar las variables efectivas de Production en Pages: DB=`inventario-login-v3`, APP_ENV=`production`, APP_ORIGIN=`https://inventario-login.pages.dev`, ACTIVE_CYCLE_ID=`piloto-v3-servicio`. El archivo de configuración es una referencia; no sustituye comprobar los bindings del deploy Git.

## Subir y comprobar

```sh
git status --short
git log -1 --oneline
git push origin inventory-v3
```

En Pages, comprobar ProductionSuccess y el commit esperado. Build: `npm run build:pages`; salida `dist`. No hay dependencias ni variables nuevas.

```sh
npm run verify:public -- --origin https://inventario-login.pages.dev
```

Después hacer un recorrido breve con cuentas existentes autorizadas: trabajador guarda/sincroniza; encargada cierra para revisión, revisa y finaliza; encargada no puede reabrir finalizado y Administrador sí con motivo; crear acceso de ensayo solo si se decide expresamente. Revisar teclado/aviso/descarte en Android/iOS y los temas. No ejecutar suites de fixtures o carga contra producción. El informe local no reemplaza esta aceptación.

## Recuperación

0007 conserva conteos, historial, IDs/fingerprints/resultados aceptados y referencias; cambia la fuente de actividad a item_activity. El código antiguo 0006 lee cycle_item_states, ahora referencia histórica, mientras la guardia nueva usa actividad persistente. Por eso revertir únicamenteGit **no es una reversión funcional transparente**. Ante problemas, pausar escrituras y evaluar código/esquema/datos juntos; no borrar tablas, bajar migraciones ni sobrescribir cambios recientes automáticamente. Restaurar respaldo es una operación separada, requiere considerar escrituras posteriores y revocar sesiones restauradas.

El Excel original sigue intacto; esta versión no exporta ni modifica libros.
