'use client'

import { useState, useEffect, useRef } from 'react'
import { signInAnonymously, signInWithGoogle, sendOtpEmail, verifyOtpToken } from '@/lib/auth'

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 19L8 12L15 5"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function IconMail({ className = '' }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 8L12 14L22 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconGhost() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3C8.13 3 5 6.13 5 10V20L7.5 18L10 20L12 18L14 20L16.5 18L19 20V10C19 6.13 15.87 3 12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="14.5" cy="10.5" r="1" fill="currentColor" />
    </svg>
  )
}

function IconCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 10H22" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="26" r="22" fill="rgba(26,122,66,0.12)" stroke="#1A7A42" strokeWidth="1.5" />
      <path
        d="M16 26L22 32L36 18"
        stroke="#1A7A42"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8V8.5M12 11V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Layout primitives ──────────────────────────────────────────────────────────

function Hero({
  compact = false,
  onBack,
  children,
}: {
  compact?: boolean
  onBack?: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="blue-zone relative overflow-hidden px-6"
      style={{
        paddingTop: `calc(env(safe-area-inset-top) + ${compact ? 20 : 28}px)`,
        paddingBottom: compact ? 52 : 48,
      }}
    >
      {/* dot grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="relative z-10">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-[18px] flex items-center gap-1 rounded-full bg-white/[0.14] px-3.5 py-[7px]"
          >
            <IconChevronLeft />
            <span className="text-[13px] text-white/90">Volver</span>
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

function Sheet({
  children,
  center = false,
}: {
  children: React.ReactNode
  center?: boolean
}) {
  return (
    <div
      className={`relative z-10 -mt-7 flex flex-1 flex-col overflow-y-auto overscroll-contain rounded-[28px] rounded-b-none bg-bg-primary ${
        center ? 'items-center justify-center gap-3.5 px-6 py-10 text-center' : ''
      }`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  )
}

function Wordmark({ size = 52, onDark = true }: { size?: number; onDark?: boolean }) {
  return (
    <div className="inline-flex items-baseline leading-none">
      <span
        className={`font-extrabold tracking-[-0.04em] ${onDark ? 'text-white' : 'text-text-primary'}`}
        style={{ fontSize: size }}
      >
        gota
      </span>
      <span
        className="font-extrabold tracking-[-0.04em]"
        style={{ fontSize: size, color: onDark ? '#5BA8CC' : 'var(--color-primary)' }}
      >
        .
      </span>
    </div>
  )
}

function CTAZone({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="sticky bottom-0 mt-6 flex flex-col gap-2.5 border-t border-black/[0.06] bg-white/92 px-5 pt-4 backdrop-blur-xl"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
    >
      {children}
    </div>
  )
}

// ── Screen 1 — Splash ──────────────────────────────────────────────────────────

function SplashScreen({
  onGoogle,
  onEmail,
  onExplore,
}: {
  onGoogle: () => void
  onEmail: () => void
  onExplore: () => void
}) {
  const [bal, setBal] = useState(0)
  const TARGET = 14788.47

  useEffect(() => {
    let v = 0
    const step = TARGET / 70
    const id = setInterval(() => {
      v += step
      if (v >= TARGET) {
        setBal(TARGET)
        clearInterval(id)
      } else {
        setBal(v)
      }
    }, 18)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-app flex flex-col">
      <Hero>
        <Wordmark size={52} onDark />
        <p className="mt-2 text-base italic font-normal text-white/70">Tu plata, clara.</p>
      </Hero>

      <Sheet>
        {/* Saldo Vivo preview */}
        <div className="px-5 pt-7">
          <div className="rounded-[20px] bg-white p-[18px] shadow-[0_2px_16px_rgba(13,24,41,0.07)]">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.9px] text-primary">
              Saldo Vivo
            </p>
            <p className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-text-primary">
              USD{' '}
              {bal.toLocaleString('es-AR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span className="text-[13px] font-medium text-primary">ARS 10.633.632</span>
              <span className="text-[11px] text-text-dim">|</span>
              <span className="text-[13px] font-medium text-primary">USD 7.300,00</span>
            </div>
            <div className="mt-3.5 flex items-center gap-3 border-t border-black/[0.06] pt-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/[0.08] text-primary">
                <IconCard />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-text-primary">Disponible real</p>
                <p className="mt-0.5 text-[12px] text-text-secondary">
                  Ya descuenta deuda en tarjeta
                </p>
              </div>
              <p className="text-sm font-bold text-text-primary">USD 12.606,08</p>
            </div>
          </div>
        </div>

        <div className="flex-1" />

        <CTAZone>
          <button
            onClick={onGoogle}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] bg-text-primary py-[15px] text-[15px] font-semibold text-white"
          >
            <IconGoogle /> Continuar con Google
          </button>
          <button
            onClick={onEmail}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] border border-black/10 bg-white py-[15px] text-[15px] font-semibold text-text-primary shadow-sm"
          >
            <IconMail className="text-text-secondary" /> Continuar con email
          </button>
          <div className="my-0.5 h-px bg-black/[0.08]" />
          <button
            onClick={onExplore}
            className="flex w-full items-center justify-center gap-2 py-[13px] text-sm font-medium text-text-dim"
          >
            <IconGhost /> Explorar sin cuenta
          </button>
          <p className="text-center text-[11px] leading-relaxed text-text-dim">
            Al continuar aceptás los{' '}
            <span className="text-primary">Términos de uso</span> y la{' '}
            <span className="text-primary">Política de privacidad</span>
          </p>
        </CTAZone>
      </Sheet>
    </div>
  )
}

