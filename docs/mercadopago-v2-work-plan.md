# Mercado Pago v2 — estrategia corregida

Fecha: 2026-10-02, Argentina. Fuente de requisitos: handoff original de ChatGPT del 30/09/2026 aportado por Facundo en esta conversación. Este documento es una estrategia; no certifica funcionalidad terminada.

## Objetivo y límites

Conectar una vez, capturar sin abrir Gota, incorporar lo inequívoco y consultar sólo excepciones. El resultado debe mejorar saldo actual, compromisos y disponible real. Mantener OAuth/PKCE, cifrado, RAW, fingerprints, reconciliación, snapshots y protección contra stale/conflict/idempotencia. No activar ledger automático antes de validar evidencia real, dedupe y audit trail. No sobrescribir configuración externa de reportes.

## Diagnóstico del trabajo actual

- Rama feat/mercadopago-integration-v2, PR draft #124; producción no actualizada. Auditoría inicial: working tree limpio, HEAD 14048d7.
- Implementados: refresh común, extracción de sync manual, polling incremental acotado con watermark/overlap/lease, endpoint cron, setup today/30d/90d, vinculación/creación de cuenta, interfaz FinancialEvent y decisiones shadow.
- Parcial: FinancialEvent deriva del normalizador existente; merchant/category confidence siguen en cero. El shadow consulta gastos existentes por importe/moneda y ventana de un día, sin escribir ni vincular ledger; los posibles duplicados ya aparecen como excepción no confirmable, pero todavía no existe la resolución transaccional Vincular/Mantener ambos.
- Shadow usa búsqueda read-only contra ledger para gastos con saldo MP. Consulta fallida, truncada o sin count exacto mantiene ledgerDedupeChecked=false; coincidencias compatibles producen review. auto_post sigue siendo sólo una decisión auditada, sin escritura automática.
- Primera mejora de revisión/edición/confirmación publicada y verificada visualmente en Preview: detalles abajo. Card matcher determinístico implementado con los últimos cuatro disponibles y aprendizaje de categorías por comercio reutiliza aliases; cuotas múltiples siguen pendientes.
- Evidencia reciente: Payments Search default/payer/collector no observó la transferencia controlada, pero Account Settlement Report la entregó después como una fila `PAYOUTS`, ARS -1.000, fechada 1/oct 22:26:52 Argentina. Esto confirma la salida del saldo MP; no identifica por sí solo BBVA ni que sea cuenta propia. La suite vigente tiene 1012 tests verdes, con TypeScript y ESLint focalizado verdes. Esta evidencia no valida compras QR ni cobertura personal completa.
- Desvío: una transferencia propia, ubicada en P3 por el handoff, consumió el camino crítico de P0/P1. Las correcciones de diagnóstico tienen valor, pero no completan el producto.

## Orden de ejecución

### 1. Cerrar captura automática en shadow para el caso inicial

Usar compras aprobadas pagadas con saldo MP como escenario prioritario. Verificar Payments Search incremental, repetición sin filas duplicadas, timestamps Argentina, refresh, leases y errores; mantener Settlement como reconciliación separada. Revisar cadencia real de hosting antes de anunciar minutos. No condicionar el avance a que Payments Search muestre retiros bancarios.

Salida: evidencia real de compras con saldo, fixture sanitizado, normalización/decisión y trazabilidad; captura sin apertura de app verificada en entorno autorizado. Un cron escrito o un deploy READY no cumplen esa salida.

La transferencia de ARS 1.000 conserva su seguimiento acotado existente. No más refactors motivados únicamente por pending sin nueva evidencia. Investigar otras APIs mediante pruebas limitadas y documentadas, sin mutar config externa ni usar sesiones privadas de MP.

### 2. Entregar revisión, edición y confirmación útiles

Diseñar cada card alrededor de comercio, importe, fecha e instrumento y explicar qué dato falta. Separar tipo financiero de categoría. Mantener visibles operaciones completas que aún requieren confirmación mientras auto-post esté deshabilitado; no ocultarlas fingiendo una bandeja sólo de excepciones.

Editar descripción/categoría mediante flujo canónico existente. Preguntar cuenta o tarjeta sólo cuando no pueda resolverse inequívocamente. Categoría incierta no debe convertirse en evidencia contable faltante; si el ledger exige categoría, resolver una representación compatible explícita y verificada antes de escribir. No inventar una categoría financiera por sugerencia de modelo.

Reusar confirmación segura actual con fingerprint, snapshot, stale/conflict protection e idempotencia. Llevar bulk dismiss y metadatos técnicos fuera de la experiencia principal sin borrar persistencias legacy. La UI puede avanzar con evidencia existente y fixtures identificados como tales; no habilitar clasificación financiera nueva basándose en mocks.

Salida: recorrido completo en Preview de ver detalle, corregir y confirmar; tests de reglas y validación visual. Cualquier prueba que escriba en el canon real requiere autorización específica previa. No usar la sesión real para confirmar gastos durante este trabajo de diagnóstico.

### 3. Completar integridad de posting

