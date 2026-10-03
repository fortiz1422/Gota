# MP v2 — implementación y validación pendiente

Actualizado 2026-10-03. Código no equivale a habilitación ni validación financiera real.

## Entrega implementada

- Transferencia saliente con débito observado: confirmación humana como consumo o desestimación si propia; jamás auto-post. La decisión del usuario reemplaza el bloqueo absoluto del handoff, conservando la clasificación RAW.
- Compra con tarjeta: total pagado explícito, N cuotas inmutables del proveedor, motor compartido `buildInstallmentRows` + `buildCardCyclePlan`. Sin entidad madre nueva. El grupo actual es la compra canónica aceptada por el usuario; compromisos consumen sus filas/ciclos existentes.
- SQL transaccional para N: ownership, snapshots RAW/tarjeta/ciclos, reparto exacto, audit, replay, bloqueo de reutilización de native key, rollback conjunto. SQL no genera la programación de cuotas: recibe el plan del motor compartido.
- Duplicados con saldo: comparación scoped de importe/moneda/fecha/cuenta; Vincular conserva ledger, Mantener ambos requiere editor/confirmación. Snapshot de la comparación y del ledger, native keys y decisión auditadas en una transacción. Trigger de usuario compartido con escritores de gastos evita comparar y crear mientras otro writer cambia el ledger. Deadlock/serialization puede abortar y debe reintentarse; no se permite fallback inseguro.
- Auto-post Phase C: approved balance expense únicamente; dos flags de deployment + opt-in de conexión + guard SQL. Categoría fallback `Otros`; incertidumbre de categoría no decide semántica. Transfers/cards/refunds/unknown/duplicates no ingresan a esta ruta.
- Captura incremental separada de reconciliación Settlement; endpoint reconciliador sobre tres días argentinos ya cerrados, éxito diario y cooldown de intentos. Nunca crea/modifica config de reportes. No se agregó schedule de hosting ni se activó opt-in real.
- Settings conserva los controles técnicos/rangos en Advanced incluso con rollout v2 deshabilitado. Detalle del gasto muestra procedencia humana/automática/vinculada sin exponer payloads. Editor y memoria de categoría reutilizan infraestructura existente.
- Snapshot del editor se compara contra la evidencia actual antes del posting. Regla shadow versión 4 exige además fecha financiera del débito observado.

## Gates de habilitación

Ninguna migración nueva fue aplicada al proyecto real. En orden, revisar/aplicar en entorno de prueba aislado:

1. `docs/supabase-mercadopago-card-installments.sql`: columnas de audit y RPC nuevo para 1..72 cuotas; usa el esquema card/review ya existente en main.
2. `docs/supabase-mercadopago-postings.sql`: audit y lock de expenses; auto_post_enabled nace false.
3. `docs/supabase-mercadopago-reconciliation-state.sql`: estado de reconciliación; background/initial ya existen.

No aplicar como parte de este rollout `docs/supabase-mercadopago-card-confirmation.sql`: su reemplazo del RPC legacy podría cambiar el contrato utilizado por main en la base compartida. Preview con flag de tarjetas usa el nuevo RPC incluso en 1x. La corrección legacy sigue revisable para una futura actualización coordinada de main.

Flags nuevos deben quedar ausentes/false hasta validar: `MERCADOPAGO_CARD_INSTALLMENTS_ENABLED`, `MERCADOPAGO_POSTING_ENABLED`, `MERCADOPAGO_AUTO_POST_ENABLED`, `MERCADOPAGO_RECONCILIATION_ENABLED`. Background conserva flag previo + opt-in de conexión. Publishing no habilita estos flags. El flag de cuotas habilita también la interpretación nueva de total paid en compras 1x; si total explícito difiere y no está habilitado, queda pendiente.

Concurrencia nativa cerrada en CI PostgreSQL16 descartable: 23 checks de cuotas +27 de postings, incluyendo clientes concurrentes, identidad idempotente y carrera manual insert vs importador que rechaza snapshot anterior sin duplicar. Run exitoso https://github.com/fortiz1422/Gota/actions/runs/37093132076 sobre commit 8f91610. Workflow read-only y sin secretos. No reemplaza operaciones reales ni prueba migraciones sobre el esquema desplegado. La suite Docker legacy separada no se ejecutó en este cierre.

