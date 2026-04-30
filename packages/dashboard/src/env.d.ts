/// <reference types="vite/client" />

import type { AnalyzeSubpackagesResult, DashboardRuntimeEvent } from './features/dashboard/types'

declare global {
  interface Window {
    __WEAPP_VITE_ANALYZE_RESULT__?: AnalyzeSubpackagesResult
    __WEAPP_VITE_PREVIOUS_ANALYZE_RESULT__?: AnalyzeSubpackagesResult | null
    __WEAPP_VITE_DASHBOARD_EVENTS__?: DashboardRuntimeEvent[]
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}

declare module 'echarts/theme/dark.js' {}

export {}
