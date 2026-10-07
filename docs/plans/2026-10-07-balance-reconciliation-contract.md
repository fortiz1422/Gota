# Gota · Confirmación de saldo y conciliación

Contrato inicial aprobado para comenzar trabajo en la conversación de voz del 07/10/2026.
Base técnica: `main` en `37984fc54894a7c2f9a4a394004d0f4d643582fa`.
Esta entrega implementa sólo dominio puro y política de tareas; no activa la función.

## Decisiones de producto de esta sesión

- La acción manual vive en el detalle de cuenta. Las invitaciones viven en la campana y abren la cuenta correspondiente directamente. No agregar CTA ni banners al saldo de Home.
- Cadencia inicial: sábados y último día de mes hacia la noche. Una sola tarea abierta por usuario/cuenta/moneda; checkpoints sucesivos no multiplican tareas. Si las invitaciones quedan próximas, combinar y priorizar fin de mes.
- Horarios usados como valores provisionales del dominio: sábado desde las 09:00 y cierre desde las 20:00, zona `America/Argentina/Buenos_Aires`. No fueron horarios acordados con el usuario. La ventana concreta y qué significa «próximas» necesitan configuración antes del scheduler.
- Una confirmación guarda cuenta, moneda, saldo observado, fecha/hora, saldo esperado y revisión del ledger. No es un cierre de medianoche ni demuestra que esté completo el historial.
- Si coincide, finalizar. Si difiere: Resolver ahora / Ajustar y seguir / Después.
- Después guarda observación y discrepancia; no modifica saldo operativo. Ajustar y seguir reconoce la diferencia en el motor, con consentimiento explícito, sin clasificarla como gasto.
- Se pueden registrar nuevos checkpoints con diferencias anteriores abiertas. Nunca sumar observaciones sucesivas del mismo faltante. Con ajustes reconocidos, la expectativa nueva ya incorpora sus residuales.
- Guardar cada checkpoint sin reescribir su expectativa original; una vista recalculada puede cambiar al entrar evidencia tardía y debe indicar su revisión.
- La diferencia neta no prueba gasto: transferencias propias, pagos de tarjeta, ingresos y rendimientos requieren su tratamiento real. No alterar compromisos de tarjeta con un ajuste genérico.
- Resolver ahora primero revisa evidencia disponible; luego permite carga manual o comprobante/sync apropiado. Resolver por partes y salir debe ser posible.
- Encontré un movimiento desde el ajuste facilita la asociación. Preguntar si estaba incluido en el saldo confirmado; no depender exclusivamente de la fecha o del importe.
- Si no se sabe el día, guardar incertidumbre temporal y no inventar fecha. Si cruza meses, no asignar período sin evidencia o decisión explícita.
- La tarea y cada avance confirmado deben persistir antes de salir al banco. Al reabrir la PWA, retomar el paso activo; salida clara para continuar después. Borradores no afectan dinero. La campana abre la misma tarea.
- Mantener componentes y tokens vigentes. Cuenta, diferencia y siguiente acción; historia y explicaciones bajo demanda. Una acción primaria; las alternativas no se eliminan. Sin banners largos, tour ni dashboard adicional.

## Contrato implementado en esta primera entrega

`lib/reconciliation/domain.ts` ofrece transformaciones inmutables: crear checkpoint, reconocer ajuste, resolver una parte, revertir allocation y cerrar sin explicación. Los importes son centavos enteros seguros; ARS/USD no se mezclan. No clasifica diferencias como consumo.

`currentDifference` compara contra saldo base más ajustes reconocidos. Checkpoints no reconocidos tienen aporte cero. `operatingBalance` es una utilidad de prueba/adaptación de un único scope; no reemplaza el motor vivo. El caller debe seleccionar los eventos vigentes al corte y garantizar que el saldo base pertenece al mismo scope.

La resolución produce movimiento real + compensación propuesta. Scope, revisión optimista, efecto incremental no contado, consentimiento, intervalo o inclusión temporal confirmada y residual se validan. Se guarda la evidencia temporal del vínculo. La escritura del movimiento, allocation y compensación todavía no existe y DEBE ser atómica en el servidor.

Una compra CREDIT con efecto de cuenta cero no puede resolver un ajuste bancario. Una transferencia sólo resuelve la pata correspondiente; el flujo real debe persistir también la otra pata, conservando neutralidad consolidada. La resolución por intervalo no genera automáticamente una fila `expenses` con fecha inventada.

La primera versión admite efectos del mismo signo hasta el residual. Un gasto de 30.000 e ingreso de 10.000 que explican un delta de -20.000 requiere un futuro comando batch atómico; el dominio actual lo rechaza en vez de distribuirlo arbitrariamente. Tampoco implementa supersession de checkpoints ni reapertura de cierre manual: deben agregarse antes de habilitar edición de esas operaciones.

