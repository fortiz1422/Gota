'use client'

import { useState, useEffect, useRef } from 'react'
import { signInAnonymously, signInWithGoogle, sendOtpEmail, verifyOtpToken } from '@/lib/auth'

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
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

function IconEye({ className = '' }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function IconEyeSlash({ className = '' }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── Wordmark ──────────────────────────────────────────────────────────────────

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

// ── CompactHero — for OTP / Explore screens ───────────────────────────────────

function CompactHero({
  onBack,
  children,
}: {
  onBack?: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="blue-zone relative overflow-hidden px-6"
      style={{
        paddingTop: `calc(env(safe-area-inset-top) + 20px)`,
        paddingBottom: 52,
      }}
    >
      <div className="relative z-10">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-[18px] flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.14] px-3.5 py-[7px]"
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

// ── Sheet — white zone for secondary screens ──────────────────────────────────

function Sheet({
  children,
  center = false,
}: {
  children: React.ReactNode
  center?: boolean
}) {
  return (
    <div
      className={`relative z-10 flex flex-1 flex-col overflow-y-auto overscroll-contain rounded-[28px] rounded-b-none bg-bg-primary ${
        center ? 'items-center justify-center gap-3.5 px-6 py-10 text-center' : ''
      }`}
      style={{ marginTop: -24, WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  )
}

// ── CTAZone — sticky bottom CTA block ─────────────────────────────────────────

function CTAZone({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="sticky bottom-0 flex flex-col gap-2.5 border-t border-black/[0.06] bg-white/92 px-5 pt-4 backdrop-blur-xl"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
    >
      {children}
    </div>
  )
}

// ── Screen 1 — Entry (Option B: "La entrada ES el producto") ──────────────────

function EntryScreen({
  onEmailContinue,
  onExplore,
}: {
  onEmailContinue: (email: string) => void
  onExplore: () => void
}) {
  const [masked, setMasked] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailValue, setEmailValue] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)

  useEffect(() => {
    if (emailOpen) {
      emailRef.current?.focus()
    }
  }, [emailOpen])

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setGoogleError(null)
    const { data, error } = await signInWithGoogle()
    setGoogleLoading(false)
    if (error) {
      setGoogleError(error.message)
      return
    }
    if (data?.url) window.location.href = data.url
  }

  const handleEmailSend = async () => {
    if (!emailValid || emailSending) return
    setEmailSending(true)
    setEmailError(null)
    const { error } = await sendOtpEmail(emailValue.trim())
    setEmailSending(false)
    if (error) {
      setEmailError(error.message)
      return
    }
    onEmailContinue(emailValue.trim())
  }

  return (
    <div className="min-h-app flex flex-col">
      {/* Hero — Blue zone con Saldo Vivo */}
      <div
        className="blue-zone px-[22px]"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + 20px)`,
          paddingBottom: 58,
        }}
      >
        {/* Fila: Wordmark + Ejemplo chip */}
        <div className="mb-7 flex items-center justify-between">
          <Wordmark size={26} onDark />
          <div className="header-glass flex items-center gap-1.5 rounded-full px-3 py-[6px]">
            <div className="h-[5px] w-[5px] rounded-full bg-white/55" />
            <span className="text-[11px] font-semibold text-white/80">Así se ve · Ejemplo</span>
          </div>
        </div>

        {/* Label */}
        <p
          className="mb-[10px] text-[10px] font-bold uppercase tracking-[0.8px] text-white/55"
        >
          SALDO VIVO
        </p>

        {/* Balance + eye toggle */}
        <div className="flex items-center justify-between">
          <p
            className="font-extrabold leading-none tracking-[-0.03em] text-white"
            style={{ fontSize: 40 }}
          >
            {masked ? '$ ··.···.···' : '$ 10.633.632'}
          </p>
          <button
            onClick={() => setMasked((m) => !m)}
            className="header-glass ml-3 shrink-0 rounded-full p-2"
            aria-label={masked ? 'Mostrar saldo' : 'Ocultar saldo'}
          >
            {masked
              ? <IconEye className="text-white/80" />
              : <IconEyeSlash className="text-white/80" />
            }
          </button>
        </div>

        {/* Breakdown */}
        <p className="mt-[6px] text-[13px] font-medium text-white/60">
          {masked ? '·· · ··' : 'ARS 10.633.632 · USD 7.300'}
        </p>
      </div>

      {/* Zona blanca */}
      <div className="flex flex-1 flex-col bg-bg-primary" style={{ marginTop: -24 }}>
        {/* Disponible real — card-s5 (overlapping) */}
        <div className="card-s5 mx-[22px] flex items-center gap-3 p-[18px]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/[0.08] text-primary">
            <IconCard />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-text-primary">Disponible real</p>
            <p className="mt-0.5 text-[12px] leading-snug text-text-secondary">
              Ya descuenta deuda en tarjeta
            </p>
          </div>
          <p className="shrink-0 text-[14px] font-bold text-text-primary">
            {masked ? '···' : '$ 8.240.100'}
          </p>
        </div>

        {/* Framing */}
        <p className="px-[22px] pt-4 text-[13px] leading-snug text-text-tertiary">
          Tu plata, clara en un vistazo.
        </p>

        <div className="flex-1" />

        {/* Access block — sticky bottom */}
        <div
          className="sticky bottom-0 border-t border-black/[0.06] bg-white/92 px-5 pt-4 backdrop-blur-xl"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        >
          {/* Google — CTA primario */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="mb-[10px] flex w-full items-center justify-center gap-2.5 rounded-[12px] bg-primary py-[15px] text-[15px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
          >
            <IconGoogle />
            {googleLoading ? 'Redirigiendo...' : 'Continuar con Google'}
          </button>

          {/* Email — cerrado */}
          {!emailOpen && (
            <button
              onClick={() => setEmailOpen(true)}
              className="mb-[10px] flex w-full items-center justify-center gap-2.5 rounded-[12px] border border-black/10 bg-white py-[15px] text-[15px] font-semibold text-text-primary shadow-sm transition-all active:scale-[0.98]"
            >
              <IconMail className="text-text-secondary" />
              Continuar con email
            </button>
          )}

          {/* Email — expandido inline */}
          {emailOpen && (
            <div
              className="mb-[10px] rounded-[12px] border bg-bg-secondary px-4 pb-[14px] pt-[14px]"
              style={{ borderColor: emailError ? 'rgba(166,30,30,0.35)' : 'rgba(33,120,168,0.25)' }}
            >
              <label className="mb-[10px] block text-[10px] font-bold uppercase tracking-[0.08em] text-text-tertiary">
                Email
              </label>
              <input
                ref={emailRef}
                type="email"
                placeholder="tu@email.com"
                value={emailValue}
                onChange={(e) => {
                  setEmailValue(e.target.value)
                  setEmailError(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailSend()}
                className="mb-[10px] w-full bg-transparent text-[16px] font-medium text-text-primary outline-none placeholder:text-text-disabled"
              />
              {emailError && (
                <p className="mb-[10px] text-[12px] text-danger">{emailError}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEmailOpen(false)
                    setEmailValue('')
                    setEmailError(null)
                  }}
                  className="px-3 py-[10px] text-[13px] font-medium text-text-tertiary"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEmailSend}
                  disabled={!emailValid || emailSending}
                  className="flex-1 rounded-[10px] bg-primary py-[10px] text-[13px] font-semibold text-white transition-all disabled:opacity-30"
                >
                  {emailSending ? 'Enviando...' : 'Enviar código'}
                </button>
              </div>
            </div>
          )}

          {/* Separador */}
          <div className="my-[6px] h-px bg-black/[0.07]" />

          {/* Explorar — acción terciaria */}
          <button
            onClick={onExplore}
            className="flex w-full flex-col items-center py-[10px] transition-opacity active:opacity-60"
          >
            <span className="flex items-center gap-1.5 text-[14px] font-medium text-text-secondary">
              <IconGhost />
              Explorar sin cuenta
            </span>
            <span className="mt-[3px] text-[11px] text-text-dim">
              Los datos quedan en este dispositivo
            </span>
          </button>

          {/* Error Google */}
          {googleError && (
            <p className="mt-1 text-center text-[12px] text-danger">{googleError}</p>
          )}

          {/* Legal */}
          <p className="mt-2 text-center text-[11px] leading-relaxed text-text-dim">
            Al continuar aceptás los{' '}
            <span className="font-medium text-primary">Términos de uso</span> y la{' '}
            <span className="font-medium text-primary">Política de privacidad</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Screen 2 — OTP ─────────────────────────────────────────────────────────────

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
        <CompactHero>
          <div className="h-5" />
        </CompactHero>
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
      <CompactHero onBack={onBack}>
        <h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-white">
          Ingresá el código
        </h2>
        <p className="mt-1 text-[13px] text-white/65">{masked}</p>
      </CompactHero>

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
            className={`w-full rounded-[12px] py-[16px] text-[15px] font-semibold transition-all ${
              full
                ? 'bg-primary text-white active:scale-[0.98]'
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

// ── Screen 3 — Explore ─────────────────────────────────────────────────────────

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
      <CompactHero onBack={onBack}>
        <Wordmark size={26} onDark />
        <p className="mt-1.5 text-[14px] text-white/65">Modo exploración</p>
      </CompactHero>

      <Sheet>
        <div className="px-5 pt-7">
          <div className="rounded-[20px] bg-white p-[18px] shadow-[0_2px_16px_rgba(13,24,41,0.07)]">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.7px] text-primary">
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
            <p className="mb-3 mt-4 text-[11px] font-bold uppercase tracking-[0.7px] text-text-dim">
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
            className="flex w-full items-center justify-center rounded-[12px] bg-primary py-[15px] text-[15px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60"
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

type Screen = 'entry' | 'otp' | 'explore'

export function LoginButton() {
  const [screen, setScreen] = useState<Screen>('entry')
  const [otpEmail, setOtpEmail] = useState('')

  return (
    <div className="min-h-app flex flex-col bg-bg-primary">
      {screen === 'entry' && (
        <EntryScreen
          onEmailContinue={(email) => {
            setOtpEmail(email)
            setScreen('otp')
          }}
          onExplore={() => setScreen('explore')}
        />
      )}
      {screen === 'otp' && (
        <OTPScreen email={otpEmail} onBack={() => setScreen('entry')} />
      )}
      {screen === 'explore' && (
        <ExploreScreen onBack={() => setScreen('entry')} />
      )}
    </div>
  )
}
