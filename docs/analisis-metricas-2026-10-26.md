# Análisis de producción — 26-10-2026

Último deploy: `96adb55`, finalizado 25/10/2026 13:31:20 America/Santiago (16:31:20 UTC). Consultas D1 y metadatos de Pages efectuadas el 26/10 alrededor de las 05:33–05:40 Chile. Solo SELECT sobre agregados; ninguna cuenta o inventario leído o modificado para este análisis.

## Cobertura y límites

La tabla anterior solo contiene el día UTC 25/10: 662 solicitudes observadas. Incluye tráfico anterior al deploy de las 13:31. No hay horas ni versiones para separar retrospectivamente ese tramo. No hay filas del 26/10 UTC en la captura; esto no prueba que nadie haya entrado ni que el servicio esté caído. Puede haber ausencia de tráfico o de lotes persistidos.

Se consultó dos veces Workers Analytics para el intervalo exacto desde 2026-10-25T16:31:20.8998Z hasta el 26/10 08:40 UTC, usando el script productivo de Pages. Cloudflare respondió `Rate limiter budget depleted` en ambas, incluso después de esperar el plazo indicado. Por tanto **no se dispone de un total exacto desde el último despliegue**. No confundir el acumulado diario con ese período, ni cero 5xx capturados con disponibilidad total.

## Resultados disponibles

662 solicitudes: 643 respuestas 2xx (97,13 %), 19 respuestas 4xx (2,87 %), ninguna 5xx registrada. Promedio ponderado del servidor: 1065,4 ms; 86,10 % de solicitudes duraron >=1000 ms. No es CPU ni tiempo de render o red móvil, ni permite calcular percentiles.

| Función | Solicitudes | Promedio servidor | >=1 s |
| --- | ---: | ---: | ---: |
| Sincronización | 261 | 1065,1 ms | 100 % |
| Supervisión | 107 | 1220,1 ms | 100 % |
| Conteo | 70 | 1230,6 ms | 100 % |
| Inventarios disponibles | 69 | 1064,5 ms | 100 % |
| Sesión | 60 | 460,6 ms | 0 % |
| Carga inicial | 37 | 1377,8 ms | 100 % |
| Navegación | 21 | 919,1 ms | 9,52 % |
| Ingreso | 6 | 1623,7 ms | 100 % |

Sincronización + sesión + status suman 323 solicitudes, 48,79 % del tráfico observado. Es tráfico de control, no 323 acciones humanas. Los 70 POST de conteo incluyen 69 respuestas 2xx y un 4xx; no representan necesariamente 69 guardados únicos. Los 6 ingresos respondieron 2xx, sin demostrar seis personas distintas.

Los 4xx: sesión 6, supervisión 5, navegación 2, gestión de inventarios 2, status 2, cuentas 1, conteo 1. La tabla no distingue códigos exactos: no es posible afirmar cuáles fueron sesiones vencidas, conflictos, permisos u otros casos.

## Interpretación y prioridad

1. La principal señal es latencia común de ~1–1,4 s en varias funciones, especialmente carga inicial y guardado. Sugiere revisar el trabajo compartido del servidor y las consultas; no demuestra que D1, CPU, red o región sean la causa.
2. No hay evidencia de errores 5xx en lo capturado. Los 4xx requieren separar casos esperables de defectos; no se clasifican automáticamente como fallos de la app.
3. El peso del tráfico de sincronización justifica medir antes de cambiar la frecuencia: reducir sondeos puede empeorar colaboración. Esta entrega no modifica esos flujos.
4. Falta experiencia de navegador para juzgar teclado, respuesta visual y saltos de diseño. Las nuevas métricas empiezan tras publicar la ampliación y no rellenan el pasado.

La muestra es pequeña y puede mezclar pruebas con uso real, sin una dimensión para distinguirlos. No permite conclusiones de adopción o productividad individual.
