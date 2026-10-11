import type * as RuntimeDefinition from './define'
import type * as RuntimePlatform from './platform'
import type * as RuntimeProvide from './provide'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { WEVU_NATIVE_SLOT_CONTEXT_KEY } from '@weapp-core/constants'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const platformEntry = fileURLToPath(new URL('./platform.ts', import.meta.url))
const registrationEntry = fileURLToPath(new URL('./register/component/registerNativeDefinition.ts', import.meta.url))
const aliases = {
  '@weapp-core/shared/platforms/runtime': fileURLToPath(new URL('../../../../@weapp-core/shared/src/platforms/runtime/index.ts', import.meta.url)),
  '@weapp-core/shared/platforms': fileURLToPath(new URL('../../../../@weapp-core/shared/src/platforms/index.ts', import.meta.url)),
  '@weapp-core/constants': fileURLToPath(new URL('../../../../@weapp-core/constants/src/index.ts', import.meta.url)),
}

async function bundleRuntime(platform: string, registration = false) {
  const source = registration
    ? `export { registerNativeComponentDefinition } from ${JSON.stringify(registrationEntry)}`
    : `import { getCurrentMiniProgramGlobalObject } from ${JSON.stringify(platformEntry)}; export const host = getCurrentMiniProgramGlobalObject()`
  const result = await build({
    stdin: { contents: source, resolveDir: repositoryRoot },
    bundle: true,
    write: false,
    format: 'esm',
    minify: true,
    define: { 'import.meta.env.PLATFORM': JSON.stringify(platform), 'process.env.NODE_ENV': '"production"' },
    alias: aliases,
  })
  return result.outputFiles[0]!.text
}

async function loadCompiledPlatform(platform: string, hosts: Record<string, unknown>) {
  const result = await build({
    entryPoints: [platformEntry],
    bundle: true,
    write: false,
    format: 'cjs',
    define: { 'import.meta.env.PLATFORM': JSON.stringify(platform) },
    alias: aliases,
  })
  const module = { exports: {} }
  runInNewContext(result.outputFiles[0]!.text, { module, ...hosts })
  return module.exports as typeof RuntimePlatform
}

