# Handoff para Hermes — revisión MP y MODO

Fecha de referencia: 24/10/2026, Argentina. Repo: fortiz1422/Gota. Base: main `5912198` (#157). Rama: `feat/mp-batch-review`. Autorización: Facundo pidió revisar PRs recientes, plantear e implementar la mejora de revisión de MP; agregó apertura de comprobantes MODO y estado de lote/confianza.

## Hechos revisados

- #145 publicó el lote de comprobantes, no el de MP. #150 persistió reintentos de memoria de comercio. #146 y #152 ampliaron captura MP hacia revisión manual, sin resolver esta fricción.
- En MP la selección existente solo descarta. El formulario individual exige repetir descripción/categoría/tarjeta. Se observó la captura aportada por Facundo; no se leyó su historial financiero real.
- La campana de comprobantes llevaba a `/shared-receipts/:id`; `/shared-receipts` contiene el lote publicado.
- `getSharedReceipt` propagaba el fallo de firma de la imagen y bloqueaba todos los datos. Las URLs firmadas duran 300 segundos y el visor individual no las renovaba al abrir. Son fallos demostrables del código, pero la causa exacta del incidente real de Facundo sigue sin confirmar.

## Decisiones e implementación

- MP: botón visible Completar en lote; selección explícita, búsqueda por texto/tarjeta, hasta 20 por tanda, aplicar descripción y categoría comunes. Las excepciones individuales quedan plegadas. No se interpreta que iguales importes o comercios vacíos sean peajes.
- La tarjeta puede elegirse una vez para los seleccionados que compartan marca y últimos cuatro dígitos informados por MP. No persiste una nueva equivalencia ni cambia la evidencia del proveedor. El matcher existente solo sugiere coincidencias determinísticas.
- Preview con importes, monedas, fechas y cuotas de la misma rama semántica usada por el backend. No se envían importes ni fechas editables. Una tarjeta no se convierte en saldo MP.
- Confirmación secuencial con el endpoint canónico existente, fingerprint y versión de cuenta cuando corresponde. Sin nuevo RPC/migración/flag/servicio. El backend conserva control de propietario, elegibilidad, duplicados e idempotencia.
- Ante conflicto, error HTTP, timeout o respuesta incierta se detiene la tanda, conserva los éxitos recibidos y exige actualizar la bandeja. Nunca hay reenvío automático. El último envío puede haber sido registrado sin respuesta: se advierte explícitamente.
- Descripción vacía: aprovechar `statementDescriptor` existente, quitando únicamente el prefijo MERPAGO*. No se inventa un comercio.
- MODO: campana a bandeja de lotes; editor individual accesible desde allí. Revisión directa aunque haya imagen; regenerar URL al abrir, mostrar fallo y reintento sin bloquear revisión; fallo de firma retorna los datos del dueño con imagen no disponible, sin exponer ruta de almacenamiento.
- Categoría MODO: alias exacto guardado, regla verificada acotada (actualmente McDonald's con acuerdo del parser) o sugerencia que requiere revisión. La confianza numérica del lector no certifica categoría; no se introduce un porcentaje sin calibración.

## Riesgos, límites y pendientes

- Confirmar en lote registra gastos reales solo cuando la persona confirma. Se probó con APIs sintéticas; no se confirmaron gastos reales ni se alteró el canon durante el desarrollo.
- Los 60 movimientos de Facundo no se clasificaron ni registraron durante este trabajo.
- Descripciones ausentes sin otro dato siguen requiriendo identificación humana; no hay nueva fuente de datos MP.
- Memoria automática de tarjeta/comercio para futuras importaciones fuera del alcance de este corte. El lote MP no consulta masivamente alias ni consume IA.
- La detención ante una respuesta incierta es conservadora y puede exigir otra tanda tras actualizar. La recuperación depende del estado autoritativo del backend existente.
- Origen de categoría y confianza de extracción son dimensiones distintas. No presentar «regla verificada» como certeza absoluta de una operación real.
- No se verificó la causa del incidente en la sesión real del iPhone ni se hicieron cambios de datos productivos. Merge y despliegue son pasos separados; el roadmap queda En curso hasta el merge.

## Verificación

Ver detalle actualizado en el PR. Se agregaron pruebas de intención y recuperación MP, fallo de firma sin pérdida de datos ni exposición de storage, apertura directa, renovación de imagen y reuso de análisis guardado. Playwright intercepta APIs con datos ficticios en 320/390/768/1440. Fixtures de exploración dev-only; `notFound()` en producción. La CI de ingestión incluye los nuevos recorridos.

Rollback: revertir el PR. No hay migración que deshacer ni cambios de flags. Evitar activar posting/reconciliación como consecuencia de este trabajo.
