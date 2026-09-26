import { afterEach, expect, it, vi } from 'vitest'
import { createBenchmarkDevEnv } from './environment'

afterEach(() => vi.unstubAllEnvs())

it('retains normal sidecar watching even when the caller has a diagnostic override', () => {
  vi.stubEnv('WEAPP_VITE_DISABLE_SIDECAR_WATCH', '1')
  vi.stubEnv('CHOKIDAR_INTERVAL', '999')
  const env = createBenchmarkDevEnv('--inspect=0')
  expect(env.WEAPP_VITE_DISABLE_SIDECAR_WATCH).toBe('0')
  expect(env.CHOKIDAR_USEPOLLING).toBe('1')
  expect(env.CHOKIDAR_INTERVAL).toBe('120')
  expect(env.NODE_OPTIONS).toBe('--inspect=0')
  expect(env.VITEST).toBeUndefined()
})
