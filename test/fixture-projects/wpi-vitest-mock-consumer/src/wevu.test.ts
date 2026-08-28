import { api as coreApi } from '@weapp-core/api'
import { api as compatApi } from '@wevu/api'
import { describe, expect, it } from 'vitest'
import { api, createApi, wpi } from 'wevu/api'
import { apiMock, wpiMock } from 'wevu/api/vitest'

describe('wevu/api Vitest setup', () => {
  it('shares one singleton across all API import layers', () => {
    expect(coreApi).toBe(apiMock)
    expect(compatApi).toBe(apiMock)
    expect(api).toBe(apiMock)
    expect(wpi).toBe(wpiMock)
    expect(typeof createApi).toBe('function')
  })
})
