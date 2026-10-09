import type * as Reactivity from '../src/reactivity'
import type * as PublicRuntime from '../src/runtime/publicRuntime'
import type * as Registration from '../src/runtime/register/runtimeInstance'
import type { InternalRuntimeState } from '../src/runtime/types'
import type * as Scheduler from '../src/scheduler'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

type ConsumerMode = 'production' | 'development' | 'missing-env'
type Runtime = Pick<typeof PublicRuntime, 'createApp' | 'mountRuntimeInstance'>
  & Pick<typeof Registration, 'enableDeferredSetData' | 'teardownRuntimeInstance'>
  & Pick<typeof Reactivity, 'ref'>
  & Pick<typeof Scheduler, 'nextTick'>

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const source = (name: string) => fileURLToPath(new URL(`../src/${name}.ts`, import.meta.url))
const aliases = {
  '@weapp-core/shared/platforms/runtime': fileURLToPath(new URL('../../../@weapp-core/shared/src/platforms/runtime/index.ts', import.meta.url)),
  '@weapp-core/shared/platforms': fileURLToPath(new URL('../../../@weapp-core/shared/src/platforms/index.ts', import.meta.url)),
  '@weapp-core/constants': fileURLToPath(new URL('../../../@weapp-core/constants/src/index.ts', import.meta.url)),
}

async function bundleConsumer(mode: ConsumerMode, minimal = false) {
  const contents = minimal
    ? `export { createApp } from ${JSON.stringify(source('runtime/app'))}; export { ref } from ${JSON.stringify(source('reactivity/index'))}`
    : [
        `export { createApp, mountRuntimeInstance } from ${JSON.stringify(source('runtime/publicRuntime'))}`,
        `export { enableDeferredSetData, teardownRuntimeInstance } from ${JSON.stringify(source('runtime/register/runtimeInstance'))}`,
        `export { ref } from ${JSON.stringify(source('reactivity/index'))}`,
        `export { nextTick } from ${JSON.stringify(source('scheduler'))}`,
      ].join('\n')
  const define: Record<string, string> = {
    // 发布阶段可能先固定 NODE_ENV，应用侧模式仍须保留开发消费者的 HMR。
    'process.env.NODE_ENV': '"production"',
    ...(mode === 'missing-env'
      ? { 'import.meta': '{}' }
      : {
          'import.meta.env.PLATFORM': '"weapp"',
          'import.meta.env.PROD': JSON.stringify(mode === 'production'),
          'import.meta.env.DEV': JSON.stringify(mode === 'development'),
        }),
  }
  return build({
    stdin: { contents, resolveDir: repositoryRoot },
    bundle: true,
    write: false,
    format: 'cjs',
    target: 'es2020',
    minify: true,
    metafile: true,
    define,
    alias: aliases,
  })
}

async function loadRuntime(mode: ConsumerMode) {
  const bundle = await bundleConsumer(mode)
  const module = { exports: {} }
  runInNewContext(bundle.outputFiles[0]!.text, {
    module,
    exports: module.exports,
    console,
    setTimeout,
    clearTimeout,
    getCurrentPages: () => [],
  })
  return module.exports as Runtime
}

function createHost() {
  return {
    data: {} as Record<string, unknown>,
    properties: {},
    setData(payload: Record<string, unknown>, callback?: () => void) {
      Object.assign(this.data, payload)
      callback?.()
    },
  } as InternalRuntimeState
}

async function flush(runtime: Runtime) {
  await runtime.nextTick()
  await runtime.nextTick()
}

describe('runtime: production HMR boundaries', () => {
  it('keeps production mounting idempotent for the same host and a replacement app', async () => {
    const runtime = await loadRuntime('production')
    const target = createHost()
    const count = runtime.ref(1)
    const app = runtime.createApp({})
    let initialSetups = 0
    let replacementSetups = 0
    try {
      runtime.mountRuntimeInstance(target, app, undefined, () => {
        initialSetups++
        return { count }
      })
      await flush(runtime)
      expect(target.data.count).toBe(1)
      const mounted = target.__wevu
      runtime.mountRuntimeInstance(target, app, undefined, () => {
        replacementSetups++
      })
      expect(target.__wevu).toBe(mounted)
      runtime.mountRuntimeInstance(target, runtime.createApp({}), undefined, () => {
        replacementSetups++
        return { count: runtime.ref(10) }
      })
      expect(target.__wevu).toBe(mounted)
      expect(initialSetups).toBe(1)
      expect(replacementSetups).toBe(0)
      count.value = 2
      await flush(runtime)
      expect(target.data.count).toBe(2)
    }
    finally {
      runtime.teardownRuntimeInstance(target)
    }
  })

  it.each(['development', 'missing-env'] as const)('keeps classic HMR reactive rebinding for %s consumers', async (mode) => {
    const runtime = await loadRuntime(mode)
    const target = createHost()
    const originalCount = runtime.ref(1)
    const replacementCount = runtime.ref(1)
    let replacementSetups = 0
    try {
      runtime.mountRuntimeInstance(target, runtime.createApp({}), undefined, () => ({ count: originalCount }))
      await flush(runtime)
      const mounted = target.__wevu
      originalCount.value = 2
      await flush(runtime)
      expect(target.data.count).toBe(2)

      runtime.mountRuntimeInstance(target, runtime.createApp({}), undefined, () => {
        replacementSetups++
        return { count: replacementCount }
      })
      // 宿主 attached 流程在刷新后恢复延迟的 setData 提交。
      runtime.enableDeferredSetData(target, { rehydrateSetupState: true })
      await flush(runtime)
      expect(target.__wevu).toBe(mounted)
      expect(replacementSetups).toBe(1)
      expect(target.data.count).toBe(2)

      replacementCount.value = 3
      await flush(runtime)
      expect(target.data.count).toBe(3)
      originalCount.value = 4
      await flush(runtime)
      expect(target.data.count).toBe(3)
    }
    finally {
      runtime.teardownRuntimeInstance(target)
    }
  })

  it('excludes HMR snapshot restoration and bridge discovery from the production minimal app', async () => {
    const bundle = await bundleConsumer('production', true)
    const retained = Object.values(bundle.metafile!.outputs).flatMap(output => Object.entries(output.inputs)).filter(([, input]) => input.bytesInOutput > 0).map(([name]) => name.replaceAll('\\', '/'))
    expect(retained.some(name => name.endsWith('/runtime/register/runtimeInstance/setupSnapshot.ts'))).toBe(false)
    expect(bundle.outputFiles[0]!.text).not.toContain(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)
  })
})
