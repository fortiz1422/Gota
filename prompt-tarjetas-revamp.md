# Revamp: Vistas de Tarjetas

Necesito que hagas un revamp de diseño en tres vistas relacionadas con tarjetas.
Antes de tocar cualquier archivo, revisá `app/globals.css` y `lib/design-tokens.ts`
para usar las utilities reales del sistema (glass-1/2/3, type-*, tokens de color).
No inventes clases ni patrones nuevos — usá los que ya existen en el codebase.

---

## Vista 1: Sheet / Lista de tarjetas

**Archivo:** encontralo buscando el componente que renderiza la lista de tarjetas
en el sheet de configuración (probablemente en `components/` o `app/config/`).

**Problemas actuales:**
- Fondo blanco puro en lugar del bgPrimary del sistema
- Nombres de tarjetas en ALL CAPS — cambiarlos a title case en el render
  (no tocar la DB, solo el display)
- Subtítulo "Cierra en Nd" repetido igual en todas las filas — no aporta
  diferenciación cuando todas cierran el mismo día
- No muestra el devengado del mes actual por tarjeta
- El botón "Nueva tarjeta" está partido entre un placeholder de texto y un FAB
  flotante — unificarlos en un único row al pie de la lista

**Cambios a hacer:**
1. Aplicar `glass-2` como superficie del contenedor de la lista
2. Cada row: ícono Phosphor `CreditCard` dentro de un pill con `glass-1`,
   nombre en title case, subtítulo con cuenta asociada + días al cierre,
   columna derecha con monto devengado del mes en curso (si es 0, mostrar
   "sin gastos" en `text-dim`)
3. Header del sheet: título "Tarjetas (n)" + línea secundaria con el total
   devengado sumado de todas las tarjetas
4. "Nueva tarjeta": un row separado debajo de la lista (misma surface glass-2),
   con ícono `Plus` de Phosphor en pill con tinte accent, texto en color accent

---

## Vista 2: Página de configuración de tarjeta individual

**Archivo:** encontralo buscando la página/componente de detalle de tarjeta,
algo como `TarjetaDetail`, `CardConfig`, o similar.

**Problemas actuales:**
1. El `<select>` nativo de "Cuenta" rompe el sistema visual — es el único
   elemento con estilo default del OS
2. Los dos botones "Pagar resumen" tienen el mismo peso visual (ambos azul
   sólido), pero uno es EN CURSO y otro CERRADO — deberían tener jerarquía
   diferente
3. El link "Pago de tarjeta anterior a tus resúmenes de Gota" está inline
   junto al label de sección RESUMENES — es un patrón raro y difícil de
   encontrar
4. "Eliminar tarjeta" como botón outline rojo a full width es demasiado
   prominente para una acción destructiva que casi nunca se usa

**Cambios a hacer:**
1. Reemplazar el `<select>` nativo de Cuenta por el patrón de selector custom
   que ya existe en la app (si hay un componente reutilizable de dropdown/select,
   usarlo; si no, construir uno consistente con el sistema)
2. Botón "Pagar resumen" del resumen EN CURSO: mantener estilo primario
   (btn-primary o equivalente). Botón del resumen CERRADO: bajar a estilo
   secundario/outline
3. "Pago anterior a Gota": moverlo a su propia row navegable dentro de una
   glass card separada, debajo de la sección RESUMENES. Row con ícono Phosphor
   `ClockCounterClockwise`, título "Pago anterior a Gota", subtítulo "Deuda
   existente antes de usar la app", chevron derecho
4. "Eliminar tarjeta": reemplazar el botón outline por un texto link pequeño
   centrado al pie de la página, en `text-dim`, con un confirm dialog antes
   de ejecutar

---

## Vista 3: Bottom sheet de pago de tarjeta

**Archivo:** encontralo buscando el componente que se abre al tocar
"Pagar resumen" — probablemente un Modal o Sheet con formulario de pago.

**Problemas actuales:**
1. El input de monto muestra el número crudo sin formato (`369192`)
2. Los campos Cuenta y Fecha usan bordes rectangulares planos que no
   corresponden al sistema visual
3. "Gastos registrados" con chevron está suelto sin contexto visual claro
4. El CTA dice siempre "Registrar pago" sin importar si el monto fue
   modificado o no

**Cambios a hacer:**
1. Input de monto: aplicar surface glass con focus ring accent, formatear
   el valor en tiempo real con separadores de miles (es-AR), prefijo `$`
   separado visualmente. El campo viene pre-llenado con el total del resumen
   y es editable (pago parcial habilitado)
2. Cuenta + Fecha: agruparlos en una glass card con rows separados por
   divider sutil, usando el mismo patrón de `field-row` que ya existe en
   otros sheets de la app
3. "Gastos registrados": convertirlo en una row colapsable dentro de su
   propia glass card. Colapsado muestra label + monto total + chevron.
   Expandido muestra el breakdown de gastos del resumen
4. CTA dinámico según el monto ingresado:
   - igual al total del resumen → "Registrar pago total"
   - menor al total → "Registrar pago parcial"
   - vacío o cero → botón deshabilitado

---

## Notas generales

- No cambiar lógica de negocio ni estructura de datos, solo presentación
- Mantener todos los handlers y callbacks existentes
- Si un patrón que necesito no existe como componente reutilizable pero
  aparece en 2+ lugares, extraerlo. Si solo se usa acá, implementarlo inline
- Correr `npm run build` al final y resolver cualquier error de tipos antes
  de terminar
