# P1 Product Definition Brief

**Fecha:** 2026-04-22
**Base:** `docs/Codex - Feedback Audit y Backlog Gota 21.4.md`
**Estado:** documento de definicion con cierre parcial de decisiones al 2026-04-25. No es backlog cerrado ni especificacion final.

## Objetivo

Este documento ordena los items P1 antes de convertirlos en PBIs ejecutables. La idea es separar:

- que problema busca resolver cada item;
- por que importa para Gota;
- que alcance inicial tiene sentido;
- donde falta definicion de producto;
- que metricas conviene mirar antes y despues.

P1 debe avanzar activacion y primera experiencia sin reabrir la confianza financiera ya trabajada en P0.

## Estado al 2026-04-25

### Implementado

- Home reorganizado con jerarquia mas clara:
  - `Saldo Vivo` como hero principal;
  - `Disponible Real` como fila secundaria;
  - bloque `Comprometido en tarjetas`;
  - `Ultimos movimientos`;
  - `SmartInput` fijo.
- `Compromisos` de Home alineado con el universo que descuenta `Disponible Real`.
- Drill de `Compromisos` ajustado para usar comprometido neto y no solo consumo bruto.
- `SmartInput` simplificado:
  - placeholder fijo;
  - sin label visible de `Parseando...`;
  - feedback de guardado en accent.
- `ParsePreview` se mantuvo como flujo actual, pero:
  - `Necesidad/Deseo` paso a etiqueta chica;
  - `Deseo` es toggle funcional;
  - `Recurrente` y `Extraordinario` quedan reservados como placeholders visuales.
- Hero financiero sin toggle `ARS/USD` en Home.
- Nueva preferencia en configuracion para visualizacion de `Saldo Vivo`:
  - `Total ARS`
  - `Total USD`
  - `Moneda principal`
- Home usa cotizacion oficial via `/api/cotizaciones` y puede consolidar el hero segun preferencia.

### Requiere cierre operativo fuera del repo

- Correr en Supabase la migracion de `hero_balance_mode` en `user_config` para persistencia server-side entre dispositivos.

### Pendiente para una sesion futura

- Reevaluacion de `ParsePreview` como confirmacion siempre visible pero mas compacta.
- Onboarding nuevo desde cero.
- Conversion de anonimo a registrado.
- Error boundaries y fallbacks de rutas principales.
- Eventual sheet de detalle para hero consolidado en modos `Total ARS` / `Total USD`.

## Condicion de avance desde P0

El bloque P0 esta implementado localmente, pero algunos cierres operativos siguen pendientes. Se puede avanzar a P1 siempre que se mantenga esta regla:

- P1 puede ejecutarse en paralelo como mejora de producto.
- Antes de lanzamiento publico, deben cerrarse los open items operativos de P0:
  - Sentry produccion confirmado con smoke test visible;
  - validacion manual de pagos aplicables vs pagos legacy;
  - prueba manual de borrado de cuenta con usuario descartable;
  - retencion de logs externos definida.

P0-02 ya quedo validado funcionalmente con eventos reales en `product_events`.

## Principios P1

1. Reducir friccion antes que agregar features.
2. Hacer que SmartInput se sienta como experiencia principal, no como formulario asistido.
3. Mantener visible el modelo financiero de confianza: `Saldo Vivo`, deuda de tarjetas y `Disponible Real`.
4. Medir cambios con eventos existentes antes de sacar conclusiones.
5. No introducir paywall duro antes de que el usuario reciba valor.
6. Evitar migraciones visuales masivas sin relacion directa con activacion.

## Items P1

| Orden | Item | Tipo | Necesita definicion |
| ---: | --- | --- | --- |
| 1 | ParsePreview compacto | UX core | Media |
| 2 | SmartInput con estados visuales reales | UX core | Baja |
| 3 | Empty states y primera transaccion | Activacion | Media |
| 4 | Onboarding corto sin paywall inicial | Activacion | Alta |
| 5 | Hero: `Saldo Vivo` vs `Disponible Real` | Producto financiero | Alta |
| 6 | Conversion anonimo mejorada | Growth/retencion | Media |
| 7 | Error boundaries/fallbacks | Operabilidad UX | Baja/Media |

