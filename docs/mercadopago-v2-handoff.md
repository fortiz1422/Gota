# Handoff para Hermes — Mercado Pago v2

Fecha: 3/oct/2026. No hubo delegación: documento para continuidad.

## Decisiones
Preservar OAuth/PKCE/cifrado/RAW y reconciliación. Cuotas pasan por motor agrupado existente; monto usa total paid explícito. Transferencia saliente puede interpretarse como consumo sólo por confirmación humana autorizada. No auto-clasificar transfers/refunds como ingreso/gasto. Duplicados requieren decisión humana auditada.

## Hechos y artefactos
Repo fortiz1422/Gota, rama feat/mercadopago-integration-v2, draft PR https://github.com/fortiz1422/Gota/pull/124 . Implementación 5e43f23; tests nativos finales 8f91610. Preview https://gota-git-feat-mercadopago-int-19f03c-facundos-projects-11ee7eb5.vercel.app/ .

Implementados FinancialEvent/policy/shadow, incremental y reconciliación separadas, matcher determinístico de tarjetas, memoria simple de comercio/categoría en confirmación, Settings/onboarding simplificados, comparación/link/keepboth de duplicados, fingerprint visto por usuario, N cuotas transaccionales y origen de gasto. Auto-post saldo preparado con flags + opt-in + guard SQL; no habilitado.

## Verificaciones
Suite de entrega 1048 tests/155 archivos, tipos/lint/build local seguro aprobados; 42 checks SQL WASM previos. Nuevo PostgreSQL16 nativo: 50 checks, 23 cuotas +27 postings, clientes concurrentes y carrera de carga manual contra importador sin duplicados. https://github.com/fortiz1422/Gota/actions/runs/37093132076 . CI financiero success; workflow Claude previo inválido, fuera de alcance. Preview autenticado observado sin Registrar/Continuar/Desestimar. Observaciones históricas no equivalen a validación de posting financiero.

## Supuestos y riesgos
Cobertura de Payments Search personal no demostrada completa. Auto-post saldo exige impacto/fecha de balance, puede esperar Settlement. No prometer actualización contable cada15min antes de medir proveedor/hosting. SQL aislado verifica contratos sintéticos, no deriva cobertura real ni integración con esquema completo desplegado.

## Pendientes y gates
Aplicar migraciones revisables en entorno específicamente autorizado; probar esquema completo y matriz controlada con efectos ledger/compromisos/disponible; revisar shadow; habilitar rollout explícito luego. Migraciones ordenadas y matriz de16casos en docs/mercadopago-v2-validation-matrix.md. Refund matching/reversal canónico, transferencias propias reconciliadas y enriquecimiento ML/servicios siguen pendientes de evidencia y desarrollo. No declarar MPv2 productiva/terminada.

## Límites preservados
Sin merge/promoción, configuración externa de reportes, transacciones financieras, escrituras de prueba al canon ni activación de import/background/auto-post. No tokens ni credenciales en artefactos. No hace falta login para este cierre de código; validación real posterior requiere acciones autorizadas.


## Actualización final de compatibilidad

Metadata-only confirmó expenses.card_id texto, distinto de cards/card_cycles/review UUID. Fix d92df45 castea comparaciones a texto; pruebas usan ese tipo y constraints observadas. Rollout aditivo68a6dc1: Preview con flag usa nuevo RPC para1..72; no aplicar reemplazo legacy al proyecto compartido. Los tres scripts autorizables están en docs/mercadopago-v2-rollout.md. Tests1049/155, SQL nativo53 checks +legacy1x, CI37131672897 success, Preview68a6dc1 READY. Queda autorización específica de migraciones/flags manuales Preview antes de ejecutar el siguiente paso. Auto-post/background y canon real siguen intactos.


## Habilitación autorizada completada

Facundo autorizó el 3/oct aplicar tres migraciones y habilitar cuotas y duplicados sólo en Preview. Versiones y efectos en docs/mercadopago-v2-rollout.md. Hash legacy intacto; nuevos RPCs service-only; RLS y trigger verificados. La base compartida sí recibió los cambios de esquema autorizados. No se modificó main ni se promovió producción.

Preview f5b81c6 READY. next.config.env limita los flags a environment=preview y la rama exacta; auto-post, background y reconciliación están desactivados. No se cambiaron variables del Dashboard. Cuatro tests de alcance y build/tipos/lint aprobados.

Editor Rondi real: ARS 67.890,30, dos cuotas, 10/08/2026. Se pidió tarjeta al no encontrar match; se canceló. PAYOUTS ARS 1.000 también cancelado. La navegación directa al GET de duplicados fue bloqueada por el navegador y no se declara validación HTTP ni vinculación real. Lectura posterior scoped: cero postings y confirmaciones desde rollout; importación no iniciada y opt-ins apagados.

No volver a pedir autorización para estas tres migraciones/capacidades ya completadas. La matriz financiera real, automatización, refunds y transferencias propias siguen pendientes y no se confunden con tests sintéticos.
