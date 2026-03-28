import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkRuntime, formatRequiredRuntimeVersion } from './version'

afterEach(() => {
  delete (globalThis as any).Deno
  delete (globalThis as any).Bun
  vi.unstubAllGlobals()
})

function createWarn() {
  return vi.fn()
}

describe('utils/version', () => {
  it('formats plain and ranged runtime requirements for warnings', () => {
    expect(formatRequiredRuntimeVersion('2.0.0')).toBe('>= 2.0.0')
    expect(formatRequiredRuntimeVersion('^20.19.0 || >=22.12.0')).toBe('^20.19.0 || >=22.12.0')
  })

  it('warns when the current runtime has no minimum requirement configured', () => {
    const warn = createWarn()

    checkRuntime(
      { bun: '1.0.0' },
      {
        runtimeInfo: {
          runtime: 'node',
          version: '20.0.0',
        },
        logger: { warn },
      },
    )

    expect(warn).toHaveBeenCalledWith('未为 node 指定最低版本，已跳过检查。')
  })

  it('warns when the runtime version is lower than required', () => {
    const warn = createWarn()

    checkRuntime(
      { node: '2.0.0' },
      {
        runtimeInfo: {
          runtime: 'node',
          version: '1.0.0',
        },
        logger: { warn },
      },
    )

    expect(warn).toHaveBeenCalledWith(
      '当前 node 版本为 1.0.0 无法满足 `weapp-vite` 最低要求的版本(>= 2.0.0)',
    )
  })

  it('does not warn when the runtime already satisfies the requirement', () => {
    const warn = createWarn()

    checkRuntime(
      { node: '2.0.0' },
      {
        runtimeInfo: {
          runtime: 'node',
          version: '3.0.0',
        },
        logger: { warn },
      },
    )

    expect(warn).not.toHaveBeenCalled()
  })

  it('warns when the runtime version does not satisfy a range requirement', () => {
    const warn = createWarn()

    checkRuntime(
      { node: '^20.19.0 || >=22.12.0' },
      {
        runtimeInfo: {
          runtime: 'node',
          version: '21.0.0',
        },
        logger: { warn },
      },
    )

    expect(warn).toHaveBeenCalledWith(
      '当前 node 版本为 21.0.0 无法满足 `weapp-vite` 最低要求的版本(^20.19.0 || >=22.12.0)',
    )
  })

  it('does not warn when the runtime version satisfies a range requirement', () => {
    const warn = createWarn()

    checkRuntime(
      { node: '^20.19.0 || >=22.12.0' },
      {
        runtimeInfo: {
          runtime: 'node',
          version: '22.12.0',
        },
        logger: { warn },
      },
    )

    expect(warn).not.toHaveBeenCalled()
  })

  it('supports deno runtime detection', () => {
    const warn = createWarn()

    ;(globalThis as any).Deno = {
      version: {
        deno: '1.40.0',
        v8: '1',
        typescript: '1',
      },
    }

    checkRuntime(
      { deno: '1.0.0' },
      {
        logger: { warn },
      },
    )

    expect(warn).not.toHaveBeenCalled()
  })

  it('supports bun runtime detection and version comparison', () => {
    const warn = createWarn()

    ;(globalThis as any).Bun = { version: '1.0.1' }

    checkRuntime(
      { bun: '2.0.0' },
      {
        logger: { warn },
      },
    )

    expect(warn).toHaveBeenCalledWith(
      '当前 bun 版本为 1.0.1 无法满足 `weapp-vite` 最低要求的版本(>= 2.0.0)',
    )
  })
})
