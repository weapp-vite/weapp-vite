import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { startAnalyzeDashboard } from './dashboard'

const bridge = vi.hoisted(() => ({ loaded: false, failure: new Error('Dashboard transport unavailable') }))
const runtime = vi.hoisted(() => ({ controllerLoaded: false, authLoaded: false }))
const resolveDashboardRoot = vi.hoisted(() => vi.fn())

vi.mock('../../dashboard/assets', () => ({
  ANALYZE_DASHBOARD_PACKAGE_NAME: '@weapp-vite/dashboard',
  resolveDashboardRoot,
}))

vi.mock('./dashboardViteBridge', () => {
  bridge.loaded = true
  throw bridge.failure
})

vi.mock('../../dashboard', () => {
  runtime.controllerLoaded = true
  return { createAnalyzeDashboardDevframe: vi.fn() }
})

vi.mock('devframe/node/auth', () => {
  runtime.authLoaded = true
  return { buildOtpAuthUrl: vi.fn(), refreshTempAuthCode: vi.fn() }
})

it('loads dashboard runtime only after resolving an installed dashboard and its transport', async () => {
  expect(bridge.loaded).toBe(false)
  expect(runtime).toEqual({ controllerLoaded: false, authLoaded: false })
  const result = { packages: [], modules: [], subPackages: [] }
  resolveDashboardRoot.mockReturnValue(undefined)
  await expect(startAnalyzeDashboard(result, { artifacts: new Map() })).resolves.toBeUndefined()
  expect(bridge.loaded).toBe(false)
  expect(runtime).toEqual({ controllerLoaded: false, authLoaded: false })

  resolveDashboardRoot.mockReturnValue({ root: path.join(tmpdir(), 'dashboard-loading') })
  await expect(startAnalyzeDashboard(result, { artifacts: new Map() })).rejects.toMatchObject({ cause: bridge.failure })
  expect(bridge.loaded).toBe(true)
  expect(runtime).toEqual({ controllerLoaded: false, authLoaded: false })
})
