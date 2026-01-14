import type { WxmlToken } from './types'
import { LRUCache } from 'lru-cache'

export const scanWxmlCache = new LRUCache<string, WxmlToken>(
  {
    max: 512,
  },
)

function fnv1aHash(input: string) {
  let hash = 0x811C9DC5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function createCacheKey(source: string, platform: string) {
  return `${platform}:${source.length.toString(36)}:${fnv1aHash(source)}`
}
