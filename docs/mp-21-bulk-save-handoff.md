# MP-21 — Preparación y guardado en lote

Reporte de Facundo, 28/10/2026: la confirmación de un grupo quedaba en “Registrando…”. El flujo anterior enviaba un POST por movimiento; cada POST volvía a leer todas las observaciones y reconstruir los candidatos. El estado visible estaba fuera del área del botón al bajar por la lista.

## Cambio

- La selección válida se prepara durante la revisión con `bulk-prepare`, sin RPCs de escritura. Cambios en selección, campos, tarjeta, cuenta o fingerprint invalidan la preparación. Una falla permite reintentar esa lectura.
- Registrar envía exactamente el payload preparado en **un POST `bulk-confirm`**, incluso con 60 movimientos. No se llama al endpoint individual desde el navegador.
- Ambos endpoints autentican una vez y leen/reconstruyen la evidencia una vez por pedido. Las referencias de tarjeta/ciclos se comparten dentro del pedido, separadas por usuario y tarjeta. Cuando la RPC crea un período, se invalidan esas referencias antes del siguiente gasto.
- El servicio conserva las mismas validaciones y RPCs del endpoint individual. El guardado vuelve a validar evidencia fresca; una preparación anterior no autoriza datos obsoletos. Importe y fecha salen de la evidencia del servidor.
- El pie mantiene el estado de guardado y tiempo transcurrido a la vista. La espera completa (incluido leer la respuesta) tiene límite; nunca hay reintento automático de escrituras. Una respuesta parcial confirma únicamente el prefijo explícito y pide actualizar.

## Límites deliberados

Un solo envío del navegador no significa una transacción SQL de todo el grupo: se mantienen las RPCs canónicas y su atomicidad por movimiento. Ante conflicto se corta el resto y se informa el prefijo confirmado. La preparación es de solo lectura; al guardar se carga un snapshot fresco compartido para conservar las garantías financieras. No se incorporó caché global, migración, tabla, flag ni cambio al sistema de alias.

El tamaño de pedido admite de 1 a 200 identidades únicas. El servidor tiene duración máxima de 120 s y el cliente deja de esperar a los 130 s. Una pérdida de respuesta requiere refrescar y verificar los estados antes de continuar.

## Verificación

- Pruebas API: 60 movimientos, una lectura de evidencia por pedido, preparación sin escrituras, autenticación y esquema estricto, corte por conflicto, evidencia modificada después de preparar, invalidación de ciclos creados.
- Pruebas del cliente: un envío para 60, validación de resultados ordenados, respuestas incompletas/malformadas y cuerpo de respuesta colgado sin reintentos.
- Pruebas de planes: 60 planes comparten dos consultas de referencias; mantienen sus importes individuales y separan usuarios.
- Playwright usa exclusivamente datos y APIs simuladas, incluyendo respuesta lenta, respuesta perdida, preparación fallida/reintento, excepciones y continuación entre grupos. Viewports: 320, 390, 768 y 1440 px.
- No se confirmaron gastos reales ni se modificó la base de datos durante las pruebas. Los logs de producción no estuvieron accesibles: no se determinó el resultado del lote original de la captura.

Estado de publicación y resultados finales se registran al completar CI y despliegue.
