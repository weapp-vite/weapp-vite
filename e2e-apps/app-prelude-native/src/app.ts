import { sharedRouteLabel } from './shared/runtime'

App({
  globalData: {
    booted: true,
    sharedRouteLabel,
  },

  getPreludeLog() {
    const host = globalThis as typeof globalThis & {
      __appPreludeLog__?: string[]
    }

    return [...(host.__appPreludeLog__ ?? [])]
  },
})
