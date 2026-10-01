import { afterEach, expect, it, vi } from 'vitest'

type Hook = () => void | Promise<void>

async function loadSuite(launch: () => Promise<{ close: () => Promise<void> }>) {
  const suites: Array<{ setup?: Hook, teardown?: Hook }> = []
  let current: (typeof suites)[number] | undefined
  vi.doMock('vitest', () => ({
    beforeAll: (hook: Hook) => {
      if (current) {
        current.setup = hook
      }
    },
    afterAll: (hook: Hook) => {
      if (current) {
        current.teardown = hook
      }
    },
    describe: (_name: string, _options: unknown, register: () => void) => {
      current = {}
      suites.push(current)
      register()
      current = undefined
    },
    it: () => {},
    expect,
  }))
  vi.doMock('node:child_process', () => ({ execFileSync: vi.fn() }))
  vi.doMock('./automator', () => ({ launchAutomator: launch }))
  vi.doMock('./domAcceptance', () => ({ createDomAcceptance: vi.fn() }))
  await import('../ide/agent-acceptance.test')
  return suites
}

afterEach(() => {
  vi.doUnmock('vitest')
  vi.doUnmock('node:child_process')
  vi.doUnmock('./automator')
  vi.doUnmock('./domAcceptance')
  vi.resetModules()
})

it('waits for an in-flight launch during teardown and closes its late session', async () => {
  let finishLaunch!: (session: { close: () => Promise<void> }) => void
  const pending = new Promise<{ close: () => Promise<void> }>((resolve) => {
    finishLaunch = resolve
  })
  const launch = vi.fn(() => pending)
  const [suite] = await loadSuite(launch)
  const setup = suite!.setup!()
  const closed = vi.fn(async () => {})
  let teardownDone = false
  const teardown = Promise.resolve(suite!.teardown!()).then(() => {
    teardownDone = true
  })
  await Promise.resolve()
  await Promise.resolve()
  expect(launch).toHaveBeenCalledTimes(1)
  expect(teardownDone).toBe(false)
  finishLaunch({ close: closed })
  await setup
  await teardown
  expect(closed).toHaveBeenCalledTimes(1)
  expect(teardownDone).toBe(true)
})

it('preserves the launch failure without masking it with teardown errors', async () => {
  const failure = new Error('host unavailable')
  const [suite] = await loadSuite(async () => {
    throw failure
  })
  await expect(suite!.setup!()).rejects.toBe(failure)
  await expect(Promise.resolve(suite!.teardown!())).resolves.toBeUndefined()
})
