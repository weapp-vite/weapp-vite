import type { BuildTarget, CompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import path from 'pathe'
import { changeFileExtension } from '../../utils/file'
import { handleWxml } from '../../wxml/handle'

export interface WxmlAssetPayload {
  type: 'asset'
  fileName: string
  source: string
}

export interface WxmlEmitRuntime {
  addWatchFile?: (id: string) => void
  emitFile: (asset: WxmlAssetPayload) => void
}

export interface EmitWxmlOptions {
  runtime: WxmlEmitRuntime
  compiler: CompilerContext
  subPackageMeta?: SubPackageMetaValue
  emittedCodeCache: Map<string, string>
  buildTarget?: BuildTarget
}

export function emitWxmlAssetsWithCache(options: EmitWxmlOptions): string[] {
  const { runtime, compiler, subPackageMeta, emittedCodeCache, buildTarget = 'app' } = options
  const { wxmlService, configService, scanService } = compiler

  if (!wxmlService || !configService || !scanService) {
    throw new Error('emitWxmlAssets requires wxmlService, configService and scanService to be initialized')
  }

  const currentPackageWxmls = Array.from(wxmlService.tokenMap.entries())
    .map(([id, token]) => {
      return {
        id,
        token,
        fileName: configService.relativeOutputPath(id),
      }
    })
    .filter(({ fileName }) => {
      if (subPackageMeta) {
        return fileName.startsWith(subPackageMeta.subPackage.root)
      }
      if (buildTarget === 'plugin') {
        const pluginRoot = configService.absolutePluginRoot
        if (!pluginRoot) {
          return false
        }
        const pluginBase = path.basename(pluginRoot)
        return fileName.startsWith(pluginBase)
      }
      return scanService.isMainPackageFileName(fileName)
    })

  const emittedFiles: string[] = []

  for (const { id, fileName, token } of currentPackageWxmls) {
    runtime.addWatchFile?.(id)
    const deps = wxmlService.depsMap.get(id)
    if (deps) {
      for (const dep of deps) {
        runtime.addWatchFile?.(dep)
      }
    }

    emittedFiles.push(fileName)
    const result = handleWxml(token)
    const previous = emittedCodeCache.get(fileName)
    if (previous === result.code) {
      continue
    }

    emittedCodeCache.set(fileName, result.code)
    runtime.emitFile({
      type: 'asset',
      fileName,
      source: result.code,
    })
  }

  return emittedFiles
}

export function emitJsonAsset(runtime: WxmlEmitRuntime, fileName: string, source: string) {
  runtime.emitFile({
    type: 'asset',
    fileName: changeFileExtension(fileName, 'json'),
    source,
  })
}
