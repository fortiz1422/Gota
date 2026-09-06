# Gota — Importar comprobante desde iPhone

Esta guía define el paquete publicable del Shortcut **Compartir con Gota**. El archivo fuente auditable está en [`gota-receipt-import.manifest.json`](./shortcuts/gota-receipt-import.manifest.json).

## Alcance y seguridad

- El Shortcut recibe únicamente **Imágenes** desde la **Hoja para compartir**.
- La credencial se crea en Gota, se muestra una sola vez y se pega en una **Pregunta de importación** de Apple Shortcuts llamada `Token de importación`.
- El token no debe incluirse en este repositorio, en capturas, en el nombre del Shortcut ni en una URL.
- Si se revoca el dispositivo en Gota, hay que crear una credencial nueva e importar/editar el Shortcut con el token nuevo.
- El Shortcut solo sube el comprobante. Gota no crea movimientos hasta que el usuario analiza, revisa y confirma la propuesta en la app.

## Construcción exacta en iOS

Configurar los detalles del Shortcut:

1. Nombre: `Compartir con Gota`.
2. Activar **Mostrar en hoja para compartir**.
3. En “Recibe”, dejar únicamente **Imágenes**. Desactivar el resto de tipos.
4. Crear una **Pregunta de importación** sobre el valor del header de autorización:
   - Pregunta: `Pegá el token de importación que te mostró Gota`.
   - Valor preguntado: solo el token, sin escribir `Bearer`.

Agregar estas acciones, en este orden:

1. **Si** `Entrada del atajo` **no tiene ningún valor**:
   - **Mostrar alerta**: título `No hay una imagen`; mensaje `Compartí una foto o captura del comprobante.`
   - **Detener este atajo**.
2. **Obtener elemento de la lista** de `Entrada del atajo`: `Primer elemento`.
3. **Obtener detalles de imágenes**: obtener `Tipo de archivo` del primer elemento.
4. **Si** el tipo no comienza con `image/`:
   - **Mostrar alerta**: título `Formato no compatible`; mensaje `Compartir con Gota solo acepta imágenes.`
   - **Detener este atajo**.
5. **Convertir imagen**:
   - Entrada: el primer elemento.
   - Formato: `JPEG`.
   - Preservar metadatos: desactivado.
6. **Obtener contenido de URL**:
   - URL: `https://<dominio-de-gota>/api/shortcut/v1/receipts` (el publicador reemplaza solo el origen por el dominio HTTPS de producción).
   - Método: `POST`.
   - Headers:
     - `Authorization`: `Bearer ` seguido de la variable de la **Pregunta de importación** `Token de importación`.
   - Cuerpo de la solicitud: `Formulario`.
   - Campo de formulario: clave `file`, tipo `Archivo`, valor `Imagen convertida`.
7. **Obtener diccionario de la entrada** usando la respuesta de la acción anterior.
8. **Obtener valor del diccionario** para la clave `status`.
9. Resolver la respuesta con acciones **Si**:
   - Si `status` es `accepted`: **Mostrar notificación** `Comprobante recibido. Abrí Gota para revisarlo.`
   - Si `status` es `duplicate`: **Mostrar notificación** `Ese comprobante ya había sido recibido. Abrí Gota para revisarlo.`
   - Si `status` es `unauthorized` o el código HTTP es `401`: **Mostrar alerta** `Token inválido o vencido. Creá uno nuevo en Gota > Integraciones.`
   - Si `status` es `too_large` o el código HTTP es `413`: **Mostrar alerta** `La imagen supera el límite permitido. Recortala o reducí su tamaño e intentá de nuevo.`
   - En cualquier otro resultado: **Mostrar alerta** `No pudimos enviar el comprobante. Intentá de nuevo.`

No agregar `Continuar en app`, creación de movimientos ni confirmación automática al Shortcut.

> Nota de empaquetado: Apple firma los archivos `.shortcut` al compartirlos desde Shortcuts/iCloud. Este entorno Linux puede versionar y validar la receta, pero **no puede generar un `.shortcut` firmado e instalable**. El paquete final debe reconstruirse y publicarse desde un iPhone, iPad o Mac con Shortcuts.

## Contrato esperado de respuesta para el Shortcut

La receta contempla estos resultados sin guardar datos financieros:

| Resultado | HTTP | Valor para la rama |
| --- | ---: | --- |
| Recibido | 200/201/202 | `status = accepted` |
| Ya recibido | 200/409 | `status = duplicate` |
| Token inválido, vencido o revocado | 401 | `status = unauthorized` o código 401 |
| Imagen demasiado grande | 413 | `status = too_large` o código 413 |

El backend que implemente el upload debe devolver JSON aun en errores controlados para que el Shortcut pueda mostrar el mensaje correspondiente. Este corte no implementa esa ruta.

## Checklist final de publicación en iCloud

- [ ] Reconstruir en Apple Shortcuts siguiendo exactamente el manifiesto versionado.
- [ ] Confirmar “Mostrar en hoja para compartir” y entrada limitada a **Imágenes**.
- [ ] Confirmar conversión a **JPEG** antes del upload.
- [ ] Confirmar método **POST**, cuerpo **Formulario**, campo de archivo exacto `file`.
- [ ] Confirmar header `Authorization: Bearer <Pregunta de importación>` sin token real embebido.
- [ ] Reemplazar `<dominio-de-gota>` por el dominio HTTPS de producción, sin cambiar `/api/shortcut/v1/receipts`.
- [ ] Probar imagen válida y comprobar `accepted`.
- [ ] Reenviar la misma imagen y comprobar `duplicate`.
- [ ] Probar token revocado y comprobar el mensaje de `401`.
- [ ] Probar un archivo por encima del límite y comprobar el mensaje de `413`.
- [ ] Confirmar que ninguna prueba crea un movimiento sin revisión y confirmación en Gota.
- [ ] Compartir el Shortcut desde un dispositivo Apple y publicar el enlace de iCloud.
- [ ] Instalar desde el enlace en un segundo dispositivo y verificar que aparece la Pregunta de importación.
- [ ] Configurar `NEXT_PUBLIC_IOS_SHORTCUT_INSTALL_URL` con el enlace final y generar un nuevo build; mientras esté ausente, la UI debe decir `Plantilla todavía no publicada`.
- [ ] Revocar los tokens de prueba y borrar capturas o portapapeles que pudieran contenerlos.
