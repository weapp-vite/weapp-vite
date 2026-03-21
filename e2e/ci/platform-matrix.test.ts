import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolvePlatformMatrix } from '../utils/platform-matrix'

const SUPPORTED_PLATFORMS = ['weapp', 'alipay', 'tt'] as const

describe('resolvePlatformMatrix', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('uses local default platform for normal local runs', () => {
    vi.stubEnv('CI', '')
    vi.stubEnv('E2E_FULL_MATRIX', '')
    vi.stubEnv('E2E_PLATFORM', '')
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['vitest'])

    expect(resolvePlatformMatrix(SUPPORTED_PLATFORMS, {
      localDefault: 'weapp',
    })).toEqual(['weapp'])
  })

  it('returns full matrix when updating snapshots locally', () => {
    vi.stubEnv('CI', '')
    vi.stubEnv('E2E_FULL_MATRIX', '')
    vi.stubEnv('E2E_PLATFORM', '')
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['vitest', '-u'])

    expect(resolvePlatformMatrix(SUPPORTED_PLATFORMS, {
      localDefault: 'weapp',
    })).toEqual(['weapp', 'alipay', 'tt'])
  })

  it('returns full matrix when E2E_FULL_MATRIX is enabled', () => {
    vi.stubEnv('CI', '')
    vi.stubEnv('E2E_FULL_MATRIX', '1')
    vi.stubEnv('E2E_PLATFORM', '')
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['vitest'])

    expect(resolvePlatformMatrix(SUPPORTED_PLATFORMS, {
      localDefault: 'weapp',
    })).toEqual(['weapp', 'alipay', 'tt'])
  })

  it('still respects explicit platform selection during snapshot updates', () => {
    vi.stubEnv('CI', '')
    vi.stubEnv('E2E_FULL_MATRIX', '')
    vi.stubEnv('E2E_PLATFORM', 'alipay')
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['vitest', '-u'])

    expect(resolvePlatformMatrix(SUPPORTED_PLATFORMS, {
      localDefault: 'weapp',
    })).toEqual(['alipay'])
  })
})
