# Configuración mobile — implementación visual acotada

Base `ac141e263910aa30f5d58e62038f957cec347f9b`, branch `feat/mobile-settings-visual`. Autorizado: planificar e implementar Configuración real mobile. No merge/push/deploy/Supabase. Principal dirty/stale intacto. `/web` no se modifica.

## Contrato
- Mejorar la composición de `/settings`, no crear una segunda Configuración.
- Mantener el título Perfil/Configuración según el flag existente y todos los controles disponibles bajo ambos valores.
- Encabezado de marca compacto y grupos verticales con títulos/descripciones legibles.
- Lectura: moneda y modo del saldo. Cuentas y tarjetas: selector de período local (límites -12/+3 intactos), paneles reales y sus formularios. Suscripciones conserva visibilidad del flag.
- Personalización e Integraciones mantienen entradas visibles; acceso y seguridad al pie, sin esconder acciones detrás de un carrusel.
- Reusar componentes de guardado sin alterar handlers, payloads, consultas ni confirmaciones. La mejora se aplica con CSS Module bajo un wrapper solo mobile-settings; no estilos globales ni variantes que cambien Web.
- No migrar Modal, auth ni lógica financiera en esta tarea. Deudas funcionales previas se documentan por separado.

## Pasos y aceptación
1. Test de render: regiones semánticas, período dentro del grupo financiero, controles y visibilidad por flag.
2. Implementación: SettingsPreferences + shell de página y CSS Module. Inputs/controles legibles, zonas táctiles, sin overflow 360/393/430; zoom y texto largo.
3. QA usando componentes reales de esta branch en runtime Next aislado con fixtures sintéticas e interceptación de red local. Requests inesperados/mutaciones bloqueados; nunca conectar Supabase. Capturas de entrada, cuentas/tarjetas desplegadas, modo de saldo y error/empty de bandeja. Comparador base y candidato con estilos de Gota.
4. Tests dirigidos, full suite, TypeScript, lint acotado, build aislado. Intentar build producto si recursos/config lo permiten; no confundir build de harness con build íntegro. Revisión independiente de la composición y fronteras.

## Rollout
Sin nueva feature flag: cambio presentacional restringido al owner de `/settings`, reversible por patch; el flag existente sigue controlando sus funcionalidades. No activar ni cambiar defaults. Mantener sin commit hasta revisión. No publicar ni habilitar en producción sin aprobación.
