# Diagnóstico de movimientos de Mercado Pago

Este diagnóstico es una lectura privada y de solo lectura sobre las observaciones RAW server-only de Payments Search. No importa movimientos ni escribe en gastos, ingresos, transferencias, cuentas, tarjetas o ningún libro contable.

Contrato de interpretación:

- La cuenta del usuario se prueba comparando `provider_user_id` con `payer_id`/`payer.id` y `collector_id`/`collector.id`. Sin esa relación, la dirección y el tipo económico quedan desconocidos.
- `regular_payment` aprobado con rol payer es gasto; `regular_payment` aprobado con rol collector es un ingreso candidato; `recurring_payment` aprobado con rol payer es gasto recurrente; `money_transfer` aprobado con rol payer y PSP_TRANSFER es transferencia saliente.
- Operaciones rechazadas, canceladas o sin estado aprobado permanecen sin resolver: se conserva su estado, pero no se presentan como gasto o ingreso consumado.
- `account_fund` requiere payer y collector coincidentes: es una transferencia entrante hacia el saldo de Mercado Pago, no un ingreso.
- `card_validation` con importe cero es neutral/técnica. CHECKOUT, INSTORE, SUBSCRIPTIONS y PSP_TRANSFER describen canal; no prueban por sí solos una marca o producto distinto.
- La fuente de fondos se mantiene separada del canal: saldo MP, tarjeta o transferencia bancaria/DEBIN. Sólo se conserva marca, issuer id y últimos cuatro de tarjeta cuando son valores seguros. Los resúmenes usan `transaction_amount_refunded` y, si hay importes numéricos seguros, suman `charges_details[].amounts.original`; `total_paid_amount` y `net_received_amount` son sólo contexto del procesamiento/collector y nunca definen la dirección ni el importe de salida del pagador.
- Payloads con forma desconocida, identidad incompleta o estado insuficiente permanecen visibles como desconocidos/parciales con códigos de razón.

Limitación de cobertura: la ausencia de una operación conocida —por ejemplo, un pago controlado de $5.500— es evidencia de cobertura de la captura, no algo que el normalizador pueda inventar. La lista de Settlement Report todavía puede estar vacía.
