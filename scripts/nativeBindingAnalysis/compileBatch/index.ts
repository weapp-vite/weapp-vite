import type { CompileBatchOptions, ProductionCollector } from './types'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { collectIgnoredGlobals } from '../globals'
import { CompileBatchController } from './controller'
import { batchGlobalKey, hookBindingSource, hookSlotSource, hookTemplateSource } from './hooks'

export type { CompileBatchMetrics, CompileBatchMode, CompileBatchOptions, CompileBatchSnapshot } from './types'

const sourceDefinitions = [
  ['packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/bindingManifest.ts', hookBindingSource],
  ['packages-runtime/wevu-compiler/src/plugins/vue/compiler/template.ts', hookTemplateSource],
  ['packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/elements/tag-slot.ts', hookSlotSource],
] as const

/** 在新鲜诊断进程导入 compileVueFile 前显式安装；eager-js 完全保留原始加载路径。 */
export async function installCompileBatch(options: CompileBatchOptions) {
  if (!['eager-js', 'control-js', 'planned-js', 'planned-summary', 'planned-native'].includes(options.mode)) {
    throw new Error('Unknown compile batch mode')
  }
  if (options.mode === 'planned-native' && !options.binding) {
    throw new Error('planned-native requires an explicit experimental binding')
  }
  if (Object.hasOwn(globalThis, batchGlobalKey)) {
    throw new Error('Compile batch loader already installed')
  }
  const ignoredGlobals = options.mode === 'planned-native' ? [...options.ignoredGlobals ?? collectIgnoredGlobals()] : []
  const planned = options.mode !== 'eager-js' && options.mode !== 'control-js'
  const controller = new CompileBatchController({ ...options, ignoredGlobals })
  const sourceHashes: Record<string, string> = {}
  const hookedSources = new Map<string, string>()
  const bindingUrl = new URL(`../../../${sourceDefinitions[0][0]}`, import.meta.url)
  for (const [relative, transform] of sourceDefinitions) {
    const url = new URL(`../../../${relative}`, import.meta.url)
    const raw = readFileSync(url, 'utf8')
    sourceHashes[relative] = createHash('sha256').update(raw).digest('hex')
    if (options.mode !== 'eager-js') {
      const source = raw.replaceAll('\r\n', '\n')
      hookedSources.set(url.href, planned ? transform(source) : source)
    }
  }
  let hook: ReturnType<typeof registerHooks> | undefined
  let disposed = false
  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true
    try {
      controller.assertDrained()
    }
    finally {
      hook?.deregister()
      if (planned) {
        delete (globalThis as unknown as Record<string, unknown>)[batchGlobalKey]
      }
    }
  }
  if (options.mode !== 'eager-js') {
    let bindingLoads = 0
    if (planned) {
      Object.defineProperty(globalThis, batchGlobalKey, { configurable: true, value: controller })
    }
    hook = registerHooks({
      load(url, context, nextLoad) {
        const source = hookedSources.get(url)
        if (source === undefined) {
          return nextLoad(url, context)
        }
        if (url === bindingUrl.href) {
          bindingLoads++
        }
        return { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(source, { mode: 'strip' }) }
      },
    })
    try {
      const module = await import(bindingUrl.href) as { experimentalCompileBatchCollectDependencies?: ProductionCollector }
      if (bindingLoads !== 1 || (planned && typeof module.experimentalCompileBatchCollectDependencies !== 'function')) {
        throw new Error('Compile batch loader requires a fresh process and uncached compiler imports')
      }
      if (planned) {
        controller.setCollector(module.experimentalCompileBatchCollectDependencies!)
      }
    }
    catch (error) {
      dispose()
      throw error
    }
  }
  return {
    sourceHashes,
    reset: () => controller.reset(),
    snapshot: () => controller.snapshot(),
    assertDrained: () => controller.assertDrained(),
    dispose,
  }
}
