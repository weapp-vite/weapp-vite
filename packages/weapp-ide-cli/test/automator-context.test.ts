import { beforeEach, expect, it, vi } from 'vitest'
import { resolveAutomatorSessionOptions } from '../src/cli/automator/context'

const resolveTarget = vi.hoisted(() => vi.fn())
vi.mock('../src/devtoolsTarget', () => ({ resolveWechatDevtoolsTarget: resolveTarget }))
const stable = { cliPath: 'stable-cli', installationId: 'stable', appPath: 'stable-app', profileDir: 'stable-profile' }

it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5, 65536])('rejects explicit invalid port %s before resolving an installation', async (port) => {
  for (const runtimeProvider of ['devtools', 'headless'] as const) {
    await expect(resolveAutomatorSessionOptions({ projectPath: 'project', runtimeProvider, port })).rejects.toThrow(/port[^\n\r1\u2028\u2029]*1.*65535/i)
  }
  expect(resolveTarget).not.toHaveBeenCalled()
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  resolveTarget.mockResolvedValue(stable)
})

it('pins an installation once for retries and all children', async () => {
  const resolved = await resolveAutomatorSessionOptions({ projectPath: 'project', cliPath: 'stable-cli' })
  await resolveAutomatorSessionOptions({ ...resolved, timeout: 1000 })
  expect(resolveTarget).toHaveBeenNthCalledWith(1, { projectPath: 'project', cliPath: 'stable-cli' })
  expect(resolveTarget).toHaveBeenNthCalledWith(2, { ...resolved, timeout: 1000 })
  expect(resolved).toMatchObject({ cliPath: 'stable-cli', installationId: 'stable', target: stable })
})

it('preserves a conflicting context for the common resolver to reject', async () => {
  const options = { projectPath: 'project', target: stable, cliPath: 'rc-cli' }
  const conflict = Object.assign(new Error('conflicting installation'), { code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
  resolveTarget.mockRejectedValueOnce(conflict)
  await expect(resolveAutomatorSessionOptions(options)).rejects.toBe(conflict)
  expect(resolveTarget).toHaveBeenCalledExactlyOnceWith(options)
})

it('rejects inconsistent shared installation identity', async () => {
  await expect(resolveAutomatorSessionOptions({ projectPath: 'project', installationId: 'rc' })).rejects.toThrow('DEVTOOLS_INSTALLATION_MISMATCH')
})

it('does not inspect installed IDEs for headless validation', async () => {
  vi.stubEnv('WEAPP_VITE_E2E_RUNTIME_PROVIDER', 'headless')
  const resolved = await resolveAutomatorSessionOptions({ projectPath: 'project' })
  expect(resolved).toMatchObject({ runtimeProvider: 'headless', installationId: 'headless' })
  expect(resolveTarget).not.toHaveBeenCalled()
  vi.unstubAllEnvs()
})
