import type { Buffer } from 'node:buffer'
import type { ScanWxmlOptions } from '../../types'
import { defu } from '@weapp-core/shared'
import { createCacheKey, scanWxmlCache } from './cache'
import { defaultExcludeComponent } from './events'
import { parseWxml } from './parser'

export type { RemovalRange, WxmlToken } from './types'

export function scanWxml(wxml: string | Buffer, options?: ScanWxmlOptions) {
  const source = typeof wxml === 'string' ? wxml : wxml.toString()
  const opts = defu<Required<ScanWxmlOptions>, ScanWxmlOptions[]>(options, {
    excludeComponent: defaultExcludeComponent,
    platform: 'weapp',
  })
  const canUseCache = opts.excludeComponent === defaultExcludeComponent
  const cacheKey = canUseCache ? createCacheKey(source, opts.platform) : undefined
  if (cacheKey) {
    const cached = scanWxmlCache.get(cacheKey)
    if (cached) {
      return cached
    }
  }

  const { token } = parseWxml({
    source,
    platform: opts.platform,
    excludeComponent: opts.excludeComponent,
  })

  if (cacheKey) {
    scanWxmlCache.set(cacheKey, token)
  }
  return token
}

export type ScanWxmlResult = ReturnType<typeof scanWxml>