El orden recomendado prioriza superficies con menor decision estrategica y mayor impacto inmediato.

---

## 1. ParsePreview compacto

### Que busca hacer

Reducir el costo de confirmar un gasto parseado. Hoy el preview funciona como un formulario completo. P1 deberia convertirlo en una confirmacion rapida: el usuario ve lo esencial, corrige solo si hace falta y guarda.

### Por que importa

SmartInput promete velocidad. Si despues del parseo el usuario enfrenta demasiados campos, la experiencia vuelve a sentirse manual. El preview es el momento donde la app debe demostrar que entendio el gasto.

### Alcance sugerido

- Primer nivel visible:
  - monto;
  - moneda;
  - categoria;
  - fuente/cuenta/tarjeta;
  - boton principal de guardar.
- Campos secundarios bajo detalle o edicion expandida:
  - fecha;
  - cuotas;
  - necesidad/deseo;
  - ajustes avanzados.
- Mantener validaciones existentes:
  - tarjeta obligatoria para credito;
  - duplicados;
  - error inline de guardado.
- No cambiar schema ni semantica financiera.

### Metricas a mirar

- `smartinput_parse_succeeded`
- `parsepreview_confirmed`
- `parsepreview_cancelled`
- tiempo cualitativo entre preview y guardado, si luego se instrumenta.

Senal esperada:

- mayor proporcion `parsepreview_confirmed / smartinput_parse_succeeded`;
- menos cancelaciones por flujo confuso.

### Definiciones pendientes

- Que campos son siempre visibles en la version compacta.
- Si `Necesidad/Deseo` sigue siendo obligatorio visualmente o se asume default editable.
- Como se muestra el detalle expandido:
  - acordeon;
  - sheet section;
  - modo editar.
- Si cuotas deben aparecer automaticamente solo cuando el parseo detecta tarjeta o cuotas.

### Riesgos

- Ocultar demasiado puede generar errores de carga si el usuario no revisa fecha/cuenta.
- Si los defaults no son buenos, un preview compacto empeora confianza.
- El selector de fuente debe ser muy claro porque afecta `Saldo Vivo`.

### Listo para ejecutar cuando

- Esten definidos los campos visibles vs secundarios.
- Este claro el comportamiento de default para fecha, necesidad/deseo y cuenta.
- Se acepte que el cambio es solo UX, sin tocar modelo de datos.

---

## 2. SmartInput con estados visuales reales

### Que busca hacer

Dar feedback claro durante el ciclo completo de SmartInput:

- escribiendo;
- parseando;
- exito;
- error recuperable;
- confirmacion guardada.

### Por que importa

SmartInput es el diferencial de Gota. Si el usuario no entiende si la app esta pensando, fallo o guardo, la experiencia se siente fragil. Los estados visuales reducen incertidumbre y hacen que el parseo parezca una capacidad central del producto.

### Alcance sugerido

- Estado idle con placeholder util.
- Estado parsing con spinner o microcopy breve.
- Estado de exito que conecte con preview.
- Estado de error inline, sin `alert()`.
- Estado post-save que limpie input y permita cargar otro gasto rapido.
- Mantener copy corto y accionable.

### Metricas a mirar

- `smartinput_parse_started`
- `smartinput_parse_succeeded`
- `smartinput_parse_failed`
- `parsepreview_confirmed`

Senal esperada:

- mas intentos de parseo;
- menos abandono despues de error;
- mas confirmaciones despues de parseo exitoso.

### Definiciones pendientes

- Tono de copy para errores:
  - tecnico minimo;
  - cercano;
  - orientado a ejemplo.
- Si hay feedback visual post-save independiente del refresh del dashboard.
- Si se agregan ejemplos rotativos o se mantiene un unico placeholder.

### Riesgos

- Animaciones excesivas pueden distraer de la carga rapida.
- Copy largo puede parecer tutorial permanente.
- Si el parseo tarda por red/Gemini, el estado debe manejar espera real sin parecer trabado.

### Listo para ejecutar cuando

- Se apruebe el set de estados.
- Se defina el tono de errores.
- Se confirme que no se agregan dependencias pesadas.

---

## 3. Empty states y primera transaccion

