# Handoff para Hermes · Transferencias en conciliación

Fecha: 09/10/2026. Continúa el PR #135 de `fortiz1422/Gota`. Código y SQL preparados; sin migración ni activación en producción.

## Decisiones y comportamiento

- Seleccionar una transferencia existente o crear una nueva desde “Fue una transferencia propia”. Una sola fila de `transfers`, con sus dos efectos nativos; no se crean gasto ni ingreso.
- Creación nueva entre cuentas propias activas distintas, en la moneda actual: ARS→ARS o USD→USD, importes iguales. Selección existente respeta las monedas/importes de sus dos lados. Crear cambios de moneda, comisiones y conversiones dentro de la misma cuenta queda fuera de esta pasada.
- Confirmar explícitamente que la evidencia estaba en el saldo de cada cuenta y, si corresponde, que ocurrió antes de la consulta del mismo día. La UI ofrece diferencias elegibles de la otra cuenta, con fecha e importe; el servidor valida también intervalo, sentido, importe pendiente y evidencia no utilizada.
- Si la otra cuenta tiene una corrección vigente, crear exige seleccionar y confirmar una diferencia elegible de esa cuenta. Si no existe, revisar esa cuenta primero. No se compensan ajustes por coincidencia de monto.
- `save_transfer_reconciliation` es una RPC nueva, con nombre único y permiso sólo para `service_role`. Verifica huella del ledger, dueños y versiones, y guarda transferencia y uno/dos vínculos en una única transacción bajo el lock del usuario. No altera la firma anterior de gastos/ingresos. El rol del navegador no puede llamarla.
- La transferencia se conserva al desvincular. Editar/borrar permanece bloqueado mientras cualquiera de sus vínculos siga activo. Reintentar una solicitud confirmada no duplica filas.
- El borrador conserva cuenta, dirección, importe y fecha; los consentimientos de vinculación se vuelven a pedir. Se reutilizan Guardar y salir / Guardar y continuar y la confirmación mínima. Sin banner adicional.

## Hechos verificados

- Suite completa: 176 archivos, 1.847 tests aprobados en zona Argentina. Quince casos nuevos de API sobre transferencias. TypeScript, lint de archivos afectados y `git diff --check` aprobados.
- SQL descartable: error forzado en el segundo guardado revierte la transferencia, el primer workspace y la auditoría; versiones/huella, propiedad, duplicados, fecha futura, replay e intención distinta; edición/borrado bloqueados hasta desvincular ambos lados; permisos de roles navegador rechazados. También pasa la prueba SQL anterior de gastos y reconciliación.
- UI React real → API Next real → cálculo de saldo real → repositorio/RPC/SQL real en PGlite descartable. Chromium móvil 393×852, sin desborde horizontal ni errores JS.
- Transferencia faltante $50.000 de BBVA a Mercado Pago: una fila, ambos ajustes explicados, saldos $950.000 / $350.000 / Nación $0, total $1.300.000. No se crearon gastos ni ingresos. Desvincular y revincular desde UI no duplicó la fila. Guardar/salir/retomar conservó el borrador.
- Tres escenarios de transferencias, 16 solicitudes HTTP exitosas. El recorrido anterior sigue pasando sus ocho escenarios, ahora con 76 solicitudes HTTP y cero errores JS. Los pedidos directos de la fixture al API no se incluyen en esos contadores HTTP.

## Evidencia

[Crear y explicar ambas cuentas](qa/reconciliation-transfers-20261009/crear-transferencia.png) · [Vincular una existente](qa/reconciliation-transfers-20261009/vincular-transferencia.png) · [Resultados](qa/reconciliation-transfers-20261009/resultados.json).

Las capturas tienen datos ficticios. La fixture de tareas no representa un nuevo Home. Los adaptadores de autenticación, rate limit y PostgREST son sintéticos.

## Pendientes, riesgos y siguiente paso

No validado: autenticación real, navegación Next/Home integrado, iOS/PWA instalada, concurrencia multisesión de PostgreSQL nativo ni adopción de la nueva RPC en staging. El build Next completo sigue pendiente por el bloqueo previo de la conexión externa de Sentry; no se volvió a intentar ni se autorizó ese envío.

Necesitamos handoff actualizado del staging de Hermes, sin secretos. Aplicar y verificar SQL primero en staging, comprobar permisos y función nueva, ejecutar prueba autenticada con las tres cuentas y validar retorno de PWA/concurrencia antes de activar el piloto. El guardado nuevo falla cerrado si falta la RPC. No hacer merge ni habilitar switches de producción como consecuencia automática de este handoff.

El tope de candidatos es de 100 entradas por tipo/sentido; no se afirma cobertura completa del historial. Las decisiones de propiedad del usuario provienen de la sesión del servidor, sin usar metadata editable. El rol de servicio permanece exclusivamente en el backend.
