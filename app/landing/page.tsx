import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowUpRight,
  ArrowRight,
  Wallet,
  CreditCard,
  PencilSimple,
} from '@phosphor-icons/react/dist/ssr'
import styles from './landing.module.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://gota.money'),
  alternates: { canonical: 'https://gota.money' },
  robots: { index: true, follow: true },
  title: 'Gota — Tu plata clara',
  description:
    'Registrá tus gastos, reuní tus cuentas y entendé cuánto te queda. Empezá sin cuenta, con tus propios datos.',
  openGraph: {
    url: 'https://gota.money',
    siteName: 'Gota',
    locale: 'es_AR',
    type: 'website',
    title: 'Gota — Tu plata clara',
    description:
      'Lo que tenés. Lo que ya comprometiste. Lo que te queda. Empezá sin cuenta.',
  },
}

const questions = [
  [
    '¿Tengo que crear una cuenta?',
    'Podés empezar sin mail ni contraseña. Tus movimientos se guardan en Gota y el acceso queda ligado a este navegador. Creá una cuenta para recuperarlos desde otro dispositivo o si borrás la sesión.',
  ],
  [
    '¿Necesito conectar mi banco?',
    'No. Empezás con el nombre de una cuenta y, si lo sabés, su saldo actual. Podés registrar todo a mano. Mercado Pago es una conexión opcional: revisás los movimientos antes de incorporarlos.',
  ],
  [
    '¿Qué significa “disponible real”?',
    'Es una referencia que considera tu dinero y la deuda registrada en tarjetas. Para que sea útil, mantené tus saldos y movimientos al día. No incluye gastos o compromisos que todavía no cargaste.',
  ],
  [
    '¿Funciona sin internet?',
    'Por ahora necesitás conexión para guardar y consultar tus datos. El modo sin cuenta no es un modo offline.',
  ],
  [
    '¿Tengo que instalar algo?',
    'No. Abrís Gota en el navegador del celular o de la computadora. También podés agregarla a la pantalla de inicio.',
  ],
]