describe('runtime platform bundle boundaries', () => {
  it.each(['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs', 'web'])('omits build metadata for %s', async (platform) => {
    const code = await bundleRuntime(platform)
    expect(code).not.toContain('project.config.json')
    expect(code).not.toContain('miniprogram-api-typings')
    expect(code).not.toContain('outputExtensions')
    expect(code).not.toContain('globalResolvePriority')
  })

  it.each(['weapp', 'tt', 'swan', 'jd', 'xhs', 'web'])('omits Alipay component adaptation for %s', async (platform) => {
    const code = await bundleRuntime(platform, true)
    expect(code).not.toContain('didMount')
    expect(code).not.toContain('didUnmount')
  })

  it('retains Alipay component adaptation for Alipay', async () => {
    const code = await bundleRuntime('alipay', true)
    expect(code).toContain('didMount')
    expect(code).toContain('didUnmount')
  })

  it.each([
    ['weapp', 'wx'],
    ['alipay', 'my'],
    ['tt', 'tt'],
    ['swan', 'swan'],
    ['jd', 'jd'],
    ['xhs', 'xhs'],
    ['web', 'wx'],
  ])('selects the compiled %s host when every host global exists', async (platform, globalKey) => {
    const hosts = Object.fromEntries(['wx', 'my', 'tt', 'swan', 'jd', 'xhs'].map(key => [key, { name: key }]))
    const runtime = await loadCompiledPlatform(platform, hosts)
    expect(runtime.getCurrentMiniProgramGlobalObject()).toBe(hosts[globalKey])
    expect(runtime.resolveCurrentMiniProgramPlatform()).toBe(platform === 'web' ? 'weapp' : platform)
    expect(runtime.supportsCurrentMiniProgramRuntimeCapability('pageShareMenu')).toBe(platform !== 'alipay')
    expect(runtime.supportsCurrentMiniProgramRuntimeCapability('appThemeChangeListener')).toBe(!['alipay', 'tt'].includes(platform))
  })

  it('keeps explicit host selection separate from the compiled current host', async () => {
    const hosts = { wx: {}, my: {} }
    const runtime = await loadCompiledPlatform('weapp', hosts)
    expect(runtime.getCurrentMiniProgramGlobalObject()).toBe(hosts.wx)
    expect(runtime.getMiniProgramGlobalObject('my')).toBe(hosts.my)
  })

  it('keeps the Douyin wx compatibility bridge', async () => {
    const hosts = { wx: {} }
    const runtime = await loadCompiledPlatform('tt', hosts)
    expect(runtime.getCurrentMiniProgramGlobalObject()).toBe(hosts.wx)
    expect(runtime.resolveCurrentMiniProgramPlatform()).toBe('tt')
  })

  it('does not substitute an unrelated host for an unavailable compiled host', async () => {
    const runtime = await loadCompiledPlatform('alipay', { wx: {} })
    expect(runtime.getCurrentMiniProgramGlobalObject()).toBeUndefined()
  })

  it.each(['alipay', 'tt', 'web'])('keeps ordinary owner injection without native discovery on compiled %s', async (platform) => {
    const definitionEntry = fileURLToPath(new URL('./define.ts', import.meta.url))
    const provideEntry = fileURLToPath(new URL('./provide.ts', import.meta.url))
    const result = await build({
      stdin: {
        contents: `export { createWevuComponentDefinition, getWevuComponentLifecycleDefinition } from ${JSON.stringify(definitionEntry)}; export { inject, provide } from ${JSON.stringify(provideEntry)}`,
        resolveDir: repositoryRoot,
      },
      bundle: true,
      write: false,
      format: 'cjs',
      define: { 'import.meta.env.PLATFORM': JSON.stringify(platform), 'process.env.NODE_ENV': '"production"' },
      alias: aliases,
    })
    const module = { exports: {} }
    runInNewContext(result.outputFiles[0]!.text, { module, console })
    const runtime = module.exports as typeof RuntimeDefinition & typeof RuntimeProvide
    const token = Symbol('ordinary-owner')
    const context = { value: 10 }
    let injected: unknown
    const definitions = [
      runtime.getWevuComponentLifecycleDefinition(runtime.createWevuComponentDefinition({
        [WEVU_NATIVE_SLOT_CONTEXT_KEY]: true,
        setup: () => runtime.provide(token, context),
      }))!,
      runtime.getWevuComponentLifecycleDefinition(runtime.createWevuComponentDefinition({
        [WEVU_NATIVE_SLOT_CONTEXT_KEY]: true,
        setup: () => { injected = runtime.inject(token) },
      }))!,
    ]
    const owner = { properties: {}, setData() {} }
    const child = {
      properties: {},
      setData() {},
      selectOwnerComponent: () => owner,
      triggerEvent() { throw new Error('Native discovery is unsupported on this platform') },
    }
    const hosts = [owner, child]
    try {
      definitions.forEach((definition, index) => {
        definition.lifetimes.created.call(hosts[index])
        definition.lifetimes.attached.call(hosts[index])
      })
      expect(injected).toBe(context)
    }
    finally {
      for (let index = hosts.length - 1; index >= 0; index--) {
        definitions[index].lifetimes.detached.call(hosts[index])
      }
    }
  })

  it('keeps dynamic discovery for targets outside the supported build backends', async () => {
    const hosts = { xhs: {} }
    const runtime = await loadCompiledPlatform('custom-host', hosts)
    expect(runtime.getCurrentMiniProgramGlobalObject()).toBe(hosts.xhs)
    expect(runtime.resolveCurrentMiniProgramPlatform()).toBe('xhs')
  })
})
