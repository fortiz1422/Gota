# Mercado Pago v2 — checkpoint nocturno

Fecha: 2026-10-02, Argentina. Pedido de Facundo: avanzar sin esperarlo, documentar bloqueos y entregar informe completo al despertar (~07:22 Argentina). Ejecución ChatGPT Work, sin Hermes/subagentes.

## Base publicada

Rama feat/mercadopago-integration-v2; draft PR #124. HEAD previo 40145c6. Producción ee8ed25 no modificada. UX de revisión ya publicada y validada visualmente; captura y clasificación siguen en shadow, sin auto-post ni background habilitados para el usuario.

## Bloque completado en este checkpoint

Ledger matcher y repository read-only conectados a shadow: moneda/importe exactos, fecha +/- un día Argentina, cuenta/funding compatibles; cuenta ausente conserva duda, merchant sólo señal explicativa. Consulta exact-count bounded, falla o truncamiento no habilitan dedupe. Rule version 3. No se resuelve ni borra duplicado automáticamente. Servicio persiste exclusivamente shadow audit.

Pruebas: suite completa 996 / 151 archivos incluyendo matcher y servicio shadow; tsc y ESLint de archivos editados verdes. SQL real read-only verificó expenses.date timestamptz y ausencia de gasto de ARS1000 en ventana consultada, lo que NO confirma la transferencia MP.

## Orden siguiente

1. Llevar posibles duplicados a revisión con explicación útil; vincular existente requiere audit/stale/ownership/idempotencia transaccionales. No habilitar vínculo parcial inseguro.
2. Card matcher determinístico con metadata realmente disponible. Tarjetas Gota tienen last_four pero no brand/issuer estructurados: no inventar identidad financiera desde nombre libre. Binding explícito de tarjeta elegida puede servir para operaciones futuras; evaluar con garantías y schema revisable.
3. Merchant/category learning: reutilizar aliases/preferencias existentes antes de otra tabla. Primera corrección sugiere; no confundir categoría con tipo financiero.
4. N cuotas: leer motor canónico de ciclos/asignaciones y confirmación actual SQL antes de extender. Bloque actual installments===1 existe también en RPC; cambiar sólo UI/gate rompe integridad. Preparar migración revisable, no aplicarla al canon real sin autorización específica.
5. Verificar UX Settings/onboarding y alertas/origen de movimientos, estados humanos; conservar técnicos en advanced y evitar mentir sobre automatización que sigue apagada.
6. Documentar matriz de 16 escenarios: real observado vs synthetic test vs pendiente. Ninguna prueba mock equivale a operación controlada real.

## Accesos y publicación

GitHub, Supabase y Vercel leídos con éxito este turno. CUA sesión existente estaba disponible en última comprobación. Si login vence: documentar y seguir código/test, nunca pedir credenciales. Repo remoto permite fetch; push shell carece credenciales. Publicar github_create_tree/create_commit/update_ref force:false; revisar HEAD remoto antes y alinear local sólo si contenido exacto. GitHub structuredContent directo; Vercel teamId vacío funciona, projectId prj_nyZGQADbn6IWx28sJoEF54BfN6Ij. Preview https://gota-git-feat-mercadopago-int-19f03c-facundos-projects-11ee7eb5.vercel.app/.

Supabase wfwkrenyoxiswaeafpjc: lectura mínima scoped user 9083ebd0-6082-4067-9bd8-ef07e346a1d9, conexión 4400a8ef-7c60-44a2-8ac0-6f6e087bee3d. Nunca tokens, auth.users/sessions, CVU/CBU. La vigilancia transferencia ARS1000 sigue separada, no avanzar producto esperando pending; no cambiar esa tarea.

## Límites de la entrega

Autorizado código, tests, commits en rama/draft PR y Preview. No merge/promoción producción, cambios config externa MP, activación background/import/autopost, nuevas transacciones ni pruebas que escriban ledger/cuentas/saldos/compromisos reales. No pulsar Continuar/Registrar en la cuenta real. Migraciones como archivos revisables.

El software puede avanzar sin login; validación real proveedor, matriz financiera y habilitación de auto-post no se sustituyen por más tests de código. Informe final debe decir qué cambió para usuario, tests verificadas, evidencia real, blockers y gates pendientes sin declarar MP v2 completa si faltan.
