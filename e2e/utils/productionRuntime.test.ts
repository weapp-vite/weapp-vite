import path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createProductionRuntime } from './productionRuntime'

const { execa } = vi.hoisted(() => ({ execa: vi.fn() }))
vi.mock('execa', () => ({ execa }))
const projectPath = path.resolve('owned production project')
const cliPath = 'selected-stable-cli'

beforeEach(() => {
  execa.mockReset().mockResolvedValue({ exitCode: 0 })
  vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', cliPath)
})
afterEach(() => vi.unstubAllEnvs())

it('reuses one session within a generation and closes only its exact project with the selected installation', async () => {
  const session = { close: vi.fn(async () => {}) }
  const launch = vi.fn(async () => session)
  const runtime = createProductionRuntime({ projectPath, provider: 'devtools', launch })
  const [first, second] = await Promise.all([runtime.open(), runtime.open()])
  expect(first).toBe(second)
  expect(launch).toHaveBeenCalledExactlyOnceWith({ projectPath, cliPath })
  vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', 'another-installation')
  await Promise.all([runtime.close(), runtime.close()])
  await runtime.close()
  expect(session.close).toHaveBeenCalledOnce()
  expect(execa).toHaveBeenCalledExactlyOnceWith(cliPath, ['close', '--project', projectPath], { timeout: 30_000, windowsHide: true })
  await runtime.open()
  expect(launch).toHaveBeenCalledTimes(2)
  await runtime.close()
})

it('releases the SDK connection before closing the project and before launching another generation', async () => {
  const events: string[] = []
  execa.mockImplementation(async () => {
    events.push('project-close')
  })
  const runtime = createProductionRuntime({ projectPath, provider: 'devtools', launch: async () => {
    events.push('launch')
    return { close: async () => {
      events.push('session-close')
    } }
  } })
  await runtime.open()
  const closing = runtime.close()
  const next = runtime.open()
  await closing
  await next
  expect(events).toEqual(['launch', 'session-close', 'project-close', 'launch'])
  await runtime.close()
})

it('keeps manual projects untouched when this owner never opened a session', async () => {
  const launch = vi.fn(async () => ({ close: vi.fn() }))
  const runtime = createProductionRuntime({ projectPath, provider: 'devtools', launch })
  await runtime.close()
  expect(launch).not.toHaveBeenCalled()
  expect(execa).not.toHaveBeenCalled()
})

it('uses a new headless VM per generation without invoking any DevTools command', async () => {
  const first = { close: vi.fn(async () => {}) }
  const second = { close: vi.fn(async () => {}) }
  const launch = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second)
  const runtime = createProductionRuntime({ projectPath, provider: 'headless', launch })
  expect(await runtime.open()).toBe(first)
  await runtime.close()
  expect(await runtime.open()).toBe(second)
  await runtime.close()
  expect(first.close).toHaveBeenCalledOnce()
  expect(second.close).toHaveBeenCalledOnce()
  expect(execa).not.toHaveBeenCalled()
})

it('still closes the owned project after a protocol cleanup failure, without suppressing the failure', async () => {
  const failure = new Error('Tool.close failed')
  const session = { close: vi.fn(async () => {
    throw failure
  }) }
  const runtime = createProductionRuntime({ projectPath, provider: 'devtools', launch: async () => session })
  await runtime.open()
  await expect(runtime.close()).rejects.toMatchObject({ errors: [failure] })
  await runtime.close()
  expect(session.close).toHaveBeenCalledOnce()
  expect(execa).toHaveBeenCalledOnce()
})

it('refuses the next generation when exact-project close fails and retries only its pending release', async () => {
  const failure = new Error('CLI close failed')
  execa.mockRejectedValueOnce(failure)
  const session = { close: vi.fn(async () => {}) }
  const launch = vi.fn(async () => session)
  const runtime = createProductionRuntime({ projectPath, provider: 'devtools', launch })
  await runtime.open()
  await expect(runtime.close()).rejects.toMatchObject({ errors: [failure] })
  await expect(runtime.open()).rejects.toThrow('Previous production project has not closed')
  expect(launch).toHaveBeenCalledOnce()
  await runtime.close()
  expect(session.close).toHaveBeenCalledOnce()
  expect(execa).toHaveBeenCalledTimes(2)
  await runtime.open()
  expect(launch).toHaveBeenCalledTimes(2)
  await runtime.close()
})

it('waits for a late owned launch before releasing it', async () => {
  const pending = Promise.withResolvers<{ close: () => Promise<void> }>()
  const session = { close: vi.fn(async () => {}) }
  const runtime = createProductionRuntime({ projectPath, provider: 'devtools', launch: () => pending.promise })
  const opening = runtime.open()
  const closing = runtime.close()
  pending.resolve(session)
  await opening
  await closing
  expect(session.close).toHaveBeenCalledOnce()
  expect(execa).toHaveBeenCalledOnce()
})

it('requires explicit CLI selection for DevTools without changing user configuration', () => {
  vi.stubEnv('WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH', '')
  const launch = vi.fn(async () => ({ close: vi.fn() }))
  expect(() => createProductionRuntime({ projectPath, provider: 'devtools', launch })).toThrow('explicitly selected')
  expect(() => createProductionRuntime({ projectPath, provider: 'headless', launch })).not.toThrow()
  expect(launch).not.toHaveBeenCalled()
  expect(execa).not.toHaveBeenCalled()
})

it('preserves another owner with a different project and IDE installation', async () => {
  const first = { close: vi.fn(async () => {}) }
  const second = { close: vi.fn(async () => {}) }
  const otherProject = path.resolve('another production project')
  const firstRuntime = createProductionRuntime({ projectPath, provider: 'devtools', cliPath, launch: async () => first })
  const secondRuntime = createProductionRuntime({ projectPath: otherProject, provider: 'devtools', cliPath: 'other-cli', launch: async () => second })
  await firstRuntime.open()
  await secondRuntime.open()
  await firstRuntime.close()
  expect(first.close).toHaveBeenCalledOnce()
  expect(second.close).not.toHaveBeenCalled()
  expect(execa).toHaveBeenCalledExactlyOnceWith(cliPath, ['close', '--project', projectPath], { timeout: 30_000, windowsHide: true })
  expect(await secondRuntime.open()).toBe(second)
  await secondRuntime.close()
  expect(execa).toHaveBeenLastCalledWith('other-cli', ['close', '--project', otherProject], { timeout: 30_000, windowsHide: true })
})
