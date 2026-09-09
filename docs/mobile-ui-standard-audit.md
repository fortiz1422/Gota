# Gota Mobile UI Standard — auditoría e inventario

## Snapshot y alcance

- Fuente auditada: `origin/main` en `d1cc22f5479f3ef29f104b7fe917dc0f825398ba`.
- Worktree de trabajo: branch `feat/mobile-ui-standard-pilot`.
- El checkout principal no se usa porque está 92 commits atrás y contiene cambios locales.
- Alcance: producto Mobile, onboarding y superficies públicas/auth.
- Fuera de esta auditoría: `/web` y rutas `/ui-exploration`; Web requiere un programa propio aunque comparta tokens y primitives.

El snapshot base contiene 22 rutas `page.tsx`:

- 10 rutas de producto Mobile;
- 5 rutas públicas/auth;
- 1 onboarding con 6 pasos internos;
- 6 rutas Web o de exploración excluidas.

El barrido de overlays encontró:

- 26 componentes nombrados `*Sheet*`;
- 6 componentes nombrados `*Modal*`;
- 52 archivos TSX que consumen `Modal`, `FullScreenSheet`, drawers o sheets.

Los conteos son de inventario estático; no equivalen a 32 experiencias únicas porque algunas superficies se reutilizan desde varias rutas.

## Gramática objetivo

Cada superficie debe tener un rol dominante. No se estandariza haciendo que todas se vean como Guardar gasto.

1. **Task Surface** — crear, confirmar o editar una entidad con una acción principal.
2. **Choice Picker** — elegir una entidad o alternativa y volver al contexto anterior.
3. **Management Surface** — recorrer y administrar una colección estable.
4. **Filter Surface** — modificar el universo visible sin mutar datos financieros.
5. **Calculation Detail** — explicar una cifra mediante una cadena inspeccionable.
6. **Alert Dialog** — confirmar una acción peligrosa o una decisión irreversible.
7. **Workspace** — responder una pregunta recurrente de producto; puede componer varias superficies.
8. **Public / Setup** — adquisición, autenticación, onboarding y privacidad.

## Inventario por ruta

### `/` — Home

**Rol:** Workspace financiero principal.

Superficies relevantes:

- Smart Input y `ParsePreview`: Task Surface de carga/revisión.
- `SaldoVivoSheet` y `DisponibleRealSheet`: Calculation Detail.
- `SignalsSheet`: centro de atención y detalle.
- `IncomeModal`, `TransferForm`, `CardPaymentForm`: Task Surfaces.
- `CuentaSheet`, cuentas, tarjetas y suscripciones: Management secundario actualmente accesible desde Home.

**Diagnóstico:** es el grafo más complejo del producto (119 archivos transitivos en el barrido) y concentra overlays, FAB, tab bar, banners y navegación. No debe ser la primera ola. Se mantiene estable mientras se prueban primitives en superficies más aisladas.

### `/movimientos`

**Rol:** Workspace de ledger.

Superficies relevantes:

- `FiltroSheet`: Filter Surface.
- edición de gastos, ingresos y transferencias: Task Surface.
- alta de ingreso, transferencia, suscripción e instrumento: Task Surface.
- `CuotasEnCursoSheet`: Calculation/Detail.

**Diagnóstico:** buen owner para validar filas densas y filtros después de estabilizar Task Surface. Debe evitar una card por movimiento o por fecha.

### `/analytics`

**Rol:** Workspace con tres dominios: análisis, presupuestos y metas.

Superficies relevantes:

- `GoalCreateSheet`, `GoalEditSheet`: Task Surface.
- `GoalContributionSheet`, `GoalContributionEditSheet`, `LinkTransferToGoalSheet`: Task Surface con semántica financiera creciente.
- `GoalDetailSheet`: Calculation/Detail + Management.
- `BudgetEditorSheet`: Management/Task.
- `MonthSelectorSheet`: Choice Picker temporal.
- `GoalsSection`, `BudgetsSection`: Workspaces internos.

**Diagnóstico:** es el mejor lugar para probar el primer Task Surface, pero no para rediseñar el workspace completo en la misma entrega. Metas actuales no son una foto histórica: el selector de mes pertenece al workspace de Analytics y debe comunicar explícitamente ese desacople.

### `/settings`

**Rol:** índice de configuración con destinos de Management.

Superficies relevantes:

- cuentas, tarjetas y suscripciones;
- aliases de comercios;
- dispositivos/recepción compartida;
- moneda y modo de lectura;
- acceso, passkeys, privacidad y eliminación.

