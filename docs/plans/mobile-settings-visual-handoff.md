# Entrega — Configuración mobile

## Código implementado (no desplegado)

Base `ac141e2`, branch `feat/mobile-settings-visual`, worktree `/root/projects/Gota-worktrees/mobile-settings-visual`.

- `app/(dashboard)/settings/page.tsx`: shell y sección Acceso y seguridad, sin cambios en loader ni consultas.
- `components/settings/SettingsPreferences.tsx`: encabezado BlueHeaderZone, Lectura, Cuentas y tarjetas con período local, Personalización e Integraciones. Mismos componentes, props, estados y límites de mes.
- `components/settings/MobileSettings.module.css`: estilos exclusivos del owner, contraste, divisores, tipografía, botones táctiles y ajuste de controles. No altera `globals.css` ni WebSettingsPage.
- `lib/mobile-settings-visual.test.ts`: tres tests de composición/visibilidad por flag. Primer test falló antes de implementar y pasó después.

## Verificado

- Suite final: **101 archivos / 629 tests passed** (`/tmp/gota-mobile-settings-tests-final.log`).
- TypeScript completo `tsc --noEmit`: exit 0.
- ESLint sobre archivos TS/TSX tocados: exit 0.
- `git diff --check`: exit 0.
- Build Next de harness aislado `.qa/settings`: exit 0, incluye los componentes reales importados desde el repo. **No es el build completo de toda Gota**; no se ejecutó ese build por espacio disponible insuficiente (140 MB medidos tras la primera verificación).
- Playwright/Chromium contra build + start: 360, 393, 430 y 768 px sin overflow de documento en entrada; edición de tarjeta desplegada comprobada también a 360 px.
- Cambio mensual hasta ambos límites, expansión cuentas/tarjetas, sheet de modo de saldo/Escape, paneles alias y dispositivos vacíos, cancelar cambio de moneda sin write, error/reintento de bandeja, flag off.
- QA final: sin pageerrors ni destinos de red inesperados. Las lecturas `/api` se responden por interceptación Playwright con fixtures locales. No se llamó a endpoints financieros reales ni a Supabase. No hubo POST/PUT/PATCH/DELETE durante la ejecución.
- Capturas finales comparan componentes base vs candidato con el mismo caso y flag off, coherente con el tab bar del build local. Los casos que ejercitan preferencias con flag on se prueban aparte; no afirman estado de flags productivas.

## Límites y pendientes

- Revisión independiente recibida (`deleg_348cfe51`): `passed: true`, sin hallazgos de seguridad ni errores lógicos. Sugiere, sin bloquear, revisar la etiqueta visual «Suscripciones» oculta por CSS (no oculta el control ni su nombre accesible) y agregar tests de interacción de límites -12/+3 a la suite unitaria. Estos límites ya se ejercitaron en el QA Playwright. No se aplicaron cambios productivos a raíz del informe.
- No autenticación real ni guardados sobre backend. Passkeys se fuerza a no soportado en el harness para evitar requests/auth e inconsistencias SSR propias del owner actual. No certifica WebAuthn.
- No validación en iPhone/PWA instalado, teclado nativo o safe-area física.
- Los handlers y modales existentes se conservaron. Sus problemas previos (p. ej. accesibilidad desigual del Modal legacy y errores de cargas de cuentas) no se corrigen por un cambio visual.
- La nueva composición prioriza agrupación y legibilidad sobre cantidad de secciones en el primer viewport. Ese trade-off se ve en la comparación y queda sujeto a revisión del usuario.
- No merge, push, deploy, nuevas flags ni cambios en Supabase. Sin commit.

## Evidencia local

`.qa/settings/evidence/comparacion.png`, `despues.png`, `cuentas-tarjetas.png`, `tarjeta-edicion-360.png`, `modo-saldo.png`, `alias-vacio.png`, `bandeja-error.png`, `vacio-flag-off.png` y `qa.json`.

El harness `.qa/settings` es solo QA, no ruta productiva para publicar. Para repetir localmente: construir con `npm run build` dentro de `.qa/settings`, iniciar `npm run start` (127.0.0.1:3128), y ejecutar `uv run --with playwright --with pillow python qa.py`. Abrir manualmente sin interceptación no equivale al caso de QA: no hay backend en este runtime.
