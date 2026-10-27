# Auditoría — Recepción de comprobantes (Shortcut / share-target → revisión)

**Fecha:** 2026-10-27  
**Alcance:** código en `main` al momento del PR; solo lectura, sin llamadas a Gemini ni datos de producción.  
**Fuera de alcance:** captura por SmartInput en Home (salvo el desvío del share-target PWA hacia `/api/parse-expense`).

---

## 1. Resumen ejecutivo (10 líneas)

El flujo **canónico** para comprobantes del iPhone es: Atajo iOS → `POST /api/shortcut/v1/receipts` → almacenamiento privado + fila `shared_receipts` → preanálisis opcional (`preanalyzeReceivedReceipt`) → bandeja `/shared-receipts` (lote o individual) → confirmación vía RPC `confirm_shared_receipt_purchase` con hash de idempotencia.  
El **share-target PWA** (`public/sw.js`, `/share-target`) guarda el archivo en Cache API + `localStorage` y en Home abre un modal que llama a **`/api/parse-expense`**, no al inbox de comprobantes; el enum `web_share_target` existe en esquema pero **no hay ingest** que lo use.  
La **configuración del Atajo** vive en Ajustes → sección **Conexiones** (`SharedReceiptDevicesPanel`): credencial de un solo uso, enlace iCloud si `NEXT_PUBLIC_IOS_SHORTCUT_INSTALL_URL` está definido, receta en `docs/ios-shortcut-shared-receipts.md`.  
**Descubrimiento en Home** de comprobantes subidos por Atajo depende de `FF_SIGNALS_CENTER_V1` (opt-in por env); sin la flag no hay campana ni tarjeta de bandeja en el dashboard.  
**Extracción** usa Gemini (`generateUniversalReceiptProposal`) solo si `canUsePaidAI`; si no, el comprobante puede quedar en `received` hasta un análisis manual en la bandeja (mismo gate).  
**Revisión en lote** prepara hasta 20 ítems, analiza en serie con ~13 s entre llamadas, bloquea confirmación con reglas fail-closed (moneda ARS/USD, operación completada, duplicados vía `expenses`, memoria de comercio con reintento persistido — MODO-04).  
**Errores parciales** en confirmación masiva devuelven `results` por fila; alias fallido conserva `pending_merchant_memory` y UI de “Reintentar solo el alias”.  
**Tests** abundan en `lib/shared-receipts/*.test.ts` y Playwright con APIs simuladas; **no hay e2e** del endpoint Shortcut ni recorrido real iPhone (abierto en ROADMAP como MODO-03).  
**Gaps prioritarios:** dos pipelines de recepción (PWA vs Atajo), visibilidad en Home sin Signals, vencimiento a 7 días sin aviso en UI, Atajo sin rama `rate_limited`, deduplicación solo contra gastos ya cargados (no MP/MODO — MODO-06).

---

## 2. Mapa del flujo (referencia)

```mermaid
flowchart LR
  subgraph ios [iPhone Atajo]
    SS[Share Sheet imagen]
    SC[POST shortcut/v1/receipts]
  end
  subgraph pwa [PWA share-target]
    SW[sw.js POST /share-target]
    ST[/share-target + localStorage]
    PE[/api/parse-expense]
  end
  subgraph server [Backend]
    SR[(shared_receipts + storage)]
    PA[preanalyze / analyze]
    CF[confirm RPC]
  end
  subgraph ui [App]
    SIG[Campana Signals]
    BAT[/shared-receipts lote]
    IND[/shared-receipts/:id]
  end
  SS --> SC --> SR
  SW --> ST --> PE
  SR --> PA --> BAT
  SR --> PA --> IND
  BAT --> CF
  IND --> CF
  SIG --> BAT
```

---

## 3. Contraste con ROADMAP