**Diagnóstico:** `origin/main` ya incorporó el patrón índice → detalle para cuentas y tarjetas. Suscripciones todavía abre un `Modal` legado. La ruta mezcla `FullScreenSheet` con adaptadores de modales anidados; requiere una ola específica de QA de foco, Escape, teclado y retorno.

### `/tarjetas/[cardId]`

**Rol:** Detail/Management financiero.

Superficies relevantes:

- resúmenes por período;
- edición de ciclo y campos de tarjeta;
- pago de resumen;
- detalle de consumos.

**Diagnóstico:** la captura histórica de Tarjetas no representa el `origin/main` auditado. La lista actual de Settings ya navega al detalle de tarjeta. Antes de rediseñar hay que reconciliar source, deployment y entrada exacta.

### `/instrumentos`

**Rol:** Management de instrumentos.

- listado de instrumentos;
- `InstrumentForm` como Task Surface.

**Diagnóstico:** candidato de segunda ola: menor complejidad de composición que Home/Analytics, pero los montos y tasas exigen QA financiero y de formato.

### `/instrumentos/[id]`

**Rol:** Calculation Detail + Management.

- rendimiento y estado;
- edición;
- cierre y renovación.

**Diagnóstico:** no aplicar un formulario gigante. Lectura primero; mutaciones en Task Surfaces separadas.

### `/shared-receipts/[id]`

**Rol:** Task Surface de revisión operativa.

- usa `SharedReceiptReview` y `ParsePreview`;
- puede confirmar información que impacta el canon financiero.

**Diagnóstico:** alta prioridad visual por frecuencia y confianza, pero posterior al piloto porque exige preservar evidencia, cola y confirmación fail-closed.

### `/share-target`

**Rol:** puente transitorio del sistema operativo hacia revisión.

**Diagnóstico:** no convertirlo en workspace. Debe comunicar progreso, recuperación y error, y entregar la revisión a la Task Surface canónica.

### `/expenses`

**Rol observado:** ledger histórico anterior.

No se encontraron enlaces internos directos a `/expenses`; la navegación canónica apunta a `/movimientos`.

**Decisión requerida:** confirmar compatibilidad/deep links y luego redirigir o retirar. No invertir una migración visual completa en una ruta heredada antes de resolver su ownership.

## Superficies públicas y setup

### `/onboarding`

Seis estados internos: bienvenida, moneda, cuenta, saldo, persistencia y finalización.

**Rol:** wizard transaccional resumible. Debe auditarse como flujo completo, no como seis páginas decorativas. La estandarización visual no puede alterar persistencia, Back/reload/retry ni creación idempotente de objetos financieros.

### `/login`, `/auth/create-password`, `/reset-password`

**Rol:** autenticación. Requieren una gramática pública común, errores visibles, teclado, fallback y foco. No deben heredar automáticamente el Blue Header Zone del producto autenticado.

### `/landing`

**Rol:** adquisición y prueba de producto. Programa visual separado; preservar narrativa y evidencia real.

### `/privacy`

**Rol:** documento/confianza. Priorizar lectura y navegación, no convertirlo en una colección de cards.

## Inconsistencias sistémicas verificadas

1. **Dos shells de overlay.** `components/ui/Modal.tsx` conserva un sheet legado de `85dvh`; `components/ui/FullScreenSheet.tsx` tiene foco, stacking, scroll lock y safe areas más robustos.
2. **Anidamiento no uniforme.** Settings adapta `Modal` mediante `NestedSettingsModalContext`, pero Analytics y otros owners pueden montar varios `Modal` hermanos/anidados sin el mismo contrato.
3. **La ubicación del CTA varía.** Acciones aparecen dentro del scroll, al final del modal o en footers fijos. En Mobile, una Task Surface debe reservar un footer alcanzable y no tapado por Tab Bar/FAB.
4. **Headers sin rol consistente.** Algunas vistas usan `BlueHeaderZone`, otras título simple dentro del modal y otras ninguna cabecera estructural.
5. **Formato monetario fragmentado.** Conviven inputs `type=number` sin formato y el helper canónico `lib/ar-input.ts`. Los Task Surfaces financieros deberían compartir entrada argentina sin cambiar payloads canónicos.
6. **Fecha dependiente del control nativo.** Los inputs `type=date` pueden mostrar orden/placeholder según navegador. Debe verificarse en iPhone/PWA antes de declarar consistencia regional.
7. **Cards en todos los niveles.** Home y Analytics acumulan containers anidados; listas y cadenas de cálculo necesitan filas, separadores y jerarquía, no card por objeto.
8. **Rutas heredadas.** `/expenses` parece no canónica frente a `/movimientos`; primero consolidar ownership, después migrar presentación.
9. **Source versus deployment.** La captura de Tarjetas no coincide con el código actual. Toda ola debe verificar fuente, build, deployment y runtime por separado.

