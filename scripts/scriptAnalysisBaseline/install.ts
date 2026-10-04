import type { ScriptBaselineFeatures } from './installHelpers/state'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { optimizeScriptBaselineSource, scriptBaselineGlobalKey, scriptBaselineSources } from './installHelpers/source'
import { ScriptBaselineState } from './installHelpers/state'

export type { ScriptBaselineFeatures, ScriptBaselineMetrics } from './installHelpers/state'

export interface ScriptBaselineInstallOptions {
  mode: 'control' | 'optimized'
  features?: Partial<ScriptBaselineFeatures>
}

/** 显式安装诊断加载器；对照与优化模式加载同六份源码，不改公开 API 或磁盘文件。 */
export async function installScriptBaseline(options: ScriptBaselineInstallOptions) {
  if (!['control', 'optimized'].includes(options.mode)) {
    throw new Error('Unknown script baseline mode')
  }
  if (Object.hasOwn(globalThis, scriptBaselineGlobalKey)) {
    throw new Error('Script baseline loader already installed')
  }
  const features: ScriptBaselineFeatures = { astReuse: true, propsNoScope: true, pageMetaGate: true, reservedPropsGate: true }
  for (const [key, value] of Object.entries(options.features ?? {})) {
    if (!Object.hasOwn(features, key) || typeof value !== 'boolean') {
      throw new Error('Unknown or non-boolean script baseline feature')
    }
    features[key as keyof ScriptBaselineFeatures] = value
  }
  Object.freeze(features)
  const state = new ScriptBaselineState()
  const sources = new Map<string, string>()
  const sourceHashes: Record<string, string> = {}
  const loadCounts = new Map<string, number>()
  for (const filename of scriptBaselineSources) {
    const url = new URL(`../../${filename}`, import.meta.url)
    const raw = readFileSync(url, 'utf8')
    sourceHashes[filename] = createHash('sha256').update(raw).digest('hex')
    const source = raw.replaceAll('\r\n', '\n')
    sources.set(url.href, options.mode === 'optimized' ? optimizeScriptBaselineSource(filename, source, features) : source)
  }
  if (options.mode === 'optimized') {
    Object.defineProperty(globalThis, scriptBaselineGlobalKey, { configurable: true, value: state })
  }
  const hook = registerHooks({
    load(url, context, nextLoad) {
      const source = sources.get(url)
      if (source === undefined) {
        return nextLoad(url, context)
      }
      loadCounts.set(url, (loadCounts.get(url) ?? 0) + 1)
      return { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(source, { mode: 'strip' }) }
    },
  })
  let disposed = false
  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true
    try {
      state.assertIdle()
    }
    finally {
      state.release()
      hook.deregister()
      if (options.mode === 'optimized') {
        delete (globalThis as unknown as Record<string, unknown>)[scriptBaselineGlobalKey]
      }
    }
  }
  try {
    await import(new URL(`../../${scriptBaselineSources[0]}`, import.meta.url).href)
    if ([...sources.keys()].some(url => loadCounts.get(url) !== 1)) {
      throw new Error('Script baseline requires a fresh process with all six compiler modules uncached')
    }
  }
  catch (error) {
    dispose()
    throw error
  }
  return {
    features,
    sourceHashes,
    snapshot: () => state.snapshot(),
    reset: () => state.reset(),
    assertIdle: () => state.assertIdle(),
    dispose,
  }
}
