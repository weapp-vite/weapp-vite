import type { BuildTarget, CompilerContext } from '../../context'
import type { SubPackageMetaValue } from '../../types'
import type { ImportMetaDefineRegistry } from '../../utils/importMeta'
import { isTemplate } from '../../utils'
import { changeFileExtension } from '../../utils/file'
import { createImportMetaDefineRegistry } from '../../utils/importMeta'
import { resolveCompilerOutputExtensions } from '../../utils/outputExtensions'
import { isPathInside, normalizeWatchPath } from '../../utils/path'
import { resolveScriptModuleTagName } from '../../utils/wxmlScriptModule'
import { handleWxml } from '../../wxml/handle'
import { resolveRelativeOutputFileNameWithExtension } from './outputFileName'

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

export function resolveWxmlEmitContext(compiler: CompilerContext) {
  const { wxmlService, configService, scanService } = compiler
  if (!wxmlService || !configService || !scanService) {
    throw new Error('emitWxmlAssets 需要先初始化 wxmlService、configService 和 scanService。')
  }

  const { templateExtension, scriptModuleExtension } = resolveCompilerOutputExtensions(configService.outputExtensions)
  const scriptModuleTag = resolveScriptModuleTagName({
    platform: configService.platform,
    scriptModuleExtension,
  })

  return {
    wxmlService,
    configService,
    scanService,
    templateExtension,
    scriptModuleExtension,
    scriptModuleTag,
  }
}

export function resolveWxmlEmitTargets(options: {
  compiler: CompilerContext
  subPackageMeta?: SubPackageMetaValue
  buildTarget?: BuildTarget
}) {
  const { compiler, subPackageMeta, buildTarget = 'app' } = options
  const { wxmlService, configService, scanService, templateExtension } = resolveWxmlEmitContext(compiler)

  return Array.from(wxmlService.tokenMap.entries())
    .filter(([id]) => isTemplate(id))
    .map(([id, token]) => {
      const outputFileName = resolveRelativeOutputFileNameWithExtension(configService, id, templateExtension)
      return {
        id,
        token,
        fileName: outputFileName,
      }
    })
    .filter(({ id, fileName }) => {
      if (subPackageMeta) {
        return fileName.startsWith(subPackageMeta.subPackage.root)
      }
      if (buildTarget === 'plugin') {
        const pluginRoot = configService.absolutePluginRoot
        if (!pluginRoot) {
          return false
        }
        return isPathInside(pluginRoot, id)
      }
      return scanService.isMainPackageFileName(fileName)
    })
}

export function emitWxmlAssetFile(options: {
  runtime: WxmlEmitRuntime
  id: string
  fileName: string
  token: any
  deps?: Set<string>
  emittedCodeCache: Map<string, string>
  importMetaDefineRegistry?: ImportMetaDefineRegistry
  scriptModuleExtension?: string
  scriptModuleTag?: string
  templateExtension: string
}) {
  const { runtime, id, fileName, token, deps, emittedCodeCache, importMetaDefineRegistry, scriptModuleExtension, scriptModuleTag, templateExtension } = options

  runtime.addWatchFile?.(normalizeWatchPath(id))
  if (deps) {
    for (const dep of deps) {
      runtime.addWatchFile?.(normalizeWatchPath(dep))
    }
  }

  const result = handleWxml(token, {
    importMetaDefineRegistry,
    importMetaExtension: templateExtension,
    importMetaRelativePath: fileName,
    scriptModuleExtension,
    scriptModuleTag,
    templateExtension,
  })
  const previous = emittedCodeCache.get(fileName)
  if (previous === result.code) {
    return false
  }

  emittedCodeCache.set(fileName, result.code)
  runtime.emitFile({
    type: 'asset',
    fileName,
    source: result.code,
  })
  return true
}

export function emitWxmlAssetsWithCache(options: EmitWxmlOptions): string[] {
  const { runtime, compiler, subPackageMeta, emittedCodeCache, buildTarget = 'app' } = options
  const { wxmlService, configService, templateExtension, scriptModuleExtension, scriptModuleTag } = resolveWxmlEmitContext(compiler)
  const currentPackageWxmls = resolveWxmlEmitTargets({
    compiler,
    subPackageMeta,
    buildTarget,
  })

  const emittedFiles: string[] = []

  for (const { id, fileName, token } of currentPackageWxmls) {
    emittedFiles.push(fileName)
    emitWxmlAssetFile({
      runtime,
      id,
      fileName,
      token,
      deps: wxmlService.depsMap.get(id),
      emittedCodeCache,
      importMetaDefineRegistry: configService.importMetaDefineRegistry
        ?? createImportMetaDefineRegistry({
          defineEntries: configService.defineImportMetaEnv,
        }),
      scriptModuleExtension,
      scriptModuleTag,
      templateExtension,
    })
  }

  return emittedFiles
}

export function emitJsonAsset(
  runtime: WxmlEmitRuntime,
  fileName: string,
  source: string,
  extension = 'json',
) {
  runtime.emitFile({
    type: 'asset',
    fileName: changeFileExtension(fileName, extension),
    source,
  })
}
