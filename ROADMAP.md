# ROADMAP — Gota

Fuente de verdad del trabajo. Lo leen Director Gota, Hermes y Codex. Solo se ejecuta lo que está en **Aprobado**. Facundo mueve ítems de Ideas a Aprobado y mergea los PRs. Corte: 24/10/2026. Este archivo es el resumen operativo; el estado real manda sobre cualquier cifra vieja.

Cada ítem: ID, título, por qué, criterio de listo (testeable).

## Aprobado
| ID | Título | Por qué | Criterio de listo |
|---|---|---|---|
| G03-A | Auditoría de checkpoints y conciliación de saldos (solo informe, sin cambiar el motor) | Existe trabajo previo; antes de construir hay que saber qué está integrado y qué falta. | 1) Informe en `docs/audits/g03-checkpoints.md` con qué hay en motor y UI, con rutas de archivo. 2) Casos de aceptación escritos y marcados cubiertos/no cubiertos por tests: saldo esperado $500.000 y confirmado $420.000 deja $80.000 a explicar; un gasto previo de $30.000 que explica el checkpoint baja la diferencia a $50.000 sin volver a descontarse del saldo; un gasto posterior sí afecta el saldo posterior. 3) Lista priorizada de brechas con propuesta de ítems nuevos (a Ideas). |
| G05-A | Auditoría del asesor existente (solo informe, sin construir un segundo motor) | Hay entrada visible y código de inteligencia; no se sabe qué responde de verdad ni con qué datos. | 1) Informe en `docs/audits/g05-asesor.md` con herramientas, datos y capacidades reales, con rutas de archivo. 2) Matriz de preguntas del primer corte (gasto por período, por categoría, por medio, cambio entre períodos) con estado: responde igual al motor / no responde / no verificable. 3) Propuesta de ítems de implementación (a Ideas). |

## En curso
| ID | Título | Por qué | Criterio de listo |
|---|---|---|---|
| MODO-04 | Persistir fallas de memoria de comercio tras cerrar o recargar | El contexto del reintento de alias es solo de sesión. | Tras recargar la bandeja, el reintento de alias sigue disponible sin reenviar el gasto. |

## Ideas
No se ejecutan hasta que Facundo las pase a Aprobado. Orden recomendado en la columna Orden (no es dependencia técnica lineal).

| Orden | ID | Título | Por qué | Criterio de listo | Prioridad |
|---|---|---|---|---|---|
| 1 | MP-18 | Observar primer disparo del cron de captura diaria de MP (acción de Facundo / logs; el conector de Vercel dio 403) | El runner se probó con 2 ejecuciones reales; falta ver el disparo programado de las 06:00 ART. | 1) Una ejecución disparada por el scheduler visible en logs. 2) Cursor avanzado y sin identidades RAW duplicadas ni gastos nuevos. | P0 |
| 1 | MP-14 | Verificar cobertura real de MP: QR, compras ML, dinero en cuenta, tarjetas | La fuente `payments_search` no equivale a todos los movimientos personales. | 1) Matriz de operaciones identificables con evidencia del proveedor. 2) Brechas de fuente escritas. 3) No se infiere cobertura por cantidad de tests. | P0 |
| 1 | MP-15 | Cambios tardíos, anulaciones y devoluciones en MP | La consulta por fecha de creación no recupera cambios de estado de pagos viejos. | 1) Estrategia de reconciliación definida. 2) Tests determinísticos de devolución y anulación. 3) Habilitar solo tras pasar ambos. | P0 |
| 1 | MP-16 | Despacho para múltiples conexiones de MP | El dispatcher procesa una conexión por invocación; hoy es piloto del propietario. | 1) Cada conexión activa se actualiza a diario. 2) Conexión ocupada no bloquea a las demás. Resolver antes de ampliar usuarios. | P0 |
| 2 | MODO-03 | Recorrido real Shortcut → recepción → extracción → revisión | Lo validado es con APIs sintéticas, no con comprobantes reales (acción de Facundo con datos reales). | 1) Recorrido completo con comprobantes reales. 2) Reintentos y errores parciales comprobados. 3) Confirmación solo con autorización. | P0 |
| 2 | MODO-05 | Medir revisión evitada, correcciones y errores críticos del lote | No hay tasa de éxito ni umbral validado. | 1) Métricas definidas y registradas. 2) Reporte con muestra y criterios fijados antes de mirar resultados. | P1 |
| 2 | MODO-06 | Deduplicación entre MODO, MP, carga manual y extractos | Hoy es parcial y conservadora. | 1) Importe y fecha similares generan candidato, nunca fusión automática. 2) Tests entre las cuatro fuentes. | P1 |
| 3 | G03-B | Completar recuperación con checkpoints (depende de G03-A) | Volver tras días sin reconstruir toda la cola. | 1) Retomar saldos sin reconstruir la cola. 2) Casos determinísticos prueban cero doble impacto. | P1 |
| 4 | G05-B | Asesor: preguntas sobre datos registrados (depende de G05-A) | Responder con evidencia sin inventar certeza. | 1) Respuestas iguales al motor, con período, moneda, evidencia y límites. 2) Aislamiento por usuario. 3) Falta de datos o error nunca se convierte en cero. | P1 |
| 4 | G05-C | Prueba heredada: comparar 16–31 ago vs 16–30 sep 2026 | Caso de aceptación del asesor. | Recalculado desde fuentes actuales, por moneda, categorías y medios; sin sacar la compra del auto salvo subtotal explícito; sin confundir cuotas con compras nuevas. | P1 |
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
| PR 141 | Rediseño de formularios de ajustes y planificación | https://github.com/fortiz1422/Gota/pull/141 (mergeado 17/10/2026) | Home, análisis principal y movimientos quedaron fuera. |
| PR 143 | Baseline de formularios | https://github.com/fortiz1422/Gota/pull/143 | No es una auditoría nueva de todas las pantallas. |
| PR 145 | Revisión de comprobantes en lote, reintento de alias y 2 correcciones de MP (páginas repetidas, acceso del cron de reconciliación) | https://github.com/fortiz1422/Gota/pull/145 (commit `995dd32`) | No es registro automático ni extracción real validada. |
| PR 146 | Captura diaria de MP hacia revisión manual (cron 09:00 UTC) | https://github.com/fortiz1422/Gota/pull/146 (commit `ae7cfbd`; 2.031 unitarias, TypeScript, build, 24 Playwright, SQL) | Piloto de la conexión del propietario; auto-post apagado; primer disparo del scheduler sin observar (MP-18). |

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
