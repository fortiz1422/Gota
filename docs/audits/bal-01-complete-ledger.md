# BAL-01 — Lectura completa para el saldo vivo

## Causa

Home calculaba el saldo vivo con una consulta sin paginación a `expenses`. La Data API aplica su límite de filas incluso si el cliente no agrega `.limit()`. Al crecer el historial, una respuesta parcial se trataba como completa; si quedaban fuera salidas grandes, el saldo subía artificialmente. Los registros seguían guardados.

La investigación productiva fue de solo lectura. La reproducción de abajo utiliza datos artificiales: este documento y las pruebas no incluyen identidades ni movimientos reales.

## Reproducción y corrección

El test usa el cliente real de Supabase contra un servidor simulado que limita cada respuesta a 1.000 filas. Con 1.048 movimientos, el código anterior omitía las últimas salidas y devolvía un saldo artificialmente alto. La regresión falló antes de implementar la corrección.

Las lecturas financieras del dashboard y del saldo por cuenta ahora usan páginas de 500 filas ordenadas por ID, conteo exacto y control de identidades únicas. Se incluyen ingresos, gastos, pagos de tarjeta, transferencias, rendimientos y los gastos usados para calcular compromisos.

El lector rechaza errores, falta de conteo, páginas recortadas, conteos que cambian entre pedidos o identidades repetidas. Así no publica un total parcial. El límite defensivo es de 200 páginas; superarlo también falla explícitamente. Los cálculos de moneda, fechas, cuotas y conciliación permanecen iguales.

No se agregan funciones SQL, migraciones, flags ni cambios de configuración. No se editan movimientos, saldos iniciales o ajustes.

## Validación

- Reproducción del dashboard con más de 1.000 movimientos usando el SDK real y respuestas HTTP simuladas.
- Saldo por cuenta con más de 1.000 ingresos.
- Paginación hasta un límite exacto de página, historial vacío y rechazo de lecturas incompletas o cambiantes.
- Pruebas existentes de cortes de fecha de Argentina y de conciliación.
- Suite completa local: 2.173 tests en 218 archivos; TypeScript, ESLint de los archivos afectados y build de producción aprobados.

La paginación no constituye un snapshot transaccional de varias tablas. Los controles detectan cambios de cardinalidad y páginas superpuestas; ante una carga concurrente se debe refrescar. Una actualización de importes que conserve la cardinalidad no queda congelada entre pedidos, igual que en las lecturas independientes anteriores.

Los logs de Vercel no estuvieron accesibles (403). La causa se contrastó mediante consultas SQL de solo lectura, inspección del código desplegado y reproducción con el cliente real de Supabase. La comprobación autenticada en el teléfono queda pendiente de publicar la corrección.
