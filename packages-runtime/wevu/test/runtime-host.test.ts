import type * as Router from '../src/router'
import type * as Hooks from '../src/runtime/hooks/base'
import type * as Platform from '../src/runtime/platform'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { rolldown } from 'rolldown'
import { beforeAll, describe, expect, it, vi } from 'vitest'

type Runtime = typeof Hooks & typeof Platform & Pick<typeof Router, 'createRouter' | 'useRouter'>
type PlatformName = 'weapp' | 'alipay' | 'tt'
const bundles = new Map<PlatformName, string>()

beforeAll(async () => {
  for (const platform of ['weapp', 'alipay', 'tt'] as const) {
    const entry = 'virtual:runtime-host'
    const bundle = await rolldown({
      input: entry,
      platform: 'neutral',
      transform: { define: { 'import.meta': JSON.stringify({ env: { PLATFORM: platform } }) } },
      plugins: [{
        name: 'runtime-host-test',
        resolveId: id => id === entry ? id : undefined,
        load: id => id === entry
          ? [
              `export * from ${JSON.stringify(path.resolve(import.meta.dirname, '../src/runtime/platform.ts'))}`,
              `export * from ${JSON.stringify(path.resolve(import.meta.dirname, '../src/runtime/hooks/base.ts'))}`,
              `export { createRouter, useRouter } from ${JSON.stringify(path.resolve(import.meta.dirname, '../src/router.ts'))}`,
            ].join('\n')
          : undefined,
      }],
    })
    try {
      const result = await bundle.generate({ format: 'cjs' })
      const chunk = result.output.find(item => item.type === 'chunk')
      if (!chunk || chunk.type !== 'chunk') {
        throw new Error('Missing runtime host test bundle')
      }
      bundles.set(platform, chunk.code)
    }
    finally {
      await bundle.close()
    }
  }
})

function loadRuntime(platform: PlatformName, globals: Record<string, unknown>) {
  const module = { exports: {} }
  runInNewContext(bundles.get(platform)!, {
    module,
    exports: module.exports,
    console,
    setTimeout,
    clearTimeout,
    ...globals,
  })
  return module.exports as Runtime
}

function createHost() {
  return Object.fromEntries(['switchTab', 'reLaunch', 'redirectTo', 'navigateTo', 'navigateBack'].map(name => [
    name,
    vi.fn((options: { success?: (result: unknown) => void }) => {
      options.success?.({ errMsg: `${name}:ok` })
    }),
  ]))
}

describe('mini program host bindings (issue #1035)', () => {
  it.each([
    ['weapp', 'wx'],
    ['alipay', 'my'],
    ['tt', 'tt'],
  ] as const)('%s bootstraps with a top-level %s binding and no globalThis', async (platform, key) => {
    const host = createHost()
    const navigateTo = host.navigateTo
    const pages = [{ route: 'pages/home/index' }]
    const runtime = loadRuntime(platform, { globalThis: undefined, [key]: host, getCurrentPages: () => pages })
    expect(runtime.resolveCurrentMiniProgramPlatform()).toBe(platform)
    expect(runtime.getMiniProgramGlobalObject()).toBe(host)
    expect(runtime.getCurrentMiniProgramPages()).toEqual(pages)
    const router = runtime.createRouter({ routes: [{ name: 'next', path: '/pages/next/index' }] })
    expect(runtime.useRouter()).toBe(router)
    await router.push({ name: 'next' })
    expect(navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/next/index' }))
    expect(navigateTo.mock.contexts).toEqual([host])
  })

  it.each(['weapp', 'alipay', 'tt'] as const)('%s shares synchronous setup context across runtime copies', (platform) => {
    const key = { weapp: 'wx', alipay: 'my', tt: 'tt' }[platform]
    const globals = { globalThis: undefined, [key]: createHost() }
    const first = loadRuntime(platform, globals)
    const second = loadRuntime(platform, globals)
    const instance = {} as Parameters<Runtime['setCurrentInstance']>[0]
    const context = { instance }
    first.setCurrentInstance(instance)
    first.setCurrentSetupContext(context)
    expect(second.getCurrentInstance()).toBe(instance)
    expect(second.getCurrentSetupContext()).toBe(context)
    second.setCurrentInstance(undefined)
    second.setCurrentSetupContext(undefined)
    expect(first.getCurrentInstance()).toBeUndefined()
    expect(first.getCurrentSetupContext()).toBeUndefined()
  })

  it.each([
    ['weapp', 'wx'],
    ['alipay', 'my'],
    ['tt', 'tt'],
  ] as const)('resolves compiled %s from lexical %s despite unrelated globalThis hosts', (platform, key) => {
    const host = createHost()
    const runtime = loadRuntime(platform, { globalThis: {}, wx: createHost(), my: createHost(), tt: createHost(), [key]: host })
    expect(runtime.resolveCurrentMiniProgramPlatform()).toBe(platform)
    expect(runtime.getMiniProgramGlobalObject()).toBe(host)
    expect(runtime.createRouter()).toBe(runtime.useRouter())
  })

  it('preserves the native page-stack receiver and prefers the selected host', () => {
    const pages = [{ route: 'pages/home/index' }]
    const host = { ...createHost(), getCurrentPages: vi.fn(() => pages) }
    const runtime = loadRuntime('tt', { globalThis: { getCurrentPages: () => [] }, tt: host })
    expect(runtime.getCurrentMiniProgramPages()).toEqual(pages)
    expect(host.getCurrentPages.mock.contexts).toEqual([host])
  })

  it('uses the wx compatibility host only when the compiled tt host is absent', () => {
    const host = createHost()
    const runtime = loadRuntime('tt', { globalThis: {}, wx: host, my: createHost() })
    expect(runtime.resolveCurrentMiniProgramPlatform()).toBe('tt')
    expect(runtime.getMiniProgramGlobalObject()).toBe(host)
    expect(runtime.createRouter()).toBe(runtime.useRouter())
  })

  it('keeps missing-router diagnostics without requiring any host global during import', () => {
    const runtime = loadRuntime('tt', { globalThis: undefined })
    expect(runtime.getMiniProgramGlobalObject()).toBeUndefined()
    expect(runtime.useRouter).toThrow('useRouter() 未找到已创建的 router 实例')
  })
})
