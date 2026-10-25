# ROADMAP — Gota

Fuente de verdad del trabajo. Lo leen Director Gota, Hermes y Codex. Solo se ejecuta lo que está en **Aprobado**. Facundo mueve ítems de Ideas a Aprobado y mergea los PRs. Corte: 24/10/2026. Este archivo es el resumen operativo; el estado real manda sobre cualquier cifra vieja.

Cada ítem: ID, título, por qué, criterio de listo (testeable).

## Aprobado
| ID | Título | Por qué | Criterio de listo |
|---|---|---|---|

## En curso
| ID | Título | Por qué | Criterio de listo |
|---|---|---|---|
| (vacío) | | | |

## Ideas
No se ejecutan hasta que Facundo las pase a Aprobado. Orden recomendado en la columna Orden (no es dependencia técnica lineal).

| Orden | ID | Título | Por qué | Criterio de listo | Prioridad |
|---|---|---|---|---|---|
| 1 | MP-18 | Observar primer disparo del cron de captura diaria de MP (acción de Facundo / logs; el conector de Vercel dio 403) | El runner se probó con 2 ejecuciones reales; falta ver el disparo programado de las 06:00 ART. | 1) Una ejecución disparada por el scheduler visible en logs. 2) Cursor avanzado y sin identidades RAW duplicadas ni gastos nuevos. | P0 |
| 1 | MP-14 | Verificar cobertura real de MP: QR, compras ML, dinero en cuenta, tarjetas | La fuente `payments_search` no equivale a todos los movimientos personales. | 1) Matriz de operaciones identificables con evidencia del proveedor. 2) Brechas de fuente escritas. 3) No se infiere cobertura por cantidad de tests. | P0 |
| 1 | MP-15 | Cambios tardíos, anulaciones y devoluciones en MP | La consulta por fecha de creación no recupera cambios de estado de pagos viejos. | 1) Estrategia de reconciliación definida. 2) Tests determinísticos de devolución y anulación. 3) Habilitar solo tras pasar ambos. | P0 |
| 2 | MODO-03 | Recorrido real Shortcut → recepción → extracción → revisión | Lo validado es con APIs sintéticas, no con comprobantes reales (acción de Facundo con datos reales). | 1) Recorrido completo con comprobantes reales. 2) Reintentos y errores parciales comprobados. 3) Confirmación solo con autorización. | P0 |
| 2 | MODO-05 | Medir revisión evitada, correcciones y errores críticos del lote | No hay tasa de éxito ni umbral validado. | 1) Métricas definidas y registradas. 2) Reporte con muestra y criterios fijados antes de mirar resultados. | P1 |
| 2 | MODO-06 | Deduplicación entre MODO, MP, carga manual y extractos | Hoy es parcial y conservadora. | 1) Importe y fecha similares generan candidato, nunca fusión automática. 2) Tests entre las cuatro fuentes. | P1 |
| 3 | G03-G | Verificar adopción del esquema de conciliación (acción de Facundo; depende de G03-A) | El SQL está preparado en docs y no hay migración versionada. La auditoría no consultó el entorno ni los flags. Plan de activación escrito en docs/plans/g03-activacion-conciliacion.md (PR #155, mergeado); falta que Facundo verifique el entorno y decida activar. | 1) Queda escrito si el esquema está aplicado en el entorno objetivo, sin secretos. 2) Queda escrito el estado de los tres flags de conciliación. 3) Este ítem no los activa. | P1 |
| 4 | G05-B | Asesor: preguntas sobre datos registrados (depende de G05-A) | Responder con evidencia sin inventar certeza. | 1) Respuestas iguales al motor, con período, moneda, evidencia y límites. 2) Aislamiento por usuario. 3) Falta de datos o error nunca se convierte en cero. | P1 |
| 4 | G05-C | Prueba heredada: comparar 16–31 ago vs 16–30 sep 2026 | Caso de aceptación del asesor. | Recalculado desde fuentes actuales, por moneda, categorías y medios; sin sacar la compra del auto salvo subtotal explícito; sin confundir cuotas con compras nuevas. | P1 |
| 4 | G05-D | Asesor: gasto y comparación por medio de pago | El snapshot trae `payment_method` pero el chat no agrega ni detecta esas preguntas (G05-A). | Intent + facts alineados al motor de Análisis; tests con mezcla CASH/DEBIT/CREDIT y caveat si hay otra moneda. | P1 |
| 4 | G05-E | Asesor: totales por ventana temporal (día, semana, mes pasado) | Solo hay listas de movimientos; el LLM no debe sumar (G05-A). | Hecho agregado por `MovementWindowKind` coherente con agregados del snapshot; tests en `buildAnswerPacket`. | P1 |
| 4 | G05-F | Asesor: caveat de cobertura truncada en el packet | Límites 2000/200/200 pueden sesgar sin aviso en chat (G05-A). | Caveat obligatorio si `coverage.*.truncated`; test con fixture truncado. | P1 |
| 4 | G05-G | Modo verificable del asesor (packet → respuesta sin LLM en CI) | Hoy CI no certifica la redacción ni paridad end-to-end (G05-A). | Contrato o golden del instruction/plantilla sin llamar a Gemini en tests. | P1 |
| 5 | G09 | Onboarding de cuentas, saldos y tarjetas (primero auditar lo publicado) | Empezar con una posición útil sin cargar un gasto artificial. | 1) Recorrido mobile completo con cuentas, saldos, tarjetas y moneda; persistencia y recuperación probadas. 2) `/start` con sesión anónima y recuperación hacia login. 3) Un saldo inicial no se convierte en ingreso. | P1 |
| 6 | G04 | Tarjetas y resúmenes: contrato y MVP de conciliación de una tarjeta, un cierre, una moneda (solo discovery/contrato primero, NO enviar a desarrollo autónomo) | Saber qué pagar aun con consumos faltantes. | 1) Contrato escrito (resumen cerrado, período abierto, cuotas futuras, saldo pendiente) con ejemplos de pago parcial, devolución, detalle tardío e importación repetida. 2) El detalle que explica un total confirmado no suma dos veces el compromiso. | P1 |
| 7 | G07 | Importación de extractos: piloto de un banco | Incorporar movimientos faltantes con trazabilidad. Banco y formato por elegir (decide Facundo). | 1) Preview y duplicados antes de confirmar. 2) Importar dos veces es idempotente. 3) Filas inválidas no afectan nada. | P2 |
| 8 | G08 | Recordatorios y notificaciones PWA | Mantener datos al día sin ruido. | 1) Permisos y entrega reales comprobados en dispositivos soportados, incluido iPhone. 2) Horarios de Argentina, links correctos, sin duplicados, opción de desactivar. | P2 |
| 9 | G06 | Consulta de Gota desde una IA externa, un cliente, solo lectura | Consultar movimientos desde una IA que ya usa. Cliente por elegir (decide Facundo). | 1) Permisos mínimos y revocación efectiva. 2) Recorrido real probado en ese cliente. 3) Aislamiento entre usuarios. | P2 |
| — | G10 | Estándar visual y consistencia de formularios (mantenimiento continuo) | Experiencia coherente. No reabrir home, análisis principal ni movimientos. | Capturas reales en 320/390/768/1440 contra el baseline, sin overflow ni problemas de foco. | Transversal |
| — | G11 | Rendimiento y regresiones de experiencia (medir antes de cambiar) | Reducir esperas sin mostrar datos desactualizados. | 1) Medición antes/después en el mismo recorrido. 2) Sin saldos viejos tras confirmar, importar o transferir. | Transversal |