Implementar búsqueda de posibles duplicados contra ledger por moneda, importe, fecha y funding/account compatibles. Un match probable produce revisión con Vincular o Mantener ambos; jamás borrado silencioso. Completar auditoría de origen/versión/razón y relación con el movimiento canónico, distinguiendo auto, human y reconciliation.

Salida: repetición, cambios de evidencia, duplicados manuales y confirmaciones concurrentes verificados. No marcar ledgerDedupeChecked=true sin haber ejecutado la búsqueda real.

### 4. Activar primera automatización útil

Sólo approved expense pagado con saldo MP, fecha/moneda/importe y efecto de saldo consistentes, payer resuelto, sin refund/conflicto/duplicado y con auditoría. Shadow debe comparar decisiones con realidad antes de habilitar escrituras. Operaciones completas entran al ledger; ambiguas quedan como excepciones. Mostrar origen y edición posterior.

Salida: operación controlada real, efecto correcto en ledger/saldo/disponible y replay sin duplicación; rollout acotado en entorno autorizado. No liberar por mocks o compilación solamente.

### 5. Tarjetas, cuotas y enriquecimiento

Card matcher determinístico: exactamente una tarjeta compatible. Después tarjeta 1x y N cuotas mediante compra canónica y motor de ciclos existente, nunca N gastos. Verificar compromisos/disponible con cierres/vencimientos reales. Merchant/category rules y correcciones aprendidas son la siguiente mejora; no bloquean semántica financiera. Expandir refunds/servicios/ML según evidencia. Transfers avanzadas y webhooks personales quedan al final.

## Validación y comunicación

Mantener la matriz original de 16 escenarios y registrar cada uno como pendiente, observado, validado o bloqueado; no fabricar cobertura. Cada bloque debe indicar código terminado, tests, prueba real, impacto visible y límites. No volver a usar “MP v2 lista” para funciones preparadas que no están activas o verificadas.

Primera entrega visible: revisión/edición/confirmación más claras, junto a captura shadow verificada para el caso prioritario. Primera entrega de valor diario: compras con saldo incorporadas sin acción del usuario. La transferencia pendiente no es requisito de esa entrega.

## Continuidad de trabajo

Documento de continuidad; ejecución a cargo de ChatGPT Work, sin delegación. Decisiones: recuperar prioridades del handoff; transferencia propia fuera del camino crítico; separar preparación técnica, prueba real y activación. Hechos: P0 parcial, shadow con dedupe ledger fail-closed, excepción visible sin resolución transaccional, UX de revisión renovada. Supuestos: Payments Search puede cubrir compras personales suficientes; pendiente de prueba. Artefactos: este plan, docs/mercadopago-v2-handoff.md, PR draft #124. Riesgos: falsos gastos por transfers, duplicados manuales, card match ambiguo, categoría confundida con semántica, promesas de latencia no medidas. Pendientes y gates detallados arriba. Ninguna escritura al ledger, migración, activación de background o promoción a producción realizada por este replanteo.


## Primera entrega de revisión — 2026-10-02

Implementado en rama: grupos Para completar / Necesitan más información; explicaciones específicas para transferencias sin resolver, cuotas pendientes, devoluciones/reclamos y evidencia incompleta; fechas de presentación en Argentina; marca/últimos cuatro de tarjeta cuando existen; selección masiva detrás de Opciones avanzadas. No se cambian las reglas de elegibilidad ni el normalizador.

La confirmación reutiliza ParsePreview y los endpoints canónicos. Alias/categoría guardados ahora se consultan también para compras de tarjeta de una cuota; las preferencias se resuelven antes de montar el editor para evitar reemplazar correcciones en curso. No se agrega merchant learning nuevo. Categoría Pago de Tarjetas no se aplica a compras de crédito. Al confirmar se vuelve a la bandeja recargada, sin abrir un siguiente movimiento con datos previos. Un conflicto requiere revisión de nuevo.

Verificación local: 965 tests en 148 archivos, TypeScript y ESLint de archivos editados. La validación visual en Preview se registra por separado. No se efectuaron confirmaciones reales, escrituras al ledger, cambios de base de datos ni activación de background/auto-post. Las cuotas mayores que una siguen sin confirmación disponible. Esta entrega no completa MP v2.

## Dedupe shadow — 2026-10-02

Consulta read-only de gastos existentes con scope explícito de usuario, importe y moneda exactos, ventana Argentina +/- un día y compatibilidad con cuenta/instrumento. Cuenta sin asignar queda como posible duplicado; nombre distinto no elimina una coincidencia (Nafta / YPF). Otra cuenta explícita, tarjeta, efectivo y pagos legacy quedan fuera. Ninguna vinculación ni borrado automático.

Resultados completos requieren count exacto consistente y máximo 100 filas. Errores, excepciones, count ausente o resultados parciales mantienen el gate cerrado. Shadow registra possible_ledger_duplicate o ledger_dedupe_pending; regla versión 3 conserva auditoría previa. Los IDs/descripciones del ledger no se duplican en el audit.

