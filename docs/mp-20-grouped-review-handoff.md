# MP-20 — release y handoff

Fecha: 27/10/2026 (Argentina). Repo: `fortiz1422/Gota`.
Estado: publicado en main y desplegado en producción. ROADMAP: Listo.
PR: https://github.com/fortiz1422/Gota/pull/172
Commit de producto: `bbfb2322305e667f44e83322d71512ca584cc4da`.

## Resultado

Revisión y confirmación por grupos sobre los alias existentes; después categorías sugeridas para movimientos sin alias y casos inciertos al final. El usuario puede abrir grupos en cualquier orden, corregir excepciones o dejarlas pendientes. Se retiró el límite arbitrario de 20 y se probó la confirmación de 30 movimientos.

Facundo precisó que la agrupación la maneja el sistema de alias. La revisión consume `/api/counterparty-aliases/resolve`, igual que la revisión individual. No modifica normalización, coincidencias, perfiles, asociaciones ni reglas persistentes. No hay cambios en `lib/counterparty-aliases/`, `app/api/counterparty-aliases/` ni `app/api/counterparty-profiles/`.

- `profile_id` / `display_name` del resolvedor definen la presentación. Solo coincidencias exactas se muestran como alias guardados; las aproximadas quedan a confirmar.
- Sin alias, se reutilizan reglas vigentes del parser de texto. Una única categoría coincidente genera sugerencia; ausencia o conflicto quedan sin categoría. No es una puntuación de confianza de IA. La API MP no aporta categoría del parser y no se agregó otro modelo/servicio.
- Cambiar categoría/selección en la pantalla solo cambia el borrador; no crea reglas futuras. La descripción común queda como edición opcional.
- Se conservan descripciones y medios de cada movimiento, importes, fechas, monedas y cuotas. Los subtotales se separan por moneda.
- Alias consultados una vez por descripción distinta, máximo cuatro lecturas simultáneas. Falla del resolvedor bloquea la preparación; no equivale a «sin alias».

## Confirmación

Se conserva el endpoint financiero por candidato, fingerprint y controles de cuenta/tarjeta, duplicados y devoluciones. La presentación no vuelve confirmable una operación incompleta ni decide si una transferencia fue un consumo.

Preview y confirmación humana obligatorios. Envío secuencial; no es una transacción atómica del grupo. Ante respuesta incierta/error se detiene y exige actualizar bandeja, sin reintentos automáticos. Tras éxito se vuelve a los grupos restantes.

## Evidencia

- CI de la cabeza revisada `9d87c73aec01197eed0b5ef325fae94949f6f4b4`: https://github.com/fortiz1422/Gota/actions/runs/40617739575 — aprobado: 2.159 unitarias, TypeScript, build de producción, 64 Playwright de comprobantes y 2 de revisión móvil MP.
- SQL transaccional: https://github.com/fortiz1422/Gota/actions/runs/40617739485 — aprobado.
- Suite completa de comprobantes local: 64/64 aprobados. Incluye los 24 casos del lote MP en 320/390/768/1440 px.
- Capturas y logs locales originales: `artifacts/mp-20-review/`. Datos sintéticos. Preview sin overflow horizontal y CTA visible. Consola del recorrido principal sin errores.
- Se corrigió el export inválido de `/expenses` moviendo su utilidad a `lib/expenses-redirect.ts`, sin cambiar comportamiento, para permitir el build.
- La primera CI reveló fixtures antiguos: faltaba `/api/capabilities` y se simulaba vencimiento de imagen por cantidad de lecturas. Se corrigieron solo fixtures y se repitió la suite completa; no cambiaron permisos ni producto.
- Se mantuvieron tokens, DM Sans y TaskSurface vigentes. Tras inspección visual se compactaron encabezado y controles, dejando una fila completa visible en 320×568.

## Producción

- Dominio: https://gota.money
- Proyecto Vercel existente: `gota`, ID `prj_nyZGQADbn6IWx28sJoEF54BfN6Ij`.
- Despliegue de producto: `dpl_EwzmAfFS2aLHQ5g5mEzZG3ux8LbQ`, target `production`, estado `READY`, `aliasError: null`, dominio `gota.money` asociado al verificar.
- Inspector: https://vercel.com/facundos-projects-11ee7eb5/gota/EwzmAfFS2aLHQ5g5mEzZG3ux8LbQ
- Rollback anterior: `dpl_CBQhPaSf37JVFzmk2Q4tKy5FgHZ3`, commit `5f205d6`.
- La documentación de cierre solo cambia ROADMAP y este handoff; no modifica código del producto.

Facundo autorizó explícitamente publicación y despliegue. Se usó el conector GitHub porque la terminal no tenía credenciales de push. La igualdad exacta de árboles local/remoto se comprobó antes de publicar. No se debilitaron protecciones ni se guardaron credenciales. Algunas operaciones Vercel de logs/preview protegido devuelven 403; la lectura de estado/metadatos funciona.

## Límites

Sin migraciones, cambios de cron/flags, autopost, alias ni escrituras reales en canon financiero. No se verificó una confirmación con la cuenta real de MP ni un iPhone físico. Las confirmaciones persistidas se recuperan al refrescar; los borradores sin enviar no sobreviven al cerrar la pantalla. Operaciones financieramente no confirmables siguen en la revisión individual existente.
