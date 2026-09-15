# Spike OAuth personal de Mercado Pago (Argentina)

Este spike prueba, de forma read-only y sin persistencia, qué recursos quedan disponibles después de autorizar una cuenta personal argentina mediante OAuth.

## Alcance y seguridad

- `connect` requiere sesión Supabase y falla cerrado si falta `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET` o `MERCADOPAGO_REDIRECT_URI`.
- Usa `state` y PKCE S256 en cookies `HttpOnly`, `Secure`, `SameSite=Lax`, con vencimiento de 600 segundos.
- El callback intercambia el `code` server-side con el único `POST` permitido: `/oauth/token`.
- Después sólo ejecuta `GET` a `/users/me`, `/v1/account/settlement_report/list` y `/v1/payments/search`, con ventana de 24 horas y límite 5.
- No genera ni configura reportes.
- No escribe en DB, ledger, UI financiera ni sistemas externos fuera del intercambio OAuth.
- No persistir, copiar ni pegar secretos en chat, issues, logs o capturas. Configurar secretos sólo en el entorno seguro del servidor.
- El callback nunca devuelve ni loguea access token, refresh token, client secret, header Authorization ni valores de IDs del proveedor.

Callback exacto requerido:

`https://gota-arg.vercel.app/api/integrations/mercadopago/callback`

## Pasos seguros de prueba

1. Crear/configurar la aplicación OAuth de Mercado Pago con el callback exacto anterior.
2. Configurar en el entorno de ejecución sólo `MERCADOPAGO_CLIENT_ID`, `MERCADOPAGO_CLIENT_SECRET` y `MERCADOPAGO_REDIRECT_URI`.
3. Iniciar sesión en Gota con la cuenta de prueba autorizada.
4. Abrir `GET /api/integrations/mercadopago/connect` y completar el consentimiento en Mercado Pago.
5. Revisar únicamente el diagnóstico sanitizado del callback: status HTTP, éxito, tipo de payload, count inferido y nombres de campos allowlisted.
6. Invalidar/revocar la autorización desde Mercado Pago cuando termine la prueba.

## Criterio GO / NO-GO

GO sólo si la cuenta personal argentina puede completar OAuth, el callback responde sin secretos ni datos financieros/IDs, y los tres probes read-only devuelven diagnósticos reproducibles con los permisos esperados.

NO-GO ante cualquier escritura distinta del `POST /oauth/token`, persistencia local/DB, exposición de secretos, valores financieros, descripciones o IDs, necesidad de generar/configurar reportes, o respuesta no sanitizada.

Este spike no crea conexiones, no guarda tokens y no tiene persistencia. Cualquier integración permanente requiere una decisión y un diseño separados.
