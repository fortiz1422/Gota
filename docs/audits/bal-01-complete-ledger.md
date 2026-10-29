# BAL-01 — Lectura completa para el saldo vivo

## Causa

Home calculaba el saldo vivo con una consulta sin paginación a `expenses`. La Data API aplica su límite de filas incluso si el cliente no agrega `.limit()`. Al crecer el historial, una respuesta parcial se trataba como completa; si quedaban fuera salidas grandes, el saldo subía artificialmente. Los registros seguían guardados.

La investigación productiva fue de solo lectura. La reproducción de abajo utiliza datos artificiales: este documento y las pruebas no incluyen identidades ni movimientos reales.

## Reproducción y corrección

El test usa el cliente real de Supabase contra un servidor simulado que limita cada respuesta a 1.000 filas. Con 1.048 movimientos, el código anterior omitía las últimas salidas y devolvía un saldo artificialmente alto. La regresión falló antes de implementar la corrección.

Las lecturas financieras del dashboard y del saldo por cuenta ahora usan páginas de 500 filas ordenadas por ID, conteo exacto y control de identidades únicas. Se incluyen ingresos, gastos, pagos de tarjeta, transferencias, rendimientos, cuentas, tarjetas, instrumentos, metas y aportes, ciclos e importes de tarjeta, suscripciones y datos usados para el arrastre mensual. Las listas visuales acotadas no se usan como fuente de los totales.

El lector rechaza errores, falta de conteo, páginas vacías cuando aún faltan filas, conteos que cambian entre pedidos o identidades repetidas. Así no publica un total parcial. Una página corta no significa que terminó el historial: se adapta al límite efectivo del servidor y sigue desde la cantidad realmente recibida. No hay tope fijo de filas ni de páginas; finaliza únicamente cuando el número de identidades coincide con el conteo exacto. Cada iteración debe avanzar. Un fallo del refresco financiero de Home se propaga a la pantalla de error existente en lugar de mantener un saldo anterior como vigente. Las fallas de lectura de estados de tarjeta tampoco se silencian. Los cálculos de moneda, fechas, cuotas y conciliación permanecen iguales.

No se agregan funciones SQL, migraciones, flags ni cambios de configuración. No se editan movimientos, saldos iniciales o ajustes.

## Validación

- Reproducción del dashboard con más de 1.000 movimientos usando el SDK real y respuestas HTTP simuladas.
- Saldo por cuenta con más de 1.000 ingresos.
- Paginación hasta un límite exacto de página, historial vacío y rechazo de lecturas incompletas o cambiantes.
- Pruebas existentes de cortes de fecha de Argentina y de conciliación.
- Se prueban límites de API de 1, 37, 100, 500 y 1.000 filas; más de 200 páginas; cuentas, instrumentos y aportes que superan 1.000 registros; y un error 503 en una página tardía.
- Suite completa local: 2.185 tests en 218 archivos; TypeScript y ESLint de los archivos afectados. El workflow `Balance completeness verification` vuelve a ejecutar la suite, TypeScript y build ante cambios de estos cálculos.

La paginación no constituye un snapshot transaccional de varias tablas. Los controles detectan cambios de cardinalidad y páginas superpuestas; ante una carga concurrente se debe refrescar. Una actualización de importes que conserve la cardinalidad no queda congelada entre pedidos, igual que en las lecturas independientes anteriores.

Los logs de Vercel no estuvieron accesibles (403). La causa se contrastó mediante consultas SQL de solo lectura, inspección del código desplegado y reproducción con el cliente real de Supabase. La comprobación autenticada en el teléfono queda pendiente de publicar la corrección.
