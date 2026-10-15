export type StartDestination = '/' | '/onboarding' | 'create-anonymous'

export function resolveStartDestination(input: {
  hasUser: boolean
  onboardingCompleted: boolean
}): StartDestination {
  if (!input.hasUser) return 'create-anonymous'
  if (input.onboardingCompleted) return '/'
  return '/onboarding'
}

type AnonymousSessionDeps = {
  getSession: () => Promise<boolean>
  signIn: () => Promise<void>
}

let pendingAnonymousSession: Promise<void> | null = null

export function resetAnonymousSessionGuard(): void {
  pendingAnonymousSession = null
}

/** One in-flight anonymous sign-in per page load. A refresh with a session does not call sign-in. */
export function ensureAnonymousSession(deps: AnonymousSessionDeps): Promise<void> {
  if (!pendingAnonymousSession) {
    pendingAnonymousSession = (async () => {
      if (await deps.getSession()) return
      await deps.signIn()
    })()
  }
  return pendingAnonymousSession
}
