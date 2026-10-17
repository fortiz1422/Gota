# Handoff para Hermes — rediseño de formularios

## Entrega

Rama: `feat/forms-redesign-20261017`.
Base revisada: `b8e25fe0fa19edc8f35a396c23ffa0aa5d649477` (también producción al iniciar y al verificar el cierre).

Implementación del paquete `gota-handoff-formularios.zip`, siguiendo las excepciones de compatibilidad del handoff y los textos/contratos reales del producto.

- Superficies opt-in `r` y `blue-hero`; los consumidores sin variante conservan su HTML original.
- R en cuentas, suscripciones de Ajustes, acceso/privacidad, Saldo Vivo, alias, dispositivos y administración de la conexión Mercado Pago.
- Cabeceras azules en transferencias, ingresos, editor de gasto, suscripción de Inicio, metas y presupuestos.
- Total de presupuesto calculado para mostrar; no entra en los datos de guardado. Saldos ARS/USD apilados. Ayuda de archivo de suscripción en la confirmación. Opciones de aporte con estado accesible.
- Selectores nativos, validación, mensajes, foco, callbacks, endpoints e invalidaciones conservados. No se añadieron las interacciones nuevas que los mockups dibujan pero el producto no implementa.

No se rediseñaron Home, Análisis principal, filas de Movimientos, SmartInput/ParsePreview, Tarjetas, conciliación ni los módulos pausados/S7. Las dos suscripciones siguen siendo componentes distintos. No hay migraciones, cambios de API, nuevas dependencias ni cambios de secretos/configuración de producción.

## Evidencia

| Control | Resultado |
| --- | --- |
| Suite unitaria completa | 189 archivos / 1.955 tests verdes; incluye 44 nuevos |
| Contratos de comportamiento | 26 componentes contra la base y fila de gasto íntegra |
| Compatibilidad por defecto | 7 snapshots de HTML de superficies y 5 de progreso sin variante idénticos a la base |
| Interacción + render | 188/188 casos: 36 estados + 11 flujos en 4 tamaños |
| Tamaños | 320×568, 390×844, 768×1024, 1440×900 |
| Estabilidad visual final | 144/144 capturas repetidas sin actualizar referencias y con tolerancia cero |
| Lint de archivos cambiados | 0 errores; sólo los 2 warnings previos de dependencias de efectos en AccountBottomSheet |
| Build de producción local | Verde, Next.js 16.1.6 / Node 24 |
| TypeScript | Sin errores |
| APIs, hooks financieros, proxy y overlays base | Sin cambios |
| Revisión de contenido nuevo | Fixtures ficticios; sin credenciales ni exportaciones de datos reales |

Pruebas de interacción: formato argentino, ARS/USD, misma cuenta, errores sin escritura, 500 y reintento, cancelación y retorno de foco, archivo ocupado sin cierre, saldos iniciales con signo, decisión explícita de alcance ante 409, los tres errores de presupuesto, total en vivo sin modificar payload, aporte comprometido y PUT del editor de gasto.

Las capturas se conservan en `e2e/forms/__screenshots__` del paquete privado de QA, fuera del repositorio público por un bloqueo específico de la revisión automática para imágenes. Los comandos y las limitaciones del entorno están en `e2e/forms/README.md`. La página de fixtures responde notFound fuera de development. Todas las escrituras de pruebas fueron interceptadas.

Correcciones visuales comprobadas: texto de opción R seleccionada, pista del switch apagado, foco visible, alineación símbolo/monto y montos legibles en 320 px. La diferencia de foco inicial en una captura USD se resuelve esperando el foco real antes de capturar; no se relaja la tolerancia de píxeles.

## Límites de lo verificado

Chromium local 138 y Playwright 1.64.1, escala 1. Por restricciones de descarga, QA/build local utilizaron una fuente DM Sans local; las declaraciones de fuente del producto no se cambiaron. No se afirma identidad de píxeles con Safari, otro Chromium o fuentes distintas. No se probaron teclado virtual físico, credenciales WebAuthn reales ni una conexión OAuth Mercado Pago real. Tampoco se afirma una comparación visual autenticada completa de producción ni persistencia en una base real: la lógica existente quedó congelada y las pruebas usan datos ficticios.

## Release y rollback

Release verificado el 17/10/2026, después de las 17:40 ART:

- PR integrado: https://github.com/fortiz1422/Gota/pull/141.
- Rama preservada: `feat/forms-redesign-20261017`. Commit de código publicado: `9629ef234339100264c5f42ba38a4eb26c7a8dd6`; los commits posteriores de esta rama sólo documentan el cierre.
- Commit de producción: `1de7e49a556cdf34c52b9a1947371a99d625ab8b` en `main`.
- Despliegue: `dpl_3AVJeH9q2BwDLfqsvSAHoAf2RC1i`, READY, proyecto `prj_nyZGQADbn6IWx28sJoEF54BfN6Ij`.
- URL de build: https://gota-kudwrht4j-facundos-projects-11ee7eb5.vercel.app.
- Alias de producción asignados: `gota.money` y `www.gota.money`.
- El árbol de código publicado es `79e7b8d690ae4e0ab72969b8164394db71bb8808`, idéntico al local sin imágenes. Los archivos de aplicación coinciden con la revisión que pasó QA.
- HTTP 200 en `/` y `/login`, con TLS validado. El CSS público `991e28208c5c548c.css` contiene las variantes nuevas.
- Smoke de navegador en producción a 390 y 1440 px: `/` y `/login` con HTTP 200, sin overflow horizontal ni errores JS observados. Chromium usó el proxy del entorno y su contexto de prueba omitió validación de certificados por la CA interna; la verificación HTTPS separada sí validó TLS. No se cambió la configuración de seguridad del sitio.

Rollback disponible y comprobado en READY: `dpl_G5ZwGkx5Hzfv2kachGMoUv2m3p7L`, commit `b8e25fe0fa19edc8f35a396c23ffa0aa5d649477`.

No hay cambio de esquema ni transformación de datos que revertir. Para rollback, restaurar ese despliegue anterior desde Vercel y verificar dominio/commit; no ejecutar SQL ni revertir datos. La rama queda disponible y el merge #141 permite también un revert de código si corresponde.

Facundo autorizó explícitamente publicar el código en `fortiz1422/Gota`. La terminal no tiene credenciales Git; la publicación se realizó con la conexión autenticada de GitHub. La revisión automática bloqueó las imágenes, por lo que no forman parte de la rama pública y se conserva el paquete privado completo. No se publica ninguna imagen rechazada por otro medio. El código de aplicación es idéntico al que pasó las pruebas; sólo cambian documentación y distribución de los archivos de QA.

Límite de observabilidad: la conexión Vercel devuelve 403 al leer logs de build/runtime y el preview protegido. No había CLI autenticada para el fallback. Se verificaron estado READY, SHA, aliases, dominio público y recursos; no se afirma que los logs estén libres de errores. No se desactivó protección ni se ampliaron permisos para pasar las pruebas. Las verificaciones públicas fueron de sólo lectura; no se crearon movimientos ni se afectó el canon.

Pendiente opcional: restablecer acceso de lectura a logs de Vercel para una observación más amplia. No queda un paso de publicación o despliegue pendiente.