### Que busca hacer

Convertir dashboard vacio en una guia directa hacia el primer valor: crear cuenta si falta, cargar primer gasto y ver impacto en el estado financiero.

### Por que importa

Un usuario nuevo no necesita entender toda la app. Necesita completar una primera accion que le muestre para que sirve Gota. Si el dashboard vacio solo muestra ausencia de datos, la activacion cae.

### Alcance sugerido

- Empty state para usuario sin cuentas.
- Empty state para usuario con cuenta pero sin gastos.
- CTA principal hacia SmartInput o creacion de cuenta segun estado.
- Mensaje muy corto orientado a accion.
- Evitar explicar todo el modelo financiero en el empty state.

### Metricas a mirar

- `first_account_created`
- `first_expense_created`
- `dashboard_loaded_with_data`
- `smartinput_parse_started`

Senal esperada:

- mas usuarios llegan a `first_expense_created`;
- menos dashboards vacios repetidos sin accion.

### Definiciones pendientes

- Que se considera "primer valor":
  - primera cuenta;
  - primer gasto;
  - ver `Saldo Vivo`;
  - ver `Disponible Real`.
- CTA principal por estado:
  - crear cuenta;
  - cargar gasto;
  - probar SmartInput.
- Si el usuario anonimo ve el mismo empty state o uno orientado a persistencia.

### Riesgos

- Empty state demasiado explicativo puede parecer onboarding duplicado.
- CTA incorrecto puede llevar al usuario a una accion que falla por falta de setup.
- Si se fuerza SmartInput sin cuenta/tarjeta preparada, el preview puede volverse confuso.

### Listo para ejecutar cuando

- Esten definidos los estados minimos del dashboard vacio.
- Se sepa que accion primaria corresponde a cada estado.
- Se confirme que el flujo no depende de nuevas tablas.

---

## 4. Onboarding corto sin paywall inicial

### Que busca hacer

Reducir el onboarding a lo minimo necesario para que el usuario llegue a valor. Sacar el paywall duro del flujo inicial y preservar la demo real de SmartInput.

### Por que importa

Gota compite contra la friccion de registrar finanzas personales. Si el onboarding pide demasiado antes de mostrar valor, se pierde la promesa de rapidez. El paywall temprano bloquea aprendizaje y medicion de activacion.

### Alcance sugerido

- Mantener solo pasos esenciales:
  - bienvenida breve;
  - primera cuenta o saldo inicial;
  - demo SmartInput;
  - entrada al dashboard.
- Quitar paywall inicial o convertirlo en informacion no bloqueante.
- Evitar pedir configuraciones que puedan esperar:
  - objetivos;
  - preferencias avanzadas;
  - features Pro.
- Registrar eventos baseline ya existentes.

### Metricas a mirar

- `onboarding_started`
- `onboarding_completed`
- `first_account_created`
- `first_expense_created`
- `smartinput_parse_started`

Senal esperada:

- mayor completion de onboarding;
- menor tiempo hasta primera cuenta/gasto;
- mas usuarios llegan al dashboard con datos.

### Definiciones pendientes

- Cuales son los pasos obligatorios.
- Que se hace con el paywall actual:
  - eliminar del onboarding;
  - mover despues de valor;
  - convertir en fake-door informativo.
- Si se permite entrar al dashboard sin cuenta.
- Si la demo de SmartInput crea datos reales o solo enseña el flujo.
- Copy exacto de promesa inicial.

### Riesgos

- Si se reduce demasiado, el dashboard puede quedar sin contexto ni datos.
- Sacar paywall puede demorar validacion de monetizacion, aunque mejora activacion.
- Si la demo usa datos reales sin claridad, puede ensuciar cuentas del usuario.

### Listo para ejecutar cuando

- Este firmado el nuevo flujo paso a paso.
- Se decida que el paywall inicial no bloquea.
- Se defina si la demo escribe datos o es simulada.

---

## 5. Hero: `Saldo Vivo` vs `Disponible Real`

### Que busca hacer

Decidir que numero debe liderar el dashboard y como se explica la relacion entre:

`Saldo Vivo - deuda pendiente de tarjetas = Disponible Real`

### Por que importa

