# Handoff para Hermes — Gota: entrada pública y seguridad

Fecha: 2026-10-06. Repo: fortiz1422/Gota. Base revisada: main, df44ccef1c6be6f8ddc5bce406107d6a6236d237. Rama: feat/public-first-use.

## Objetivo y decisión de alcance

Poder compartir un link con amigos: entender Gota, empezar sin cuenta o ingresar, configurar una cuenta, cargar un gasto, revisar y volver a encontrarlo. Sin demo interactiva en la landing.

Se conserva el mecanismo existente de sesiones anónimas de Supabase. Los datos se guardan en servidor, no offline. Implementar otra base local y migración no entra en esta entrega; la UI y privacidad explican el comportamiento real. Vincular un mail/Google nuevo conserva el usuario; ingresar a una cuenta existente no fusiona datos. Se agrega una advertencia explícita y descarga de gastos antes de cambiar de sesión.

## Cambios de aplicación

- Root sin sesión lleva a /landing. /start abre directamente el camino sin cuenta. Landing y páginas informativas no dependen del servicio de autenticación.
- Links protegidos conservan destino y query al ingresar; destinos externos y bucles de login se rechazan. APIs sin sesión devuelven JSON 401.
- Landing nueva, responsive, con captura existente etiquetada como ejemplo, pasos concretos, FAQs, privacidad y condiciones navegables.
- Login sin montos ficticios ni animación financiera; OTP deriva por configuración, no por heurística de antigüedad de usuario.
- Onboarding reemplazado por una pantalla de cuenta, tipo, moneda y saldo explícito; después abre el destino real. Se conserva y recupera la cuenta si falla la configuración. Endpoint dedicado con ID estable por usuario y RLS para evitar duplicados en reintentos y pestañas concurrentes. Se eliminan las pantallas antiguas.
- Efectivo explícito tiene prioridad sobre la cuenta bancaria principal en la revisión.

## Iteración de onboarding — 6 octubre, noche (Argentina)

### Decisiones y comportamiento

- Se aplicó el benchmark oficial de Copilot, Monarch, YNAB y Duolingo. La dirección es configuración breve y primera acción guiada dentro del producto, no un número de pantallas supuestamente óptimo.
- Una pantalla editorial: nombre con sugerencias, banco/billetera/efectivo, moneda principal (ARS por defecto), saldo explícito y saldo en segunda moneda si corresponde. Adaptación a escritorio y móvil con CSS propio; contraste y foco visibles, labels/fieldset, errores con role=alert y controles deshabilitados durante guardado.
- El modelo actual no representa saldo desconocido. Se pide saldo en vez de convertir un vacío en cero; cero es válido. Saldo omitible con estado desconocido queda pendiente de diseño de motor y esquema, no implementado como truco de UI.
- El input de saldo admite separadores argentinos, centavos y negativo explícito; rechaza valores inválidos o fuera del rango de la base. Se agrega validación del lado servidor a cuentas.
- Cuenta y configuración se guardan en secuencia. Si falla la segunda operación, la cuenta permanece y se ofrece reintento. El ID de la primera cuenta se deriva de forma estable del usuario; el servidor decide propietario/ID, nunca los recibe como autorización del navegador. Todas las consultas usan el cliente del usuario y RLS.
- Si onboarding ya está completo, el endpoint responde completed sin sobrescribir los saldos de una pestaña vieja. No es una transacción multioperación: si falla configuración, puede quedar la cuenta guardada con onboarding incompleto, que el siguiente intento recupera. Ediciones simultáneas aún pueden tener última escritura prevalente.
- Se conserva una cuenta previa cuando hay setup incompleto; no se agrega una segunda. La moneda elegida queda como default en home si el link no especifica otra.
- Se marca el tour anterior como completado para nuevos onboardings. No cambia las preferencias de usuarios existentes.
- Home sin historial usa una guía opcional que abre SmartInput y ParsePreview normales, sin duplicar el motor ni el formulario de revisión. Un ejemplo de café está etiquetado y jamás se envía o guarda automáticamente.
- Dismiss de la guía persiste en el navegador, por ID de cuenta; con storage bloqueado dura esa sesión del componente. La guía no ocupa meses vacíos de usuarios con historial.
- Se advierte que gastos ya incluidos en el saldo volverían a descontarse. No se modificó el motor ni se solucionó automáticamente la incorporación de históricos contra saldo actual.
- El acceso anónimo conserva sus avisos de recuperación. Vinculación después del primer valor sigue accesible mediante el banner existente; no se fuerza una nueva modal al guardar el gasto.