Verificación: suite completa 996 tests / 151 archivos incluyendo integración shadow, TypeScript y ESLint. Verificado por lectura de schema real que expenses.date es timestamptz: query de ventana usa comienzo UTC inclusivo y fin siguiente día exclusivo; el matcher preserva el calendario que el editor canónico guarda a medianoche UTC. Prueba SQL read-only scoped al usuario, sin escritura. Esta mejora no prueba cobertura del proveedor ni hace auto-post.

## Card matcher — 2026-10-02

El editor de compra MP preselecciona una tarjeta únicamente con señal determinística: crédito + últimos cuatro válidos + exactamente una tarjeta activa compatible. Marca nunca identifica por sí sola; sólo desambigua tarjetas con iguales últimos cuatro cuando el nombre libre de Gota contiene una marca reconocible. Cero/múltiples matches muestran revisión manual y nunca eligen arbitrariamente. La elección queda editable.

El schema actual no conserva brand/issuer de manera estructurada, por lo que no se afirma un match por issuer. Sin migración ni escritura real. Verificación local: 1001 tests / 152 archivos, TypeScript, ESLint y build productivo Next verdes. Es cobertura sintética de reglas, no prueba de consistencia de last4/issuer en operaciones reales de Mercado Pago.

## Merchant/category learning — 2026-10-02

Se reutiliza la infraestructura counterparty_profiles/counterparty_aliases. Las confirmaciones MP proponen recordar comercio/categoría por defecto con control visible. La escritura sucede después del posting humano exitoso; si falla, no transforma un gasto confirmado en error ni lo vuelve a enviar. Corregir la categoría de un perfil existente ahora actualiza su default_category, por lo que la siguiente operación puede sugerir la corrección en vez del valor viejo.

Esta memoria sólo organiza gastos: no decide tipo económico, funding, cuenta, tarjeta o cuotas. Sin ML nuevo, tabla nueva o escritura de prueba. Tests focalizados, suite completa, TypeScript, ESLint y build productivo Next verdes; evidencia de comportamiento real todavía requiere una confirmación controlada autorizada.

## Auditoría de cuotas existente — 2026-10-02

El motor canónico actual no almacena una compra madre: `buildInstallmentRows` divide el total en N filas futuras unidas por installment_group_id, cada una asignada a su card_cycle. Borrado es grupal, edición individual está bloqueada y compromisos consumen esas filas/ciclos. El RPC MP actual replica sólo el caso 1x y valida installments=1 tanto en TypeScript como SQL.

Por eso, habilitar N en la UI sería inseguro y extender el RPC sin decisión de modelo perpetuaría una tensión con el handoff (“gasto económico total hoy” y obligaciones futuras, no seis gastos independientes). Próximo paso seguro: definir si el grupo actual cuenta como compra canónica a nivel producto o introducir una entidad de compra madre que alimente ciclos. Hasta entonces N cuotas permanece review; 1x no cambia.

## Clasificación real de PAYOUTS — 2026-10-02

Una transferencia controlada MP→banco apareció finalmente en Account Settlement Report como `PAYOUTS`, con `TRANSACTION_AMOUNT`, `SETTLEMENT_NET_AMOUNT` y `REAL_AMOUNT` iguales a ARS -1.000 y timestamp compatible. Payments Search no la había devuelto. Se agregó un fixture mínimo sanitizado que conserva únicamente semántica financiera y omite IDs/destino.

El normalizador ahora interpreta exclusivamente `PAYOUTS` de Settlement con monto negativo como `transfer/outflow`. Conserva account role, funding, destino y aprobación como desconocidos; un `PAYOUTS` cero o positivo sigue unknown. La política shadow lo manda a review por tipo económico, jamás a gasto/ingreso o auto-post. La bandeja lo presenta como “Transferencia por resolver”. Esto mejora semántica y UX sin afirmar que el destino sea BBVA o una cuenta propia.

La primera inspección del Preview con esa fila descubrió que el gate histórico de “balance debit conocido” todavía tenía prioridad en la confirmación humana y la mostraba entre gastos completables. Se corrigió tanto la elegibilidad del cliente como la del endpoint: tipos transfer/income/neutral y reversos quedan fuera de confirmación de gasto aunque tengan un débito de saldo consistente. Este hallazgo refuerza por qué la matriz real es obligatoria y los tests sintéticos no bastan.

## Excepción visible de posible duplicado — 2026-10-02

La bandeja une una decisión shadow al movimiento sólo cuando candidate ID, fingerprint de evidencia y versión de regla coinciden. Proyecta únicamente `possible_duplicate`, sin IDs de ledger ni metadata interna. La operación deja de ser confirmable, se muestra en “Necesitan más información” y explica que debe compararse antes de registrar otra.

La confirmación de gastos con saldo repite el dedupe read-only inmediatamente antes del RPC. Una lectura incompleta falla con 503 y un match compatible con 409; ninguna de las dos rutas escribe ledger. Esto cierra la carrera entre la evaluación shadow y el click humano. “Vincular” y “Mantener ambos” siguen pendientes hasta contar con decisión persistente, ownership, stale protection e idempotencia transaccionales. Verificación: 1012 tests / 152 archivos, TypeScript y ESLint focalizado verdes; sin escrituras reales.
