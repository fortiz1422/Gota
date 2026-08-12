import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Bank,
  ChartLineUp,
  Check,
  CreditCard,
  LockKey,
  MagicWand,
  Wallet,
} from '@phosphor-icons/react/dist/ssr'

export const metadata: Metadata = {
  title: 'GOTA — Tu plata clara',
  description:
    'Reuní tus cuentas, billeteras y tarjetas, registrá sin fricción y entendé cuánto podés usar realmente.',
  robots: {
    index: false,
    follow: false,
  },
}

const navItems = [
  { href: '#producto', label: 'Producto' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#privacidad', label: 'Privacidad' },
  { href: '#preguntas', label: 'Preguntas' },
]

const accounts = [
  { name: 'Banco', amount: '$ 840.000', tone: 'bg-primary/10 text-primary' },
  { name: 'Billetera', amount: '$ 260.000', tone: 'bg-success/10 text-success' },
  { name: 'Efectivo', amount: '$ 100.000', tone: 'bg-warning/10 text-warning' },
]

function SectionTag({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-primary">
      {children}
    </p>
  )
}

function Logo() {
  return (
    <Image
      src="/brand/gota-wordmark-primary.svg"
      alt="GOTA"
      width={112}
      height={32}
      priority
      className="h-8 w-auto"
    />
  )
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-bg-primary text-text-primary">
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <Link href="/landing" aria-label="GOTA, inicio">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Navegación principal">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <span className="hidden text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary sm:inline">
              Próximamente
            </span>
            <Link
              href="/login"
              className="rounded-xl border border-border-strong bg-white px-3.5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-secondary"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </header>

      <section className="relative px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
        <div className="absolute left-1/2 top-[-320px] h-[560px] w-[760px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Próximamente
            </div>
            <h1 className="max-w-[720px] text-[46px] font-extrabold leading-[0.98] tracking-[-0.055em] sm:text-[64px] lg:text-[72px]">
              GOTA,
              <br />
              <span className="text-primary">tu plata clara.</span>
            </h1>
            <p className="mt-7 max-w-[590px] text-[18px] leading-8 text-text-secondary sm:text-xl">
              Registrá movimientos en segundos, reuní tus cuentas, billeteras y tarjetas, y entendé cuánto podés usar realmente.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(33,120,168,0.24)] transition-transform hover:-translate-y-0.5"
              >
                Ver cómo funciona
                <ArrowRight size={17} weight="bold" />
              </a>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-border-strong bg-white px-5 py-3.5 text-sm font-bold text-text-primary transition-colors hover:bg-bg-secondary"
              >
                Ingresar
              </Link>
            </div>
            <p className="mt-5 text-sm text-text-tertiary">
              GOTA estará disponible próximamente.
            </p>
          </div>

          <figure className="relative mx-auto flex w-full max-w-[470px] flex-col items-center lg:items-end">
            <div className="absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-3xl lg:left-[66%]" />
            <div className="relative w-[min(100%,340px)] overflow-hidden rounded-[30px] border border-border-subtle bg-white p-1.5 shadow-[0_28px_70px_rgba(13,24,41,0.14)]">
              <Image
                src="/landing/gota-home-demo.png"
                alt="Home mobile de GOTA con Saldo Vivo, Disponible Real, últimos movimientos y carga rápida"
                width={393}
                height={852}
                priority
                sizes="(max-width: 640px) calc(100vw - 40px), 330px"
                className="h-auto w-full rounded-[24px]"
              />
            </div>
            <figcaption className="relative mt-4 flex items-center gap-2 text-xs text-text-tertiary">
              <span className="font-bold uppercase tracking-[0.12em] text-primary">Producto real</span>
              <span aria-hidden="true">·</span>
              <span>Datos de ejemplo</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section id="producto" className="border-y border-border-subtle bg-bg-secondary px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1060px] text-center">
          <SectionTag>El problema</SectionTag>
          <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">Tu saldo no cuenta toda la historia.</h2>
          <p className="mx-auto mt-5 max-w-[720px] text-lg leading-8 text-text-secondary">
            Tenés plata en el banco, otra parte en una billetera, consumos en tarjetas y movimientos entre cuentas. GOTA reúne esas piezas para que no reconstruyas tu situación de memoria.
          </p>
          <div className="mt-12 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
              {accounts.map((account) => (
                <div key={account.name} className="flex items-center justify-between rounded-2xl border border-border-subtle bg-white p-4 shadow-sm">
                  <span className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${account.tone}`}>{account.name}</span>
                  <span className="font-bold tabular-nums">{account.amount}</span>
                </div>
              ))}
            </div>
            <ArrowRight size={24} weight="bold" className="mx-auto rotate-90 text-primary md:rotate-0" />
            <div className="rounded-card-lg bg-primary p-7 text-left text-white shadow-md">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/65">Una sola lectura</p>
              <p className="mt-3 text-lg font-semibold text-white/80">Saldo Vivo</p>
              <p className="mt-1 text-4xl font-extrabold tracking-[-0.04em]">$ 1.200.000</p>
              <p className="mt-5 text-sm leading-6 text-white/75">La distribución sigue visible. La foto completa también.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1080px]">
          <div className="max-w-[760px]">
            <SectionTag>El modelo de GOTA</SectionTag>
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">Tres pilares para entender tu plata.</h2>
            <p className="mt-5 text-lg leading-8 text-text-secondary">Cargar sin fricción, reunir lo que tenés y entender qué sigue disponible.</p>
          </div>
          <div className="mt-12 overflow-hidden rounded-card-lg border border-border-subtle bg-bg-secondary p-5 sm:p-8">
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                { step: '01', icon: MagicWand, title: 'Carga sin fricción', text: 'Escribí el movimiento como te salga, revisá la propuesta y guardá.', value: 'En segundos' },
                { step: '02', icon: Wallet, title: 'Saldo Vivo', text: 'Tu dinero líquido entre cuentas, reunido sin perder el detalle.', value: '$ 1.248.900' },
                { step: '03', icon: Check, title: 'Disponible Real', text: 'Lo que queda después de contemplar deuda y consumos registrados.', value: '$ 612.400' },
              ].map((item, index) => (
                <div key={item.title} className={`relative rounded-card-lg border p-6 ${index === 2 ? 'border-primary bg-primary text-white' : 'border-border-subtle bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold tracking-[0.14em] ${index === 2 ? 'text-white/60' : 'text-text-tertiary'}`}>{item.step}</span>
                    <item.icon size={23} weight="regular" className={index === 2 ? 'text-white' : 'text-primary'} />
                  </div>
                  <h3 className="mt-8 text-lg font-bold">{item.title}</h3>
                  <p className={`mt-2 min-h-12 text-sm leading-6 ${index === 2 ? 'text-white/75' : 'text-text-secondary'}`}>{item.text}</p>
                  <p className="mt-7 text-2xl font-extrabold tracking-[-0.035em] tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-8 text-center text-xl font-bold tracking-[-0.02em]">Cargás fácil. Ves lo que tenés. <span className="text-primary">Entendés lo que podés usar.</span></p>
        </div>
      </section>

      <section className="bg-text-primary px-5 py-20 text-white sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-[1080px] items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionTag>Registrar sin fricción</SectionTag>
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">Escribilo como te salga.</h2>
            <p className="mt-5 max-w-[500px] text-lg leading-8 text-white/65">SmartInput interpreta el movimiento y prepara una propuesta editable. Vos revisás los datos importantes antes de guardar.</p>
            <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-white/55">
              <LockKey size={17} className="mt-1 shrink-0" />
              La IA interpreta el texto. Los cálculos financieros los hace la lógica de GOTA.
            </p>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/7 p-4 sm:p-6">
            <div className="rounded-2xl bg-white p-4 text-text-primary">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">Lo que escribiste</p>
              <p className="mt-3 text-lg font-semibold">“Gasté $10.000 en la panadería ayer”</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {[['Monto', '$ 10.000'], ['Categoría', 'Alimentos'], ['Fecha', 'Ayer'], ['Cuenta', 'Para revisar']].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/7 p-4">
                  <p className="text-xs text-white/45">{label}</p>
                  <p className="mt-1.5 font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1080px]">
          <div className="text-center">
            <SectionTag>Más contexto</SectionTag>
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">Tus movimientos empiezan a decir algo.</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { icon: CreditCard, title: 'Tarjetas sin sorpresas', text: 'Organizá consumos por ciclo y anticipá cuánto y cuándo vas a pagar.' },
              { icon: Bank, title: 'Toda tu plata reunida', text: 'Bancos, billeteras, efectivo, pesos y dólares sin perder el detalle.' },
              { icon: ChartLineUp, title: 'Análisis para decidir', text: 'Entendé el estado del mes, hábitos, fugas silenciosas, presupuestos y metas.' },
            ].map((item) => (
              <article key={item.title} className="rounded-card-lg border border-border-subtle bg-bg-secondary p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-card bg-primary/10 text-primary">
                  <item.icon size={23} weight="regular" />
                </div>
                <h3 className="mt-7 text-xl font-bold tracking-[-0.02em]">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-text-secondary">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacidad" className="border-y border-border-subtle bg-bg-secondary px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-[980px] gap-8 rounded-card-lg border border-border-subtle bg-white p-7 shadow-sm md:grid-cols-[auto_1fr] md:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockKey size={28} weight="regular" />
          </div>
          <div>
            <SectionTag>Confianza y privacidad</SectionTag>
            <h2 className="text-3xl font-extrabold tracking-[-0.035em]">Claridad también sobre tus datos.</h2>
            <p className="mt-4 max-w-[760px] leading-7 text-text-secondary">GOTA no solicita claves bancarias ni se conecta automáticamente a tus bancos. Vos decidís qué cargar y revisás cada propuesta de SmartInput antes de guardarla.</p>
            <p className="mt-4 text-sm text-text-tertiary">La información legal completa se publicará antes de abrir el acceso general.</p>
          </div>
        </div>
      </section>

      <section id="preguntas" className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[860px]">
          <div className="text-center">
            <SectionTag>Preguntas frecuentes</SectionTag>
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">Lo esencial, antes de empezar.</h2>
          </div>
          <div className="mt-10 divide-y divide-border-subtle border-y border-border-subtle">
            {[
              ['¿Cuándo estará disponible GOTA?', 'Próximamente. Todavía no abrimos el acceso general.'],
              ['¿GOTA se conecta con mis bancos?', 'No. Hoy vos cargás y controlás la información; GOTA no solicita tus claves bancarias.'],
              ['¿Puedo usar pesos y dólares?', 'Sí. Podés registrar cuentas y movimientos en ARS y USD y conservar una foto consolidada.'],
              ['¿Qué diferencia hay entre Saldo Vivo y Disponible Real?', 'Saldo Vivo reúne tu dinero líquido. Disponible Real descuenta deuda y consumos registrados en tarjetas.'],
              ['¿Puedo usar GOTA desde el celular?', 'Sí. GOTA funciona como una aplicación web instalable, pensada para registrar y consultar desde el celular.'],
            ].map(([question, answer]) => (
              <div key={question} className="grid gap-2 py-6 sm:grid-cols-[0.9fr_1.1fr] sm:gap-8">
                <h3 className="font-bold text-text-primary">{question}</h3>
                <p className="text-sm leading-6 text-text-secondary">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-10 sm:px-8">
        <div className="mx-auto max-w-[1080px] overflow-hidden rounded-card-lg bg-primary px-6 py-14 text-center text-white sm:px-12 sm:py-18">
          <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">Tu plata puede sentirse más clara.</h2>
          <p className="mx-auto mt-5 max-w-[650px] text-lg leading-8 text-white/72">GOTA estará disponible próximamente. Mientras tanto, podés conocer cómo reúne y explica tu plata.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#como-funciona" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-primary shadow-lg">
              Ver cómo funciona
              <ArrowRight size={17} weight="bold" />
            </a>
            <Link href="/login" className="px-5 py-3.5 text-sm font-semibold text-white/80 hover:text-white">Ingresar</Link>
          </div>
        </div>
      </section>

      <footer className="px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[1080px] flex-col items-center justify-between gap-5 border-t border-border-subtle pt-8 sm:flex-row">
          <Logo />
          <p className="text-xs text-text-tertiary">GOTA · Tu plata clara.</p>
        </div>
      </footer>
    </main>
  )
}
