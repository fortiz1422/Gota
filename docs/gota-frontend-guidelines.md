# Gota — Frontend Guidelines v1.0

**Versión:** 1.0 · actualizado post-MVP
**Fecha:** 3 Febrero 2026 · revisado Febrero 2026
**Framework:** Next.js 16.1.6 (App Router)
**Language:** TypeScript
**Status:** ✅ MVP Completo — patrones activos en producción

---

## ÍNDICE

1. [Project Structure](#1-project-structure)
2. [Component Architecture](#2-component-architecture)
3. [Server vs Client Components](#3-server-vs-client-components)
4. [State Management](#4-state-management)
5. [Data Fetching Patterns](#5-data-fetching-patterns)
6. [Form Handling](#6-form-handling)
7. [Error Handling](#7-error-handling)
8. [Performance Patterns](#8-performance-patterns)
9. [TypeScript Conventions](#9-typescript-conventions)
10. [Code Quality](#10-code-quality)
11. [Import Order](#11-import-order)
12. [Naming Conventions](#12-naming-conventions)

---

## 1. PROJECT STRUCTURE

### 1.1 Directory Layout (estructura real en producción)

```
app/
├── (auth)/                      # Route group (no layout impact)
│   └── login/
│       └── page.tsx
├── auth/                        # Auth routes (fuera del grupo para que proxy las alcance)
│   ├── login/
│   │   └── route.ts             # POST — inicia Google OAuth
│   └── callback/
│       └── route.ts             # GET — exchange code for session
├── (dashboard)/                 # Route group con layout
│   ├── layout.tsx
│   └── page.tsx                 # "/" - Dashboard (Server Component)
├── expenses/
│   └── page.tsx                 # "/expenses" — Server Component con filtros desde searchParams
├── api/
│   ├── expenses/
│   │   ├── route.ts             # POST (create), GET (list + filtros + paginación 20/pág)
│   │   ├── [id]/
│   │   │   └── route.ts         # PUT, DELETE
│   │   └── duplicates/
│   │       └── route.ts         # GET — detect_duplicate_expenses RPC
│   ├── parse-expense/
│   │   └── route.ts             # POST (Gemini gemini-2.5-flash-lite)
│   ├── monthly-income/
│   │   └── route.ts             # POST (upsert), GET (?month=YYYY-MM)
│   ├── user-config/
│   │   └── route.ts             # GET, PUT
│   ├── export/
│   │   └── route.ts             # GET — CSV UTF-8 BOM
│   └── account/
│       └── route.ts             # DELETE — elimina datos + auth user
├── layout.tsx                   # Root layout
└── globals.css                  # Tailwind v4 tokens (@theme {})

proxy.ts                         # Auth protection (Next.js 16 — no middleware.ts)

components/
├── ui/
│   └── Modal.tsx                # createPortal — Client Component
├── dashboard/
│   ├── DashboardHeader.tsx      # Period nav + SettingsModal — Client
│   ├── SmartInput.tsx           # Text input → parse-expense API — Client
│   ├── ParsePreview.tsx         # Modal confirmación + duplicate check — Client
│   ├── SaldoVivo.tsx            # Hero card con cálculo defensivo — Client
│   ├── GastosTarjeta.tsx        # Total tarjetas del mes
│   ├── FiltroEstoico.tsx        # Need/want progress bar
│   ├── Top3.tsx                 # Category bars con íconos
│   ├── Ultimos5.tsx             # Recent expenses + "Ver todos →"
│   ├── IncomeSetupModal.tsx     # First-time modal (mounted trick para SSR)
│   └── SettingsModal.tsx        # Tabs: Cuenta, Config, Datos
└── expenses/
    ├── ExpenseItem.tsx          # Inline expand/edit (saveRef pattern)
    └── ExpenseFilters.tsx       # useSearchParams → Suspense requerido

lib/
├── supabase/
│   ├── client.ts                # createBrowserClient
│   ├── server.ts                # createServerClient (async cookies)
│   └── admin.ts                 # service-role client (para account deletion)
├── gemini/
│   ├── client.ts                # gemini-2.5-flash-lite, apiVersion: v1
│   └── prompts.ts               # Prompt español argentino
├── validation/
│   └── schemas.ts               # ExpenseSchema, ParsedExpenseSchema, CATEGORIES
├── format.ts                    # formatAmount (ARS/USD), formatDate
└── categories.ts                # CATEGORY_ICONS map

types/
└── database.ts                  # Database type + Expense, MonthlyIncome, UserConfig, DashboardData, Category
```

**Notas críticas Next.js 16:**
- Dynamic route params: `{ params: Promise<{ id: string }> }` → `const { id } = await params`
- `themeColor` movido a export `viewport: Viewport` (no en `metadata`)
- OAuth debe iniciarse desde Client Component con `supabase.auth.signInWithOAuth()` — NO form POST + Route Handler

---

## 2. COMPONENT ARCHITECTURE

### 2.1 Component Types

**4 tipos de componentes:**

1. **UI Components** - Reusables, no business logic
2. **Feature Components** - Domain-specific, contain business logic
3. **Layout Components** - Structure (Header, Sidebar, etc)
4. **Page Components** - App Router pages

---

### 2.2 UI Component Pattern

**Características:**

- Sin business logic
- Props tipadas explícitamente
- Compound components cuando tiene sentido
- Forward ref cuando necesario

**Example: Button.tsx**

```typescript
// components/ui/Button.tsx
import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    className,
    children,
    ...props
  }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'rounded-button font-semibold transition-all',
          // Size variants
          {
            'px-4 py-2 text-sm': size === 'sm',
            'px-6 py-3 text-body': size === 'md',
            'px-8 py-4 text-lg': size === 'lg',
          },
          // Color variants
          {
            'bg-gradient-to-br from-primary to-purple-600 text-white shadow-lg hover:shadow-xl':
              variant === 'primary',
            'bg-bg-secondary text-text-primary border border-border-strong hover:bg-bg-tertiary':
              variant === 'secondary',
            'bg-transparent text-text-secondary hover:bg-white/5':
              variant === 'ghost',
            'bg-danger text-white hover:bg-red-600':
              variant === 'danger',
          },
          // States
          {
            'opacity-50 cursor-not-allowed': disabled || loading,
            'active:scale-95': !disabled && !loading,
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner size="sm" />
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

**Usage:**

```tsx
<Button variant="primary" size="md" onClick={handleClick}>
  Guardar gasto
</Button>

<Button variant="danger" loading={isDeleting}>
  Eliminar
</Button>
```

---

### 2.3 Feature Component Pattern

**Características:**

- Contiene business logic
- Puede tener side effects
- Usa custom hooks
- Compone UI components

**Example: SmartInput.tsx**

```typescript
// components/dashboard/SmartInput.tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ParsePreview } from './ParsePreview'
import { useParseExpense } from '@/lib/hooks/useParseExpense'
import { useDashboard } from '@/lib/hooks/useDashboard'

export function SmartInput() {
  const [input, setInput] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const { mutate: parse, data: parsed, isPending } = useParseExpense()
  const { currentMonth } = useDashboard()

  const handleSubmit = async () => {
    if (!input.trim()) return

    parse(input, {
      onSuccess: (data) => {
        if (data.is_valid) {
          setShowPreview(true)
        } else {
          alert(data.reason)
        }
      },
      onError: () => {
        alert('Error al procesar el gasto')
      }
    })
  }

  const handleSave = () => {
    setShowPreview(false)
    setInput('')
  }

  return (
    <>
      <div className="flex gap-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="café 2500"
          disabled={isPending}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
        />
        <Button
          onClick={handleSubmit}
          disabled={!input.trim() || isPending}
          loading={isPending}
        >
          ▶
        </Button>
      </div>

      {/* Hint when viewing past month */}
      {currentMonth !== getCurrentMonth() && (
        <p className="text-body-sm text-text-tertiary mt-2">
          ⓘ Se registrará en {formatMonth(getCurrentMonth())}
        </p>
      )}

      {showPreview && parsed?.is_valid && (
        <ParsePreview
          data={parsed.data}
          onSave={handleSave}
          onCancel={() => setShowPreview(false)}
        />
      )}
    </>
  )
}
```

---

### 2.4 Compound Components Pattern

**When to use:**

- Component with multiple related parts
- Need flexible composition
- Share internal state

**Example: Card.tsx**

```typescript
// components/ui/Card.tsx
import { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface CardProps {
  children: ReactNode
  className?: string
  elevated?: boolean
}

function CardRoot({ children, className, elevated = false }: CardProps) {
  return (
    <div
      className={cn(
        'bg-bg-secondary rounded-card p-4',
        {
          'border-2 border-border-strong shadow-xl': elevated,
          'border border-border-subtle': !elevated,
        },
        className
      )}
    >
      {children}
    </div>
  )
}

function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4', className)}>
      {children}
    </div>
  )
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-text-primary">
      {children}
    </h3>
  )
}

function CardContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-body text-text-secondary', className)}>
      {children}
    </div>
  )
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Content: CardContent,
})
```

**Usage:**

```tsx
<Card elevated>
  <Card.Header>
    <Card.Title>💰 Saldo del Mes</Card.Title>
  </Card.Header>
  <Card.Content>{/* Content */}</Card.Content>
</Card>
```

---

## 3. SERVER VS CLIENT COMPONENTS

### 3.1 Decision Tree

```
¿Necesita interactividad? (onClick, onChange, useState)
  └─ YES → Client Component ('use client')
  └─ NO → ¿Necesita acceder a datos?
       └─ YES → Server Component (async)
       └─ NO → Server Component (default)
```

---

### 3.2 Server Component Pattern

**When to use:**

- Initial data fetching
- No user interaction needed
- SEO important
- Reduce JS bundle

**Example: Dashboard Page**

```typescript
// app/(dashboard)/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SmartInput } from '@/components/dashboard/SmartInput'
import { SaldoVivo } from '@/components/dashboard/SaldoVivo'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch data server-side
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: config } = await supabase
    .from('user_config')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Check if first time (no config)
  if (!config) {
    return <FirstTimeSetupModal />
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <SmartInput /> {/* Client Component */}
      <SaldoVivo userId={user.id} /> {/* Can be Server */}
      {/* ... */}
    </div>
  )
}
```

**Benefits:**

- Fast initial load
- No hydration needed for static parts
- Data fetched close to DB

---

### 3.3 Client Component Pattern

**When to use:**

- User interactions (clicks, typing)
- React hooks (useState, useEffect)
- Browser APIs (localStorage, window)
- Event listeners

**Example: ParsePreview Modal**

```typescript
// components/dashboard/ParsePreview.tsx
'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useCreateExpense } from '@/lib/hooks/useExpenses'

interface ParsePreviewProps {
  data: ParsedExpense
  onSave: () => void
  onCancel: () => void
}

export function ParsePreview({ data, onSave, onCancel }: ParsePreviewProps) {
  const [formData, setFormData] = useState(data)
  const { mutate: create, isPending } = useCreateExpense()

  const handleSave = () => {
    create(formData, {
      onSuccess: () => {
        onSave()
      }
    })
  }

  return (
    <Modal open onClose={onCancel}>
      <Modal.Header>
        <Modal.Title>Confirmar gasto</Modal.Title>
      </Modal.Header>

      <Modal.Content>
        {/* Editable fields */}
        <Input
          label="Monto"
          type="number"
          value={formData.amount}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            amount: Number(e.target.value)
          }))}
        />

        {/* More fields... */}
      </Modal.Content>

      <Modal.Footer>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={isPending}
        >
          Guardar gasto
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
```

---

### 3.4 Hybrid Pattern (Server + Client)

**Pattern:** Server Component wraps Client Component

```typescript
// app/(dashboard)/page.tsx (Server Component)
import { DashboardClient } from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: initialData } = await supabase
    .from('expenses')
    .select('*')
    .limit(5)

  // Pass server data to client
  return <DashboardClient initialData={initialData} />
}
```

```typescript
// app/(dashboard)/DashboardClient.tsx (Client Component)
'use client'

import { useState } from 'react'

export function DashboardClient({ initialData }) {
  const [data, setData] = useState(initialData)

  // Client-side interactions
  return (
    <div>
      {data.map(expense => (
        <ExpenseItem key={expense.id} expense={expense} />
      ))}
    </div>
  )
}
```

---

## 4. STATE MANAGEMENT

### 4.1 State Types

**3 tipos de estado:**

1. **Server State** - Data from DB (React Query)
2. **UI State** - Form inputs, modals (useState)
3. **URL State** - Filters, pagination (searchParams)

---

### 4.2 React Query Patterns

**Setup:**

```typescript
// app/providers.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 30 * 60 * 1000, // 30 minutes
        refetchOnWindowFocus: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

```typescript
// app/layout.tsx
import { Providers } from './providers'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
```

---

### 4.3 Custom Hooks Pattern

**Query Hook:**

```typescript
// lib/hooks/useExpenses.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useExpenses(month: string, currency: string) {
  return useQuery({
    queryKey: ['expenses', month, currency],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('currency', currency)
        .gte('date', `${month}-01`)
        .lt('date', getNextMonth(month))
        .order('date', { ascending: false })

      if (error) throw error
      return data
    },
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (expense: CreateExpenseInput) => {
      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expense),
      })

      if (!response.ok) throw new Error('Failed to create')
      return response.json()
    },
    onSuccess: () => {
      // Invalidate all expenses queries
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Expense>
    }) => {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error('Failed to update')
      return response.json()
    },
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['expenses'] })

      // Snapshot previous value
      const previous = queryClient.getQueryData(['expenses'])

      // Optimistically update
      queryClient.setQueryData(['expenses'], (old: any) => {
        return old?.map((expense: Expense) =>
          expense.id === id ? { ...expense, ...updates } : expense
        )
      })

      return { previous }
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['expenses'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
```

**Usage in Component:**

```typescript
'use client'

import { useExpenses, useDeleteExpense } from '@/lib/hooks/useExpenses'

export function ExpenseList({ month, currency }) {
  const { data: expenses, isLoading, error } = useExpenses(month, currency)
  const { mutate: deleteExpense } = useDeleteExpense()

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorMessage error={error} />

  return (
    <div>
      {expenses?.map(expense => (
        <ExpenseItem
          key={expense.id}
          expense={expense}
          onDelete={() => deleteExpense(expense.id)}
        />
      ))}
    </div>
  )
}
```

---

### 4.4 URL State Pattern

**For filters, pagination:**

```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'

export function ExpenseFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const category = searchParams.get('category') || ''
  const payment = searchParams.get('payment') || ''

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/expenses?${params.toString()}`)
  }

  return (
    <div className="flex gap-2">
      <Select
        value={category}
        onChange={(e) => updateFilter('category', e.target.value)}
      >
        <option value="">Todas las categorías</option>
        {CATEGORIES.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </Select>

      <Select
        value={payment}
        onChange={(e) => updateFilter('payment', e.target.value)}
      >
        <option value="">Todos los medios</option>
        {PAYMENT_METHODS.map(method => (
          <option key={method} value={method}>{method}</option>
        ))}
      </Select>
    </div>
  )
}
```

---

## 5. DATA FETCHING PATTERNS

### 5.1 Server Component Fetch

```typescript
// app/(dashboard)/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [expenses, income, config] = await Promise.all([
    supabase.from('expenses').select('*'),
    supabase.from('monthly_income').select('*'),
    supabase.from('user_config').select('*').single(),
  ])

  return <Dashboard data={{ expenses, income, config }} />
}
```

---

### 5.2 Client Component Fetch (React Query)

```typescript
'use client'

