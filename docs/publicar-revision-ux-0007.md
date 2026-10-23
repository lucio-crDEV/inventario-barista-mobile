# Publicar la revisión UX 0007

Guía manual para el propietario. Ninguno de estos comandos remotos se ejecutó en esta entrega. El commit queda local, sin push/despliegue. Trabajar en `inventory-v3` desde `/Users/lucio/workspace/inventario_brioche`.

La app nueva exige 0007. El usuario informa 0006 ya preparada en su entorno; comprobarlo con el listado en lugar de repetir inicializaciones. No cambiar DB, variables, catálogo ni ciclo. No aplicar 0005, fixtures, bootstrap, cuentas demo ni crear otro ciclo.

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
