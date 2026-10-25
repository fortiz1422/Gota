# MP-20 — precarga de categoría con la política del parser regular

Pedido de Facundo, 25/10/2026: planificar y mejorar el flujo MP; la categoría debe resolverse como en ParsePreview regular. Rama `feat/mp-category-preload`, base `9aae283`.

## Diagnóstico

ParsePreview no clasifica: recibe el resultado de `/api/parse-expense`. Ese endpoint usa Gemini en cuentas habilitadas, reglas locales como alternativa y `enrichParsedExpensePreview` para priorizar la preferencia del alias. MP individual consultaba únicamente alias; el lote creaba drafts con categoría vacía.

## Flujo implementado

1. Conservar la descripción original de MP y el fallback al descriptor existente. Texto ausente o que contiene identificadores financieros no se envía al clasificador.
2. Resolver alias con la sesión del propietario. Reutilizar `enrichParsedExpensePreview`: una categoría guardada prevalece sobre la propuesta del parser. Un alias aproximado se presenta como sugerencia, igual que en el regular.
3. Para textos sin una preferencia utilizable, generar categorías con el mismo modelo, temperatura y `createExpenseCategoryGuidance` del parser regular. En lote es una generación por hasta 20 textos distintos; no una por movimiento.
4. Sin permiso de IA o ante fallo: usar `suggestLocalExpenseCategory`, extraída del parser regular. Peaje/TelePASE/autopistas se agregaron a esa misma tabla compartida. Si no hay evidencia, dejar pendiente, sin llenar Otros para ocultar ausencia de información.
5. Mostrar origen: comercio guardado, alias sugerido, parser o reglas locales. No se publica un porcentaje de certeza sin calibración. La categoría sigue siendo una propuesta y no confirma gastos.
6. Aplicar al lote sin sobrescribir una categoría ya elegida ni una descripción modificada. El editor individual usa el mismo endpoint de propuestas y conserva ParsePreview como editor.
7. Al editar una descripción se puede volver a sugerir al salir del campo si la categoría no fue elegida explícitamente. La descripción común puede precargar su categoría antes de aplicar al grupo.

## Límites y seguridad

- Endpoint autenticado, sin `user_id` del cliente, sin servicio admin, sin writes/RPC/migración/flags nuevos.
- Contrato estricto: solo lista de hasta 20 descripciones de hasta 160 caracteres. Respuesta limitada a categoría canónica y metadatos de origen. Nunca genera monto, fecha, cuotas, cuenta o tarjeta.
- Mantiene allowlist de IA paga y límite de cinco solicitudes por minuto por usuario. Máximo una generación por solicitud con timeout de 12 segundos y salida acotada; sin reintento pago automático. El navegador deduplica textos y divide hasta 100 textos en tandas de 20.
- Se reutilizan guía, modelo, reglas y precedencia del parser; no se promete que dos generaciones estocásticas distintas produzcan categorías idénticas en todos los casos. Hay menos contexto en una descripción MP que en una frase o ticket completo.
- Los datos RAW, la elegibilidad financiera y el endpoint de confirmación no cambian. Ninguna categoría inferida autoriza registro automático.
- Sin texto informativo, el usuario debe identificar el consumo. No se infieren peajes por importe o terminación de tarjeta.

## Criterios de aceptación y validación

- Preferencia de alias coincide con el preview regular, preservando descripción original.
- Peaje/TelePASE, YPF y farmacia usan las mismas reglas del parser local.
- Una consulta para 22 movimientos con el mismo texto; sin confirmaciones financieras por precargar.
- Resultado tardío no pisa una corrección manual.
- Sesión ausente, entrada fuera de límites, modelo inválido, categorías no canónicas y timeout fallan sin fabricar datos.
- TypeScript, unitarias, lint focalizado y recorridos de navegador en 320/390/768/1440. Evidencia final en el PR.

## Handoff para Hermes

Decisión: centralizar la propuesta de categoría y reutilizar las piezas vigentes, sin pasar evidencia financiera de MP por un parser que pueda reescribirla. No activar IA para otras cuentas. No se leyeron ni clasificaron movimientos reales del usuario durante QA. No se hicieron llamadas pagas en pruebas.

Pendientes: verificar el comportamiento con textos reales en la sesión del propietario tras desplegar; medir categorías corregidas y ahorro de revisión. El límite de requests es conservador y abrir muchas revisiones seguidas puede requerir completar manualmente o esperar. La memoria de nuevas reglas/comercios y la persistencia de equivalencias de tarjeta quedan fuera de este corte.

Rollback: revertir el PR; sin cambios de esquema ni migración. MP-20 queda En curso hasta el merge. No declarar el caso real validado por el resultado de fixtures.
