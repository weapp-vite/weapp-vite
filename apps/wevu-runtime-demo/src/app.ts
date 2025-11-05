import { createApp } from 'wevu'
import type { RuntimeInstance } from 'wevu'

interface GlobalState {
  initialized: boolean
  theme: 'dark' | 'light'
  logs: string[]
}

type GlobalMethods = {
  toggleTheme(this: GlobalRuntimeContext): void
  appendLog(this: GlobalRuntimeContext, message: string): void
  markInitialized(this: GlobalRuntimeContext): void
}

type GlobalRuntimeContext = GlobalState & GlobalMethods
type GlobalRuntime = RuntimeInstance<GlobalState, {}, GlobalMethods>

type AppGlobalData = {
  runtimeLogs: string[]
  theme: 'dark' | 'light'
}

type AppInstance = WechatMiniprogram.App.Instance<AppGlobalData> & {
  globalData: AppGlobalData
  $wevu?: GlobalRuntime
}

export const appRuntime = createApp({
  data: () => ({
    initialized: false,
    theme: 'dark',
    logs: [],
  }),
  methods: {
    toggleTheme(this: GlobalRuntimeContext) {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      this.appendLog(`切换主题为：${this.theme}`)
    },
    appendLog(this: GlobalRuntimeContext, message: string) {
      this.logs = [...this.logs, message]
    },
    markInitialized(this: GlobalRuntimeContext) {
      if (!this.initialized) {
        this.initialized = true
        this.appendLog('应用初始化完成')
      }
    },
  },
  globalData: {
    runtimeLogs: [],
    theme: 'dark',
  } satisfies AppGlobalData,
  setup({ runtime, watch, instance }) {
    const app = instance as AppInstance
    runtime.methods.appendLog('应用已启动')
    runtime.methods.markInitialized()
    
    watch(
      () => runtime.proxy.logs.slice(),
      (logs) => {
        app.globalData.runtimeLogs = logs.slice()
      },
      {
        immediate: true,
        deep: true,
      },
    )

    watch(
      () => runtime.proxy.theme,
      (theme) => {
        app.globalData.theme = theme as AppGlobalData['theme']
      },
      { immediate: true },
    )
  },
  onLaunch(this: AppInstance) {
    console.log('[wevu-runtime-demo] app launched with wevu runtime')
  },
  onShow(this: AppInstance) {
    this.$wevu?.methods.appendLog('应用切换到前台')
  },
  onHide(this: AppInstance) {
    this.$wevu?.methods.appendLog('应用切换到后台')
  },
})