## Orden de migración

### Ola 0 — Foundations y primer piloto

- `TaskSurface` canónico sobre `FullScreenSheet`.
- “Nueva meta” como primera implementación real.
- Pruebas de estructura, safe area, foco, scroll, error y footer.

Motivo: no impacta saldos, no está anidada y prueba un formulario real con monto, moneda, fecha y API existente.

### Ola 1 — Familia Task de bajo riesgo

- Editar meta, resolviendo primero el overlay sobre `GoalDetailSheet`.
- Crear/editar suscripción.
- InstrumentForm.
- Altas y ediciones de ingreso/transferencia que no requieran nueva semántica.

Objetivo: probar reutilización antes de extraer primitives de campos.

### Ola 2 — Management en Settings

- Suscripciones.
- Cuentas.
- Tarjetas, reconciliando deployment.
- Aliases, dispositivos, acceso y privacidad.

Objetivo: una geometría común de fila y navegación índice → detalle, con diferencias justificadas por comportamiento.

### Ola 3 — Movimientos y revisión

- Filtro canónico.
- Ledger y detalle.
- Shared receipts/ParsePreview.
- Choice Pickers de cuenta, tarjeta, categoría y fecha.

Objetivo: consolidar el ciclo buscar → revisar → corregir → confirmar.

### Ola 4 — Cálculos y compromisos

- Saldo Vivo.
- Disponible Real.
- Cuotas y resúmenes de tarjeta.
- Instrumentos detalle.
- Meta detalle/aportes.

Objetivo: una cadena financiera inspeccionable, sin repetir totals en cards.

### Ola 5 — Workspaces completos

- Metas y Presupuestos dentro de Analytics.
- Analytics principal.
- Movimientos completo.
- Home al final, preservando Saldo Vivo y Disponible Real.

Objetivo: recomponer pantallas grandes usando primitives ya validados; no experimentar con Home mientras cambia el sistema base.

### Ola 6 — Onboarding y superficies públicas

- onboarding completo con persistencia/reanudación;
- login, creación/reset de contraseña;
- privacy;
- landing como programa separado.

## Piloto implementado en esta branch

`components/analytics/GoalCreateSheet.tsx` ahora usa `components/ui/TaskSurface.tsx`.

El piloto conserva:

- endpoint `/api/goals`;
- nombres y estructura del payload;
- validaciones de nombre y monto;
- semántica de metas: registrar progreso no mueve dinero por sí solo.

El piloto agrega:

- header estructural con safe-area ownership;
- cuerpo scrollable independiente;
- CTA y Cancelar fijos;
- jerarquía de monto/moneda;
- formato visual argentino usando `lib/ar-input.ts`;
- error visible junto a la acción y limpieza al corregir campos;
- foco inicial controlado por `FullScreenSheet`.

La ruta de laboratorio `ui-exploration/mobile-task-pilot` importa el componente real y no debe usarse para mutaciones ni como evidencia de datos productivos.

## Segundo checkpoint implementado

La misma branch ya incorpora:

- `GoalEditSheet` sobre `TaskSurface`, incluyendo foco y retorno al detalle;
- `ManagementSurface` como contrato reutilizable de administración mobile;
- `SubscriptionsSubSheet` migrado a Management Surface;
- `SubscriptionBottomSheet` migrado a Task Surface;
- confirmación explícita de alcance ante el `409` existente;
- confirmación separada para archivar;
- payloads de alta/edición preservados mediante `lib/subscriptions/form-payload.ts` y pruebas de contrato.

El laboratorio `ui-exploration/mobile-subscriptions-pilot` usa fixtures sintéticas y un request adapter local. Valida Management → Task → Choice/Confirm sin escribir datos reales. El alta rápida de suscripciones desde Home (`components/subscriptions/SubscriptionSheet.tsx`) permanece fuera de este checkpoint para migrarla con el resto de los Task launchers de Home.

## Gates por ola

Cada migración debe demostrar:

1. payloads y handlers preservados;
2. tests del estado y contrato tocados;
3. lint y TypeScript enfocados;
4. suite completa y build antes de entregar rama;
5. QA a 393×852: vacío, cargado, error, long values, teclado, scroll y safe areas;
6. overlays anidados: foco inicial, Escape sólo del hijo, retorno al padre y luego al trigger;
7. Assistant/FAB y Tab Bar fuera de interacción mientras un full-screen sheet está abierto;
8. revisión visual de pantalla completa, no sólo primera viewport.