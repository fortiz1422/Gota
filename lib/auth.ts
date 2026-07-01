import { createClient } from '@/lib/supabase/client'

type ExperimentalPasskeyAuth = {
  signInWithPasskey: () => Promise<any>
  registerPasskey: () => Promise<any>
  passkey: {
    list: () => Promise<any>
    update: (params: { passkeyId: string; friendlyName: string }) => Promise<any>
    delete: (params: { passkeyId: string }) => Promise<any>
  }
}

const passkeyAuth = () => createClient().auth as unknown as ExperimentalPasskeyAuth

/** Crea un usuario anónimo con sesión real en Supabase */
export const signInAnonymously = () => createClient().auth.signInAnonymously()

export const isPasskeySupported = () =>
  typeof window !== 'undefined' && typeof PublicKeyCredential !== 'undefined' && window.isSecureContext

export const signInWithPasskey = () => passkeyAuth().signInWithPasskey()

export const registerPasskey = () => passkeyAuth().registerPasskey()

export const listPasskeys = () => passkeyAuth().passkey.list()

export const renamePasskey = (passkeyId: string, friendlyName: string) =>
  passkeyAuth().passkey.update({ passkeyId, friendlyName })

export const deletePasskey = (passkeyId: string) =>
  passkeyAuth().passkey.delete({ passkeyId })

/** Vincula Google al usuario anónimo actual → convierte en cuenta permanente */
export const linkGoogleAccount = () =>
  createClient().auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback?auth_intent=link_google` },
  })

/** Sign-in normal con Google → para cuenta existente, no preserva sesión anónima */
export const signInWithGoogle = () =>
  createClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })

export const startAnonymousEmailUpgrade = (email: string) =>
  createClient().auth.updateUser(
    { email },
    {
      emailRedirectTo: `${window.location.origin}/auth/callback?auth_intent=anon_email_upgrade&next=/auth/create-password`,
    }
  )

export const signInWithEmailPassword = (email: string, password: string) =>
  createClient().auth.signInWithPassword({ email, password })

export const signUpWithEmailPassword = (email: string, password: string) =>
  createClient().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })

export const requestPasswordReset = (email: string) =>
  createClient().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
  })

export const updatePassword = (password: string) =>
  createClient().auth.updateUser({ password })

export const sendOtpEmail = (email: string) =>
  createClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } })

export const verifyOtpToken = (email: string, token: string) =>
  createClient().auth.verifyOtp({ email, token, type: 'email' })