// ── Screen 2 — Email ───────────────────────────────────────────────────────────

function EmailScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void
  onContinue: (email: string) => void
}) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  const handleSubmit = async () => {
    if (!valid || loading) return
    setLoading(true)
    setError(null)
    const { error } = await sendOtpEmail(email.trim())
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    onContinue(email.trim())
  }

  return (
    <div className="min-h-app flex flex-col">
      <Hero compact onBack={onBack}>
        <Wordmark size={26} onDark />
        <p className="mt-1.5 text-[14px] text-white/65">Ingresá tu email para continuar</p>
      </Hero>

      <Sheet>
        <div className="flex flex-col gap-3 px-5 pt-7">
          <div className="rounded-[20px] bg-white p-[18px] shadow-[0_2px_16px_rgba(13,24,41,0.07)]">
            <label className="mb-1.5 block text-[12px] font-semibold text-text-secondary">
              Email
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
                <IconMail />
              </span>
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                autoFocus
                className="w-full rounded-[12px] border bg-bg-secondary py-[13px] pl-[42px] pr-3.5 text-[15px] text-text-primary outline-none transition-[border-color]"
                style={{ borderColor: valid ? 'rgba(33,120,168,0.35)' : 'transparent' }}
              />
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-text-dim">
              Te enviamos un código de 6 dígitos. Puede estar en spam.
            </p>
          </div>

          <div
            className="flex items-start gap-2 rounded-[12px] px-3 py-2.5"
            style={{ background: 'rgba(33,120,168,0.05)' }}
          >
            <span className="mt-px shrink-0 text-text-dim">
              <IconInfo />
            </span>
            <p className="text-[12px] leading-snug text-text-secondary">
              Si es tu primera vez, te creamos una cuenta automáticamente. Si ya tenés una,
              ingresás directo.
            </p>
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        <div className="flex-1" />

        <CTAZone>
          <button
            onClick={handleSubmit}
            disabled={!valid || loading}
            className={`w-full rounded-[14px] py-[16px] text-[15px] font-semibold transition-all ${
              valid
                ? 'bg-text-primary text-white'
                : 'cursor-default bg-bg-secondary text-text-dim'
            }`}
          >
            {loading ? 'Enviando...' : 'Enviar código'}
          </button>
        </CTAZone>
      </Sheet>
    </div>
  )
}

