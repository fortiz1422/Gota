# Mockup - Resumenes de Tarjeta Multimoneda

## Idea

La vista deja de tratar `ARS` y `USD` como dos pantallas separadas.
Cada ciclo de tarjeta se muestra como un solo resumen, y adentro vive el
detalle por moneda.

Esto busca que la experiencia se parezca mas a como el usuario piensa un
resumen real: un mismo cierre, con una deuda en pesos y otra en dolares.

## Mockup

```text
╭──────────────────────────────────────────────╮
│ Santander Visa                               │
│ Cierre 08 may · Vence 16 may                 │
│                                              │
│ Resumen actual                               │
│                                              │
│ ╭──────────────────────────────────────────╮ │
│ │ ARS                                      │ │
│ │ Total         $ 428.500                  │ │
│ │ Pagado        $ 120.000                  │ │
│ │ Pendiente     $ 308.500                  │ │
│ │                                  [Pagar] │ │
│ ╰──────────────────────────────────────────╯ │
│                                              │
│ ╭──────────────────────────────────────────╮ │
│ │ USD                                      │ │
│ │ Total         US$ 470                    │ │
│ │ Pagado        US$ 200                    │ │
│ │ Pendiente     US$ 270                    │ │
│ │                                  [Pagar] │ │
│ ╰──────────────────────────────────────────╯ │
│                                              │
│ Movimientos del ciclo                        │
│                                              │
│ ARS                                          │
│ Supermercado                    $ 84.200     │
│ Nafta                           $ 51.300     │
│ Seguro                          $ 29.900     │
│ Ver todos >                                  │
│                                              │
│ USD                                          │
│ Booking                      US$ 220         │
│ Apple                         US$ 12         │
│ Amazon                        US$ 38         │
│ Ver todos >                                  │
│                                              │
│ Pago registrado el 10 may en ARS             │
╰──────────────────────────────────────────────╯
```

## Lectura de producto

- La card principal sigue siendo el ciclo.
- `ARS` y `USD` aparecen como bloques hermanos dentro del mismo resumen.
- Cada moneda tiene su propio:
  - total
  - pagado
  - pendiente
  - CTA de pago
- Si una moneda no tiene consumo ni pago, ese bloque no se muestra.
- El detalle de movimientos tambien se separa por moneda dentro del ciclo.

## Jerarquia visual sugerida

- Header del ciclo con datos de `cierre` y `vencimiento`.
- Bloque `ARS` primero si es la moneda principal del usuario.
- Bloque `USD` despues, con el mismo layout pero menor protagonismo visual si
  tiene menos pendiente.
- El CTA de cada bloque debe decir la moneda implicitamente por contexto:
  `Pagar`, `Editar`, `Revertir pago`.
- El estado del ciclo no deberia ser uno solo. Puede verse:
  - `ARS pendiente`
  - `USD pagado`

## Variante mas compacta

Si queres una version mas densa para mobile, los bloques pueden pasar a una
fila de tres metricas y un CTA:

```text
ARS   Total $ 428.500   Pagado $ 120.000   Pendiente $ 308.500   [Pagar]
USD   Total US$ 470     Pagado US$ 200     Pendiente US$ 270     [Pagar]
```

## Por que mejora frente al toggle

- Evita cambiar de contexto para entender la deuda completa.
- Se parece mas al resumen bancario real.
- Hace evidente que una moneda puede estar paga y la otra no.
- Reduce el riesgo de que el usuario crea que ya saldo todo el ciclo.

## Recomendacion

Si avanzamos con esta direccion, yo haria la pantalla asi:

1. Header de tarjeta
2. Lista de ciclos
3. Dentro de cada ciclo:
   - bloque ARS si aplica
   - bloque USD si aplica
   - detalle de consumos agrupado por moneda
4. Acciones por moneda, no por ciclo completo
