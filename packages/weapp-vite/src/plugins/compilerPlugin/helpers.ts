import type { OutputAsset } from 'rolldown'
import type { Plugin, PluginOption } from 'vite'
import type { CompilerContext } from '../../context'
import type { WeappCompilerPluginOption, WeappCompilerResourceKind } from '../../types/compilerPlugin'
import { Buffer } from 'node:buffer'
import { resolveCompilerOutputExtensions } from '../../utils/outputExtensions'

export const WEAPP_COMPILER_PLUGIN_META = Symbol.for('weapp-vite:compiler-plugin-meta')

interface CompilerPluginMeta {
  phase: 'source' | 'output'
  name: string
}

type CompilerPluginInternal = Plugin & {
  [WEAPP_COMPILER_PLUGIN_META]?: CompilerPluginMeta
}

export interface PluginContextRef {
  resolve?: (
    source: string,
    importer?: string,
    options?: { skipSelf?: boolean },
  ) => Promise<{ id: string, external?: boolean | 'absolute' } | null>
  addWatchFile?: (id: string) => void
  environment?: {
    moduleGraph?: {
      getModuleById?: (id: string) => unknown
      invalidateModule?: (module: unknown) => void
    }
  }
}

export function normalizeCompilerPluginOptions(options: WeappCompilerPluginOption | WeappCompilerPluginOption[] | undefined) {
  if (!options) {
    return []
  }
  return Array.isArray(options) ? options : [options]
}

export function markWeappCompilerPlugin(plugin: Plugin, phase: 'source' | 'output', name: string) {
  return Object.assign(plugin, {
    [WEAPP_COMPILER_PLUGIN_META]: { phase, name },
  }) as CompilerPluginInternal
}

export function isWeappCompilerPlugin(option: PluginOption, phase?: 'source' | 'output') {
  if (!option || (typeof option !== 'object' && typeof option !== 'function')) {
    return false
  }
  const meta = (option as CompilerPluginInternal)[WEAPP_COMPILER_PLUGIN_META]
  return Boolean(meta && (!phase || meta.phase === phase))
}

export function getWeappCompilerPluginMeta(option: PluginOption) {
  if (!option || (typeof option !== 'object' && typeof option !== 'function')) {
    return undefined
  }
  return (option as CompilerPluginInternal)[WEAPP_COMPILER_PLUGIN_META]
}

export function inferCompilerResourceKind(id: string, outputExtensions?: CompilerContext['configService']['outputExtensions']): WeappCompilerResourceKind | undefined {
  const normalized = id.toLowerCase()
  const normalizedPath = normalized.split('?')[0]!
  const { templateExtension, styleExtension, scriptExtension } = resolveCompilerOutputExtensions(outputExtensions)
  if (normalized.includes('type=template') || normalizedPath.endsWith(`.${templateExtension}`) || normalizedPath.endsWith('.wxml') || normalizedPath.endsWith('.axml')) {
    return 'template'
  }
  if (normalized.includes('type=style') || normalizedPath.endsWith(`.${styleExtension}`) || /\.(?:css|wxss|acss|scss|sass|less|styl|stylus|pcss|postcss)(?:\?|$)/.test(normalized)) {
    return 'style'
  }
  if (normalized.includes('type=script') || normalizedPath.endsWith(`.${scriptExtension}`) || /\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts)(?:\?|$)/.test(normalized)) {
    return 'script'
  }
}

export function readCompilerOutputAsset(asset: OutputAsset) {
  return typeof asset.source === 'string' ? asset.source : Buffer.from(asset.source).toString('utf8')
}

export function inferCompilerOutputKind(fileName: string, outputExtensions: CompilerContext['configService']['outputExtensions']): WeappCompilerResourceKind | undefined {
  const normalized = fileName.toLowerCase()
  const { templateExtension, styleExtension, scriptExtension } = resolveCompilerOutputExtensions(outputExtensions)
  if (normalized.endsWith(`.${templateExtension}`) || normalized.endsWith('.wxml') || normalized.endsWith('.axml')) {
    return 'template'
  }
  if (normalized.endsWith(`.${styleExtension}`) || normalized.endsWith('.wxss') || normalized.endsWith('.acss') || normalized.endsWith('.css')) {
    return 'style'
  }
  if (normalized.endsWith(`.${scriptExtension}`) || normalized.endsWith('.js') || normalized.endsWith('.mjs') || normalized.endsWith('.cjs')) {
    return 'script'
  }
}