// ── Screen 3 — OTP ─────────────────────────────────────────────────────────────

function OTPScreen({ email, onBack }: { email: string; onBack: () => void }) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [seconds, setSeconds] = useState(27)
  const [verified, setVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (seconds <= 0) return
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [seconds])

  const handleVerify = async (token: string) => {
    setVerifying(true)
    setError(null)
    const { data, error } = await verifyOtpToken(email, token)
    setVerifying(false)
    if (error) {
      setError('Código inválido. Revisá e intentá de nuevo.')
      setCode(['', '', '', '', '', ''])
      refs.current[0]?.focus()
      return
    }
    if (data.user) {
      setVerified(true)
      const createdMs = new Date(data.user.created_at).getTime()
      const isNew = Date.now() - createdMs < 30_000
      setTimeout(() => {
        window.location.href = isNew ? '/onboarding' : '/'
      }, 1400)
    }
  }

  const handleDigit = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...code]
    next[i] = val
    setCode(next)
    if (val && i < 5) refs.current[i + 1]?.focus()
    if (next.every((d) => d) && val) handleVerify(next.join(''))
  }

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus()
  }

  const handleResend = () => {
    setSeconds(27)
    setError(null)
    sendOtpEmail(email)
  }

  const masked = email.replace(
    /(.{2})(.*)(@.*)/,
    (_, a, b, c) => a + '*'.repeat(Math.max(0, b.length)) + c,
  )
  const full = code.every((d) => d)

  if (verified) {
    return (
      <div className="min-h-app flex flex-col">
        <Hero compact>
          <div className="h-5" />
        </Hero>
        <Sheet center>
          <IconCheck />
          <h2 className="text-[24px] font-extrabold tracking-[-0.02em] text-text-primary">
            ¡Listo!
          </h2>
          <p className="text-[15px] text-text-secondary">Cuenta verificada correctamente.</p>
        </Sheet>
      </div>
    )
  }

  return (
    <div className="min-h-app flex flex-col">
      <Hero compact onBack={onBack}>
        <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-white">
          Ingresá el código
        </h2>
        <p className="mt-1 text-[13px] text-white/65">{masked}</p>
      </Hero>

      <Sheet>
        <div className="px-5 pt-7">
          <p className="mb-7 text-[14px] leading-snug text-text-secondary">
            Te enviamos un código de 6 dígitos.{' '}
            <span className="font-semibold text-text-primary">Revisá también spam.</span>
          </p>

          <div className="mb-6 flex justify-center gap-2.5">
            {code.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKey(i, e)}
                className="h-[54px] w-11 rounded-[14px] border text-center text-[22px] font-bold text-text-primary outline-none transition-all"
                style={{
                  background: d ? '#fff' : 'var(--color-bg-secondary)',
                  borderColor: d ? 'rgba(33,120,168,0.4)' : 'transparent',
                  boxShadow: d ? '0 0 0 4px rgba(33,120,168,0.1)' : 'none',
                }}
              />
            ))}
          </div>

          <div className="text-center">
            {seconds > 0 ? (
              <span className="text-[14px] text-text-dim">
                Reenviar en{' '}
                <span className="font-bold text-text-primary">
                  00:{String(seconds).padStart(2, '0')}
                </span>
              </span>
            ) : (
              <button
                onClick={handleResend}
                className="text-[14px] font-semibold text-primary"
              >
                Reenviar código
              </button>
            )}
          </div>

          {error && <p className="mt-4 text-center text-[13px] text-danger">{error}</p>}
        </div>

        <div className="flex-1" />

        <CTAZone>
          <button
            onClick={() => full && !verifying && handleVerify(code.join(''))}
            disabled={!full || verifying}
            className={`w-full rounded-[14px] py-[16px] text-[15px] font-semibold transition-all ${
              full
                ? 'bg-text-primary text-white'
                : 'cursor-default bg-bg-secondary text-text-dim'
            }`}
          >
            {verifying ? 'Verificando...' : 'Verificar código'}
          </button>
        </CTAZone>
      </Sheet>
    </div>
  )
}

