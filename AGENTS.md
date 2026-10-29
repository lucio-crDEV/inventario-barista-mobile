# Instrucciones de mantenimiento

## Proyecto y alcance

- Trabajar en `inventory-v3`, raíz `/Users/lucio/workspace/inventario_brioche`. No mezclar `main`, `inventory-v2` ni `warehouse-order`; Pedido es otro módulo.
- Leer [arquitectura](docs/arquitectura-y-operacion.md), [estado de 4D](docs/etapa-4d-exportacion.md) y [verificación](docs/verification.md). Para UI, leer [estilos](docs/style-guide.md). Los informes fechados son evidencia histórica.
- `sources/` es referencia sincronizada de solo lectura: no editar, mover ni borrar. Proteger cambios previos del usuario; inspeccionar rama, estado y diff antes de escribir.
- Mantener Free. No contratar servicios ni publicar sin autorización. Root sigue sin implementar; no abrir las métricas técnicas a los roles actuales.
- Minimizar tokens totales. Delegar solo si compensa contexto, coordinación y revisión; tareas acotadas con modelo/esfuerzo económicos, complejas con capacidad proporcionada. No heredar Ultra ni repetir lecturas/pruebas sin motivo nuevo.

## Regla de oro del Excel

- El original `inventarios_og/11_10-INVENTARIO-totalizado.xlsx` es de solo lectura. No normalizar ni reconstruir su desorden.
- Generar una copia conservando hojas, páginas, filas, ID, unidades, referencias, fórmulas y formatos. Solo modificar STOCK autorizado; nunca eliminar filas al desactivar o reagrupar productos.
- La sustitución de la fórmula de cocina!C74 (Trutro pollo) es la única excepción de STOCK aprobada. Mantener [documentación y reversión](docs/excepcion-stock-cocina-c74.md).
- Solo Administrador captura inventarios globalmente finalizados. Sumar únicamente ubicaciones terminadas; excluir inactivos, pendientes, avances y anulaciones. Cero confirmado es 0; sin aporte válido queda blanco. Redondear una sola vez a tres decimales después de sumar.
- Una cantidad contada sin destino, unidad o conversión resueltos bloquea la generación; no inventar equivalencias ni omitirla silenciosamente. Mantener separados `countCategory` y referencias/categorías de exportación.
- La política de cálculo se registra en cada captura. No cambiarla silenciosamente ni modificar capturas o archivos anteriores. El estado aprobado está en 4D.
- Las capturas son inmutables y los archivos privados. Cada descarga exige sesión y rol actuales. No comprimir XLSX ni calcular bcrypt en las peticiones productivas de Pages; utilizar los bindings privados preparados.

## Producto y permisos

- Administrador > Jefa de servicio > Trabajador. Jefa restringida a Servicio; en cuentas mixtas solo administra accesos de Servicio. No añadir Root.
- Cada persona cambia su nombre visible; Administración cambia el usuario de ingreso. Eliminar cuenta exige confirmación/versionado, conserva autoría y no puede dejar sin administrador activo.
- Cierre para revisión y finalización son distintos. Solo Administrador reabre finalizados, con motivo obligatorio. Rectificar, anular, actividad y finalizar no exigen motivo; la finalización con pendientes requiere revisar/confirmar la advertencia vigente.
- Activo/Inactivo persiste por área y conserva conteos e historial. No trasladar cantidades de ciclos anteriores al nuevo reparto de Servicio.
- Conservar idempotencia, revisiones esperadas, permisos transaccionales y borradores ante conflictos o respuesta incierta. No resolver carreras solo con una comprobación JS previa.
- Conservar los ID técnicos de Servicio, incluido `armado-linea-coperia`. Los nombres históricos pertenecen al registro de despliegue, no a parches en consultas genéricas.

## Implementación y diseño

