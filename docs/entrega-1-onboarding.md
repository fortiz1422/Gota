# Entrega 1 — onboarding y fechas honestas

## Qué entra

- `/start` crea la sesión anónima una sola vez y, si ya hay sesión, retoma el onboarding o abre el home.
- Onboarding en dos pasos: cuenta y tarjetas. El alta de tarjeta es la misma en onboarding, Tarjetas y configuración: día de cierre, día de vencimiento, «No las sé, completar después» y la respuesta Sí / No / No sé todavía.
- `due_day` puede ser NULL y ya no tiene DEFAULT 10. No se inventa un vencimiento.
- La lista de tarjetas muestra «Faltan las fechas de cierre», «Resumen sin cargar», «Gastos sin cargar desde el …», «Falta completar» o «Al día».
- El home muestra una sola nota, «Falta información de N tarjetas · tu disponible puede ser menor», y el aviso «Guardá tu acceso para no perder tus datos.»
- El detalle pregunta por gastos desde el cierre con la carga que ya existe, y «¿Ya pagaste ese resumen?» con «Ya lo pagué» / «Todavía no». «Todavía no» vuelve a preguntar a los 7 días y no baja la nota.

## Qué no entra

- «Cargar» y la pantalla del resumen sin pagar (Entrega 2).
- `amount_draft` no se usa para ese resumen.
- Anti-abuso de `/start`.

## Decisiones conservadoras

- Una tarjeta vieja, sin respuesta Sí / No / No sé, no entra en la nota ni cambia de estado. No hay forma de distinguir un `due_day` 10 inventado de uno cargado, y esta entrega no reescribe filas.
- «No sé todavía» no es «Al día». Si las fechas y los gastos ya están resueltos, la lista dice «Falta completar»: los mockups no tienen una pastilla para ese caso y «Al día» sería falso.
- «Todavía no» esconde la pregunta hasta la fecha y deja la nota y «Resumen sin cargar».
- La pregunta de gastos se cierra con «No la usé», «Listo, ya están todos» o el primer cierre posterior al alta. Cargar un gasto no la cierra.
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
