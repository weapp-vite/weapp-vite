import { appSharedRouteLabel } from './shared/appRuntime'

App({
  globalData: {
    booted: true,
    sharedRouteLabel: appSharedRouteLabel,
  },

  getPreludeLog() {
    const host = globalThis as typeof globalThis & {
      __appPreludeLog__?: string[]
    }

    return [...(host.__appPreludeLog__ ?? [])]
  },
})
