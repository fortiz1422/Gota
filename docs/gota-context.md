# Gota — Context v2.0

**Versión:** 2.0 (Post-Interrogación) · actualizado post-MVP
**Fecha:** 3 Febrero 2026 · revisado Febrero 2026
**Status:** ✅ MVP Completo — decisiones confirmadas e implementadas

---

## RESUMEN EJECUTIVO

Este documento contiene el contexto completo, filosofía de producto y stack técnico de Gota.

**Cambios principales v1.0 → v2.0:**

- Saldo Vivo simplificado (eliminado "Comprometido" con rollforward)
- Multi-currency básico confirmado (análisis solo default_currency)
- Review-first SIEMPRE (ParsePreview mandatorio)
- Límites y validaciones específicas
- Auth solo Google OAuth
- Edición inline guarda al colapsar
- Navegación máximo 12 meses atrás

---

## 1. USER PROFILE

**Usuario primario:** Facundo (desarrollador fullstack, Argentina, ~30s)

**Context:**

- 3 tarjetas crédito: BBVA VISA, BBVA MÁSTER, BNA MASTER
- Dual currency: ARS (vida diaria) + USD (suscripciones/ahorro)
- Device principal: iPhone (mobile-first non-negotiable)
- Alta inflación Argentina → necesita visibilidad real de gastos

**Pain actual:**
Apps tradicionales = demasiada fricción → abandono en 2 semanas

**Solución Gota:**

1. Smart Input (1 campo) → registro en 5s
2. Saldo Vivo → validación objetiva vs banco
3. Filtro Estoico → awareness sin culpa

---

## 2. FILOSOFÍA DEL PRODUCTO

### Friction = 0

Cada paso extra = 50% abandono.

**Implementación:**

- 1 campo de texto (no formularios)
- AI parsea todo (no selección manual)
- Mobile-first absoluto

### Data Precision > Speed

**Quote literal:**

> "La categorización correcta es más importante que la velocidad. Si no confío en que los datos están bien, dejo de usar la app."

**Por eso:**

- ParsePreview SIEMPRE aparece
- Review-first > optimistic UI
- 2s latency acceptable si es correcto

### Simplicidad > Completeness

Si no uso la versión simple → no usaré la compleja.

**MVP agresivo:**

- NO cuotas (80% compras argentinas, pero 80 dev hours)
- NO offline-first
- NO OCR
- NO budgets, NO light mode

---

## 3. STACK TÉCNICO

### Frontend

- Next.js 16.1.6 (App Router) — **nota:** `middleware.ts` se llama `proxy.ts` en Next.js 16; la función exportada también se llama `proxy`
- React 19 + TypeScript
- Tailwind v4 — config via `@theme {}` en globals.css (no tailwind.config.ts)
- @tanstack/react-query (caché)
- Zod (validación)
- Lucide React (iconos)

### Backend

- Next.js API Routes
- Supabase PostgreSQL (São Paulo)
- Supabase Auth (Google OAuth only)
- RLS (Row Level Security)

### AI Parsing

- Google **gemini-2.5-flash-lite** (apiVersion: `v1`, NO `v1beta`)
- 100% gratuito: 15 RPM, 1500 req/día
- Latency ~1-3s
- **Sin** `responseMimeType` (no soportado en v1) — strip markdown del response manualmente

### Deployment

- Vercel (free tier: 100GB/mes)
- Auto-deploy on push to main
- PWA completa: manifest.json + sw.js + íconos PNG (192, 512, 180)

### Cost MVP

```
Vercel:     $0/mes
Supabase:   $0/mes
Gemini API: $0/mes
Total:      $0/mes 🎉
```

---

## 4. DECISIONES CRÍTICAS

### ✅ Review-First SIEMPRE

**Decisión:** ParsePreview aparece antes de guardar.

**Excepción:** Solo si `is_valid: false` → alert directo.

**Por qué:**

- Gemini precision ~85-90%
- Categorización incorrecta → abandono
- 2s validando < frustración corregir después

### ✅ Saldo Vivo Simplificado

**ANTES (rechazado):**

```
Comprometido: $150K
  BBVA VISA: $100K (cierra 15/02)
  BBVA MASTER: $50K (cierra 20/02)

→ Tracking qué se pagó
→ Rollforward automático
```

**AHORA (implementar):**

```
💳 Gastos con tarjeta este mes: $370.000
   (se pagarán en marzo)

→ Simple SUM de CREDIT
→ NO tracking
→ Puramente informativo
```

**Fórmula:**