### Artefactos y verificación

- Galería en /ui-exploration/onboarding, fuera de producción, con datos sintéticos y wrappers inert. No habilita guardados ni crea sesiones.
- Archivo de entrega Gota_onboarding_pantallas.html se genera del HTML compilado y CSS/fuentes/assets inline: cuatro vistas estáticas. No acredita inspección visual en navegador ni login real.
- Pruebas focalizadas: 99 pasan en 7 archivos. Incluyen 30 nuevas para parseo de saldo, validación, orden de guardado, fallo/reintento, identidad estable, rechazo de propietario recibido y pestaña ya completada; también regresiones de motor de saldo, parser y entrada pública.
- TypeScript y lint de archivos nuevos/editados focalizados pasan. Build final local con Supabase ficticio pasó; confirma compilación, no auth ni RLS reales del nuevo endpoint. Suite completa: 1158 pruebas pasan, 8 fallan en los mismos 4 archivos de MP/comprobantes verificados en la base anterior. No hay fallas nuevas en esa ejecución.
- El navegador remoto rechazó la vista data: por política de protocolos. No se eludió ni se publicó un sitio alternativo. La prueba visual e interacción móvil se mantiene pendiente de preview accesible.

### Pendientes y límites

Probar alta, guardado fallido, recarga, guía/input/review y vinculación con sesiones sintéticas en preview. Verificar que el upsert usa correctamente las políticas SELECT/INSERT/UPDATE ya existentes. No tocar saldos o movimientos personales. No presentar el diseño como validado con usuarios ni afirmar una mejora medida en conversión.

## Smart input y costo

Todo texto se interpreta con reglas de aplicación y vocabulario, sin llamar a Gemini. El texto sigue llegando al servidor para la revisión y memoria de comercios; no se promete funcionamiento offline. Soporta monto argentino, mil/k, fecha hoy/ayer/anteayer o día/mes/año, moneda, medio y cuotas numéricas. Una tarjeta concreta no se inventa; se elige al revisar. Ante múltiples números, fechas/medios contradictorios, ingreso, pago de tarjeta o transferencia propia, pide aclaración. La categoría es una sugerencia. No existe una medición de cobertura con entradas reales: el conjunto automatizado es sintético.

Llamadas pagas (audio/imagen, asistente, análisis de comprobantes compartidos) cerradas por defecto. Requieren GOTA_PAID_AI_ENABLED=true **y** UUID exacto en GOTA_PAID_AI_USER_IDS **y** usuario permanente. Los valores son configuración de servidor, no autorización desde el cliente. No habilitar para todos: el rate limit existente es por instancia, no un presupuesto global. El texto nunca hace fallback pago, incluso para usuarios permitidos. No se cambió configuración de producción ni se configuró una allowlist.

## Hallazgo de base de datos y corrección bloqueada

Se verificó el proyecto Supabase contra los documentos del repo y su catálogo. Tres funciones de lectura y una vista heredada tienen privilegios que evitan RLS. Se preparó docs/supabase-public-access-hardening.sql: funciones de lectura como SECURITY INVOKER, search_path fijo, sin ejecución para PUBLIC/anon; trigger de alta mantiene su definer pero no ejecución pública; vista usa security_invoker. No cambia cuerpos de cálculo, saldos ni movimientos.

La corrección se probó dentro de una transacción revertida con dos usuarios anónimos y movimientos sintéticos. Se verificaron cálculo propio, denegación de lectura cruzada en dashboard, duplicados y vista, y denegación de RPC sin sesión. Script reproducible: scripts/tests/public-access-isolation.sql. La transacción hizo ROLLBACK.

**No aplicada en producción.** Auto-review rechazó aplicar la migración porque requiere aprobación explícita del usuario para ese cambio de permisos. No reintentar por otra herramienta ni ejecutar SQL persistente como alternativa. Autorizar la migración preparada, aplicarla y repetir la prueba y advisors antes de declarar publicable.

