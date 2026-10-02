# Mercado Pago v2 — estrategia corregida

Fecha: 2026-10-02, Argentina. Fuente de requisitos: handoff original de ChatGPT del 30/09/2026 aportado por Facundo en esta conversación. Este documento es una estrategia; no certifica funcionalidad terminada.

## Objetivo y límites

Conectar una vez, capturar sin abrir Gota, incorporar lo inequívoco y consultar sólo excepciones. El resultado debe mejorar saldo actual, compromisos y disponible real. Mantener OAuth/PKCE, cifrado, RAW, fingerprints, reconciliación, snapshots y protección contra stale/conflict/idempotencia. No activar ledger automático antes de validar evidencia real, dedupe y audit trail. No sobrescribir configuración externa de reportes.

## Diagnóstico del trabajo actual

- Rama feat/mercadopago-integration-v2, PR draft #124; producción no actualizada. Auditoría inicial: working tree limpio, HEAD 14048d7.
- Implementados: refresh común, extracción de sync manual, polling incremental acotado con watermark/overlap/lease, endpoint cron, setup today/30d/90d, vinculación/creación de cuenta, interfaz FinancialEvent y decisiones shadow.
- Parcial: FinancialEvent deriva del normalizador existente; merchant/category confidence siguen en cero. Reconciliación no coteja todavía contra movimientos manuales del ledger.
- Shadow pasa ledgerDedupeChecked=false: ninguna evaluación real puede habilitar auto_post. Es una protección deliberada, no evidencia de automatización lista.
- Sin cambios v2 en pantalla de revisión, edición ni confirmación; categorías por comercio, card matcher y cuotas múltiples siguen pendientes.
- Evidencia reciente: 960 tests verdes, TypeScript y ESLint. Prueba real de consultas default/payer/collector para transferencia MP→BBVA: 0 resultados en las tres. Reporte de período pasado pendiente. Estos hechos no validan compras QR ni cobertura personal completa.
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

Documento de continuidad; ejecución a cargo de ChatGPT Work, sin delegación. Decisiones: recuperar prioridades del handoff; transferencia propia fuera del camino crítico; separar preparación técnica, prueba real y activación. Hechos: P0 parcial, shadow sin dedupe ledger, UX de revisión anterior. Supuestos: Payments Search puede cubrir compras personales suficientes; pendiente de prueba. Artefactos: este plan, docs/mercadopago-v2-handoff.md, PR draft #124. Riesgos: falsos gastos por transfers, duplicados manuales, card match ambiguo, categoría confundida con semántica, promesas de latencia no medidas. Pendientes y gates detallados arriba. Ninguna escritura al ledger, migración, activación de background o promoción a producción realizada por este replanteo.


## Primera entrega de revisión — 2026-10-02

Implementado en rama: grupos Para completar / Necesitan más información; explicaciones específicas para transferencias sin resolver, cuotas pendientes, devoluciones/reclamos y evidencia incompleta; fechas de presentación en Argentina; marca/últimos cuatro de tarjeta cuando existen; selección masiva detrás de Opciones avanzadas. No se cambian las reglas de elegibilidad ni el normalizador.

La confirmación reutiliza ParsePreview y los endpoints canónicos. Alias/categoría guardados ahora se consultan también para compras de tarjeta de una cuota; las preferencias se resuelven antes de montar el editor para evitar reemplazar correcciones en curso. No se agrega merchant learning nuevo. Categoría Pago de Tarjetas no se aplica a compras de crédito. Al confirmar se vuelve a la bandeja recargada, sin abrir un siguiente movimiento con datos previos. Un conflicto requiere revisión de nuevo.

Verificación local: 965 tests en 148 archivos, TypeScript y ESLint de archivos editados. La validación visual en Preview se registra por separado. No se efectuaron confirmaciones reales, escrituras al ledger, cambios de base de datos ni activación de background/auto-post. Las cuotas mayores que una siguen sin confirmación disponible. Esta entrega no completa MP v2.