import { useDashboard } from '@/lib/hooks/useDashboard'

export function Dashboard() {
  const { data, isLoading, error } = useDashboard('2026-02', 'ARS')

  if (isLoading) return <DashboardSkeleton />
  if (error) return <ErrorState error={error} />

  return (
    <div>
      <SaldoVivo data={data.saldo_vivo} />
      <FiltroEstoico data={data.filtro_estoico} />
      {/* ... */}
    </div>
  )
}
```

---

### 5.3 Parallel Fetching

```typescript
// Use Promise.all for parallel
const [expenses, income] = await Promise.all([fetchExpenses(), fetchIncome()])

// React Query parallel (automatic)
const expenses = useExpenses(month)
const income = useMonthlyIncome(month)
// Both fetch in parallel
```

---

### 5.4 Sequential Fetching

```typescript
// When second depends on first
const config = await fetchConfig()
const expenses = await fetchExpenses(config.default_currency)
```

---

## 6. FORM HANDLING

### 6.1 Controlled Forms (Complex)

**When to use:**

- Multi-step forms
- Complex validation
- Field dependencies

```typescript
'use client'

import { useState } from 'react'
import { ExpenseSchema } from '@/lib/validations/expense'

export function ExpenseForm() {
  const [formData, setFormData] = useState({
    amount: 0,
    category: '',
    payment_method: '',
    // ...
  })
  const [errors, setErrors] = useState({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    const result = ExpenseSchema.safeParse(formData)
    if (!result.success) {
      setErrors(result.error.flatten().fieldErrors)
      return
    }

    // Submit
    createExpense(result.data)
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input
        label="Monto"
        type="number"
        value={formData.amount}
        onChange={(e) => setFormData(prev => ({
          ...prev,
          amount: Number(e.target.value)
        }))}
        error={errors.amount?.[0]}
      />

      {/* More fields */}

      <Button type="submit">Guardar</Button>
    </form>
  )
}
```

---

### 6.2 Server Actions (Simple)

**When to use:**

- Simple forms
- Progressive enhancement
- No complex client validation

```typescript
// app/actions/expenses.ts
'use server'

import { revalidatePath } from 'next/cache'
import { ExpenseSchema } from '@/lib/validations/expense'

export async function createExpenseAction(formData: FormData) {
  const rawData = {
    amount: Number(formData.get('amount')),
    category: formData.get('category'),
    // ...
  }

  const parsed = ExpenseSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: 'Invalid data', details: parsed.error }
  }

  // Create in DB
  const supabase = await createClient()
  const { data, error } = await supabase.from('expenses').insert(parsed.data)

  if (error) return { error: error.message }

  revalidatePath('/')
  return { success: true, data }
}
```

```typescript
// Component
'use client'

