import { describe, expect, it, vi } from 'vitest'
import { createDevProcessEnv } from './dev-process-env'

describe('createDevProcessEnv', () => {
  it('preserves the inherited machine lease while stripping other E2E variables', () => {
    vi.stubEnv('WEAPP_VITE_E2E_MACHINE_LEASE', '{"pid":1,"token":"lease"}')
    vi.stubEnv('WEAPP_VITE_E2E_TASK_FILTER', 'template')

    const env = createDevProcessEnv()

    expect(env.WEAPP_VITE_E2E_MACHINE_LEASE).toBe('{"pid":1,"token":"lease"}')
    expect(env.WEAPP_VITE_E2E_TASK_FILTER).toBeUndefined()
  })
})