No promover a producción sin matriz controlada, shadow revisado y efecto correcto en saldo/compromisos/disponible real. No afirmar cadencia de 10–15 minutos hasta configurar y medir hosting. No modificar config externa ni liberar refunds/transfers automáticos para subir automation rate.

## Matriz de evidencia real

| Caso original | Evidencia disponible | Validación final |
|---|---|---|
| 1 QR con saldo | Histórico de pagos con saldo; no certifica escenario QR controlado | Pendiente |
| 2 QR + crédito 1x | Compras históricas de crédito 1x; no certifica QR ni posting | Pendiente |
| 3 QR + crédito 3x | Tests sintéticos de motor/policy; no operación real 3x controlada | Pendiente |
| 4 Tarjeta no cargada | Preview real dejó selector vacío sin match único | UI verificada; posting no probado |
| 5 ML con saldo | No operación controlada identificada como buyer ML | Pendiente |
| 6 ML + crédito 6x | Histórico trae compras 2x; total/cantidad visibles, no escenario 6x | Pendiente |
| 7 MP → tercero | PAYOUTS observado prueba salida, no identidad del destinatario | Pendiente |
| 8 Tercero → MP | No fixture real controlado | Pendiente |
| 9 Cuenta propia → MP | Sin matching real contra canon | Pendiente |
| 10 MP → propia | Transferencia ARS1.000 declarada por usuario + PAYOUTS real -1.000, fecha compatible; no destino en RAW ni ledger linkage | Salida observada; reconciliación propia pendiente |
| 11 Servicio con saldo | Histórico con descripciones de servicio; no matriz controlada | Pendiente |
| 12 Servicio con tarjeta | Histórico observado; evidencia incompleta no habilita ledger | Pendiente |
| 13 Refund conocido | Pruebas fail-closed, sin reversal canónico real | Pendiente |
| 14 Refund sin original | Policy manda review; cobertura sintética | Pendiente real |
| 15 Compra fallida | Policy ignore; cobertura sintética | Pendiente real |
| 16 Chargeback/reverso | Policy review; cobertura sintética | Pendiente real |

Fixtures históricos sanitizados existentes conservados; ningún escenario sintético se presenta como RAW real. La compra de juguete en 2x fue identificada por el usuario; esa declaración no certifica la escritura ni el cálculo real de disponible.

## Extensiones fuera de la primera habilitación

Refund matching/reversal canónico, reconciliación avanzada de own transfers, enriquecimiento ML/servicios por evidencia y webhook personal permanecen cerrados hasta observar escenarios suficientes. Apple Pay queda posterior a MP. No se construyó un segundo motor de cuotas ni una integración bancaria para inferir destinos inexistentes.


## Verificación de código final

Suite Vitest 1.048/1.048 en 155 archivos, TypeScript y lint focalizado verdes. SQL descartable PostgreSQL/WASM: 20 checks de cuotas +22 de posting. Build productivo de validación local sin uploads/telemetría de Sentry completado (`GOTA_LOCAL_VERIFY=true NEXT_TELEMETRY_DISABLED=1 NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1 npm run build`). No ejecutar scripts contra el proyecto real: sólo PGlite descartable o Docker aislado. Esto no habilita flags, migraciones, escritura financiera ni producción.


Preview de implementación `5e43f23` READY y sesión autenticada verificada: 40 pendientes (27 completables, 13 excepciones); editor de salida ARS1.000 muestra 1/oct y fue cancelado; compra 2x muestra total paid ARS67.890,30 y permanece gated; Settings ofrece hoy/30d/90d sin fuentes técnicas. Sin escrituras reales. PR #124 continúa draft.


### Cierre de concurrencia, 3/oct

50 checks PostgreSQL16 nativo aprobados en CI; evidencia y logs conservados en run 37093132076. El bloqueo local de Docker/UID fue resuelto mediante CI aislado, sin tocar Supabase. El workflow Claude previo tiene configuración inválida (`on:` vacío); no se presenta el repositorio entero como CI verde. El workflow financiero nuevo terminó success.


### Compatibilidad real y rollout aditivo
Metadata-only de Supabase el3/oct confirma expenses.card_id texto, cards/card_cycles/review UUID. Replay compara cast a texto, sin migrar esa columna. Harness ajustados a tipo real y constraints observadas; nunca se copiaron filas reales. CI agrega RPC legacy1x y asegura que la migración nueva no altera su definición. Detalle del permiso pendiente en docs/mercadopago-v2-rollout.md.
