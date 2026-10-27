# Auditoría UI/UX mobile (390 px) — Octubre 2026

**Alcance:** carga de gasto/ingreso, movimientos, tarjetas/cuotas, cuentas, onboarding/start, configuración, conciliación, bandeja de comprobantes y Mercado Pago.  
**Método:** lectura de `Agents.md`, `ROADMAP.md`, `FEATURES.md`, `DESIGN.md`, `CONVENTIONS.md`, `docs/gota-design-system.md` (histórico/DNU), `docs/design-system-final.md`, `docs/forms-consistency-followup-2026-10-18.md`; revisión de `app/(dashboard)` y `components/`; contratos en `e2e/forms/consistency.spec.ts` y tests de superficies móviles.  
**Límite:** no hubo `.env.local` en el entorno del agente; no se levantó la app con datos reales. Evidencia = referencias `archivo:línea` salvo donde se indique explícitamente.  
**ROADMAP:** hallazgos mapeados a G09 (onboarding), G10 (consistencia visual/formularios), G11 (datos viejos/errores silenciosos). No se modificó `ROADMAP.md` ni código de producto.

## Resumen (10 líneas)

1. Los flujos canónicos mobile (Home + SmartInput, `/movimientos`, Ajustes con superficie R, MP y comprobantes en lote) siguen el design system light S5 en código; la deuda visible es sobre todo **errores con `alert()`/`confirm()` nativos** y rutas legacy.
2. **G11:** en Movimientos, un fallo de `/api/movimientos` deja la lista anterior sin aviso ni reintento (`MovimientosClient.tsx:211-213`), riesgo de saldos/listas desactualizados tras cambiar mes o filtros.
3. **G10:** el design system pide no agregar `alert()` nuevos y migrar formularios (`design-system-final.md` §A); persisten `alert()` en Configuración, instrumentos, modales de Home y en la ruta legacy `/expenses`.
4. La ruta **`/expenses`** sigue titulándose «Movimientos» y reutiliza ítems con UX inferior al listado canónico (`/movimientos` + sheets de edición).
5. En Movimientos, el header azul muestra **solo el nombre del mes** (sin año), lo que ambigüa períodos distintos al navegar (`MovimientosClient.tsx:351`).
6. Varias acciones táctiles clave usan **32–36 px** (mes/filtros en Movimientos, volver en Tarjetas, borrar ingreso en `/expenses`) por debajo del patrón 44 px de Ajustes.
7. Copy rioplatense inconsistente: imperativos sin tilde («Proba», «Queres», «Aun») y mezcla vos/tú («Intenta») en captura y edición de gastos.
8. Onboarding (`AccountSetup`) explica bien saldo inicial vs ingreso (alineado a **G09**); `/start` tiene error y reintento explícitos.
9. Conciliación y bandeja de comprobantes muestran mejor manejo de carga/error/reintento que Movimientos; MP review usa `TaskSurface`/`ConfirmationSurface`.
10. Prioridad sugerida: errores silenciosos y `alert()` en flujos frecuentes (P1), luego período ambiguo y táctiles; copy/ortografía como arreglos chicos (S).

## Tabla de hallazgos

