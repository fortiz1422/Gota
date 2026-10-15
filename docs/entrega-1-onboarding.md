# Entrega 1 — onboarding y fechas honestas

## Qué entra

- `/start` crea la sesión anónima una sola vez y, si ya hay sesión, retoma el onboarding o abre el home.
- Onboarding en dos pasos: cuenta y tarjetas. El alta de tarjeta es la misma en onboarding, Tarjetas y configuración: día de cierre, día de vencimiento, «No las sé, completar después» y la respuesta Sí / No / No sé todavía.
- `due_day` puede ser NULL y ya no tiene DEFAULT 10. No se inventa un vencimiento.
- La lista de tarjetas muestra «Faltan las fechas de cierre», «Resumen sin pagar», «Gastos sin cargar desde el …» o «Al día». «No sé» queda en «Resumen sin pagar» hasta contestar «No» o «Ya lo pagué».
- El home muestra una sola nota, «Falta información de N tarjetas · tu disponible puede ser menor», y el aviso «Guardá tu acceso para no perder tus datos.»
- El detalle pregunta por gastos desde el cierre con la carga que ya existe, y «¿Ya pagaste ese resumen?» con «Ya lo pagué» / «Todavía no». «Todavía no» vuelve a preguntar a los 7 días y no baja la nota.

## Qué no entra

- «Cargar» y la pantalla del resumen sin pagar (Entrega 2).
- `amount_draft` no se usa para ese resumen.
- Anti-abuso de `/start`.

## Decisiones conservadoras

- Una tarjeta vieja, sin respuesta Sí / No / No sé, no entra en la nota ni cambia de estado. No hay forma de distinguir un `due_day` 10 inventado de uno cargado, y esta entrega no reescribe filas.
- «No sé todavía» no es «Al día». Usa el mismo estado «Resumen sin pagar» y sigue en la nota del home.
- «Todavía no» esconde la pregunta hasta la fecha y deja la nota y «Resumen sin pagar».
- «¿Ya pagaste ese resumen?» queda fijo en el cierre anterior o igual al alta. No avanza con los cierres siguientes. Pregunta recién el día después del vencimiento, y sigue hasta «No» o «Ya lo pagué».
- La pregunta de gastos se cierra con «No la usé», «Listo, ya están todos» o el día después del primer cierre posterior al alta. El día del cierre sigue preguntando. Cargar un gasto no la cierra.
- Terminar el onboarding no marca el tour como hecho. La guía señala la nota de tarjetas una vez.
- Sin día de cierre no se pregunta por gastos y no se fabrica una fecha.
- Si falta `due_day`, a los 60 días la pregunta es «¿Ya pagaste ese resumen?» sin fecha.
- En el hueco entre entregas, «Ya lo pagué» y «No» bajan el aviso del resumen. Cargarlo queda para la Entrega 2.
- La palabra «pendiente» no se usa en etiquetas, estados ni títulos nuevos. En la pregunta del mockup se mantiene porque es una frase.
- Login y onboarding usan Geist. El home sigue en DM Sans.

## Migración

Archivos: `docs/supabase-cards-due-day-nullable.sql` y `docs/supabase-cards-due-day-nullable-down.sql`.

El UP solo hace `DROP NOT NULL`, `DROP DEFAULT` y agrega columnas nulas. No hay `UPDATE` ni `DELETE` sobre `cards`.

El DOWN borra las columnas nuevas, repone el default y se niega a restaurar `NOT NULL` si hay `due_day` nulos, para no escribir un 10 inventado.

No se aplicó en ningún proyecto remoto. El único proyecto Supabase accesible es `wfwkrenyoxiswaeafpjc` (`fortiz1422's Project`), la base compartida con producción, y no tiene ramas de staging. Producción no se toca.

## Inventario de `due_day`

Un `due_day` NULL no se reemplaza por 10 ni por cierre + 10. Los consumidores:

| Lugar | Con `due_day` NULL |
|---|---|
| `app/api/cards/route.ts`, `app/api/cards/[id]/route.ts`, `lib/cards/persist.ts` | Guardan el día cargado o NULL. No calculan un vencimiento. |
| `lib/card-cycles.ts` `buildLegacyCardCycle` / `resolveDueMonth` | No arman ciclo. `closing_day ?? 1` solo se usa si el vencimiento existe; no inventa `due_day`. |
| `lib/card-cycle-assignment.ts` | El plan de cuotas sale vacío. No inserta ciclos. |
| `lib/card-payment-targeting.ts` | Si no hay ciclo guardado y el vencimiento es NULL, no fabrica uno. |
| `lib/card-payment-prompts.ts`, `lib/cardPaymentPrompt.ts` | No proponen pago. |
| `lib/analytics/computeCompromisos.ts` | La tarjeta va a `tarjetasSinVencimiento` y no entra en la deuda con fecha. |
| `lib/card-setup-state.ts` | Estado «Faltan las fechas de cierre». A los 60 días, «¿Ya pagaste ese resumen?» sin fecha. |
| `lib/mercadopago/card-purchase-plan.ts` | Pasa el día al planificador, que no crea ciclos si es NULL. |
| `app/api/cards/summary/route.ts`, `components/settings/TarjetasSubSheet.tsx`, `components/web/settings/WebSettingsPage.tsx` | Lo muestran o lo omiten. No lo escriben. |
| `components/analytics/Compromisos.tsx` | Aviso de tarjetas sin vencimiento. No completa el día. |
| `app/(dashboard)/tarjetas/[cardId]/EditCycleModal.tsx` | Solo guarda si la persona cargó cierre y vencimiento. |
| `schema.sql`, `types/database.ts` | Columna nullable, sin DEFAULT. |

`app/api/card-payments/route.ts` no escribe `due_day`. Si no hay cierre previo, el período del pago arranca el día 1 de ese mes. Eso ya estaba y no rellena el vencimiento de la tarjeta.
