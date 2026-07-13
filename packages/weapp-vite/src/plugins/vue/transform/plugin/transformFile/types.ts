import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { HmrProfileDurationKey } from '../../../../../utils/hmrProfile'

export interface VueCompilationCacheEntry {
  result: VueTransformResult
  source?: string
  isPage: boolean
  autoRoutesSignature?: string
  refreshToken?: number
  styleIndependentSignature?: string
}

export type VueCompilationCache = Map<string, VueCompilationCacheEntry>

export type TransformStageMeasurer = <T>(stage: string, action: () => Promise<T>) => Promise<T>

export type VueHmrStageMeasurer = <T>(
  stage: string,
  profileKey: HmrProfileDurationKey,
  action: () => Promise<T>,
) => Promise<T>

export type VueStyleBlocksCache = Map<string, SFCStyleBlock[]>
