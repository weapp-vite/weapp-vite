import { getSupportedMiniProgramPlatforms, MINI_PROGRAM_PLATFORM_ALIASES } from '@weapp-core/shared'
import { describe, expect, it } from 'vitest'
import {
  BUILD_VERIFICATION_CAPABILITIES,
  PLATFORM_VERIFICATION_CAPABILITIES,
  TARGET_PLATFORM_IDS,
} from './verification'

describe('platform verification capabilities', () => {
  it('keeps the six target platforms in the agreed order', () => {
    expect(TARGET_PLATFORM_IDS).toEqual(['weapp', 'tt', 'ks', 'alipay', 'dingtalk', 'swan'])
  })

  it('covers every public mini program platform with a build expectation', () => {
    expect(BUILD_VERIFICATION_CAPABILITIES.map(item => item.id).sort()).toEqual(
      [...getSupportedMiniProgramPlatforms()].sort(),
    )
  })

  it('keeps aliases aligned with the shared registry for public platforms', () => {
    for (const capability of BUILD_VERIFICATION_CAPABILITIES) {
      expect(MINI_PROGRAM_PLATFORM_ALIASES[capability.id]).toBe(capability.id)
      for (const alias of capability.aliases) {
        expect(MINI_PROGRAM_PLATFORM_ALIASES[alias]).toBe(capability.id)
      }
    }
  })

  it('does not invent output contracts for planned platforms', () => {
    const planned = PLATFORM_VERIFICATION_CAPABILITIES.filter(item => item.build === 'planned')
    expect(planned.map(item => item.id)).toEqual(['ks', 'dingtalk'])
    expect(planned.every(item => !('expectation' in item))).toBe(true)
  })

  it('records Douyin simulator verification without inventing automator support', () => {
    expect(PLATFORM_VERIFICATION_CAPABILITIES.find(item => item.id === 'tt')).toMatchObject({
      build: 'required',
      ideCli: 'unsupported',
      runtimeAutomator: 'unsupported',
      simulator: 'optional',
    })
  })
})