import { useFormStatus } from 'react-dom'
import { createExpenseAction } from '@/app/actions/expenses'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} loading={pending}>
      Guardar
    </Button>
  )
}

export function ExpenseForm() {
  return (
    <form action={createExpenseAction}>
      <Input name="amount" type="number" required />
      <Select name="category" required>
        {/* options */}
      </Select>
      <SubmitButton />
    </form>
  )
}
```

---

## 7. ERROR HANDLING

### 7.1 Error Boundary

```typescript
// components/shared/ErrorBoundary.tsx
'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-danger/10 rounded-card">
          <h2 className="text-danger font-semibold">Algo salió mal</h2>
          <p className="text-body-sm text-text-secondary mt-2">
            {this.state.error?.message}
          </p>
          <Button
            className="mt-4"
            onClick={() => this.setState({ hasError: false })}
          >
            Intentar de nuevo
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Usage:**

```typescript
<ErrorBoundary>
  <Dashboard />
</ErrorBoundary>
```

---

### 7.2 Error States in Components

```typescript
export function ExpenseList() {
  const { data, isLoading, error } = useExpenses()

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error) {
    return (
      <div className="p-4 bg-danger/10 rounded-card">
        <p className="text-danger">Error al cargar gastos</p>
        <Button onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return <EmptyState />
  }

  return (
    <div>
      {data.map(expense => (
        <ExpenseItem key={expense.id} expense={expense} />
      ))}
    </div>
  )
}
```