| ID | Sev. | Pantalla / flujo | Evidencia | Impacto | ROADMAP |
|---|---|---|---|---|---|
| UX-01 | P1 | Movimientos — cambio de mes/filtros | `components/movimientos/MovimientosClient.tsx:196-213` (`catch` vacío) | Tras error de red, el usuario ve datos viejos como si fueran actuales | G11 |
| UX-02 | P1 | Home / Ajustes / tarjetas — errores de guardado | `components/settings/CurrencySection.tsx:24`; `components/dashboard/CuotasEnCursoSheet.tsx:70`; `components/instruments/InstrumentoDetailClient.tsx:150,177,200`; `components/subscriptions/SubscriptionSheet.tsx:83` | `alert()` bloquea la UI, sin contexto ni recuperación; contradice `design-system-final.md` §A y follow-up de formularios | G10 |
| UX-03 | P1 | Legacy `/expenses` | `app/(dashboard)/expenses/page.tsx:128` (título «Movimientos»); `components/expenses/IncomeItem.tsx:27,37`; `components/expenses/TransferItem.tsx:27,37` | Enlaces viejos o bookmarks llevan a lista duplicada con `confirm`/`alert` y botón × chico para borrar | G10 |
| UX-04 | P1 | Movimientos — período en header | `components/movimientos/MovimientosClient.tsx:350-351` (`split(' ')[0]`) | En meses de otro año solo se lee «marzo»/«abril»; riesgo de confundir totales del strip | G10 |
| UX-05 | P2 | Movimientos — navegación y filtros | `components/movimientos/MovimientosClient.tsx:344,356,425` (`h-8 w-8`) | Área táctil ~32 px en controles de alto uso (contraste: `MobileSettings.module.css:25` exige 44 px) | G10 |
| UX-06 | P2 | Tarjetas — listado | `app/(dashboard)/tarjetas/TarjetasClient.tsx:20-22` (solo ícono, sin `min-h-11`) | Volver es difícil de tocar con precisión en 390 px | G10 |
| UX-07 | P2 | Tarjetas — detalle, revertir pago | `app/(dashboard)/tarjetas/[cardId]/CardDetailClient.tsx:488,498-505` | Texto sin tildes («Queres», «eliminara»); botones de confirmación con `py-1.5` (~área chica) | G10 |
| UX-08 | P2 | Movimientos — strip operativo | `components/movimientos/StripOperativo.tsx:72` («Aun sin pagar») | Ortografía y tono rioplatense inconsistentes con el resto de la app | G10 |
| UX-09 | P2 | Home — SmartInput | `components/dashboard/SmartInput.tsx:129,136` («Proba», «cafe») | Mensaje de error principal de captura sin norma rioplatense | G10 |
| UX-10 | P2 | Home — confirmación de gasto | `components/dashboard/ParsePreview.tsx:353` («Intenta de nuevo») | Mezcla tuteo con voseo usado en el mismo flujo (`Intentá` en `:293`) | G10 |
| UX-11 | P2 | Gastos — edición de cuotas | `components/expenses/ExpenseItem.tsx:433,468-469` («descripcion», «operacion», «Podes») | Microcopy técnico y sin tildes en un mensaje de restricción importante | G10 |
| UX-12 | P2 | Instrumentos — alta desde Home | `components/instruments/InstrumentForm.tsx:68,84` (`Modal` + `alert`) | Patrón visual distinto a ingreso/transferencia (`TaskSurface`); error no inline | G10 |
| UX-13 | P2 | Comprobantes — lote | `components/shared-receipts/SharedReceiptBatchReview.tsx:1134-1137` (`window.confirm`) | Confirmación nativa rompe consistencia con `ConfirmationSurface` usada en MP y Ajustes | G10 |
| UX-14 | P2 | Ajustes — comercios memorizados | `components/settings/CounterpartyAliasesPanel.tsx:324` (`X size={12}`) | Eliminar alias es un target visual muy chico junto a chips | G10 |
| UX-15 | P2 | Movimientos — resumen con filtros | `components/movimientos/MovimientosClient.tsx:451-454` | Muestra monto filtrado sin etiqueta («Total» / moneda / qué incluye); puede leerse como saldo de cuenta | G10 |

**Nota G09:** `components/onboarding/AccountSetup.tsx:245-286` y `components/settings/AccountBottomSheet.tsx:319` comunican saldo inicial vs movimientos; no se registró hallazgo P0/P1 de conversión saldo→ingreso en UI. Validación en dispositivo real sigue en criterios de G09.

**Nota G03:** conciliación depende de flags (`ROADMAP` G03-G); `ReconciliationFlow.tsx:227-237` ya ofrece error + reintento cuando la ruta está habilitada.

---

## Propuestas (máx. 15, por impacto)

### Cambios de comportamiento

#### UX-01 — Error visible al cargar Movimientos
**Por qué:** Un fetch fallido no debe mostrar datos obsoletos sin aviso (G11).  
**Listo cuando:** (1) Si `/api/movimientos` falla, se muestra mensaje inline o banner con «Reintentar». (2) La lista previa no se presenta como actualizada (vacío o estado de error explícito). (3) Test o spec que simule `!res.ok` y assert de UI.  
**Tamaño:** M

#### UX-02 — Reemplazar `alert()` en flujos frecuentes de guardado
**Por qué:** Alineación con G10 y `docs/forms-consistency-followup-2026-10-18.md` (errores inline).  
**Listo cuando:** (1) Moneda, cuotas en curso, suscripción sheet e instrumentos muestran `InlineError` o equivalente sin `alert()`. (2) `lib/settings-surface-contract.test.ts` / mobile surface tests siguen verdes. (3) Revisión manual en 390 px de al menos un fallo forzado por API.  
**Tamaño:** M

