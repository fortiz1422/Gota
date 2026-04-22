import { createClient } from '@/lib/supabase/client'

/** Crea un usuario anónimo con sesión real en Supabase */
export const signInAnonymously = () => createClient().auth.signInAnonymously()

/** Vincula Google al usuario anónimo actual → convierte en cuenta permanente */
export const linkGoogleAccount = () =>
  createClient().auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback?auth_intent=link_google` },
  })