---

### 7.3 Toast Notifications (Optional)

```typescript
// lib/hooks/useToast.ts
import { useState, useCallback } from 'react'

type Toast = {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36)
    setToasts((prev) => [...prev, { id, message, type }])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return { toasts, toast }
}
```

---

## 8. PERFORMANCE PATTERNS

### 8.1 Code Splitting

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic'

const ParsePreview = dynamic(() => import('./ParsePreview'), {
  loading: () => <LoadingSpinner />,
  ssr: false, // Client-only
})

const ExpenseFilters = dynamic(() => import('./ExpenseFilters'), {
  loading: () => <div>Cargando filtros...</div>,
})
```

---

### 8.2 Memoization

```typescript
import { useMemo, useCallback } from 'react'

export function Dashboard({ expenses }) {
  // Memoize expensive calculations
  const stats = useMemo(() => {
    return {
      total: expenses.reduce((sum, e) => sum + e.amount, 0),
      top3: calculateTop3(expenses),
      filtroEstoico: calculateFiltro(expenses),
    }
  }, [expenses])

  // Memoize callbacks
  const handleDelete = useCallback((id: string) => {
    deleteExpense(id)
  }, [deleteExpense])

  return <DashboardUI stats={stats} onDelete={handleDelete} />
}
```

---

### 8.3 React.memo (Prevent Re-renders)

```typescript
import { memo } from 'react'