```sql
SUM(expenses) WHERE:
  payment_method = 'CREDIT'
  AND month(date) = mes_actual
  AND category != 'Pago de Tarjetas'
  AND currency = default_currency
```

### ✅ Multi-Currency BÁSICO

**Scope:**

- ✅ Registrar ARS y USD
- ✅ Almacenar ambos
- ✅ Análisis solo default_currency
- ❌ NO conversión

**Ejemplo:**

```
default_currency = ARS

Dashboard muestra:
- Saldo Vivo: solo ARS
- Top 3: solo ARS
- Filtro Estoico: solo ARS
- Últimos 5: ambos (USD con badge)
```

### ✅ 21 Categorías

**Sweet spot:**

- <15: Muy genérico
- > 25: Decision fatigue
- 21: Cubre 95% casos argentinos

**Categoría especial: "Pago de Tarjetas"**

- ✅ Cuenta para Saldo Vivo
- ❌ NO Top 3
- ❌ NO Filtro Estoico
- ❌ NO is_want (NULL)

### ✅ Límites y Validaciones

**Confirmados:**

- Monto min: $1 (no centavos)
- Descripción max: 100 chars
- Gastos/día max: 50
- Navegación: 12 meses atrás
- Fechas futuras: permitidas con warning

**Duplicados:**

- Detección: mismo amount + category + date
- Badge: "⚠️ Posible duplicado"

### ✅ Edición Inline

**Campos editables:**

- ✅ Monto, Categoría, Medio, Tarjeta, Fecha, Need/Want
- ❌ Descripción (NO editable)

**Guardar:** Al colapsar (tap fuera), NO onChange.

**Por qué:**

- Evita spam API calls
- Batch changes en 1 request

### ✅ Navegación Períodos

**Límites:**

- ← 12 meses máximo (picker disabled)
- → Meses futuros OK (planning)

**Hint contextual:**

```
Viendo: ← Enero 2026
Smart Input: "ⓘ Se registrará en Feb 2026"
Gastos → van a Febrero (actual)
```

### ✅ Tarjetas Hardcoded

**Inicial (todos los usuarios):**

```json
[
  { "id": "bbva_visa", "name": "BBVA VISA" },
  { "id": "bbva_master", "name": "BBVA MÁSTER" },
  { "id": "bna_master", "name": "BNA MASTER" }
]
```

**Gestión:**

- Settings → Agregar (solo nombre)
- Eliminar con confirmación
- Archived si tiene histórico

**Fechas cierre:** NO en MVP.

### ✅ Auth: Solo Google OAuth

**NO email/password en MVP.**

**Por qué:**

- Simplifica onboarding
- 1-click login
- Sin validaciones/reset/etc

**Session:** Indefinida hasta logout.

---

## 5. UX DECISIONS

### Dashboard Integrado

**Layout:**

```
Header
Smart Input
─────────
Saldo Vivo
Gastos tarjeta
Filtro Estoico
Top 3 Categorías
Últimos 5
```

**~730px = 1.1 scrolls** en iPhone.

### ParsePreview: Vertical Stack

**Campos apilados:**

```
[Monto + Moneda toggle]
CATEGORÍA [dropdown]
MEDIO [dropdown]
FECHA [picker]
NECESIDAD/DESEO [toggle]

[Guardar]
[Cancelar]
```

**~500px altura** → cabe sin scroll.

### Gasto Expandido: Vertical Stack

**Mismo layout ParsePreview** + botón Eliminar.

**Guardar:** Al colapsar.

### Página /expenses

**Mobile:** Lista vertical

**Desktop:** Tabla

```
| Fecha | Categoría | Descripción | Medio | Monto |
```

**Paginación:** 20/página.

---

## 6. DATA MODEL

### Schema

**3 tablas:**

```sql
expenses (
  id, user_id, amount, currency,
  category, description, is_want,
  payment_method, card_id,
  date, created_at, updated_at
)

monthly_income (
  id, user_id, month,
  amount_ars, amount_usd,
  created_at, updated_at
)

user_config (
  user_id, default_currency, cards,
  created_at, updated_at
)
```

### RLS

**Habilitado en TODAS.**

```sql
WHERE auth.uid() = user_id
```

### Constraints

```sql
-- No pagar tarjeta con tarjeta
CHECK (
  category != 'Pago de Tarjetas'
  OR payment_method != 'CREDIT'
)

-- Tarjeta required cuando CREDIT
CHECK (
  (payment_method = 'CREDIT' AND card_id IS NOT NULL)
  OR ...
)
```

### Timezone

**Guardar con offset local:**