El hero financiero define el modelo mental de Gota. `Saldo Vivo` funciona como trust engine de movimientos reales. `Disponible Real` puede ser mas accionable, pero depende de que el usuario entienda deuda de tarjeta y pagos.

### Alcance sugerido

- No borrar ninguno de los dos conceptos.
- Decidir default del hero:
  - `Saldo Vivo`;
  - `Disponible Real`;
  - toggle con default actual.
- Mejorar copy y detalle del sheet.
- Mantener visible el puente entre ambos numeros.
- Medir efecto antes de convertirlo en cambio permanente.

### Metricas a mirar

Eventos actuales:

- `dashboard_loaded_with_data`
- eventos de SmartInput y confirmacion como proxy de continuidad.

Eventos posibles a agregar luego:

- `hero_toggle_changed`
- `disponible_real_sheet_opened`
- `saldo_vivo_sheet_opened`

Senal esperada:

- menos confusion cualitativa;
- mayor continuidad despues de ver dashboard;
- menos discrepancias reportadas sobre tarjetas.

### Definiciones pendientes

- Cual es el default.
- Que copy explica el puente entre ambos numeros.
- Si el usuario puede elegir default persistente.
- Como se muestra deuda pendiente cuando no hay tarjetas.
- Como se comunica pago legacy sin meter jerga contable.

### Riesgos

- Cambiar default a `Disponible Real` puede hacer que usuarios no entiendan por que no coincide con cuentas.
- Mantener `Saldo Vivo` como default puede ser menos accionable para decision diaria.
- Si pagos legacy no estan validados manualmente, conviene no hacer un cambio agresivo de hero.

### Listo para ejecutar cuando

- Este tomada la decision de default.
- Este aceptada la formula visible.
- Este validado manualmente el caso tarjeta: consumo, pago aplicable y pago legacy.

---

## 6. Conversion anonimo mejorada

### Que busca hacer

Mejorar el paso de usuario anonimo a usuario registrado con un trigger contextual y copy centrado en persistencia de datos, no en marketing generico.

### Por que importa

El usuario anonimo puede recibir valor rapido, pero si no se registra, el producto pierde continuidad y retencion. La conversion debe aparecer cuando el usuario ya tiene algo que proteger o continuar.

### Alcance sugerido

- Mantener `AnonymousBanner` como base.
- Mejorar triggers:
  - despues de cierta cantidad de movimientos;
  - despues de volver otro dia;
  - despues de crear cuenta/gasto;
  - antes de acciones sensibles si aplica.
- Copy concreto:
  - guardar progreso;
  - no perder movimientos;
  - acceder desde otro dispositivo.
- Medir vistas, inicio y completado.

### Metricas a mirar

- `anonymous_banner_seen`
- `anonymous_link_started`
- `anonymous_link_completed`
- `first_expense_created`
- `dashboard_loaded_with_data`

Senal esperada:

- mayor conversion anonimo a registrado;
- menor cierre del banner sin accion;
- mas usuarios vuelven con datos persistidos.

### Definiciones pendientes

- Cuales son los triggers exactos.
- Si el banner es persistente, dismissible o contextual.
- Cuantas veces se muestra antes de reducir frecuencia.
- Que proveedor/metodo de login se prioriza.
- Que copy legal/minimo hace falta por tratarse de datos financieros.

### Riesgos

- Si aparece demasiado pronto, interrumpe la activacion.
- Si aparece tarde, el usuario puede perder datos o no volver.
- Si el copy promete demasiado, aumenta riesgo de confianza.

### Listo para ejecutar cuando

- Se definan triggers y frecuencia.
- Se apruebe copy de persistencia.
- Se confirme que eventos anonimos funcionan como se espera.

---

## 7. Error boundaries y fallbacks en rutas principales

### Que busca hacer

Agregar recuperacion visible cuando fallan rutas o superficies importantes: dashboard, analytics, movimientos, parseo o guardado.

### Por que importa

Sentry captura errores, pero el usuario necesita una salida. En una app financiera, una pantalla rota sin explicacion destruye confianza aunque el error sea temporal.

### Alcance sugerido

- Revisar rutas principales:
  - dashboard;
  - analytics;
  - movimientos;
  - settings/cuenta si aplica.
