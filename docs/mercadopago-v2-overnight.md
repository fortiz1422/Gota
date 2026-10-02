# Mercado Pago v2 — checkpoint nocturno

Fecha: 2026-10-02, Argentina. Pedido de Facundo: avanzar sin esperarlo, documentar bloqueos y entregar informe completo al despertar (~07:22 Argentina). Ejecución ChatGPT Work, sin Hermes/subagentes.

## Base publicada

Rama feat/mercadopago-integration-v2; draft PR #124. HEAD de inicio de este bloque 0451f6c. Producción ee8ed25 no modificada. UX de revisión ya publicada y validada visualmente; captura y clasificación siguen en shadow, sin auto-post ni background habilitados para el usuario.

## Bloque completado en este checkpoint

Ledger matcher y repository read-only conectados a shadow: moneda/importe exactos, fecha +/- un día Argentina, cuenta/funding compatibles; cuenta ausente conserva duda, merchant sólo señal explicativa. Consulta exact-count bounded, falla o truncamiento no habilitan dedupe. Rule version 3. No se resuelve ni borra duplicado automáticamente. Servicio persiste exclusivamente shadow audit.

Pruebas: suite completa 996 / 151 archivos incluyendo matcher y servicio shadow; tsc y ESLint de archivos editados verdes. SQL real read-only verificó expenses.date timestamptz y ausencia de gasto de ARS1000 en ventana consultada, lo que NO confirma la transferencia MP.

### Card matcher determinístico

Implementado sobre el editor canónico de compras con tarjeta. Requiere tarjeta de crédito y últimos cuatro válidos; marca sola nunca alcanza. Una única coincidencia activa por últimos cuatro se preselecciona. Si varias tarjetas comparten dígitos, la marca del proveedor sólo puede desambiguar contra una marca reconocible en el nombre libre de Gota. Cero o múltiples coincidencias no eligen arbitrariamente y muestran una explicación al usuario; la selección sigue siendo editable antes de confirmar.

No se agregaron columnas brand/issuer ni se leyó metadata sensible real para simular identidad. El schema actual de cards sólo tiene name y last_four, por lo que issuer no puede participar de forma determinística todavía. Sin escrituras de ledger o DB. Suite completa: 1001 tests / 152 archivos; TypeScript, ESLint y build productivo Next verdes. El primer build encontró TLS al descargar Google Fonts; la opción oficial de certificados del sistema permitió completar compilación, typecheck, 75 páginas estáticas y optimización.

### Aprendizaje simple de comercio/categoría

Reutiliza counterparty_profiles/counterparty_aliases y el editor canónico. En confirmaciones MP, “Recordar este comercio” queda activo por defecto pero visible y reversible. La memoria se escribe sólo después de una confirmación financiera exitosa. Si el comercio ya existía, una corrección actualiza default_category; antes sólo conservaba la categoría anterior. Si falla la memoria, el gasto confirmado no se revierte ni se duplica y la bandeja informa que sólo falló la preferencia.

No hay IA nueva ni aprendizaje sobre semántica financiera. Transferencias, funding, cuotas y tipo económico no se derivan de esta regla. Sin migración ni escritura durante las pruebas. Tests focalizados 28/28; suite completa 1002/1002 en 152 archivos, TypeScript, ESLint y build productivo Next verdes.

### Verificación visual segura en Preview

Con la sesión autenticada existente se inspeccionó la bandeja real sin pulsar Continuar ni Registrar y sin editar datos persistentes. El Preview mostró 39 pendientes: 26 para completar y 13 que necesitan más información. Al abrir una compra aprobada con tarjeta master terminada en 8215, el matcher no encontró una coincidencia única y dejó el selector vacío con explicación explícita; no eligió una tarjeta arbitrariamente. El control “Recordar este comercio para próximas veces” apareció activo por defecto y editable. Se canceló el formulario sin guardar.

También se abrió una compra real informada por Mercado Pago en 2 cuotas. La UI la mantuvo no confirmable, explicó que el soporte todavía no está disponible y sólo ofreció mantenerla pendiente o desestimarla. No hubo escrituras ni confirmaciones. Esto valida el comportamiento visual del Preview y sus gates, no la corrección contable de una operación real registrada ni cobertura completa del proveedor.

### PAYOUTS observado y clasificado sin convertirlo en gasto

El reporte del día argentino 2026-10-01 pasó de pending a success y entregó una fila real compatible con la transferencia controlada: `PAYOUTS`, ARS -1.000, 1/oct 22:26:52 Argentina, con efecto neto y real también -1.000. Payments Search no había observado el evento. La fila demuestra una salida del saldo MP, pero no contiene evidencia suficiente para afirmar destino BBVA ni cuenta propia.

