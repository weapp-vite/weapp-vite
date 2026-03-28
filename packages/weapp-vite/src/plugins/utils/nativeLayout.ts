import type { CompilerContext } from '../../context'
import type { OutputExtensions } from '../../platforms/types'
import { resolveCompilerOutputExtensions } from '../../utils/outputExtensions'

export function resolveNativeLayoutOutputOptions(options: {
  configService: Pick<NonNullable<CompilerContext['configService']>, 'relativeOutputPath'>
  layoutBasePath: string
  outputExtensions: OutputExtensions | undefined
}) {
  const relativeBase = options.configService.relativeOutputPath(options.layoutBasePath)
  if (!relativeBase) {
    return undefined
  }

  return {
    relativeBase,
    ...resolveCompilerOutputExtensions(options.outputExtensions),
  }
}

export function emitNativeLayoutScriptChunkIfNeeded(options: {
  pluginCtx: any
  scriptId: string | undefined
  fileName: string
}) {
  const { pluginCtx, scriptId, fileName } = options
  if (!scriptId) {
    return false
  }

  const emittedLayoutScripts: Set<string> = (pluginCtx as any).__weappViteNativeLayoutScripts ?? ((pluginCtx as any).__weappViteNativeLayoutScripts = new Set<string>())
  if (emittedLayoutScripts.has(fileName)) {
    return false
  }

  emittedLayoutScripts.add(fileName)
  pluginCtx.emitFile({
    type: 'chunk',
    id: scriptId,
    fileName,
    // @ts-ignore Rolldown 的 PluginContext 类型不完整
    preserveSignature: 'exports-only',
  })
  return true
}