export const ExpenseItem = memo(function ExpenseItem({
  expense,
  onDelete
}: ExpenseItemProps) {
  return (
    <div>
      {expense.description} - ${expense.amount}
      <Button onClick={() => onDelete(expense.id)}>Delete</Button>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.expense.id === nextProps.expense.id &&
         prevProps.expense.updated_at === nextProps.expense.updated_at
})
```

---

### 8.4 Image Optimization

```typescript
import Image from 'next/image'

// Always use Next Image for profile pics
<Image
  src={user.avatar_url}
  alt={user.name}
  width={40}
  height={40}
  className="rounded-full"
  priority // For above-the-fold images
/>
```

---

## 9. TYPESCRIPT CONVENTIONS

### 9.1 Type Definitions

```typescript
// types/expense.ts

// Database types (from Supabase codegen)
import type { Database } from './database'

export type Expense = Database['public']['Tables']['expenses']['Row']
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert']
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update']

// App-specific types
export type ExpenseWithDetails = Expense & {
  categoryEmoji: string
  formattedAmount: string
}

// Form types
export type ExpenseFormData = {
  amount: number
  currency: 'ARS' | 'USD'
  category: string
  description: string
  is_want: boolean
  payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
  card_id: string | null
  date: string
}
```

---

### 9.2 Props Typing

```typescript
// Explicit interface
interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

// Extend HTML attributes
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

// Generic types
interface SelectProps<T> {
  options: T[]
  value: T
  onChange: (value: T) => void
  getLabel: (option: T) => string
  getValue: (option: T) => string
}
```

---

### 9.3 Utility Types

```typescript
// Make all optional
type PartialExpense = Partial<Expense>

// Pick specific fields
type ExpensePreview = Pick<Expense, 'id' | 'amount' | 'description'>

// Omit fields
type ExpenseWithoutTimestamps = Omit<Expense, 'created_at' | 'updated_at'>

// Make specific fields required
type ExpenseWithCard = Expense & Required<Pick<Expense, 'card_id'>>
```

---

### 9.4 Type Guards

```typescript
// Type guard function
function isPagoTarjetas(expense: Expense): boolean {
  return expense.category === 'Pago de Tarjetas'
}

// Type predicate
function isValidExpense(data: unknown): data is Expense {
  return (
    typeof data === 'object' &&
    data !== null &&
    'amount' in data &&
    'category' in data
  )
}
```

---

## 10. CODE QUALITY

### 10.1 ESLint Configuration

```json
// .eslintrc.json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { "argsIgnorePattern": "^_" }
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

---

### 10.2 Prettier Configuration

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

---

### 10.3 Code Comments

```typescript
// ❌ BAD: Obvious comments
// Set amount to 0
const amount = 0

// ✅ GOOD: Explain WHY
// Normalize to first day of month for database consistency
const month = date_trunc('month', inputDate)

// ✅ GOOD: Document edge cases
// If payment_method is CREDIT, card_id is required
// This is enforced by database constraint
if (payment_method === 'CREDIT' && !card_id) {
  throw new ValidationError('card_id required for CREDIT')
}
```

---

## 11. IMPORT ORDER

### 11.1 Standard Order

```typescript
// 1. React & Next.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

// 2. External libraries
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { z } from 'zod'

// 3. Internal modules (@ alias)
import { Button } from '@/components/ui/Button'
import { useExpenses } from '@/lib/hooks/useExpenses'
import { formatCurrency } from '@/lib/utils/format'

// 4. Types
import type { Expense } from '@/types/expense'

// 5. Relative imports
import { calculateTotal } from './utils'
import styles from './styles.module.css'
```

---

## 12. NAMING CONVENTIONS

### 12.1 Files

```
PascalCase:  Components (Button.tsx, ExpenseList.tsx)
camelCase:   Utils, hooks (format.ts, useExpenses.ts)
kebab-case:  Routes (user-profile/, expense-detail/)
UPPERCASE:   Constants (CATEGORIES.ts, CONFIG.ts)
```

---

### 12.2 Variables & Functions

```typescript
// camelCase for variables
const userName = 'Facundo'
const isValid = true

// camelCase for functions
function calculateTotal() {}
const handleClick = () => {}

// PascalCase for Components
function ExpenseItem() {}

// PascalCase for Types
type ExpenseData = {}
interface UserConfig {}

// UPPER_SNAKE_CASE for constants
const MAX_EXPENSES_PER_DAY = 50
const DEFAULT_CURRENCY = 'ARS'
```

---

### 12.3 Event Handlers

```typescript
// Prefix with "handle"
const handleClick = () => {}
const handleSubmit = () => {}
const handleChange = (e) => {}

// In props, prefix with "on"
<Button onClick={handleClick} />
<Form onSubmit={handleSubmit} />
```

---

### 12.4 Boolean Variables

```typescript
// Prefix with is/has/should
const isLoading = true
const hasError = false
const shouldValidate = true

// In props
<Button disabled={isDisabled} loading={isLoading} />
```

---

## PATTERNS SUMMARY

### Component Patterns

✅ Separate UI components from feature components  
✅ Use compound components for complex UI  
✅ Forward refs for UI components  
✅ Server Components by default, Client when needed

### State Management

✅ React Query for server state  
✅ useState for UI state  
✅ URL params for filters  
✅ No global state library needed (MVP)

### Data Fetching

✅ Server Components for initial data  
✅ React Query for client fetching  
✅ Parallel fetching when possible  
✅ Optimistic updates for mutations

### Performance

✅ Dynamic imports for heavy components  
✅ Memoization for expensive calculations  
✅ React.memo for expensive renders  
✅ Next Image for all images

### Code Quality

✅ TypeScript strict mode  
✅ ESLint + Prettier  
✅ Consistent naming conventions  
✅ Meaningful variable names

---

**FIN DEL FRONTEND GUIDELINES v1.0 — Gota**

Este documento define cómo construir componentes y manejar estado en Gota.