function Logo() {
  return (
    <Image
      src="/brand/gota-wordmark-primary.svg"
      alt="Gota"
      width={108}
      height={32}
      priority
    />
  )
}
function StartLink({
  children = 'Empezar sin cuenta',
}: {
  children?: React.ReactNode
}) {
  return (
    <Link href="/start" className={styles.cta}>
      {children}
      <ArrowRight size={18} aria-hidden />
    </Link>
  )
}

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/landing" aria-label="Gota, inicio">
          <Logo />
        </Link>
        <nav aria-label="Navegación principal">
          <a href="#como-funciona" className={styles.navDetail}>
            Cómo funciona
          </a>
          <Link href="/login">
            Ingresar <ArrowUpRight size={16} aria-hidden />
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span /> Finanzas claras
          </p>
          <h1>
            Tu plata,
            <br />
            <em>a la vista.</em>
          </h1>
          <p className={styles.lead}>
            Lo que tenés. Lo que ya comprometiste.
            <br className={styles.desktopBreak} /> Lo que te queda para vos.
          </p>
          <p className={styles.intro}>
            Reuní tus cuentas, registrá tus gastos y entendé tu mes. Sin
            planillas y sin tener que saber de finanzas.
          </p>
          <StartLink />
          <p className={styles.caption}>
            Sin mail ni contraseña para empezar.
            <br />
            Con tus propios datos, desde el primer gasto.
          </p>
          <a href="#como-funciona" className={styles.textLink}>
            Conocé cómo funciona <span aria-hidden>↓</span>
          </a>
        </div>
        <figure className={styles.product}>
          <div className={styles.productBackdrop} aria-hidden />
          <div className={styles.productLabel}>
            Una foto más clara de tu mes
          </div>
          <div className={styles.phone}>
            <Image
              src="/landing/gota-home-demo.png"
              alt="Vista de Gota con el dinero entre cuentas, disponible real y últimos movimientos"
              width={393}
              height={852}
              priority
              sizes="(max-width: 700px) 290px, 320px"
            />
          </div>
          <figcaption>Vista de Gota · datos de ejemplo</figcaption>
        </figure>
      </section>

      <section className={styles.value} aria-labelledby="value-title">
        <div>
          <p className={styles.eyebrow}>La cuenta que importa</p>
          <h2 id="value-title">
            Tener saldo no es
            <br />
            tenerlo todo disponible.
          </h2>
        </div>
        <div className={styles.valueCopy}>
          <p>
            Entre el banco, la billetera y la tarjeta, es fácil perder de vista
            cuánto podés usar.
          </p>
          <p>
            Gota junta esa información para que puedas verla con claridad. Vos
            registrás y revisás; Gota hace las cuentas.
          </p>
          <span>La foto mejora con cada movimiento que cargás.</span>
        </div>
      </section>

      <section id="como-funciona" className={styles.how}>
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>De cero a tu primer gasto</p>
          <h2>
            Empezá simple.
            <br />
            El resto, después.
          </h2>
          <p>No hace falta cargar toda tu vida financiera para arrancar.</p>
        </div>
        <div className={styles.steps}>
          <article>
            <div className={styles.stepTop}>
              <Wallet size={24} aria-hidden />
              <span>01</span>
            </div>
            <h3>Elegí dónde tenés plata.</h3>
            <p>
              Tu banco, Mercado Pago o efectivo. Poné un nombre y, si lo sabés,
              cuánto tenés hoy.
            </p>
            <div className={styles.accountExample}>
              <span>Mi cuenta</span>
              <strong>$ 120.000</strong>
              <small>Saldo de ejemplo</small>
            </div>
          </article>
          <article>
            <div className={styles.stepTop}>
              <PencilSimple size={24} aria-hidden />
              <span>02</span>
            </div>
            <h3>Escribí lo que gastaste.</h3>
            <p>
              “Ayer gasté 20 mil en el súper”. Revisá el monto, la fecha y de
              dónde salió la plata antes de guardar.
            </p>
            <blockquote>
              ayer gasté 20 mil en el súper
              <span>Monto · fecha · categoría → revisión</span>
            </blockquote>
          </article>
          <article>
            <div className={styles.stepTop}>
              <CreditCard size={24} aria-hidden />
              <span>03</span>
            </div>
            <h3>Entendé cómo venís.</h3>
            <p>
              Consultá tus movimientos y lo que queda. Cuando quieras, sumá
              otras cuentas, tarjetas y cuotas.
            </p>
            <div className={styles.progressExample}>
              <span>Dinero en cuentas</span>
              <div />
              <span>Disponible después de tarjetas</span>
              <div />
              <small>Ejemplo ilustrativo</small>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.trust}>
        <p className={styles.eyebrow}>Vos tenés el control</p>
        <h2>
          Registrás tu plata.
          <br />
          Gota no la mueve.
        </h2>
        <p>
          No pedimos tus claves bancarias. Cada gasto pasa por tu revisión.
          Podés empezar sin cuenta y crear una después para conservar el acceso
          a tus movimientos.
        </p>
        <Link href="/privacy" className={styles.textLink}>
          Cómo cuidamos tus datos <ArrowUpRight size={17} aria-hidden />
        </Link>
      </section>

      <section className={styles.faq} id="preguntas">
        <div>
          <p className={styles.eyebrow}>Antes de empezar</p>
          <h2>
            Lo esencial,
            <br />
            sin letra chica.
          </h2>
        </div>
        <div>
          {questions.map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden>+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <p className={styles.eyebrow}>Un gasto es un buen comienzo</p>
        <h2>
          Tu próximo gasto,
          <br />
          un poco más claro.
        </h2>
        <StartLink />
        <Link href="/login" className={styles.textLink}>
          Ingresar o crear cuenta <ArrowUpRight size={17} aria-hidden />
        </Link>
        <p className={styles.caption}>
          Empezá de a poco y revisá tus datos.
        </p>
      </section>
      <footer className={styles.footer}>
        <Logo />
        <p>Gota · gota.money · Argentina</p>
        <div>
          <a href="mailto:facundo@gota.money">facundo@gota.money</a>
          <Link href="/privacy">Privacidad</Link>
          <Link href="/terms">Condiciones de uso</Link>
        </div>
      </footer>
    </main>
  )
}
