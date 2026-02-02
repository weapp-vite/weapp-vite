import {
  createApp,
  getCurrentInstance,
  onError,
  onHide,
  onLaunch,
  onPageNotFound,
  onShow,
  onThemeChange,
  onUnhandledRejection,
} from 'wevu'
import { initStoreManager } from './shared/store'

initStoreManager()

createApp({
  data: () => ({
    __appHooks: [] as string[],
  }),
  setup() {
    const app = getCurrentInstance() as { globalData?: { __appHooks?: string[] } } | undefined
    const logs: string[] = []
    const push = (name: string) => {
      logs.push(name)
      if (app?.globalData) {
        app.globalData.__appHooks = logs.slice()
      }
    }

    onLaunch(() => push('onLaunch'))
    onShow(() => push('onShow'))
    onHide(() => push('onHide'))
    onError(() => push('onError'))
    onPageNotFound(() => push('onPageNotFound'))
    onUnhandledRejection(() => push('onUnhandledRejection'))
    onThemeChange(() => push('onThemeChange'))

    return {}
  },
})