`lib/reconciliation/reminders.ts` define ocurrencia por calendario local, clave estable de tarea y puntero serializable de reanudación. No hay scheduler, storage de borradores, endpoint ni navegación conectados. El puntero sólo conserva identidad/paso; nunca un saldo que pueda sustituir al servidor. Al restaurarlo, el endpoint debe validar ownership, existencia, estado y revisión; un puntero no es autorización.

## Escenario de Facundo, demostrado con fixture sintético

Todos los valores de esta tabla son pesos; internamente se prueban centavos.

| Paso | Base registrada | Ajuste residual | Saldo operativo | Banco |
|---|---:|---:|---:|---:|
| Confirmación inicial y ajuste | 1.000.000 | -100.000 | 900.000 | 900.000 |
| Se registran 50.000 nuevos | 950.000 | -100.000 | 850.000 | 800.000 |
| Se incorporan 50.000 atrasados que explican el ajuste | 900.000 | -50.000 | 850.000 | 800.000 |
| Nueva confirmación | 900.000 | -50.000 | 850.000 | 800.000 |

La nueva diferencia es -50.000; el ajuste anterior conserva otros -50.000 sin explicar. No confundir residual explicativo con discrepancia actual de saldo. Al aceptar el nuevo ajuste, el operativo sería 800.000; los dos intervalos permanecen trazables.

Si un gasto antiguo se cargó como nuevo, la próxima confirmación puede mostrar un gap contrario. No prueba la causa: ofrecer candidatos, permitir corregir evidencia y revertir asociaciones, nunca compensar por monto solamente. Un movimiento ya incluido en el expected original no autoriza otra compensación.

## Integración pendiente y orden de entrega

1. Persistencia aditiva: checkpoints, eventos, allocations y tareas/borradores; RLS, idempotencia de comandos, revisión de ledger, concurrencia y rollback. Obtener estado real DB antes de preparar migración final.
2. Adaptador único a saldo vivo/hero/detalle/disponibilidad. Probar cortes históricos: reconocimiento efectivo en checkpoint y compensaciones al corte correspondiente. No sumar indiscriminadamente estados actuales a todos los períodos.
3. Endpoints autenticados: after/defer, ajuste y resoluciones con evidencia incremental extraída por servidor, nunca confiando en booleans enviados desde navegador. Edición o eliminación de movimientos asignados exige revertir efectos en la misma transacción.
4. Tarea reanudable integrada a campana y cuentas; restauración de sesión autenticada, borradores acotados, manejo offline sin posting y conflicto visible si cambió el ledger. No confiar sólo en estado React o en localStorage para dinero.
5. UI con diseño vigente. Pruebas de cambiar al banco, cerrar PWA, reabrir, retomar, guardar parte, duplicar click, cambiar usuario y revocar acceso. Comprobar en iPhone real antes de afirmar continuidad end-to-end.
6. Reminder diario evaluado por servidor/app-entry; no cron de PWA. Supresión tras confirmar, snooze, merge de cercanía, dedupe DB. Push y automatización MP separadas y posteriores.

La luz verde autoriza comenzar implementación; la aplicación de migraciones al canon financiero o cambios a datos personales requiere confirmación específica. No se aplicó ninguna migración ni se modificó producción.

## Handoff para Hermes

**Hechos:** repo verificado, checkout aislado de main 37984fc; archivos nuevos únicamente. Dominio y política no están importados por la aplicación.

**Decisiones:** campana/cuentas, sábados y cierre mensual, tres acciones con semántica explícita, checkpoints conservados, neto desconocido separado de gasto, evidencia temporal y continuidad sin banners.

**Supuestos:** 09:00/20:00 son provisionales; un baseline confiable debe determinar si puede afirmarse un intervalo. Confirmaciones anteriores con historial incompleto no demuestran ausencia de errores más antiguos.

**Artefactos:** cuatro archivos TypeScript de dominio/política/tests y este contrato, en rama de trabajo. El análisis anterior queda como antecedente; este contrato precisa las decisiones de voz posteriores.

**Pendientes:** DB/RLS/RPC, integración de saldos, tarea persistida y UI, corrección de checkpoints, batch de signos mixtos, merge de recordatorios próximos, pruebas en PWA y datos personales autorizados.

**Riesgos:** boolean de evidencia no confiable si proviene del cliente; doble conteo al escribir sin transacción; desfase de cortes históricos; movimientos sin fecha exacta incompatibles con expense actual; falsos candidatos; confundir diferencia histórica con saldo actual.

**Verificación:** 34 tests nuevos; suite completa con `TZ=America/Argentina/Buenos_Aires`: 169 archivos, 1.808 tests aprobados. TypeScript sin emisión, lint de `lib/reconciliation` y diff check aprobados. Sin acceso a datos personales, build ni pruebas de DB/navegador. La suite con zona del entorno falló en el test preexistente `web-movimientos-model` por etiquetas con un día de diferencia; pasó al usar zona argentina. No se modificó ese archivo. No afirmar persistencia o flujo productivo verificados a partir de serializar un puntero.
