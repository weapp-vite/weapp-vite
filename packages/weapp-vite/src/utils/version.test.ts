import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.doUnmock('@weapp-core/logger')
  vi.doUnmock('node:process')
  delete (globalThis as any).Deno
  delete (globalThis as any).Bun
})

async function loadVersionModule(options: {
  process: any
  setup?: () => void
}) {
  const warn = vi.fn()
  vi.doMock('@weapp-core/logger', () => ({ default: { warn } }))
  vi.doMock('node:process', () => ({ default: options.process }))
  options.setup?.()
  const mod = await import('./version')
  return { warn, ...mod }
}

describe('utils/version', () => {
  it('warns when the current runtime has no minimum requirement configured', async () => {
    const { checkRuntime, warn } = await loadVersionModule({
      process: {
        versions: { node: '20.0.0' },
        version: 'v20.0.0',
      },
    })

    checkRuntime({ bun: '1.0.0' })
    expect(warn).toHaveBeenCalledWith('未为 node 指定最低版本，已跳过检查。')
  })

  it('warns when the runtime version is lower than required', async () => {
    const { checkRuntime, warn } = await loadVersionModule({
      process: {
        versions: { node: '1.0.0' },
        version: 'v1.0.0',
      },
    })

    checkRuntime({ node: '2.0.0' })
    expect(warn).toHaveBeenCalledWith(
      '当前 node 版本为 1.0.0 无法满足 `weapp-vite` 最低要求的版本(>= 2.0.0)',
    )
  })

  it('does not warn when the runtime already satisfies the requirement', async () => {
    const { checkRuntime, warn } = await loadVersionModule({
      process: {
        versions: { node: '3.0.0' },
        version: 'v3.0.0',
      },
    })

    checkRuntime({ node: '2.0.0' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('supports deno runtime detection', async () => {
    const { checkRuntime, warn } = await loadVersionModule({
      process: {},
      setup: () => {
        (globalThis as any).Deno = {
          version: {
            deno: '1.40.0',
            v8: '1',
            typescript: '1',
          },
        }
      },
    })

    checkRuntime({ deno: '1.0.0' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('supports bun runtime detection and version comparison', async () => {
    const { checkRuntime, warn } = await loadVersionModule({
      process: {},
      setup: () => {
        (globalThis as any).Bun = { version: '1.0.1' }
      },
    })

    checkRuntime({ bun: '2.0.0' })
    expect(warn).toHaveBeenCalledWith(
      '当前 bun 版本为 1.0.1 无法满足 `weapp-vite` 最低要求的版本(>= 2.0.0)',
    )
  })
})