- KISS, HTML/CSS/JavaScript nativos. No añadir dependencias, infraestructura o animaciones por anticipado. Usar `html`/`setHTML` de `shared/html.js` para contenido dinámico; no crear puntos de inserción HTML mediante cadenas ni omitir el lint. Mantener las vistas de inventario separadas y sus pruebas de foco, campos, borradores y navegación.
- Móvil primero, diseño compacto y textos breves. Crema/carbón, cian, superficies uniformes, sin degradados ni efectos de hover/pulsación. Campos de 16 px y blancos táctiles de al menos 44 px.
- Foco de teclado visible con fondo/luminosidad suaves, sin subrayados ni bordes añadidos al tocar. Respetar movimiento y transparencia reducidos. Los popups usan desenfoque y sombra leve.
- Sin stock guarda cero contado y usa verde; pendiente rojo, avance ámbar, contado verde, siempre con texto. Conservar Anterior / Ver ítems / Siguiente, siguiente pendiente y contexto/posición del resumen.
- Ver ítems no abre teclado; la lupa sí enfoca búsqueda. Menú de cuatro cuadros, tema dentro del panel de cuenta y solo toggle en ingreso. Usar SVG para iconos.
- No incluir el nombre del empleador en textos públicos. La telemetría autorizada es agregada, sin contenido ni seguimiento personal.

## Datos, operación y entrega

- Migraciones aditivas; no reescribir las históricas ni aplicar la propuesta `0005`. Nunca ejecutar fixtures/bootstrap en producción ni pruebas sobre el estado de desarrollo activo.
- El contrato 15 comprueba capacidades ligeras por petición; el preflight completo verifica definiciones y cardinalidades antes de publicar. Sellar al final de la migración revisada, no aceptar DDL desconocido mediante un arreglo genérico.
- Mantener respaldos privados cifrados cada 90 días. La purga acotada solo elimina metadatos de autenticación vencidos; no borrar inventarios, historial, comandos, capturas o XLSX por antigüedad sin otra decisión.
- Offline está implementado: el SW solo conserva estructura pública y estáticos; IndexedDB conserva una instantánea por persona, ciclo y área, como máximo hasta la sesión real o doce horas. No cachear API en el SW, exportaciones o credenciales; no usar instantáneas ante 401/403/503 ni enviar borradores automáticamente. Mantener borrado entre pestañas y cierre pendiente del servidor al salir sin red.
- RTv2 entrega registros únicamente al conteo que opta por `v=2`; preservar clientes v1, ámbitos, versiones y cursores. Revalidar accesos en el primario después de esperar datos y verificar expiración antes de enviar. La recuperación usa la API autorizada; conservar el respaldo de treinta segundos cuando hay tiempo real y documentar su costo, sin prometer cuota Free para uso continuo de veinticuatro horas.
- El importador `scripts/catalog-data.mjs` admite solo paquetes aprobados y validados. No reescribir catálogos históricos ni inventar referencias. El índice de `0016_catalog_lookup_index.sql` está aplicado en producción con preflight aprobado; no asumir que ya existe en otros entornos.
- Dependabot, TOTP, nuevas políticas de acceso/inactividad y «Cerrar otras sesiones» siguen pendientes. No activarlos por inferencia. Mantener explícitos los límites de aceptación física en teléfono/Excel y los datos de catálogo pendientes.
- Publicar únicamente `dist`; nunca la raíz, `.backups`, `.exports`, `.git`, dependencias ni secretos. Los IDs de configuración no son credenciales. No imprimir tokens, hashes de contraseñas, cookies ni datos de producción en evidencias.
- No hacer commit, push, reset, limpieza destructiva o publicación sin autorización. En la entrega actual hay autorización para commits y preparación remota; el push/publicación de Pages queda al usuario.
- Ejecutar pruebas pertinentes, revisar diff y registrar tanto resultados como límites. CI incluye formato, lint HTML, importador y las regresiones aisladas de HTML, offline y RTv2; no retirar sus guardas para hacer pasar una entrega. La simulación local no certifica CPU ni una descarga productiva posterior al push. Mantener README breve y documentación vigente sin repetir pilas de actualizaciones históricas.

- Monitor privado: conservar muestreo cada quince minutos, datos agregados, secreto Analytics de solo lectura y logs automáticos de peticiones desactivados. No añadir telemetría personal ni afirmar que una muestra local certifica CPU/cuotas.
