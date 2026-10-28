# MP-20 — revisión por grupos: handoff

Fecha: 27/10/2026 (Argentina). Repo: `fortiz1422/Gota`.
Base verificada: `5f205d6` (`main`, checkout limpio). Rama local: `feat/mp-grouped-review`.
Estado: implementado y verificado localmente; En curso en ROADMAP hasta revisión/merge. Sin push, PR, merge ni deploy.

## Decisión y alcance

Facundo aprobó revisar primero los movimientos identificados por sus alias existentes, después las categorías sugeridas para movimientos sin alias y finalmente los casos inciertos. Luego precisó: **no modificar la agrupación; el sistema de alias la maneja por sí mismo**.

La implementación consume `/api/counterparty-aliases/resolve`, el mismo endpoint usado en la revisión individual. No modifica normalización, coincidencias, perfiles, alias ni reglas persistentes. No hay cambios en `lib/counterparty-aliases/`, `app/api/counterparty-aliases/` ni `app/api/counterparty-profiles/`.

- El resultado existente `profile_id` / `display_name` define el grupo visual. No se crea un nuevo comercio ni se asocian alias.
- Solo resultados `exact` se presentan como alias guardados; `suggestion` se mantiene para confirmar.
- Sin alias, se reutilizan las reglas de categoría del parser de texto vigente. Solo una coincidencia de categoría produce sugerencia; conflictos y ausencia de coincidencia quedan sin categoría. Esto es una propuesta determinística, no una puntuación de confianza de IA ni una nueva clasificación del proveedor.
- La API de movimientos MP hoy no entrega categoría del parser. No se simula que la entregue y no se agrega otro servicio/modelo.
- El usuario abre grupos en cualquier orden, revisa todos sus ítems, quita excepciones y confirma. Un grupo puede contener 30 movimientos; se retiró el límite arbitrario de 20 del cliente.
- Cambiar la categoría de una fila o de una selección solo modifica el borrador de revisión. No actualiza preferencias futuras del comercio.
- Las descripciones, medios, importes, monedas, fechas y cuotas originales se conservan. La descripción común queda como edición opcional.
- Importes de grupo separados por moneda, con fechas explícitas. Nunca se suman ARS y USD en un total combinado.

## Confirmación y errores

Se conserva el endpoint financiero existente por candidato, el fingerprint y las validaciones de cuenta/tarjeta. La presentación por alias no vuelve confirmable una operación con evidencia incompleta ni elimina controles de duplicados/devoluciones.

La confirmación se envía secuencialmente y solo después del preview humano. No es una transacción atómica de todo el grupo: puede haber éxitos parciales. Ante respuesta incierta/error se detiene, se muestra lo confirmado y se exige actualizar bandeja; nunca se reintenta automáticamente. Tras éxito completo se vuelve a los grupos restantes.

Las consultas al resolvedor de alias se hacen una vez por descripción distinta, con máximo cuatro lecturas simultáneas. Un fallo del resolvedor bloquea la preparación: no se interpreta como «sin alias».

## Validación

- `TZ=America/Argentina/Buenos_Aires npm test`: **2.159 pruebas, 215 archivos, todas aprobadas**.
- `npx tsc --noEmit`: aprobado.
- ESLint sobre los archivos de lógica, componente de lote y tests editados: aprobado.
- Playwright `e2e/receipts/mp-batch.spec.ts`: **24 pruebas aprobadas**, seis recorridos en 320/390/768/1440 px.
- Recorridos: 30 alias → confirmar → siguiente categoría; corregir excepción y dejar otra pendiente; selección/categoría manual para inciertos; detención y refresh ante confirmación parcial; falla de referencias; alias no evita asignación de tarjeta faltante.
- Payloads probados conservan descripción por movimiento, fingerprint, tarjeta y cuotas; no envían importe ni fecha editables.
- Capturas reales en `artifacts/mp-20-review/`; datos sintéticos. Se verificó preview sin overflow horizontal y CTA visible en los cuatro tamaños. Consola sin errores en el recorrido principal.
- Build optimizado: compiló el código en 42 s, pero **falló la validación de páginas** por un error preexistente en `app/(dashboard)/expenses/page.tsx`: `expensesToMovimientosHref is not a valid Page export field`. El archivo es idéntico al commit base `5f205d6` (verificado con `git show` y diff vacío). No se cambió por estar fuera del alcance. El éxito del chequeo `tsc` previo al build no reemplaza este gate de Next.js.
- Comando de build: `GOTA_LOCAL_VERIFY=true NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack`, con fuentes locales mock y referencias Supabase ficticias. Sin carga de sourcemaps ni release remoto. Log en `artifacts/mp-20-review/build.log`.

La suite completa inicialmente detectó un test de fechas ajeno al cambio que depende de la zona horaria del host. Se ejecutó con zona Argentina y pasó sin modificar ese test ni su código.

## QA visual

Se mantuvieron tokens, DM Sans, TaskSurface y encabezado vigentes. La primera captura mostraba demasiados controles antes de los movimientos. Se compactó el encabezado del grupo y se plegaron búsqueda/selección y edición común. La segunda captura muestra una fila completa incluso en 320×568, con acción de revisión visible. En desktop conserva la geometría de sheet existente.

## Límites y siguiente paso

- No se verificó contra la cuenta real de MP, Supabase real ni un iPhone físico.
- Sin migraciones, configuración, cron, autopost ni escrituras en canon financiero.
- Las confirmaciones ya registradas se recuperan del servidor al refrescar. Los cambios de borrador aún no enviados son locales a la pantalla y no sobreviven al cerrarla.
- Las operaciones financieramente no confirmables siguen en la revisión individual existente; no se fuerza su registro desde el lote.
- Validar en staging con un entorno autorizado y revisar el cambio antes de publicar. Este handoff no autoriza publicación ni operaciones reales.

## Entrega

Código y evidencia en un commit local de `feat/mp-grouped-review`. Patch autocontenido generado con `git format-patch --binary` junto a la evidencia para traslado/revisión. No aplicar sobre un checkout con cambios concurrentes sin comparar antes contra el base.


## Preparación de despliegue — 27/10/2026

Facundo solicitó «Desplegarlo». Se corrigió el bloqueo de build moviendo, sin cambios de comportamiento, `expensesToMovimientosHref` y su tipo desde el módulo de página hacia `lib/expenses-redirect.ts`; la página solo exporta su componente y el test importa la utilidad.

Validación adicional: 19 tests relevantes aprobados; build de producción local completo aprobado con referencias ficticias y `GOTA_LOCAL_VERIFY=true`. Log en `artifacts/mp-20-review/build-deploy.log`.

Destino identificado: repo público `https://github.com/fortiz1422/Gota.git`; proyecto Vercel `gota` (`prj_nyZGQADbn6IWx28sJoEF54BfN6Ij`), equipo `facundos-projects-11ee7eb5` (`team_mOjC9aUBijmKyvVNyH1tSY7A`). El main remoto seguía en `5f205d6` al inspeccionar.

Bloqueos de publicación:
- El conector Vercel devuelve 403 al leer proyecto/deployments y requiere que el usuario habilite acceso al equipo mediante el enlace de consentimiento.
- Auto-review rechazó `git push -u origin feat/mp-grouped-review`: consideró insuficiente la autorización de despliegue para exportar código potencialmente sensible al remoto. No se eludió el rechazo ni se publicó con otro mecanismo. Se requiere autorización explícita del usuario para publicar estos cambios en el repo público indicado.
- No hay despliegue nuevo ni cambios en producción. No se tocó el sistema de alias ni datos financieros.
