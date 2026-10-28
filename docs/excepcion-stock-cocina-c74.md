# Excepción de STOCK: Cocina C74

Autorización expresa de Lucio: 28-10-2026.
Estado: contrato, verificador y generador local implementados; captura y generación documentadas en etapa-4bc-exportacion.md. El original sigue intacto.

## Alcance exacto

- Libro original: inventarios_og/11_10-INVENTARIO-totalizado.xlsx.
- SHA-256 original: 9c123ce93a01df5167c80339451d2ffa94e5f29e9260a24519879fb1b78a14e9.
- Hoja: cocina. Celda: C74, columna STOCK.
- Producto: Trutro pollo. Referencia interna: cocina:74. Unidad del original: KG.
- Fórmula original (contenido de f, sin el signo inicial que muestra Excel): 15.228+2.986.
- Valor cacheado original: 18.213999999999999.
- Estilo original: atributo s="24".

Fragmento original:

```xml
<c r="C74" s="24"><f>15.228+2.986</f><v>18.213999999999999</v></c>
```

## Decisión aprobada

Se autorizó sustituir exclusivamente esta fórmula de STOCK por el nuevo conteo en la copia exportada. Si la política de conteo da blanco, la celda debe quedar en blanco. Se conserva la celda, la fila, su estilo y el resto del libro. No se altera el archivo original, los conteos guardados ni su historial.

Esta excepción no autoriza reemplazar otras fórmulas ni cambiar caches o configuración de cálculo del resto del libro. No es una conversión de unidades.

La revisión exhaustiva de las 1.151 celdas de destino detectó una fórmula: C74. Esto corrige la afirmación demasiado amplia del diagnóstico inicial que describía todos los destinos STOCK como valores sin fórmulas.

El permiso vive en replaceableStockFormulaCells de data/inventario/export-template.js. stockFormulaCells registra la característica del original y debe conservarse aunque se retire el permiso. El verificador permite la sustitución únicamente para la intersección explícita con esa lista, sin autorizar fórmulas nuevas.

## Retirar o revertir la excepción

1. Retirar C74 de replaceableStockFormulaCells y registrar fecha y motivo de la nueva decisión. No cambiar stockFormulaCells ni el hash del original.
2. Ejecutar las pruebas de plantilla. El caso de sustitución debe pasar a esperar PROTECTED_STOCK_FORMULA; las pruebas de protección del original y del resto de fórmulas deben seguir pasando.
3. En el generador, bloquear la exportación de esa fila hasta resolver cómo representar el conteo actual conservando la fórmula. No volver a usar silenciosamente la suma del inventario antiguo.
4. Si existen archivos ya exportados, conservar su versión e identidad. Retirar la excepción afecta generaciones futuras; no modifica archivos descargados ni datos históricos.

Para recuperar la referencia original basta consultar el libro inmutable con su hash verificado. Restaurar esa fórmula en un archivo de comparación recupera también una suma antigua: no demuestra que sea el stock del inventario actual. Una corrección de un archivo operativo requiere identificar el inventario y validar su resultado.

## Verificación preparada

- Original intacto y hash exacto.
- Sustitución de C74 por número o blanco permitida con autorización.
- Sustitución rechazada al retirar la autorización.
- Cambio de formato o incorporación de una fórmula nueva rechazados.
- El resto de partes, fórmulas, caches y configuración permanece sin alteraciones.

Estas verificaciones comprueban fidelidad y alcance; todavía no certifican un archivo generado, corrección de cantidades ni recálculo en Excel.