## Verificaciones y pendientes

- TypeScript: sin errores.
- Build local: pasó con GOTA_LOCAL_VERIFY=true y NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1. Se usaron valores públicos ficticios de Supabase: verifica compilación, no autenticación real.
- Pruebas focalizadas de parser, costo y rutas: 84 pruebas en 7 archivos, todas pasan.
- Suite completa: las ocho fallas encontradas en cuatro archivos de review MP/comprobantes también fallan en un checkout limpio de df44cce. No se modificaron esos contratos para hacerlas pasar.
- Lint completo: deuda preexistente. Lint de archivos nuevos y cambios: limpio salvo los cinco `any` heredados de lib/auth.ts y CSS fuera del alcance de ESLint. No se refactorizó ese SDK experimental ajeno al flujo.
- Revisión de seguridad real con advisors: confirmado el hallazgo mencionado. RLS habilitada en tablas financieras. No es una auditoría integral de todos los RPC administrativos.
- Vercel connector lista el proyecto pero la inspección de su scope devuelve 403. No se cambiaron credenciales, protección de deployment ni variables.
- El navegador remoto bloquea la URL local. La verificación visual y los flujos de alta/OTP/Google deben realizarse sobre una preview accesible. No presentar unit tests como prueba del alta o vinculación real.

## Publicación pendiente

La rama está preparada y comprometida localmente. Auto-review rechazó el push al repositorio público por falta de aprobación explícita para publicar estos cambios y documentación. No hay PR ni deployment nuevo. La aprobación requerida es publicar la rama feat/public-first-use y crear su PR, además de aplicar la migración de permisos ya preparada.

## Condición para compartir por WhatsApp

No declarar listo hasta: permisos aplicados y verificados; preview/producción correcta; recorrido mobile probado con sesión nueva; gasto revisado y encontrado tras recarga; vinculación a cuenta nueva con mismo usuario comprobada; aislamiento cruzado corroborado. La fusión con cuentas existentes y el modo offline quedan fuera del alcance, explícitos en UI.

No tocar movimientos de Facundo ni integraciones MP durante estas verificaciones. La fase siguiente retoma MP y capacidades agénticas después de cerrar estos puntos.

### Home después del onboarding — 6 de octubre de 2026

- Decisión: acompañar el primer uso dentro de la home; no agregar pasos obligatorios al onboarding.
- Hecho encontrado: en primer uso, Últimos movimientos tenía título pero devolvía contenido nulo. Ahora muestra una explicación del registro vacío y aclara que el saldo inicial no es un movimiento.
- Guía del primer gasto sigue siendo opcional. Una tarjeta separada «Tu punto de partida» conserva la explicación del saldo y de la cobertura aunque se cierre esa invitación. Ambas se muestran mientras no haya historial de movimientos; no se convierten en un checklist permanente.
- Cuentas y tarjetas abren las hojas existentes desde la home. No se agregó una ruta ni un flujo alternativo de escritura. Las tarjetas se consultan al abrir su hoja existente.
- Sin tarjetas: el texto aclara que el disponible no incluye deudas no registradas. Con tarjetas y sin movimientos: explica cuándo aparecen compromisos. Los módulos de compromisos sin importes siguen ocultos; no se presentan deudas o métricas ficticias.
- Mes sin actividad pero con historial: conserva estado mensual, explicación de período e historial accesible. Se retira el enlace a un historial vacío para quien recién empieza.
- Verificación: 38 pruebas focalizadas aprobadas (estado vacío, onboarding y balances); TypeScript sin errores; ESLint focalizado sin errores; git diff --check limpio. Destinos revisados: cuentas y tarjetas usan componentes ya existentes, no enlaces supuestos.
- Límite: no se verificó el render móvil ni el flujo autenticado de las hojas en navegador. Persisten los bloqueos de preview y publicación documentados arriba. Este ajuste es local y no está desplegado; no altera saldos ni motor financiero.
- Pendiente: validar con un usuario nuevo si comprende el saldo de partida, el primer registro y el alcance del disponible; revisar densidad de las dos tarjetas de ayuda en pantalla chica en una preview autorizada.