| ID ROADMAP | Estado en repo | Relación con esta auditoría |
|---|---|---|
| **MODO-03** | Ideas (P0) | Sigue abierto: no hay validación documentada con Atajo + comprobantes reales ni reintentos/errores parciales en dispositivo; el código soporta el recorrido pero CI usa fixtures. |
| **MODO-04** | Listo (#150) | **Cubierto:** columna `pending_merchant_memory`, PUT/DELETE en API, hidratación en lote y botón “Reintentar solo el alias”. |
| **MODO-05** | Ideas (P1) | **No cubierto:** no hay métricas de tasa de revisión evitada, correcciones ni errores críticos del lote en código de producto. |
| **MODO-06** | Ideas (P1) | **Parcial:** duplicados en lote consultan `expenses` (y montos de cuotas); no hay candidatos entre MP, MODO importado y extractos. |
| **MODO-07** | Listo (#158) | **Cubierto:** campana → `/shared-receipts`, revisión sin depender de abrir imagen primero, renovación de URL firmada al ampliar. |
| **PR 145** | Listo | **Cubierto:** lote, reintento de alias, errores parciales en confirmación (comportamiento verificado en `bulk-confirmation` + UI). |

---

## 4. Tabla de hallazgos

Ordenada por impacto al usuario. Severidad: P0 = riesgo financiero o pérdida silenciosa de comprobante; P1 = fricción fuerte o feedback roto; P2 = deuda o pulido.

| ID | Sev. | Evidencia | Impacto para el usuario | ROADMAP |
|---|---|---|---|---|
| **REC-01** | P0 | `components/share-target/SharedReceiptPreviewModal.tsx:146-151` (fetch `/api/parse-expense`); `lib/shortcut-receipts/ingest.ts:170` (`source_kind: 'ios_shortcut'` único); `types/database.ts:110` (`web_share_target` sin writer) | Compartir desde Android/desktop PWA **no** entra a la bandeja ni deduplica por hash; el usuario cree que “Gota recibió el comprobante” pero es una carga manual paralela. | **Nuevo** |
| **REC-02** | P1 | `lib/flags.ts:30-31` (`FF_SIGNALS_CENTER_V1` solo con env); `components/dashboard/DashboardShell.tsx:245-252,595` (inbox solo si flag); `lib/shared-receipts-signals.test.ts:101-109` (sin `SharedReceiptsInboxCard` en Home) | Tras subir por Atajo, quien no tiene Signals activo **no ve** campana ni tarjeta de comprobantes; debe recordar `/shared-receipts` o Ajustes. | **Nuevo** |
| **REC-03** | P1 | `lib/paid-ai-policy.ts:6-15,18-19`; `lib/shared-receipts/preanalyze.ts:20-26`; `app/api/shared-receipts/[id]/analyze/route.ts:20-21` | Cuentas fuera de allowlist: preanálisis no corre y el análisis devuelve 403; comprobantes quedan en `received` con bloqueo “Comprobante no preparado” hasta entender el mensaje genérico de la bandeja. | **Nuevo** (relacionado política IA) |
| **REC-04** | P1 | `docs/supabase-shared-receipts.sql:93` (`expires_at` +7 días); `app/api/cron/shared-receipts/route.ts:17-24`; ausencia de `expires_at` en UI (`components/shared-receipts/*`) | Comprobantes no confirmados **expiran** y pierden imagen sin aviso previo en bandeja o Home. | **Nuevo** |
| **REC-05** | P1 | `app/api/shortcut/v1/receipts/route.ts:61-65`; `lib/shortcut-receipts/response.ts:4`; `docs/ios-shortcut-shared-receipts.md:47-52` y `docs/shortcuts/gota-receipt-import.manifest.json:80-86` (sin rama `rate_limited`) | Al superar 20 uploads / 10 min el Atajo recibe 429 y cae en alerta genérica “No pudimos enviar…”. | **Nuevo** |
| **REC-06** | P1 | `docs/ios-shortcut-shared-receipts.md:50` (“Gota > Integraciones”); `components/settings/SettingsPreferences.tsx:141-144` (sección “Conexiones”) | Mensaje del Atajo no coincide con la UI; fricción al renovar token. | **Nuevo** |
| **REC-07** | P1 | — | Recorrido Shortcut real no certificado en CI ni en esta auditoría (solo APIs sintéticas / Facundo). | **MODO-03** (ya en Ideas) |
| **REC-08** | P1 | `lib/shared-receipts/bulk-review.ts:244-251` (`duplicates` bloquea si ≠ `clear`); `app/api/shared-receipts/bulk-confirm/route.ts:74-80` (`hasDuplicate` solo tabla `expenses`) | Posible duplicado solo contra gastos ya guardados; no alerta candidatos MP/MODO; dos gastos legítimos iguales siguen bloqueando lote. | **MODO-06** (parcial) |
| **REC-09** | P2 | `lib/shared-receipts/bulk-review.ts:12-13`; `components/shared-receipts/SharedReceiptBatchReview.tsx:245-258` | Hasta 20 comprobantes nuevos: ~4+ min de “Leyendo los pendientes…” en el celular antes de poder confirmar todos. | **Nuevo** |
| **REC-10** | P2 | `components/share-target/ShareTargetBridge.tsx:77-78` (copy “Share target”); `public/sw.js:24-27` (acepta cualquier `File`, sin `image/`) | Texto en inglés y share sin validación de tipo en SW; archivos no imagen llevan a modal con error tardío. | **Nuevo** |
| **REC-11** | P2 | `components/shared-receipts/SharedReceiptReview.tsx:299` (`window.confirm` descartar); `SharedReceiptBatchReview.tsx:1134-1136` (confirm recargar tanda) | Patrones poco amigables en móvil y accesibilidad limitada frente a `ConfirmationSurface` usado en Ajustes. | **Nuevo** |
| **REC-12** | P2 | `e2e/receipts/*.spec.ts` (mocks); ausencia de tests e2e a `app/api/shortcut/v1/receipts/route.ts` | Regresiones en ingest/auth/rate-limit del Atajo no las atrapa Playwright actual. | **Nuevo** (complementa MODO-03) |

---

## 5. Ítems nuevos propuestos (máx. 12, por impacto)

Ítems que **no** están ya formulados en ROADMAP (MODO-03/05/06 se citan aparte).

### REC-01 — Unificar share-target PWA con inbox `shared_receipts`

**Por qué:** Hoy hay dos semantics de “comprobante recibido” (gasto directo vs bandeja con idempotencia).

**Criterios de listo (testeables):**

1. Compartir imagen vía PWA crea fila `shared_receipts` con `source_kind = web_share_target` y aparece en `/api/shared-receipts` sin confirmar movimiento.
2. Mismo `content_sha256` devuelve `duplicate` y no duplica fila.
3. Playwright o contrato de ruta cubre POST de ingest web equivalente al Shortcut.

**Tamaño:** L · **¿Toca finanzas/datos?** Sí (persistencia, idempotencia, storage).

---

### REC-02 — Descubrimiento de bandeja sin depender solo de Signals

**Por qué:** Con `FF_SIGNALS_CENTER_V1` apagado no hay superficie en Home para comprobantes del Atajo.

**Criterios de listo:**

1. Usuario con ≥1 comprobante pendiente ve CTA claro en Home (tarjeta o módulo) aunque Signals esté off.
2. Test de regresión actualiza `lib/shared-receipts-signals.test.ts` con el comportamiento elegido.
3. El CTA no implica confirmación automática.

**Tamaño:** M · **¿Toca finanzas/datos?** No.

---

### REC-03 — Feedback explícito cuando la IA de comprobantes no está habilitada

**Por qué:** Fail-closed correcto en backend, pero la bandeja no explica por qué el estado queda en `received`.

**Criterios de listo:**

1. Fila en lote con `received` + usuario sin `canUsePaidAI` muestra mensaje accionable (p. ej. cargar manual o contacto), no solo “Comprobante no preparado”.
2. `POST /analyze` 403 se refleja en UI de individual con el mismo copy.
3. Test de componente o ruta con usuario mock sin allowlist.

**Tamaño:** S · **¿Toca finanzas/datos?** No (solo UX; política IA sin cambio salvo decisión explícita).

---

### REC-04 — Aviso de vencimiento de comprobantes pendientes

**Por qué:** `expires_at` a 7 días y cron `expired` borran evidencia sin copy en producto.

**Criterios de listo:**

1. Bandeja muestra fecha límite o “vence en X días” usando `expires_at` del listado.
2. Comprobante a &lt;48 h del vencimiento muestra severidad visual (warning).
3. Test con fixture de `expires_at` próximo.

**Tamaño:** S · **¿Toca finanzas/datos?** No (lectura de campo existente).

---

### REC-05 — Atajo iOS: rama `rate_limited` (429)

**Por qué:** El backend ya devuelve `rate_limited`; el Atajo no lo distingue.

**Criterios de listo:**

1. Manifiesto y `docs/ios-shortcut-shared-receipts.md` documentan HTTP 429 + mensaje usuario.
2. Receta Shortcuts muestra alerta específica (“demasiados envíos, esperá…”).
3. Test de contrato en `lib/shortcut-receipts/response.test.ts` ya cubre copy; checklist de publicación actualizado.

**Tamaño:** S · **¿Toca finanzas/datos?** No.

---

### REC-06 — Alinear copy Atajo ↔ Ajustes (“Conexiones”)

**Por qué:** Reduce errores al rotar token.

**Criterios de listo:**

1. Mensaje `unauthorized` del Atajo apunta a “Ajustes → Conexiones → Dispositivos”.
2. Misma cadena en `errorMessages.unauthorized` si aplica.
3. Revisión de strings en manifest sin secretos.

**Tamaño:** S · **¿Toca finanzas/datos?** No.

---

### REC-09 — Reducir fricción de preparación en lote (20 × 13 s)

**Por qué:** Muchos toques y espera en celular antes de confirmar tanda completa.

**Criterios de listo:**

1. Documentar o ajustar política de rate-limit (p. ej. paralelismo acotado o reutilizar `needs_review` ya preanalizado) sin superar presupuesto Gemini acordado.
2. Usuario con 5 comprobantes `received` los ve en `needs_review` en &lt;60 s en entorno de prueba con IA habilitada.
3. No se duplica análisis (CAS `received` → `parsing` intacto).

**Tamaño:** M · **¿Toca finanzas/datos?** No (IA/infra).

---

### REC-10 — Share-target: i18n y validación de tipo en SW

**Por qué:** Accesibilidad y menos callejones sin salida.

**Criterios de listo:**

1. `ShareTargetBridge` sin strings “Share target” en inglés.
2. `handleShareTarget` rechaza no-imagen con redirect y mensaje en español.
3. Test unitario o de SW para MIME no imagen.

**Tamaño:** S · **¿Toca finanzas/datos?** No.

---

### REC-11 — Reemplazar `window.confirm` en flujos de comprobantes

**Por qué:** Consistencia con design system y mejor foco/teclado en móvil.

**Criterios de listo:**

1. Descartar comprobante individual usa `ConfirmationSurface` (o equivalente) con foco atrapado.
2. Recargar tanda en lote usa el mismo patrón.
3. Playwright existente de receipts sigue verde.

**Tamaño:** S · **¿Toca finanzas/datos?** No.

---

### REC-12 — E2E/contrato del ingest Shortcut

**Por qué:** Complementa MODO-03 con automatización mínima del servidor.

**Criterios de listo:**

1. Test de integración contra `createReceiptIngestHandler` o ruta con token fixture: accepted, duplicate, 401, 413, 429.
2. CI ejecuta el test sin iPhone.
3. No se almacenan secretos en repo.

**Tamaño:** M · **¿Toca finanzas/datos?** Sí (ingest y storage mockeado).

---

### Referencia ROADMAP (no duplicar como ítems nuevos)

- **MODO-03:** Ejecutar recorrido real Shortcut → bandeja → confirmación con comprobantes reales y errores parciales (acción Facundo + evidencia).
- **MODO-05:** Instrumentar métricas de revisión evitada / correcciones / fallos críticos del lote.
- **MODO-06:** Extender candidatos de duplicado a MP, MODO, manual y extractos sin fusión automática.

---

## 6. Cobertura de tests (deuda)

| Área | Cobertura observada | Hueco |
|---|---|---|
| Dominio lote / confirmación / alias | `lib/shared-receipts/bulk-*.test.ts`, `operations.test.ts`, `pending-merchant-memory*.test.ts` | — |
| Preanálisis post-ingest | `preanalyze.test.ts` | Sin prueba de extremo a extremo con storage real |
| Shortcut HTTP | `lib/shortcut-receipts/*.test.ts`, `backend-contract.test.ts` | Sin e2e Playwright al route handler |
| Share-target PWA | `lib/share-target.test.ts` | Sin prueba del modal → parse-expense vs bandeja |
| UI lote / individual | `e2e/receipts/batch.spec.ts`, `receipt-opening.spec.ts` | APIs mockeadas; viewports 320–1440 según `docs/receipt-bulk-review.md` |

---

## 7. Reglas financieras (verificación rápida)

| Regla | Evidencia |
|---|---|
| Fail-closed moneda | `lib/shared-receipts/bulk-review.ts:185-186` rechaza moneda distinta de ARS/USD o ausente. |
| Sin confirmación sin usuario | Shortcut solo ingesta (`ingest.ts:178-182`); confirmación vía `confirmSharedPurchase` + RPC. |
| Idempotencia por comprobante | `docs/supabase-shared-receipts.sql:96` `unique (user_id, content_sha256)`; `operations.ts:132-139` hash de payload en confirmación. |
| Duplicados conservadores | `bulk-confirmation.ts:153-158` bloquea lote; no fusiona. |
| ARS/USD no mezclados en propuesta | `lib/shared-receipts-ui.ts:323` fuerza USD o ARS en propuesta de compra. |

---

*Fin del informe. No se modificó `ROADMAP.md` ni código de producto.*
