import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const children = [
  '../../e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.class-style-binding.test',
  '../../e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.form.test',
  '../../e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.layout-feedback-dialog.test',
  '../../e2e/ide/template-weapp-vite-wevu-tailwindcss-tdesign-template.runtime-errors.test',
]

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('WEAPP_VITE_E2E_TARGET_FILE', undefined)
})

afterEach(() => {
  for (const module of ['vitest', '../../e2e/utils/automator', '../../e2e/utils/buildLog', ...children]) {
    vi.doUnmock(module)
  }
  vi.unstubAllEnvs()
  vi.resetModules()
})

function mockHost() {
  const session = { close: vi.fn(async () => {}) }
  const build = vi.fn(async () => {})
  const launch = vi.fn(async () => session)
  vi.doMock('../../e2e/utils/automator', () => ({ launchAutomator: launch }))
  vi.doMock('../../e2e/utils/buildLog', () => ({ runWeappViteBuildWithLogCapture: build }))
  return { session, build, launch }
}

describe('TDesign aggregate session ownership', () => {
  it('explicitly retains the real owner before child hooks without a managed-runner environment', async () => {
    const { session, build, launch } = mockHost()
    const hooks: Array<() => Promise<void>> = []
    const borrowers: Array<typeof import('../../e2e/ide/tdesignRegressionSession')> = []
    vi.doMock('vitest', async (importOriginal) => {
      const actual = await importOriginal<typeof import('vitest')>()
      return { ...actual, afterAll: (hook: () => Promise<void>) => hooks.push(hook) }
    })
    for (const child of children) {
      vi.doMock(child, async () => {
        borrowers.push(await import('../../e2e/ide/tdesignRegressionSession'))
        return {}
      })
    }

    await import('../../e2e/ide/template-wevu-tdesign-regression.aggregate.test')
    expect(borrowers).toHaveLength(4)
    expect(hooks).toHaveLength(1)
    for (const borrower of borrowers) {
      expect(borrower.getTdesignRegressionSession).toBe(borrowers[0]!.getTdesignRegressionSession)
      expect(await borrower.getTdesignRegressionSession()).toBe(session)
      await borrower.closeTdesignRegressionSession()
      expect(session.close).not.toHaveBeenCalled()
    }
    expect(build).toHaveBeenCalledOnce()
    expect(launch).toHaveBeenCalledOnce()
    await hooks[0]!()
    await hooks[0]!()
    expect(session.close).toHaveBeenCalledOnce()
    await expect(borrowers[0]!.getTdesignRegressionSession()).rejects.toThrow('closed')
  })

  it('closes normally when a child runs without the aggregate declaration', async () => {
    const { session, build, launch } = mockHost()
    const child = await import('../../e2e/ide/tdesignRegressionSession')
    expect(await child.getTdesignRegressionSession()).toBe(session)
    await child.closeTdesignRegressionSession()
    expect(session.close).toHaveBeenCalledOnce()
    expect(build).toHaveBeenCalledOnce()
    expect(launch).toHaveBeenCalledOnce()
    await expect(child.getTdesignRegressionSession()).rejects.toThrow('closed')
  })
})
