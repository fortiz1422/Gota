# Diagnóstico de movimientos de Mercado Pago

Este diagnóstico es una lectura privada y de solo lectura sobre observaciones RAW server-only de Payments Search y del reporte oficial `Todas las transacciones` (`/v1/account/settlement_report`). No importa movimientos ni escribe en gastos, ingresos, transferencias, cuentas, tarjetas o ningún libro contable.

Flujo del Settlement Report:

1. Se consulta `GET /v1/account/settlement_report/config`. Sólo ante `404` se crea la configuración explícita con `file_name_prefix=gota_settlement`, `frequency=daily`, las 19 `columns` documentadas, `display_timezone=GMT-03`, separador `,`, `include_withdraw=true` y `header_language=en`. Una configuración existente nunca se sobrescribe.
2. Se consulta `GET /v1/account/settlement_report/list` antes de generar. Un reporte pendiente para la ventana no se duplica; si el listado sigue vacío durante la preparación, el último source run `pending` aplica un cooldown determinista de 10 minutos.
3. Un `file_name` CSV válido para la ventana se considera listo aunque la respuesta oficial de list no incluya `status`; se descarga antes de generar otro reporte.
4. Si no hay reporte listo ni un pending vigente, se ejecuta una única generación manual con `POST /v1/account/settlement_report` y se devuelve estado `pending`; una lista vacía nunca se interpreta como cero movimientos.
5. Un reporte listo se descarga sólo por el `file_name` validado y codificado contra `GET /v1/account/settlement_report/:file_name`. El CSV se parsea de forma determinista y cada fila se guarda como observación RAW `source=account_settlement_report`, usando `SOURCE_ID` o un hash estable.

La migración aditiva no aplicada `docs/supabase-mercadopago-pending-source-runs.sql` habilita `pending` en `mercadopago_sync_source_runs`: `success` y `pending` requieren `error_code` nulo; `error` exige `error_code` no nulo.

Cobertura e interpretación:

- Payments Search conserva su paginación y su contrato de lectura independiente.
- El Settlement Report cubre movimientos que pueden afectar el saldo y que Payments Search omite, como el pago Shell de $5.500, cuando Mercado Pago lo incluye en el archivo.
- La cuenta del usuario se prueba comparando `provider_user_id` con `payer_id`/`payer.id` y `collector_id`/`collector.id`. Sin esa relación, la dirección y el tipo económico quedan desconocidos.
- Las filas de settlement conservan monto, moneda, fecha, descripción, tipo de transacción y medio. No se asume que `SETTLEMENT` es ingreso ni que un monto positivo define dirección: quedan `unknown`/`partial` cuando faltan pruebas.
- `available_money` se muestra como saldo Mercado Pago; tarjetas conservan únicamente tipo, marca segura y últimos cuatro dígitos. Operaciones ambiguas permanecen visibles con interpretación parcial o sin resolver.
- Payloads, tokens, identificadores personales y CSV completo permanecen server-only; la UI recibe sólo estados, cantidades y movimientos normalizados angostos.

Limitaciones: la ausencia de una operación conocida sigue siendo evidencia de cobertura de la captura, no algo que el normalizador pueda inventar. No hay importación al ledger, migraciones, cron, webhook ni llamadas reales al proveedor en los tests.
