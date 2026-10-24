# Captura diaria de Mercado Pago — 24/10/2026

## Alcance

Producción/main habilita captura en segundo plano hacia la bandeja, con opt-in persistente por conexión. Preview y desarrollo conservan el estado apagado. Auto-post y reconciliación automática continúan forzados a false. El runner de captura no importa los servicios de posting ni shadow y devuelve posted=0. No hay migraciones ni cambios al motor financiero.

El cron `/api/cron/mercadopago-sync` se programa `0 9 * * *`: desde las 06:00 de Argentina. En Vercel Hobby la ejecución puede ocurrir dentro de esa hora; no se promete precisión al minuto. Requiere el CRON_SECRET existente y configuración OAuth válida; nunca se incluyen credenciales en código, pruebas o respuestas.

## Arranque y recuperación

El setup existente conserva los períodos explícitos hoy/30/90 días y la cuenta vinculada. Después de aceptar el opt-in, intenta una captura inmediata con Next after; el estado durable queda disponible para el cron si esa invocación termina. No usa after como única garantía de entrega.

Cada ejecución tiene 40 segundos de presupuesto de captura compartido entre las conexiones activas. Cada conexión completa como máximo 32 ventanas de un día por ejecución. Cada ventana completa persiste su propio cursor mediante CAS y lease; un error no adelanta el cursor de esa ventana. El timeout de la función es 60 segundos. Las lecturas de MP tienen timeout de hasta 8 segundos, reducido por el presupuesto restante. RAW conserva el upsert por identidad nativa existente. Un catch-up incompleto se informa como tal y continúa en la próxima ejecución.

El cron despacha todas las conexiones con opt-in en la misma invocación, ordenadas por intento más antiguo. Cada una recibe una ventana de un día por turno antes de que otra reciba una segunda. Una conexión ocupada, fallida o lenta no detiene a las demás. Lo que no entra en el presupuesto queda pendiente y la siguiente ejecución empieza por el intento más antiguo. En el plan Hobby el cron sigue siendo diario y puede correr en cualquier momento de esa hora. La activación inicial sigue siendo la conexión del propietario hasta que haya más opt-ins.

## Evidencia de preactivación

La lectura de producción encontró una conexión real conectada, con access/refresh presentes y vencimiento futuro; no se extrajeron sus valores. Background y auto-post estaban apagados, sin cursor ni importación inicial. La última captura Payments Search exitosa llegaba al 14/10/2026. Los RPC de setup, lease, avance y resume están instalados y son exclusivos de service_role. La identidad y los permisos reales del proveedor aún requieren una captura desplegada; el estado de la base no los certifica.

Vercel MCP devuelve 403 al equipo propietario; los despliegues Git existentes permiten publicar y registrar el cron por vercel.json. El navegador de Gota no tiene sesión autenticada. No se crea una sesión administrativa ni se extraen credenciales como sustituto de ese acceso.

## Límites y criterio de cierre

La captura usa Payments Search, cuya cobertura no equivale a todos los movimientos personales de MP. No genera ni descarga reportes de liquidación en este proceso. La cobertura real de compras debe comprobarse por separado.

Cerrar la activación sólo después de desplegar, aceptar un período explícito en la conexión correcta, observar una ejecución real exitosa y repetirla sin crear identidades RAW duplicadas ni gastos. Hasta entonces distinguir código publicado de conexión activada y de primera ejecución verificada. No hay confirmaciones financieras reales como prueba.

Rollback operativo: desactivar background_sync_enabled en la conexión detiene capturas posteriores; el runner vuelve a comprobarlo bajo lease y el RPC no permite avanzar un cursor desconectado. Revertir el commit y desplegar retira el cron y el flag. Conservar RAW, historial y ledger.
