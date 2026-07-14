type LockableStyle = {
  overflow: string
}

type LockableBodyStyle = LockableStyle & {
  position: string
  top: string
  width: string
}

export type ScrollLockEnvironment = {
  bodyStyle: LockableBodyStyle
  rootStyle: LockableStyle
  getScrollY: () => number
  scrollTo: (x: number, y: number) => void
}

type SavedScrollState = {
  scrollY: number
  bodyOverflow: string
  bodyPosition: string
  bodyTop: string
  bodyWidth: string
  rootOverflow: string
}

export type ScrollLockManager = {
  acquire: (id: string) => void
  release: (id: string) => void
  isLocked: () => boolean
}

export function createScrollLockManager(
  environment: ScrollLockEnvironment
): ScrollLockManager {
  const lockIds = new Set<string>()
  let savedState: SavedScrollState | null = null

  return {
    acquire(id) {
      if (lockIds.has(id)) return

      if (lockIds.size === 0) {
        savedState = {
          scrollY: environment.getScrollY(),
          bodyOverflow: environment.bodyStyle.overflow,
          bodyPosition: environment.bodyStyle.position,
          bodyTop: environment.bodyStyle.top,
          bodyWidth: environment.bodyStyle.width,
          rootOverflow: environment.rootStyle.overflow,
        }

        environment.rootStyle.overflow = 'hidden'
        environment.bodyStyle.overflow = 'hidden'
        environment.bodyStyle.position = 'fixed'
        environment.bodyStyle.top = `-${savedState.scrollY}px`
        environment.bodyStyle.width = '100%'
      }

      lockIds.add(id)
    },
    release(id) {
      if (!lockIds.delete(id) || lockIds.size > 0 || !savedState) return

      const stateToRestore = savedState
      savedState = null
      environment.rootStyle.overflow = stateToRestore.rootOverflow
      environment.bodyStyle.overflow = stateToRestore.bodyOverflow
      environment.bodyStyle.position = stateToRestore.bodyPosition
      environment.bodyStyle.top = stateToRestore.bodyTop
      environment.bodyStyle.width = stateToRestore.bodyWidth
      environment.scrollTo(0, stateToRestore.scrollY)
    },
    isLocked() {
      return lockIds.size > 0
    },
  }
}

let browserScrollLocks: ScrollLockManager | null = null

function getBrowserScrollLocks(): ScrollLockManager | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null

  browserScrollLocks ??= createScrollLockManager({
    bodyStyle: document.body.style,
    rootStyle: document.documentElement.style,
    getScrollY: () => window.scrollY,
    scrollTo: (x, y) => window.scrollTo(x, y),
  })
  return browserScrollLocks
}

export function acquireScrollLock(id: string): void {
  getBrowserScrollLocks()?.acquire(id)
}

export function releaseScrollLock(id: string): void {
  getBrowserScrollLocks()?.release(id)
}
