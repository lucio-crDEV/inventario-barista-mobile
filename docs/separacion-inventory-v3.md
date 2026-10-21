# Separación de inventory-v3 — 21-10-2026

## Base conservada

`inventory-v3` se creó desde `inventory-v2` en el commit `3d2331919ea8bdf39daf1f095ea09877d69e6dd0` (`fix: restore cached summary counts in meeting workbook`). Incluye toda la historia y los archivos de esa base. No hubo reset, borrado, traslado de archivos a otro repositorio ni modificación de libros.

La referencia local `inventory-v2` permanece exactamente en ese commit, igual que la referencia local conocida `origin/inventory-v2`. No se consultó ni modificó el remoto durante esta separación. La base ya contenía el catálogo, diseño y conteo local anteriores; los cambios de documentación que estaban sin commit antes de 3A se conservaron en la nueva rama.

## Avance incorporado

El commit `0a50b58` incorpora la implementación de etapa 3A: cuentas personales, contraseñas, sesiones, administración mínima, ámbitos múltiples, Worker + D1, catálogo filtrado, conteo compartido, historial, resolución Descartar/Sumar/Sobrescribir, borradores, pruebas y documentación.

El siguiente commit separa los nombres de paquete y Workers a `inventory-v3` / `inventory-v3-local`, actualiza las instrucciones del repositorio y documenta esta decisión. La configuración de producción de ejemplo identifica `inventory-v3-production`; sigue sin un UUID real ni dominio configurados. No hay recursos remotos creados o modificados.

Se conservan sin renombrar los ID internos de productos/ubicaciones, referencias Excel, esquema SQL y versión inmutable de catálogo `inventory-v2-2026-10-21`. Son identidades de datos; cambiarlas por el nombre de la nueva rama rompería compatibilidad con el ciclo de ensayo. También se preserva el UUID local ficticio y la base local de pruebas ya preparada. `inventario-session-v2` sigue intacto, sin importación automática.

## GitHub y despliegues

La rama activa de continuación es `inventory-v3`. Sus cambios están en commits locales; para enviarla:

```sh
git push -u origin inventory-v3
```

Ese comando crea/actualiza únicamente la rama remota v3; no modifica la referencia de `inventory-v2`. No ejecutar push de v2 ni fusionar v3 a v2 para publicar esta funcionalidad. No se ejecutó push en esta tarea y no se verificaron credenciales SSH en vivo.

No hay workflows de despliegue versionados en `.github/` en esta copia. La configuración externa de Cloudflare Pages/Workers no fue consultada ni modificada: si existe una integración que crea previews para todas las ramas, el futuro push de v3 podría activar una preview según esa configuración. Mantener `inventory-v2` como rama de producción de su proyecto actual y preparar v3 en un proyecto/Worker, dominio y D1 separados antes de autorizar su despliegue. Esta separación de Git no afirma que se hayan cambiado ajustes de Cloudflare.

## Verificación de la separación

- La base de `inventory-v2` sigue siendo `3d23319` y es ancestro de `inventory-v3`.
- Los commits del avance aparecen únicamente por encima de esa base en v3.
- El paquete y los nombres de Workers usan v3; las identidades de datos se conservan.
- Se ejecutaron build, pruebas generales, contrato de 1.151 filas y comprobación de diff tras la separación. Los resultados completos de integración/navegador/carga de la implementación se conservan en [verification.md](verification.md).
- La validación operativa/producción continúa pendiente; la separación no convierte 3A en una entrega desplegada.
