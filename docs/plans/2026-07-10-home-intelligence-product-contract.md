# Contrato de producto — Home inteligente (control room)

Fecha: 2026-07-10 · Estado: vigente para Release B
Referencias: `docs/design-system-final.md`, `docs/gota-intelligence-overview.md`,
`lib/intelligence/home-brief.ts`, `components/dashboard/DashboardShell.tsx`

Este documento congela qué responde el Home, la semántica de cada métrica,
los estados permitidos y la prioridad de módulos, **antes** de diseñar píxeles.
Cualquier variante visual (sketches 003) debe poder mapearse 1:1 a este
contrato sin reinterpretarlo.

---

## 1. Jerarquía financiera (semántica congelada)

```text
Saldo Vivo            = plata viva actual / posición financiera (único héroe)
Disponible Real       = Saldo Vivo neto de deuda de tarjeta
                        (resúmenes pendientes + ciclo en curso)
Libre                 = Disponible Real neto de metas comprometidas
Margen hasta fin de mes = Disponible Real neto de metas y de débitos
                        directos restantes del mes
Ritmo observado       = gasto real observado por día transcurrido
Margen diario permitido = margen restante / días restantes (incluye hoy)
```

Reglas de nomenclatura:

- El margen diario permitido **no se llama "Ritmo del mes"**: ritmo es lo
  observado; margen es lo permitido. Mezclarlos fue el error de la iteración
  anterior.
- Un débito que vence **hoy** sigue siendo salida del mes en curso
  (regla inclusiva, `lib/intelligence/features.ts:nextSubscriptionDate`).
- La deuda de tarjeta ya está descontada en Disponible Real: ningún módulo
  puede volver a restarla (doble descuento).
- Los gastos marcados extraordinarios se excluyen de todo baseline histórico
  (ritmo, promedios por categoría, comparativas same-day), pero sí aparecen
  en los totales factuales del mes.

## 2. Preguntas del Home, en orden

```text
1. ¿Qué tengo ahora?            → Saldo Vivo (héroe)
2. ¿Qué puedo usar de verdad?   → Disponible Real (subhéroe permanente)
3. ¿Estoy cubierto?             → Lectura de hoy (estado calm/watch/risk)
4. ¿Qué necesita atención hoy?  → Lectura de hoy + slot de acción contextual
5. ¿Qué mueve la caja después?  → Horizonte de caja (2–3 eventos)
6. ¿Qué acaba de pasar?         → Actividad reciente (2–3 filas)
```

El Home es un tablero de control del presente: no es un feed de
transacciones ni un dashboard de IA. Nada de chips horizontales de
inteligencia, ni card de pulso + card de insight apiladas.

## 3. Matriz de estados

| Estado | Comportamiento de la lectura | Comportamiento del Home |
|---|---|---|
| sin cuenta | sin inteligencia | solo activación de cuenta |
| learning / insuficiente | guía compacta opcional; **nunca** afirma "nada urgente" ni "estás cubierto" | Home nativo completo |
| calm | una lectura concisa con margen diario, o abstención | sin card verde de éxito |
| watch | una lectura priorizada | CTA nativa visible |
| risk | una lectura priorizada, copy fuerte | color danger contenido (sin pantalla roja) |
| sin movimientos + resumen por vencer | la lectura aparece igual | no se gatea por `hasAnyMovement` |
| montos ocultos | todo monto de inteligencia enmascarado (`•••`); los títulos pueden quedar | masking global coherente |
| ARS/USD combinado | misma base de display que el resto del Home (`resolveMoneyBasis`); sin cotización válida cae explícito a default | sin contradicción de base |
| API parcial / error | layout estable, brief cacheado si existe | sin card de error ruidosa |
| mes pasado | sin brief del presente | navegación histórica intacta |

Implementación de la matriz: `lib/intelligence/home-brief.ts` +
`lib/intelligence/home-display-context.ts` (tests en
`lib/intelligence/__tests__/home-brief.test.ts`).

## 4. Prioridad de módulos y slot de acción

Prioridad del **único** slot de acción contextual del Home:

```text
riesgo / acción con vencimiento
→ confirmación que afecta el saldo (pago de tarjeta, ingreso recurrente a confirmar)
→ recibo pendiente (share target)
→ ingreso esperado
→ revisión no urgente (suscripciones, instrumentos)
```

Reglas:

- Solo **un** slot de acción contextual puede renderizar por vez.
- La lectura de hoy lleva una acción nativa primaria cuando existe;
  `Preguntar` es siempre secundaria.
- Señales correlacionadas (vencimiento de tarjeta + liquidez) son **una**
  historia: una sola mención del mismo actor (p. ej. Visa) en el primer
  viewport.
- El horizonte de caja puede listar como evento algo que ya es titular de la
  lectura, pero no repite su párrafo explicativo.

## 5. Reglas no negociables (heredadas del plan)

1. Saldo Vivo es el único número héroe.
2. Disponible Real es subhéroe permanente, no una fila genérica.
3. A lo sumo una lectura editorial de inteligencia en el Home.
4. Sin chips horizontales de inteligencia en el Home.
5. Sin card de pulso + card de insight separadas.
6. Acción nativa primaria cuando exista; `Preguntar` secundaria.
7. El Home puede no mostrar lectura si la relevancia/confianza no alcanza.
8. Masking y base de moneda idénticos al resto del Home.
9. El Home es control del presente, no feed ni dashboard de IA.
10. No se rediseña Análisis ni se toca lógica fuera del alcance sin
    aprobación explícita.