## Listo
Publicado en main. «Listo» acá significa código publicado y CI verde; la validación real contra proveedor se mantiene abierta en Ideas donde corresponda.

| ID | Título | Evidencia | Límite |
|---|---|---|---|
| MP-19 | Completar movimientos MP en lote | https://github.com/fortiz1422/Gota/pull/158 (mergeado; `0191ab3`, 2.097 tests, 48 Playwright, TypeScript, build y SQL aprobados) | Selección humana hasta 20; sin reglas persistentes nuevas ni registro automático. |
| MODO-07 | Acceso al lote y revisión sin depender de imagen | https://github.com/fortiz1422/Gota/pull/158 (mergeado; `0191ab3`) | Campana a lotes; renovación de imagen y fallo de firma aislado; causa real en iPhone pendiente de verificar. |
| PR 141 | Rediseño de formularios de ajustes y planificación | https://github.com/fortiz1422/Gota/pull/141 (mergeado 17/10/2026) | Home, análisis principal y movimientos quedaron fuera. |
| PR 143 | Baseline de formularios | https://github.com/fortiz1422/Gota/pull/143 | No es una auditoría nueva de todas las pantallas. |
| PR 145 | Revisión de comprobantes en lote, reintento de alias y 2 correcciones de MP (páginas repetidas, acceso del cron de reconciliación) | https://github.com/fortiz1422/Gota/pull/145 (commit `995dd32`) | No es registro automático ni extracción real validada. |
| PR 146 | Captura diaria de MP hacia revisión manual (cron 09:00 UTC) | https://github.com/fortiz1422/Gota/pull/146 (commit `ae7cfbd`; 2.031 unitarias, TypeScript, build, 24 Playwright, SQL) | Piloto de la conexión del propietario; auto-post apagado; primer disparo del scheduler sin observar (MP-18). |
| G05-A | Auditoría del asesor existente (solo informe, sin construir un segundo motor) | https://github.com/fortiz1422/Gota/pull/148 (commit `ccd99bd`; auditoría) | Solo informe; implementación queda en Ideas (G05-B–G). |
| G03-A | Auditoría de checkpoints y conciliación de saldos (solo informe, sin cambiar el motor) | https://github.com/fortiz1422/Gota/pull/149 (commit `f331169`; auditoría) | Solo informe; brechas priorizadas en Ideas (G03-C–G). |
| MODO-04 | Persistir fallas de memoria de comercio tras cerrar o recargar | https://github.com/fortiz1422/Gota/pull/150 (commit `fdbe49d`) | Migración `supabase/migrations/20261024153000_shared_receipt_pending_merchant_memory.sql` aplicada en producción el 24/10/2026 (columna `shared_receipts.pending_merchant_memory`). |
| G03-B | Completar recuperación con checkpoints (depende de G03-A) | https://github.com/fortiz1422/Gota/pull/151 (commit `2374ea1`) | Decididas el 24/10/2026: saldo vivo = confirmado ($420.000, pendiente $50.000); campana solo moneda del snapshot; recordatorio sábado y cierre de mes sin cambios; `unexplained()` corregido; flags apagados. |
| G03-C | Tests de los tres casos de aceptación de checkpoints (depende de G03-A) | https://github.com/fortiz1422/Gota/pull/156 (mergeado 24/10/2026) | Tests de aceptación en `lib/reconciliation/checkpoints-acceptance.test.ts`. Sin migraciones ni flags tocados. |
| G03-D | Explicar un checkpoint antes de ajustar conserva el saldo confirmado (depende de G03-A) | https://github.com/fortiz1422/Gota/pull/156 (mergeado 24/10/2026) | Saldo vivo = confirmado; pendiente aparte ($420.000 / $50.000 en suite). Sin migraciones ni flags tocados. |
| G03-E | Decidir y testear el saldo de Home tras confirmar sin ajustar (depende de G03-A) | https://github.com/fortiz1422/Gota/pull/156 (mergeado 24/10/2026) | Home muestra el saldo confirmado y lo pendiente aparte; `unexplained()` = lo que falta publicar. Sin migraciones ni flags tocados. |
| G03-F | Preview al desvincular una explicación sin ajuste publicado (depende de G03-A) | https://github.com/fortiz1422/Gota/pull/156 (mergeado 24/10/2026) | El preview de desvincular coincide con Home. Sin migraciones ni flags tocados. |
| MP-16 | Despacho para múltiples conexiones de MP | https://github.com/fortiz1422/Gota/pull/152 (commit `5c9d971`) | Resolver antes de ampliar usuarios. |

