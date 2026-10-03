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