#### UX-03 — Retirar o redirigir `/expenses` al listado canónico
**Por qué:** Duplica «Movimientos» con peor UX y patrones ya excluidos del baseline de formularios.  
**Listo cuando:** (1) `GET /expenses` redirige a `/movimientos` preservando query útil **o** la página se elimina y tests actualizados. (2) No quedan `confirm`/`alert` en componentes solo usados por esa ruta. (3) `lib/web-panel/navigation.ts` sigue mapeando la ruta si aplica en desktop.  
**Tamaño:** M

#### UX-04 — Período completo en header de Movimientos
**Por qué:** Evita ambigüedad de año al navegar meses (G10).  
**Listo cuando:** (1) El header muestra mes y año (p. ej. «Marzo 2026») o abreviatura clara en 390 px sin overflow. (2) Captura o test visual a 320/390 px.  
**Tamaño:** S

#### UX-13 — Confirmación de sistema en «Actualizar estados» (comprobantes)
**Por qué:** Misma familia de interacción que MP/Ajustes (`ConfirmationSurface`).  
**Listo cuando:** (1) `window.confirm` reemplazado por superficie de confirmación accesible. (2) Foco y Escape cierran sin perder datos si el usuario cancela.  
**Tamaño:** S

#### UX-12 — Instrumentos: superficie de formulario alineada
**Por qué:** Alta desde el + de Home debería sentirse como ingreso/transferencia (G10).  
**Listo cuando:** (1) Alta usa `TaskSurface` o patrón blue-hero/R según §A del design system. (2) Errores inline; sin `alert()`. (3) `e2e/forms/consistency.spec.ts` incluye o documenta exclusión explícita si queda fuera de alcance.  
**Tamaño:** L

#### UX-15 — Etiquetar el monto del resumen filtrado
**Por qué:** Reduce lectura errónea del número como saldo vivo (G10/G11).  
**Listo cuando:** (1) Junto al monto aparece texto fijo («Total filtrado» + moneda). (2) Con filtro «Percibidos»/tarjeta, el copy coincide con la definición del strip.  
**Tamaño:** S

### Arreglos directos (estilo / copy / táctil sin cambiar reglas de negocio)

#### UX-05 — Táctiles 44 px en nav/filtros de Movimientos
**Por qué:** Consistencia con Ajustes y menos toques fallidos.  
**Listo cuando:** (1) Botones mes anterior/siguiente y embudo usan `min-h-11 min-w-11` (o padding equivalente). (2) Sin regresión visual en 320 px.  
**Tamaño:** S

#### UX-06 — Target de «Volver» en listado de Tarjetas
**Por qué:** Control de navegación principal sin área mínima.  
**Listo cuando:** (1) Botón con `min-h-11 min-w-11` y `aria-label` conservado.  
**Tamaño:** S

#### UX-07 — Ortografía y táctiles en revertir pago de tarjeta
**Por qué:** Copy rioplatense y confirmación destructiva legibles.  
**Listo cuando:** (1) Texto «¿Querés revertir…?» / «Se eliminará…». (2) Botones Cancelar/Confirmar con altura mínima 44 px.  
**Tamaño:** S

#### UX-08 — «Aún sin pagar» en strip de Tarjeta
**Por qué:** Ortografía estándar.  
**Listo cuando:** (1) String actualizado en `StripOperativo.tsx:72`.  
**Tamaño:** S

#### UX-09 — Mensajes de SmartInput en voseo
**Por qué:** Primer contacto con captura de gasto.  
**Listo cuando:** (1) «Probá con algo como "café 2500"» en ambas ramas de error.  
**Tamaño:** S

#### UX-10 — Voseo en ParsePreview
**Por qué:** Consistencia en el mismo sheet de confirmación.  
**Listo cuando:** (1) «Intentá de nuevo» en `ParsePreview.tsx:353`.  
**Tamaño:** S

#### UX-11 — Tildes en copy de cuotas (ExpenseItem)
**Por qué:** Claridad en restricción de edición.  
**Listo cuando:** (1) «descripción», «operación», «Podés» en líneas citadas.  
**Tamaño:** S

#### UX-14 — Target de eliminar alias en comercios
**Por qué:** Acción destructiva en chip pequeño.  
**Listo cuando:** (1) Botón con padding mínimo 44×44 o hit area invisible expandida; ícono puede seguir siendo 12 px.  
**Tamaño:** S

---

## Referencias consultadas

- Design system vigente: `docs/design-system-final.md`, tokens `app/globals.css`
- Histórico (no decisión visual): `docs/gota-design-system.md`
- Formularios: `docs/forms-consistency-followup-2026-10-18.md`, PR 141/143 en `ROADMAP.md`
- Convención `alert()` en producto: `CONVENTIONS.md` (patrón documentado como deuda)