```sql
date: "2026-02-03T23:30:00-03:00"
```

**Parser "hoy":** Fecha local usuario.

### Ordenamiento

```sql
ORDER BY date DESC, created_at DESC
```

Crítico: Por `date` (no `created_at`).

---

## 7. GEMINI INTEGRATION

### Setup (configuración real en producción)

```typescript
// apiVersion: 'v1' es crítico — v1beta no tiene free tier
const model = genAI.getGenerativeModel(
  { model: 'gemini-2.5-flash-lite' },
  { apiVersion: 'v1' }
)

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  generationConfig: { temperature: 0.1 },
  // NO responseMimeType — no soportado en v1
})

// Strip markdown que Gemini agrega a veces
const raw = result.response.text()
const clean = raw
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/, '')
  .trim()
const validated = ParsedExpenseSchema.parse(JSON.parse(clean))
```

### Error Handling

- 429 → "Límite alcanzado. Espera 1min."
- Timeout → "Error al procesar. Intentá de nuevo."
- Invalid JSON → Zod catch → "Error validación."

---

## 8. PERFORMANCE

### React Query

```typescript
useQuery({
  queryKey: ['dashboard', currentMonth],
  queryFn: () => fetchDashboard(currentMonth),
  staleTime: 5 * 60 * 1000,
  cacheTime: 30 * 60 * 1000,
})
```

**Benefit:** Feb → Ene → Feb = instantáneo.

### Database

- 1 query grande gastos del mes
- Cálculos en React (Top 3, Filtro)

### PWA

```json
{
  "name": "Gota",
  "display": "standalone",
  "theme_color": "#38bdf8"
}
```

- Add to Home Screen: ✅
- Service worker: ✅ (sw.js implementado)
- Íconos: 192px, 512px, 180px (apple-touch-icon)
- Safe area (Dynamic Island): `.pt-safe` = `calc(env(safe-area-inset-top) + 1.5rem)`
- Probado en iPhone ✅

### Vercel Cron

```json
{
  "crons": [
    {
      "path": "/api/cron/keep-alive",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Ping diario → DB no pausa.

---

## 9. SUCCESS CRITERIA

### Primary (3 meses)

1. **Registration Rate:** >70% gastos reales
2. **Saldo Vivo Accuracy:** <5% diferencia vs banco
3. **Registration Time:** <5 segundos promedio
4. **Abandonment:** <5% en ParsePreview

### Qualitative

**Puedo responder en <10s:**

- "¿Qué gastaste este mes?"
- "¿Cuánto fue impulso?"
- **"¿Cuánto disponible tenés?"** ← NUEVO

**Con confianza** → MVP worked.

---

## 10. RED FLAGS

🚩 No usado después 2 semanas → problema no painful  
🚩 Saldo Vivo nunca matchea → modelo no funciona  
🚩 Más tiempo categorizando → parser falla  
🚩 Frustración review step → considerar optimistic

**Si 2+ flags → pivotar/cancelar.**

---

## 11. POST-MVP

### Out of Scope (sigue igual)

❌ Cuotas/installments
❌ Offline-first
❌ OCR tickets
❌ Light mode
❌ Email/password
❌ Bank integration
❌ Multi-user
❌ Push notifications

### Backlog priorizado (post-MVP)

**Alta prioridad:**
- Presupuesto por categoría — límite mensual + alerta al acercarse
- Tendencias mensuales — gráfico últimos 6 meses (dato ya disponible)

**Media prioridad:**
- Alerta límite diario — `check_daily_expense_limit()` existe en DB, falta UI
- Estados vacíos — dashboard sin gastos queda raro
- Skeletons de carga — feedback visual en fetching

**Técnico:**
- Tests — cero cobertura actualmente
- Rate limiting — especialmente en `/api/parse-expense`
- Error boundaries — si el RPC falla, dashboard explota silenciosamente

---

## 12. GLOSSARY

**Cash flow real:** CASH + DEBIT + TRANSFER (inmediato)

**Diferido:** CREDIT (no impacta hasta pago)

**Gastos con tarjeta:** SUM de CREDIT del mes (simplificado)

**Filtro Estoico:** Necesidad vs Deseo (awareness)

**ParsePreview:** Confirmación pre-save (review-first)

**Smart Input:** Campo texto + AI parsing

**Saldo Vivo:** Sistema validación vs banco

**Pago de Tarjetas:** Categoría especial para resúmenes

**Default currency:** Moneda principal análisis (ARS/USD)

---

**FIN DEL CONTEXT v2.0 FINAL**
