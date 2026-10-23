# G02 — Revisión de comprobantes en lote

Base inspeccionada: `main` en `a9f0fdb` (#143). Rama: `feat/receipt-bulk-review`.

## Comportamiento implementado

La bandeja abre `/shared-receipts`. Prepara tandas de hasta veinte comprobantes y muestra todos los que requieren intervención, con el motivo concreto. Los listos se pueden editar, seleccionar y confirmar juntos. El enlace de revisión individual sigue disponible y los enlaces anteriores no cambian.

Los nuevos envíos por Shortcut intentan analizarse después de responder al dispositivo, mediante `after` de Next.js. Se conserva la política de IA paga existente y el límite de análisis por usuario. La recepción no depende del éxito del análisis. La lista reutiliza los análisis persistidos y prepara los recibidos restantes de a uno, con al menos trece segundos entre inicios; se pausa ante límites o falta de autorización. No reintenta automáticamente análisis fallidos. Una ejecución de fondo terminada por timeout se recupera como error explícito después de cinco minutos al cargar la bandeja.

No se agregaron dependencias, servicios, cron nuevos ni migraciones. No se modificó el motor financiero ni el RPC canónico de confirmación.

## Criterio de «listo»

- Comprobante preparado, de compra o transferencia a tercero soportada.
- Operación completada; los pendientes/rechazados no pasan por lote. Los análisis anteriores sin estado requieren verificación explícita.
- Importe positivo, moneda ARS/USD, fecha válida, descripción y cuenta/tarjeta activa sin selección automática por defecto. Cuotas válidas.
- Categoría canónica proveniente de alias exacto con preferencia guardada, elección explícita o regla acotada de comercio.
- Advertencias revisadas y consulta de posibles duplicados completada sin coincidencias. Un error de consulta bloquea; nunca equivale a cero coincidencias.

La primera regla de comercio cubre únicamente el nombre exacto normalizado de McDonald's, con sugerencia coincidente de Restaurantes, tipo compra y sin advertencias. No cubre Shell, nombres personales ni coincidencias parciales. Es una regla determinística inicial, no una medición de precisión del modelo. La confianza declarada por el modelo no habilita el lote. La UI distingue alias exacto, alias sugerido, categoría sugerida y elección manual, sin porcentajes.

El backend vuelve a consultar el comprobante propio y el alias vigente, valida las referencias y reconsulta duplicados antes de cada confirmación. Para cuotas comprueba candidatos por importe total y primera cuota según el reparto del RPC actual. La consulta es conservadora: dos gastos legítimos iguales pueden necesitar revisión individual. No fusiona registros.

## Alias y resultados parciales

«Recordar comercio» permite crear uno con nombre editable o vincular a uno existente. Muestra el texto original detectado y advierte si reemplazará la categoría preferida. Aplicar categoría a comprobantes del mismo comercio es una acción separada, sin habilitar memoria automáticamente.

Las preferencias idénticas del mismo comercio se guardan una sola vez por tanda; preferencias contradictorias se bloquean antes de enviar gastos. El guardado financiero ocurre mediante el RPC existente, con su hash de idempotencia por comprobante. Se conservan los éxitos cuando otras filas fallan. Si falla recordar un comercio, se muestra una acción que reintenta solamente el alias; una creación de perfil ya confirmada conserva su ID para ese reintento.

## Evidencia y límites de validación

- TypeScript: sin errores.
- Suite unitaria completa: 196 archivos, 1.994 pruebas aprobadas.
- Navegador: 24 pruebas de los componentes reales con APIs sintéticas en 320, 390, 768 y 1440 px; incluye lote 10/10, categoría a tres comprobantes, confirmar trece y conservar siete, alias nuevo/existente, errores parciales, fallo al recordar, duplicados y lectura sin abrir imagen.
- Servicio y handler HTTP: pruebas con dependencias de base aisladas, validación de propietario, bloqueo ante fallas y llamada al RPC canónico.
- Capturas de QA: `artifacts/receipt-bulk-review/`. Datos ficticios, pantalla real de desarrollo. La ruta de QA devuelve 404 en producción y no modifica autenticación.
- Lint global: 231 errores y 61 advertencias en archivos sin cambios respecto del commit base. Ningún archivo de esta entrega figura entre los hallazgos del lint. El lint de los archivos nuevos/modificados pasa.
- Build inicial: bloqueado por revisión automática ante un intento de envío de telemetría/datos de compilación a Sentry. La revalidación local posterior, descrita abajo, usa la opción existente de verificación sin telemetría, releases ni subida de sourcemaps; no valida el envío a Sentry.
- No se ejecutaron consultas ni escrituras sobre una base real, ni se invocó Gemini real. La precisión de extracción y la integración desplegada con Supabase/Shortcut siguen pendientes de validación en staging.
- El límite de IA por minuto heredado es local al proceso, no un cupo global distribuido; la recepción conserva su límite persistente por dispositivo. `after` no es una cola durable; la bandeja ofrece recuperación controlada.
- La idempotencia garantizada por el RPC es por comprobante. La detección de coincidencias entre fuentes sigue siendo conservadora y no constituye identidad global ni bloqueo transaccional entre dos sesiones concurrentes que confirmen comprobantes distintos.

## Reproducir

```sh
npm ci
npx tsc --noEmit
npm test
FORMS_CHROMIUM_PATH=/ruta/a/chrome-headless-shell npx playwright test -c e2e/receipts/playwright.config.ts
```

El config de navegador usa valores ficticios de Supabase y mocks de API. Las fuentes de QA reutilizan el helper existente; instalar `@fontsource-variable/dm-sans` y `@fontsource/dm-mono` fuera del repo en `/tmp/gota-fonts`, o configurar `GOTA_QA_FONTS_ROOT`. Ninguna clave real es necesaria para estas pruebas.

Antes de merge: completar la regresión de navegador, revisar la UX móvil y verificar el recorrido con un usuario/datos de staging. No se hizo merge, deploy ni cambios al canon de producción.

## Revalidación local — 23/10/2026, tarde

- Alias nuevos y existentes, categorías por alias exacto y reintento de memoria ya estaban implementados en `29f7072`; no eran funcionalidades pendientes. La confianza del LLM no habilita una confirmación en lote. Shell sigue requiriendo revisión si no tiene un alias exacto con categoría guardada.
- Se corrigió un caso adicional: después de confirmar un gasto y fallar el guardado del alias, actualizar la tanda quitaba el comprobante confirmado de la lista y dejaba el reintento sin contexto. Se conserva ese contexto en memoria durante la sesión para reintentar solamente el alias, incluso con una bandeja nueva. No persiste al cerrar o recargar la página.
- TypeScript y lint de los dos archivos modificados aprobados. Se reejecutaron las 39 pruebas específicas de lote, handler, duplicados, preparación y memoria de comercios: aprobadas. Las 1.994 unitarias y 24 de navegador de arriba corresponden a la validación inicial, no a una nueva ejecución completa.
- Build optimizado con webpack **aprobado**: compilación, TypeScript y 87 páginas generadas. Se usó un entorno de proceso limpio, valores ficticios de Supabase, `GOTA_LOCAL_VERIFY=true` y `NEXT_TELEMETRY_DISABLED=1`. Las fuentes se sirvieron mediante el helper de QA existente y copias idénticas recuperadas del cache local de la compilación de desarrollo; el intento sin ese helper falló por DNS de Google Fonts. No se usaron credenciales ni servicios reales. El build habitual con descargas de fuentes y la integración de Sentry en despliegue siguen sin validar.
- Se amplió la regresión de navegador para actualizar la bandeja después del fallo de alias y comprobar que el reintento conserva el nombre, vuelve a intentar la memoria y no repite la confirmación financiera. Su ejecución actual queda pendiente porque este runtime no tiene el ejecutable de Chromium.
- Se inspeccionaron las cuatro capturas iniciales (320, 390, 768 y 1440): header azul, fondo uniforme y CTA fijo consistentes; no se observaron solapamientos o recortes horizontales en esas capturas. En 320×568 el área de revisión es reducida por el header y el CTA fijo (P2); la interacción de scroll, foco y zoom no fue revalidada ahora. No hubo cambios visuales ni nuevas capturas.
- Staging pendiente: recepción real por Shortcut, extracción real, permisos y alias con usuario de prueba, confirmación y replay mediante el RPC, duplicados entre fuentes y recuperación de análisis. Sin esta integración y sin la regresión de navegador pendiente, la entrega no se considera lista para merge/deploy.
