# Mercado Pago — limpieza de diseño

Fecha: 3 de octubre de 2026. Base: main d1c4228 (PR #124). Rama de trabajo: feat/mercadopago-design-cleanup.

## Análisis visual

La configuración autenticada muestra una tarjeta extensa con dos explicaciones, fecha exacta, CTA y un acordeón que vuelve a presentar conexión, estado y sincronización. La bandeja, aun vacía, repetía encabezado, instrucciones, contador y controles. Antes del descarte autorizado se comprobaron 40 filas con descripciones completas, párrafo contable y CTA por fila; esos pendientes siguen descartados.

La inspección del código confirma el mismo patrón en la confirmación: introducción extensa, textos auxiliares de categorías, etiquetas y opciones de comercio desplegadas. OAuth aún hablaba de “prueba completada”. Duplicados necesitaba una pregunta y dos alternativas concretas.

## Cambios

- Conexión: tarjeta compacta, estado, registro manual explícito y una acción principal. Gestión de cuenta/consulta pasa a una hoja; el panel anterior ya no se monta hasta abrirla. Se conserva diagnóstico secundario y todos los controles existentes.
- Bandeja: un contador contextual y una lista por fecha; nombre truncado visualmente, importe, medio y cuotas. Una indicación breve por movimiento; la fila completa abre el detalle. Selección en menú accesible de tres puntos, sin controles en vacío.
- Vacío: “Estás al día”. No promete que la captura esté automatizada.
- Confirmación: una instrucción corta, botón “Registrar”, etiquetas colapsadas sólo para MP, preferencia de comercio compacta y descripción original disponible en “Detalle de origen”. Importe, moneda, fecha y cuotas siguen siendo evidencia inmutable.
- Transferencias: se conserva confirmación humana y texto específico de pago/transferencia. Una entrada solicita identificar origen; nunca se sugiere gasto para una transferencia entrante.
- Duplicados: comparación con gasto existente o continuar como otro gasto; se conservan huellas, callbacks y protección de stale writes.
- OAuth: conexión completada con próximo paso claro, sin redundancias del spike.

## Verificación y límites

TypeScript, build local de producción y tests de presentación/semántica. Suite completa registrada en el checkpoint de entrega. La galería /ui-exploration/mercadopago contiene datos ficticios, reutiliza componentes reales y no permite acciones financieras; está bloqueada en producción. Se utiliza para revisar estados poblados sin recuperar ni modificar movimientos reales.

No hay migraciones ni cambios a reglas de posting, RAW, sincronización, OAuth/PKCE o ledger. Auto-post/background mantienen el rollout vigente apagado. La matriz real del proveedor no se sustituye por estas pruebas de diseño.

## Handoff para Hermes

Decisión: reducir ruido con divulgación progresiva específica, sin cambiar evidencia ni reglas financieras. Hechos: la bandeja real está vacía tras el descarte previo y la configuración pudo observarse autenticada. Artefactos: componentes MP, ajustes opt-in a ParsePreview, tests y galería visual restringida. Riesgo: nombres largos requieren abrir detalle; se conserva el texto completo de origen. Pendientes: revisar Preview visual y cerrar publicación. No hubo delegación ni escrituras financieras durante este trabajo.
