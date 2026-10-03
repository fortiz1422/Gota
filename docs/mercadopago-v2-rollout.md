# Mercado Pago v2 — siguiente habilitación concreta

Proyecto Supabase wfwkrenyoxiswaeafpjc. Rama feat/mercadopago-integration-v2; PR draft124. Base compartida con main, sin branch Supabase existente según lectura3/oct. No se crean recursos pagos.

## Acción pendiente de autorización específica
Aplicar, con MCP apply_migration y una transacción por archivo:

1. docs/supabase-mercadopago-card-installments.sql
2. docs/supabase-mercadopago-postings.sql
3. docs/supabase-mercadopago-reconciliation-state.sql

No reemplazar confirm_mercadopago_card_expense legacy. No borrar ni reescribir filas financieras. Se añaden audit/RPCs/estado y un trigger que serializa escritores por usuario y rechaza cambios de ownership. Main conserva RPC existente.

Verificar columnas, privilegios service-only, RLS de postings, definición legacy inalterada, trigger y auto_post_enabled false. Lecturas mínimas; no tokens/auth/users/sessions ni datos financieros innecesarios.

Luego habilitar únicamente en deployment Preview de esta rama MERCADOPAGO_CARD_INSTALLMENTS_ENABLED=true y MERCADOPAGO_POSTING_ENABLED=true. Nunca production. Las env de AUTO_POST, RECONCILIATION y background siguen ausentes/false; opt-ins connection quedan false; ningún cron nuevo. Confirmar redeploy Preview READY y capacidades/editor visibles sin Registrar/Continuar/Desestimar.

## Lo que esta autorización no habilita
No escrituras de prueba al ledger real, no importación/background/auto-post, no merge/promoción, no configurar reportes externos ni transacciones financieras. La matriz financiera real sigue siendo un paso posterior, con evidencia y autorización para cualquier escritura. No se puede sustituir por tests sintéticos ni prometer MPv2 productiva.

## Verificación preparada
Tests route fuerzan v2RPC también1x cuando flag está habilitado, legacy cuando apagado. SQL contra PostgreSQL16 descartable incluye ownership, stale, rollback, replay, clientes concurrentes, carga manual vs import y card_id texto observado. Legacy1x conserva prueba independiente.
