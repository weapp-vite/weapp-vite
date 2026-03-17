/// <reference types="vite/client" />

import type { AnalyzeSubpackagesResult } from './types'

declare global {
  interface Window {
    __WEAPP_VITE_ANALYZE_RESULT__?: AnalyzeSubpackagesResult
  }
}

export {}