- Agregar boundaries o fallbacks locales donde tenga sentido.
- Mensajes cortos con accion:
  - reintentar;
  - recargar;
  - volver al dashboard.
- Capturar errores sin enviar datos sensibles.

### Metricas a mirar

Sentry:

- errores por ruta;
- frecuencia;
- entorno.

Eventos posibles a agregar luego:

- `route_error_seen`
- `route_error_retry_clicked`

### Definiciones pendientes

- Que rutas entran en P1 y cuales quedan para P2.
- Si se usa un boundary global, local o ambos.
- Copy estandar para errores financieros.
- Si se muestra soporte/contacto o solo reintento.

### Riesgos

- Un fallback demasiado generico puede ocultar bugs importantes.
- Capturar demasiado contexto puede filtrar datos sensibles si no se mantiene redaccion.
- Si cada ruta inventa su UI, se fragmenta el sistema de errores.

### Listo para ejecutar cuando

- Este definido el set de rutas criticas.
- Se apruebe copy base.
- Se confirme que Sentry prod esta operativo o se deja como dependencia explicita.

---

## Decisiones a firmar antes de PBIs

### Decision A - Default del hero financiero

Opciones:

1. Mantener `Saldo Vivo` como default y mejorar explicacion de `Disponible Real`.
2. Cambiar `Disponible Real` a default y mantener puente visible con `Saldo Vivo`.
3. Mantener toggle y medir apertura/cambio antes de decidir.

Recomendacion inicial: no cambiar default hasta terminar validacion manual de pagos tarjeta/legacy.

### Decision B - Paywall en onboarding

Opciones:

1. Eliminarlo del onboarding inicial.
2. Moverlo despues de primera accion de valor.
3. Convertirlo en fake-door informativo.

Recomendacion inicial: eliminar bloqueo inicial y medir activacion primero.

### Decision C - Demo SmartInput

Opciones:

1. Demo simulada que no crea datos.
2. Demo real que crea primer gasto.
3. Demo real opcional con confirmacion explicita.

Recomendacion inicial: demo real opcional con confirmacion clara.

### Decision D - Nivel de compactacion de ParsePreview

Opciones:

1. Compacto agresivo: solo monto, categoria, fuente y guardar.
2. Compacto moderado: monto, categoria, fuente, fecha visible.
3. Actual con orden visual mejorado.

Recomendacion inicial: compacto moderado si los defaults todavia no estan suficientemente probados.

### Decision E - Trigger de conversion anonima

Opciones:

1. Mostrar al entrar.
2. Mostrar despues del primer gasto.
3. Mostrar despues de varios movimientos o retorno.

Recomendacion inicial: despues del primer gasto o primer dashboard con datos.

## Propuesta de ejecucion

### Tanda 1 - SmartInput y confirmacion

- ParsePreview compacto.
- Estados visuales reales de SmartInput.
- Empty state hacia primera transaccion si cae dentro del mismo flujo.

Motivo: menor necesidad de decision estrategica y mayor impacto directo sobre activacion.

### Tanda 2 - Onboarding

- Reducir pasos.
- Sacar paywall inicial.
- Mantener demo SmartInput.

Motivo: requiere definicion de flujo y puede tocar mas superficie.

### Tanda 3 - Hero financiero

- Definir default.
- Ajustar copy y sheet.
- Medir comportamiento.

Motivo: alto impacto en modelo mental; conviene entrar con pagos tarjeta/legacy ya validados manualmente.

### Tanda 4 - Conversion y fallbacks

- AnonymousBanner contextual.
- Error boundaries/fallbacks.

Motivo: complementan activacion y operabilidad una vez estabilizado el flujo principal.

## Checklist para convertir un item P1 en PBI

- [ ] Problema y usuario objetivo definidos.
- [ ] Decision abierta resuelta o explicitamente acotada.
- [ ] Alcance minimo acordado.
- [ ] Eventos/metricas a revisar definidos.
- [ ] Riesgos principales escritos.
- [ ] No depende de P0 operativo sin declararlo.
- [ ] Archivos candidatos identificados.
- [ ] Criterios de aceptacion redactados.
