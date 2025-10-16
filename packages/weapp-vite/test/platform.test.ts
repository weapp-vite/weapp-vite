import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MP_PLATFORM,
  MINI_PLATFORM_ALIASES,
  normalizeMiniPlatform,
  resolveMiniPlatform,
} from '@/platform'

describe('platform utilities', () => {
  it('normalizes platform input by trimming and lowercasing', () => {
    expect(normalizeMiniPlatform('  WeChat  ')).toBe('wechat')
    expect(normalizeMiniPlatform('JD')).toBe('jd')
    expect(normalizeMiniPlatform(undefined)).toBeUndefined()
  })

  it('resolves well-known aliases to canonical mini program platforms', () => {
    expect(resolveMiniPlatform('wx')).toBe('weapp')
    expect(resolveMiniPlatform('Baidu')).toBe('swan')
    expect(resolveMiniPlatform('jingdong')).toBe('jd')
    expect(resolveMiniPlatform('douyin')).toBe('tt')
  })

  it('returns undefined for unknown platforms so callers can fallback', () => {
    expect(resolveMiniPlatform('unknown-platform')).toBeUndefined()
    expect(resolveMiniPlatform('')).toBeUndefined()
  })

  it('exposes alias table entries for new platforms', () => {
    expect(MINI_PLATFORM_ALIASES.swan).toBe('swan')
    expect(MINI_PLATFORM_ALIASES.baidu).toBe('swan')
    expect(MINI_PLATFORM_ALIASES.jd).toBe('jd')
  })

  it('provides a default mini program platform constant', () => {
    expect(DEFAULT_MP_PLATFORM).toBe('weapp')
  })
})
