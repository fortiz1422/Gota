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
            <Link
              href="/login"
              className="hidden rounded-xl px-3.5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-secondary sm:block"
            >
              Ingresar
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_rgba(33,120,168,0.2)] transition-transform hover:-translate-y-0.5"
            >
              Sumarme a la beta
            </Link>
          </div>
        </div>
      </header>

      <section className="relative px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
        <div className="absolute left-1/2 top-[-280px] h-[640px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(91,168,204,0.18),rgba(255,255,255,0)_66%)]" />
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-14 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Finanzas personales, sin fricción
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
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(33,120,168,0.24)] transition-transform hover:-translate-y-0.5"
              >
                Sumarme a la beta
                <ArrowRight size={17} weight="bold" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center rounded-xl border border-border-strong bg-white px-5 py-3.5 text-sm font-bold text-text-primary transition-colors hover:bg-bg-secondary"
              >
                Ver cómo funciona
              </a>
            </div>
            <p className="mt-5 text-sm text-text-tertiary">
              Para quienes manejan su plata en más de un lugar.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="absolute -inset-8 rounded-[44px] bg-primary/8 blur-3xl" />
            <div className="relative rounded-[32px] border border-white/80 bg-[linear-gradient(145deg,#1B7E9E_0%,#1B6A93_100%)] p-3 shadow-[0_30px_80px_rgba(13,24,41,0.22)]">
              <div className="rounded-[24px] bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Saldo Vivo</p>
                    <p className="mt-2 text-[34px] font-extrabold tracking-[-0.04em] text-text-primary sm:text-[42px]">$ 1.200.000</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Wallet size={23} weight="duotone" />
                  </div>
                </div>
                <div className="mt-5 flex gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-bg-tertiary px-3 py-1.5 text-text-secondary">ARS $1.050.000</span>
                  <span className="rounded-full bg-bg-tertiary px-3 py-1.5 text-text-secondary">USD 150</span>
                </div>
                <div className="my-5 h-px bg-separator" />
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-text-secondary">Disponible real</p>
                    <p className="mt-1 text-xs leading-5 text-text-tertiary">Ya descuenta deuda y consumos en tarjeta.</p>
                  </div>
                  <p className="whitespace-nowrap text-xl font-extrabold tracking-[-0.03em]">$ 730.000</p>
                </div>
                <div className="mt-5 rounded-2xl border border-primary/10 bg-bg-secondary p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">SmartInput</p>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-border-strong bg-white px-3.5 py-3 text-sm text-text-secondary shadow-sm">
                    <MagicWand size={17} className="shrink-0 text-primary" />
                    Gasté $10.000 en la panadería ayer
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-7 -left-4 rounded-2xl border border-white bg-white/95 p-3.5 shadow-lg backdrop-blur sm:-left-12">
              <p className="text-[11px] font-semibold text-text-tertiary">Próximo vencimiento</p>
              <p className="mt-1 text-sm font-bold text-text-primary">Visa · 18 ago</p>
            </div>
          </div>
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
            <div className="rounded-[26px] bg-primary p-7 text-left text-white shadow-[0_18px_40px_rgba(33,120,168,0.18)]">
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
          <div className="max-w-[720px]">
            <SectionTag>El modelo de GOTA</SectionTag>
            <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">De lo que tenés a lo que podés usar.</h2>
            <p className="mt-5 text-lg leading-8 text-text-secondary">Una lectura simple, construida sobre los movimientos que vos registrás.</p>
          </div>
          <div className="mt-12 overflow-hidden rounded-[28px] border border-border-subtle bg-bg-secondary p-5 sm:p-8">
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                { step: '01', icon: Wallet, title: 'Saldo Vivo', text: 'Todo tu dinero líquido, consolidado.', value: '$ 1.200.000' },
                { step: '02', icon: CreditCard, title: 'Tarjetas', text: 'Consumos registrados que todavía no salieron de tus cuentas.', value: '− $ 470.000' },
                { step: '03', icon: Check, title: 'Disponible Real', text: 'Una lectura más honesta de tu capacidad de gasto.', value: '$ 730.000' },
              ].map((item, index) => (
                <div key={item.title} className={`relative rounded-[22px] border p-6 ${index === 2 ? 'border-primary bg-primary text-white' : 'border-border-subtle bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold tracking-[0.14em] ${index === 2 ? 'text-white/60' : 'text-text-tertiary'}`}>{item.step}</span>
                    <item.icon size={23} weight="duotone" className={index === 2 ? 'text-white' : 'text-primary'} />
                  </div>
                  <h3 className="mt-8 text-lg font-bold">{item.title}</h3>
                  <p className={`mt-2 min-h-12 text-sm leading-6 ${index === 2 ? 'text-white/75' : 'text-text-secondary'}`}>{item.text}</p>
                  <p className="mt-7 text-2xl font-extrabold tracking-[-0.035em] tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-8 text-center text-xl font-bold tracking-[-0.02em]">No solo cuánto tenés. <span className="text-primary">Cuánto podés usar.</span></p>
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
              <article key={item.title} className="rounded-[24px] border border-border-subtle bg-bg-secondary p-6 transition-transform hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <item.icon size={25} weight="duotone" />
                </div>
                <h3 className="mt-7 text-xl font-bold tracking-[-0.02em]">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-text-secondary">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="privacidad" className="border-y border-border-subtle bg-bg-secondary px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-[980px] gap-8 rounded-[28px] border border-border-subtle bg-white p-7 shadow-sm md:grid-cols-[auto_1fr] md:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <LockKey size={28} weight="duotone" />
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
        <div className="mx-auto max-w-[1080px] overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#2178A8_0%,#1B6A93_100%)] px-6 py-14 text-center text-white sm:px-12 sm:py-18">
          <h2 className="text-3xl font-extrabold tracking-[-0.04em] sm:text-5xl">Tu plata puede sentirse más clara.</h2>
          <p className="mx-auto mt-5 max-w-[650px] text-lg leading-8 text-white/72">Empezá con una cuenta, registrá tus movimientos y construí una foto financiera que puedas sostener en el tiempo.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-primary shadow-lg">
              Sumarme a la beta
              <ArrowRight size={17} weight="bold" />
            </Link>
            <Link href="/login" className="px-5 py-3.5 text-sm font-semibold text-white/80 hover:text-white">Ya tengo cuenta · Ingresar</Link>
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
