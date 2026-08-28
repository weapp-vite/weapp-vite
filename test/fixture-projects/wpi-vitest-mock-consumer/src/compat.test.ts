import { api as coreApi } from '@weapp-core/api'
import { api, createApi, wpi } from '@wevu/api'
import { apiMock, wpiMock } from '@wevu/api/vitest'
import { describe, expect, it } from 'vitest'

describe('@wevu/api Vitest setup', () => {
  it('shares one singleton across core and compatibility imports', () => {
    expect(coreApi).toBe(apiMock)
    expect(api).toBe(apiMock)
    expect(wpi).toBe(wpiMock)
    expect(typeof createApi).toBe('function')
  })
})
