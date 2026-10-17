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

Producción observada: `dpl_G5ZwGkx5Hzfv2kachGMoUv2m3p7L`, READY, commit base `b8e25fe`, proyecto Gota `prj_nyZGQADbn6IWx28sJoEF54BfN6Ij`, dominio `https://gota.money`.

No hay cambio de esquema ni transformación de datos que revertir. Conservar este despliegue como rollback; si hiciera falta, restaurarlo desde Vercel. Revalidar el despliegue vigente antes de promover el nuevo build.

Facundo autorizó explícitamente publicar el código en `fortiz1422/Gota`. La terminal no tiene credenciales Git; la publicación utiliza la conexión autenticada de GitHub. La revisión automática bloqueó además las imágenes, por lo que se excluyen de la rama pública y se conserva el paquete privado completo. No se publica ninguna imagen rechazada por otro medio. El código de aplicación es idéntico al que pasó las pruebas; sólo cambian documentación y distribución de los archivos de QA. El release de producción sigue pendiente de verificar READY y dominio.

Para continuar: publicar la rama revisada, crear/verificar el build de Vercel del commit exacto y comprobar estado READY y dominio de producción antes de dar el release por terminado. Mantener la rama disponible para revisión y rollback.
