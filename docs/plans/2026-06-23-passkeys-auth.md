# Passkeys Auth Implementation Plan

> **For Hermes:** implementar directamente en este branch con cambios mínimos y verificación real.

**Goal:** agregar login por passkey en Gota sin romper la UI actual de la landing, y permitir registrar/gestionar passkeys desde la cuenta.

**Architecture:** usar passkeys nativas de Supabase Auth (WebAuthn) como método primario de login y como credencial adicional para usuarios ya autenticados. Mantener Google, email OTP/password y modo exploración intactos como fallback. Encapsular la lógica de passkeys en `lib/auth.ts` y reutilizar un componente de gestión en Settings mobile/web.

**Tech Stack:** Next.js 16, React 19, Supabase Auth, `@supabase/supabase-js` con `auth.experimental.passkey`, Tailwind/tokens Gota.

---

## Alcance

1. Subir `@supabase/supabase-js` a una versión con passkeys.
2. Habilitar passkeys en los clientes Supabase browser/server.
3. Agregar helpers de auth para:
   - login por passkey
   - registro de passkey autenticado
   - listado de passkeys
   - rename/delete de passkeys
4. Mantener la landing visualmente estable, sumando CTA de passkey sin rediseño disruptivo.
5. Agregar gestión de passkeys en:
   - `AccountSection` mobile
   - `WebSettingsPage` web
6. Verificar con lint/build y prueba visual de login/settings.

## Restricciones

- No eliminar Google ni email.
- No tocar lógicas de producto ajenas a auth.
- No prometer upgrade anónimo → passkey directo: Supabase exige usuario confirmado y no anónimo para registrar passkey.
- Si la feature no está habilitada en Supabase Dashboard, mostrar error accionable en UI.

## Archivos previstos

- Modificar: `package.json`
- Modificar: `package-lock.json`
- Modificar: `lib/supabase/client.ts`
- Modificar: `lib/supabase/server.ts`
- Modificar: `lib/auth.ts`
- Modificar: `app/(auth)/login/LoginButton.tsx`
- Modificar: `app/(dashboard)/settings/page.tsx`
- Modificar: `components/settings/AccountSection.tsx`
- Modificar: `components/web/settings/WebSettingsPage.tsx`
- Crear: `components/auth/PasskeysPanel.tsx`

## Verificación

1. `npm run lint`
2. `npm run build`
3. levantar app y revisar `/login`, `/settings`, `/web/settings`
4. comprobar que la landing conserva jerarquía visual y no rompe layout
5. validar que los CTAs y mensajes de fallback sigan presentes
