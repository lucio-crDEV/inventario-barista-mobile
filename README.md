# Inventario

Aplicación web móvil para contar inventarios compartidos y exportar una copia fiel del libro original. Roles: Administrador, Jefa de servicio y Trabajador. JavaScript nativo, Cloudflare Pages/Workers, D1 y almacenamiento privado R2.

**Regla de oro:** el original es de solo lectura. La salida conserva hojas, filas, referencias, unidades y formatos; solo cambia el STOCK autorizado. La excepción de cocina!C74 está [documentada y es reversible](docs/excepcion-stock-cocina-c74.md).

El Administrador exporta desde **Panel de supervisión → Exportar Excel**, usando el inventario seleccionado. Solo los inventarios globalmente finalizados admiten una captura nueva; las copias anteriores siguen accesibles al reabrir.

## Desarrollo local

Requiere Node 24. Los siguientes pasos crean exclusivamente datos ficticios locales:

```sh
npm ci
npm run db:local
npm run seed:local
npm run dev
```

Abrir `http://127.0.0.1:8787/`. Usuario ficticio `admin-prueba`, clave `Solo-pruebas-2026`. Un servidor estático no sustituye al backend. No ejecutar inicialización ni fixtures en producción.

## Validación y publicación

```sh
npm run format:check
npm test
npm run test:security:isolated
npm run build:pages
```

GitHub Actions ejecuta formato, pruebas unitarias, lint HTML y la batería aislada, que incluye HTML seguro, offline y tiempo real. Pages publica **solo `dist`**, después del push del usuario a `inventory-v3`. Nunca publicar la raíz, `.backups`, `.exports`, `.git` ni `node_modules`. No hay secretos incluidos en el build.

## Documentación

- [Arquitectura, reglas y decisiones pendientes](docs/arquitectura-y-operacion.md).
- [Exportación, almacenamiento y preparación de producción](docs/etapa-4d-exportacion.md).
- [Verificación y límites de las pruebas](docs/verification.md).
- [Guía de estilos](docs/style-guide.md).
- [Índice de documentación](docs/README.md).

La app puede abrir el último ciclo y área autorizados sin conexión: conserva una instantánea por persona hasta el vencimiento de su sesión, como máximo doce horas. Los borradores requieren envío explícito con conexión; salir elimina la instantánea. El conteo RTv2 comparte registros autorizados y conserva la compatibilidad anterior.

El código local y su publicación se registran por separado. La migración de índice 0016 ya está aplicada y verificada en producción. Dependabot, TOTP, nuevas políticas de acceso y «Cerrar otras sesiones» siguen pendientes. La aceptación en teléfono físico y Microsoft Excel, y las referencias de catálogo sin resolver, conservan sus límites documentados.