// ── Screen 4 — Explore ─────────────────────────────────────────────────────────

function ExploreScreen({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEnter = async () => {
    setLoading(true)
    setError(null)
    const { error } = await signInAnonymously()
    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }
    window.location.href = '/'
  }

  const canDo = [
    'Registrar gastos e ingresos',
    'Ver tu Saldo Vivo',
    'Usar el SmartInput con IA',
    'Navegar Analytics',
  ]
  const cantDo = [
    'Sincronizar entre dispositivos',
    'Recuperar tus datos si perdés el celular',
  ]

  return (
    <div className="min-h-app flex flex-col">
      <Hero compact onBack={onBack}>
        <Wordmark size={26} onDark />
        <p className="mt-1.5 text-[14px] text-white/65">Modo exploración</p>
      </Hero>

      <Sheet>
        <div className="px-5 pt-7">
          <div className="rounded-[20px] bg-white p-[18px] shadow-[0_2px_16px_rgba(13,24,41,0.07)]">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.7px] text-primary">
              Podés explorar
            </p>
            {canDo.map((item, i) => (
              <div
                key={item}
                className={`flex items-center gap-2.5 py-2.5 ${
                  i < canDo.length - 1 ? 'border-b border-black/[0.06]' : ''
                }`}
              >
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                <span className="text-[14px] text-text-primary">{item}</span>
              </div>
            ))}
            <p className="mb-3 mt-4 text-[12px] font-bold uppercase tracking-[0.7px] text-text-dim">
              Sin cuenta no podés
            </p>
            {cantDo.map((item, i) => (
              <div
                key={item}
                className={`flex items-center gap-2.5 py-2.5 ${
                  i < cantDo.length - 1 ? 'border-b border-black/[0.05]' : ''
                }`}
              >
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-dim" />
                <span className="text-[14px] text-text-dim">{item}</span>
              </div>
            ))}
            <p className="mt-4 text-[12px] leading-snug text-text-dim">
              Tus datos se guardan en este dispositivo hasta que conectes una cuenta.
            </p>
          </div>
          {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
        </div>

        <div className="flex-1" />

        <CTAZone>
          <button
            onClick={handleEnter}
            disabled={loading}
            className="flex w-full items-center justify-center rounded-[14px] bg-text-primary py-[15px] text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar sin cuenta'}
          </button>
          <button
            onClick={onBack}
            className="flex w-full items-center justify-center py-[13px] text-sm font-medium text-text-dim"
          >
            Mejor me registro
          </button>
        </CTAZone>
      </Sheet>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

type Screen = 'splash' | 'email' | 'otp' | 'explore'

export function LoginButton() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [otpEmail, setOtpEmail] = useState('')

  const handleGoogle = async () => {
    const { data, error } = await signInWithGoogle()
    if (error) return
    if (data?.url) window.location.href = data.url
  }

  const handleEmailContinue = (email: string) => {
    setOtpEmail(email)
    setScreen('otp')
  }

  return (
    <div className="min-h-app flex flex-col bg-bg-primary">
      {screen === 'splash' && (
        <SplashScreen
          onGoogle={handleGoogle}
          onEmail={() => setScreen('email')}
          onExplore={() => setScreen('explore')}
        />
      )}
      {screen === 'email' && (
        <EmailScreen onBack={() => setScreen('splash')} onContinue={handleEmailContinue} />
      )}
      {screen === 'otp' && (
        <OTPScreen email={otpEmail} onBack={() => setScreen('email')} />
      )}
      {screen === 'explore' && (
        <ExploreScreen onBack={() => setScreen('splash')} />
      )}
    </div>
  )
}
