# Mercado Pago v2 — habilitación de Preview

Actualizado: 3 de octubre de 2026. Facundo autorizó las tres migraciones y las capacidades manuales de cuotas y duplicados. Esa habilitación está ejecutada. No se autorizó automatización ni pruebas que escriban movimientos reales.

## Migraciones aplicadas

Proyecto Supabase: wfwkrenyoxiswaeafpjc. La base es compartida con main.

| Versión registrada | Script | Resultado |
|---|---|---|
| 20261003162312 | docs/supabase-mercadopago-card-installments.sql | Audit y RPC nuevo para 1..72 cuotas |
| 20261003162341 | docs/supabase-mercadopago-postings.sql | Posting auditado y bloqueo compartido de gastos |
| 20261003162349 | docs/supabase-mercadopago-reconciliation-state.sql | Estado de reconciliación |

No se aplicó el reemplazo del RPC legacy de docs/supabase-mercadopago-card-confirmation.sql. Su hash permanece 38f84095dc44acbef192ed7012b3c4ac. Los nuevos RPCs tienen EXECUTE para service_role y no para anon/authenticated. Postings tiene RLS activo; el trigger de gastos está habilitado. Las migraciones no crearon gastos ni compromisos de prueba.

## Configuración de Preview

Commit de habilitación: f5b81c6. Deployment dpl_7cymQEtiFf1mXVjKMjkpaTLuBzuf, READY.

El conector de Vercel no ofrecía edición de variables ni una CLI autenticada. Se usó configuración de build revisable, sin secretos: next.config.env llama a lib/mercadopago/preview-rollout.ts. Sólo environment=preview y la rama exacta feat/mercadopago-integration-v2 reciben:

| Flag | Valor |
|---|---|
| MERCADOPAGO_CARD_INSTALLMENTS_ENABLED | true |
| MERCADOPAGO_POSTING_ENABLED | true |
| MERCADOPAGO_AUTO_POST_ENABLED | false |
| MERCADOPAGO_BACKGROUND_SYNC_ENABLED | false |
| MERCADOPAGO_RECONCILIATION_ENABLED | false |

No se modificaron variables del Dashboard ni se promovió un deployment a producción. Para retirar las capacidades, quitar la configuración de Preview y redeployar; no borrar ledger ni auditoría.

## Verificación realizada

- Cuatro tests de alcance de flags: Preview autorizado, producción, otras ramas y metadata ausente. Tipos, lint y build local con metadata de Preview aprobados.
- Sesión autenticada: 40 pendientes, 30 para completar y 10 excepciones.
- Rondi: editor muestra ARS 67.890,30, fecha 10/08/2026 y dos cuotas inmutables del proveedor. No encuentra tarjeta por últimos cuatro dígitos y pide elección humana. Editor cancelado.
- PAYOUTS ARS 1.000: editor abierto y cancelado. No se pulsó Registrar, Continuar ni Desestimar.
- Lectura scoped posterior: cero postings y cero confirmaciones desde el rollout; background=false, auto_post=false e initial_import_status=not_started.

La navegación directa al GET de duplicados fue bloqueada por el navegador con ERR_BLOCKED_BY_CLIENT. No se eludió el bloqueo ni se declara validación HTTP de ese endpoint o vinculación real. Sus tests SQL, permisos y configuración están verificados.

## Pendientes posteriores

Validar operaciones controladas, posting real, ciclos/compromisos/disponible y shadow antes de automatizar. No están habilitados importación, background, reconciliación automática ni auto-post. Refund matching y transferencias propias reconciliadas siguen pendientes. No merge ni promoción de producción.
