import type { AnalyzeSubpackagesResult } from './src-types'

declare global {
  interface Window {
    __WEAPP_VITE_ANALYZE_RESULT__?: AnalyzeSubpackagesResult
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, any>
  export default component
}

export {}
