# Review del plan para eliminar el "2s de carga" en Home

Fecha: 2026-04-10

## Resumen ejecutivo

El plan de Claude va en la direccion correcta para eliminar el skeleton interno del dashboard en la carga inicial, pero no alcanza por si solo para demostrar que elimina por completo los "2s de carga".

El problema real parece tener al menos dos capas:

1. `DashboardShell` hoy renderiza sin datos y despues hace un fetch client-side a `/api/dashboard`.
2. El route segment `app/(dashboard)` ya tiene su propio `loading.tsx`, que puede seguir apareciendo aunque el dashboard reciba `initialData`.

Ademas, el paso de `staleTime` no agrega valor porque el cache global ya esta configurado con 2 minutos.

## Lo que si confirma el codigo

- [`app/(dashboard)/page.tsx`](C:/Users/Admin/Documents/gota/app/(dashboard)/page.tsx) renderiza [`DashboardShell`](C:/Users/Admin/Documents/gota/components/dashboard/DashboardShell.tsx) sin `initialData`.
- [`components/dashboard/DashboardShell.tsx`](C:/Users/Admin/Documents/gota/components/dashboard/DashboardShell.tsx) usa `useQuery` y hace `fetch('/api/dashboard?...')`.
- Mientras ese query carga, [`DashboardShell.tsx`](C:/Users/Admin/Documents/gota/components/dashboard/DashboardShell.tsx) muestra su skeleton interno.
- El patron de "server fetch + initialData" ya existe en [`app/(dashboard)/movimientos/page.tsx`](C:/Users/Admin/Documents/gota/app/(dashboard)/movimientos/page.tsx), asi que la idea encaja con patrones ya usados en el repo.

## Donde el plan es incompleto o incorrecto

### 1. Mezcla dos loaders distintos

El plan atribuye todo el problema al fetch client-side del dashboard, pero hoy existen dos estados de carga separados:

- [`app/(dashboard)/loading.tsx`](C:/Users/Admin/Documents/gota/app/(dashboard)/loading.tsx)
- el skeleton interno de [`components/dashboard/DashboardShell.tsx`](C:/Users/Admin/Documents/gota/components/dashboard/DashboardShell.tsx)

Mover el fetch al server puede eliminar el segundo, pero no necesariamente el primero.

Consecuencia: si el "2s" que se percibe viene de la navegacion al route segment y no solo del query cliente, el plan ataca solo una parte.

### 2. `staleTime: 30_000` no aporta

[`lib/query-client.ts`](C:/Users/Admin/Documents/gota/lib/query-client.ts) ya define:

- `staleTime: 2 * 60 * 1000`
- `gcTime: 10 * 60 * 1000`
- `refetchOnWindowFocus: false`

Entonces:

- volver a Home dentro de 30 segundos ya deberia usar cache fresca hoy
- agregar `staleTime: 30_000` en el hook no mejora el comportamiento
- incluso reduce el tiempo de frescura respecto de la configuracion actual

### 3. La route no es solo lectura

[`app/api/dashboard/route.ts`](C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts) no solo arma respuesta:

- ejecuta `processSubscriptions(...)`
- ejecuta `await processYieldAccrual(...)` cuando `FF_YIELD` esta activo

Eso significa que "extraer la logica a una funcion compartida" requiere separar con cuidado:

- side effects previos a la lectura
- queries de lectura del dashboard
- wrapper HTTP del route

Si `page.tsx` llama una version incompleta y `/api/dashboard` sigue llamando la version con side effects, se puede generar inconsistencia entre:

- primer render server-side
- refetch posterior del cliente

## Evaluacion paso por paso

### Paso 1: extraer logica del route a funcion compartida

Direccion correcta, pero mal definida si se hace literal.

Recomendacion:

- crear una funcion pura de lectura de datos del dashboard
- dejar los side effects aislados en otra funcion explicita
- hacer que tanto `page.tsx` como `route.ts` usen la misma capa de lectura

No conviene mover codigo sin separar antes que parte muta estado y que parte solo lee.

### Paso 2: server-side initial fetch

Este es el cambio con mas impacto real para el primer paint.

Si `page.tsx` obtiene los datos del dashboard en el server y se los pasa a `DashboardShell`, deberia desaparecer el skeleton interno en la carga inicial.

Esto esta alineado con:

- el patron documentado en [`docs/gota-frontend-guidelines.md`](C:/Users/Admin/Documents/gota/docs/gota-frontend-guidelines.md)
- el patron ya implementado en [`app/(dashboard)/movimientos/page.tsx`](C:/Users/Admin/Documents/gota/app/(dashboard)/movimientos/page.tsx)

### Paso 3: agregar `staleTime` al `useQuery`

No lo recomiendo como parte de esta solucion.

El proyecto ya tiene `staleTime` global. Si hay refetches inesperados, primero hay que validar si vienen de:

- cambio de `queryKey`
- invalidaciones amplias con `invalidateQueries({ queryKey: ['dashboard'] })`
- una navegacion que desmonta/remonta el subtree

## Conclusiones

- El plan es valido como estrategia para sacar el skeleton interno de Home.
- El plan no demuestra por si solo que elimine todo el tiempo de carga percibido.
- El paso de `staleTime` parte de una premisa incorrecta porque ese cache ya existe globalmente.
- El principal riesgo tecnico es romper consistencia entre SSR y `/api/dashboard` si no se separan bien los side effects del route.

## Recomendacion concreta

La mejor version de este trabajo seria:

1. Separar side effects y lectura en la capa del dashboard.
2. Reusar la misma funcion de lectura desde `page.tsx` y desde `/api/dashboard`.
3. Pasar `initialData` a `DashboardShell` para eliminar el skeleton interno.
4. Medir despues si el tiempo restante viene de `loading.tsx` del route segment o de la latencia real de las queries server-side.

## Referencias

- [`app/(dashboard)/page.tsx`](C:/Users/Admin/Documents/gota/app/(dashboard)/page.tsx)
- [`components/dashboard/DashboardShell.tsx`](C:/Users/Admin/Documents/gota/components/dashboard/DashboardShell.tsx)
- [`app/api/dashboard/route.ts`](C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
- [`app/(dashboard)/loading.tsx`](C:/Users/Admin/Documents/gota/app/(dashboard)/loading.tsx)
- [`lib/query-client.ts`](C:/Users/Admin/Documents/gota/lib/query-client.ts)
- [`app/(dashboard)/movimientos/page.tsx`](C:/Users/Admin/Documents/gota/app/(dashboard)/movimientos/page.tsx)
- [`docs/gota-frontend-guidelines.md`](C:/Users/Admin/Documents/gota/docs/gota-frontend-guidelines.md)