Se agregó un fixture sanitizado mínimo y el normalizador clasifica sólo `PAYOUTS` negativo de Settlement como `transfer/outflow`, manteniendo role, funding, destino y aprobación desconocidos. Cero o positivo no se clasifican como salida. El pipeline completo termina en `review` y la UX “Transferencia por resolver”; nunca en gasto, ingreso o auto-post. Suite completa 1006/1006 en 152 archivos, TypeScript y ESLint focalizado verdes. No hubo escritura real de ledger ni activación.

### Posibles duplicados: shadow visible y confirmación bloqueada

La bandeja ahora consume únicamente decisiones shadow de la regla vigente cuyo `candidate_id` y fingerprint coinciden exactamente con la evidencia RAW reconstruida. Un match `possible_ledger_duplicate` se proyecta como el marcador público mínimo `possible_duplicate`: no expone IDs de gastos, fingerprints, motivos internos ni datos del ledger. La tarjeta pasa a “Necesitan más información”, explica que puede ser un movimiento ya registrado y ofrece comparar, sin afirmar que sean iguales ni vincular/borrar silenciosamente.

Se unificó el fingerprint de shadow, stale protection y confirmación humana en una sola función canónica. Decisiones de otra versión, evidencia anterior, otro resultado o lectura fallida se ignoran/fallan cerradas. Además, el POST de confirmación de gasto repite la consulta read-only de dedupe justo antes del RPC: si no puede verificar, responde `dedupe_unavailable`; si encuentra candidatos, responde `possible_duplicate`; en ambos casos no escribe ledger. Las compras con tarjeta continúan fuera de este matcher porque todavía no existe un matcher canónico equivalente para card purchases.

No se implementó todavía “Vincular” ni “Mantener ambos”: ambas decisiones requieren una auditoría transaccional persistente con ownership, stale protection e idempotencia; ofrecer botones sin esa garantía sería engañoso. Suite completa 1012/1012 en 152 archivos; TypeScript, ESLint focalizado y `git diff --check` verdes. No hubo escritura real ni migración aplicada.

## Orden siguiente

1. Diseñar resolución de duplicados (`linked_existing` / `keep_both`) sólo con audit/stale/ownership/idempotencia transaccionales; no habilitar vínculo parcial inseguro.
2. N cuotas: auditoría terminada. El motor actual crea N filas agrupadas, divide el total y las asigna a ciclos futuros; la UI las muestra individualmente. Esto sostiene compromisos pero no materializa literalmente “gasto económico total hoy” del handoff. Extender el RPC exige decidir si el grupo existente es la compra canónica aceptable o si hace falta una entidad madre; no cambiar sólo UI/gate. Preparar migración revisable, no aplicarla al canon real sin autorización específica.
3. Verificar UX Settings/onboarding y alertas/origen de movimientos, estados humanos; conservar técnicos en advanced y evitar mentir sobre automatización que sigue apagada.
4. Documentar matriz de 16 escenarios: real observado vs synthetic test vs pendiente. Transferencia saliente tiene evidencia real parcial (salida `PAYOUTS`, sin destino); no equivale todavía a reconciliación de cuenta propia. Ninguna prueba mock equivale a operación controlada real.

## Accesos y publicación

GitHub, Supabase y Vercel leídos con éxito este turno. CUA sesión existente estaba disponible en última comprobación. Si login vence: documentar y seguir código/test, nunca pedir credenciales. Repo remoto permite fetch; push shell carece credenciales. Publicar github_create_tree/create_commit/update_ref force:false; revisar HEAD remoto antes y alinear local sólo si contenido exacto. GitHub structuredContent directo; Vercel teamId vacío funciona, projectId prj_nyZGQADbn6IWx28sJoEF54BfN6Ij. Preview https://gota-git-feat-mercadopago-int-19f03c-facundos-projects-11ee7eb5.vercel.app/.

Supabase wfwkrenyoxiswaeafpjc: lectura mínima scoped user 9083ebd0-6082-4067-9bd8-ef07e346a1d9, conexión 4400a8ef-7c60-44a2-8ac0-6f6e087bee3d. Nunca tokens, auth.users/sessions, CVU/CBU. La vigilancia transferencia ARS1000 sigue separada, no avanzar producto esperando pending; no cambiar esa tarea.

## Límites de la entrega

Autorizado código, tests, commits en rama/draft PR y Preview. No merge/promoción producción, cambios config externa MP, activación background/import/autopost, nuevas transacciones ni pruebas que escriban ledger/cuentas/saldos/compromisos reales. No pulsar Continuar/Registrar en la cuenta real. Migraciones como archivos revisables.

El software puede avanzar sin login; validación real proveedor, matriz financiera y habilitación de auto-post no se sustituyen por más tests de código. Informe final debe decir qué cambió para usuario, tests verificadas, evidencia real, blockers y gates pendientes sin declarar MP v2 completa si faltan.