## Reglas transversales (no negociables)
| Regla | Qué significa |
|---|---|
| Canon | Los cálculos financieros salen del motor real. Ninguna cifra vieja de un chat es dato vigente. Escrituras financieras o cambios de reglas solo con confirmación explícita de Facundo. |
| Períodos y monedas | Siempre explícitos. ARS y USD no se suman sin conversión identificada. El corte de tarjeta no se infiere de una fecha aislada. |
| Fail-closed | Dato ausente, fuente fallida o verificación incompleta no equivalen a cero, a «listo» ni a cobertura total. |
| Identidad entre fuentes | Importe y fecha similares generan candidato, nunca fusión automática. Se conserva la evidencia de MODO, MP, manual y extracto. |
| Idempotencia | Distinguir identidad RAW, idempotencia por comprobante y unicidad financiera entre fuentes. |
| Conciliación | Explicar un checkpoint o un resumen confirmado no descuenta el dinero ni suma el compromiso otra vez. |
| Seguridad | Propietario y permisos verificados en backend. Sin secretos en repo, docs ni prompts. |
| Infraestructura | Reutilizar el stack actual. Ninguna tarjeta autoriza nuevas suscripciones, proveedores o bases. |
| Done | Publicar código, pasar CI y comprobar contra el proveedor real son hitos distintos. Done exige la evidencia del objetivo de la tarjeta. |
