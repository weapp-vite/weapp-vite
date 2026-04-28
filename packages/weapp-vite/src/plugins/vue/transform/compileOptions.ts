import type { CompileVueFileOptions } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import type { MpPlatform } from '../../../types'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { getMiniProgramTemplatePlatform } from 'wevu/compiler'
import logger from '../../../logger'
import { createCachedEntryResolveOptions, resolveEntryPath } from '../../../utils/entryResolve'
import { createSfcResolveSrcOptions } from '../../utils/vueSfc'
import { resolveClassStyleWxsLocationForBase } from './classStyle'
import { createUsingComponentPathResolver } from './usingComponentResolver'
import { resolveWevuDefaultsWithPreset } from './wevuPreset'

export type CompileVueFileResolvedOptions = CompileVueFileOptions

interface CompileOptionsContext {
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
  compileOptionsCache?: Map<string, CompileVueFileResolvedOptions>
}

type AutoImportComponentSourceType = 'wevu-sfc' | 'native'

export function getCompileVueFileOptionsCacheKey(vuePath: string, isPage: boolean, isApp: boolean) {
  return `${vuePath}::${isPage ? 'page' : 'component'}::${isApp ? 'app' : 'entry'}`
}

export function resolveVueTemplatePlatformOptions(options: {
  platform: string
  wxsEnabled: boolean
  wxsExtension?: string
  classStyleRuntime: 'auto' | 'wxs' | 'js'
  classStyleRuntimeWarned: { value: boolean }
}) {
  const supportsWxs = options.wxsEnabled && typeof options.wxsExtension === 'string' && options.wxsExtension.length > 0
  const resolvedWxsExtension = supportsWxs ? options.wxsExtension : undefined
  let classStyleRuntime = options.classStyleRuntime

  if (options.classStyleRuntime === 'auto') {
    classStyleRuntime = supportsWxs ? 'wxs' : 'js'
  }
  else if (options.classStyleRuntime === 'wxs' && !supportsWxs) {
    classStyleRuntime = 'js'
    if (!options.classStyleRuntimeWarned.value) {
      logger.warn('已配置 vue.template.classStyleRuntime = "wxs"，但当前平台不支持 WXS 或已禁用 weapp.wxs，将回退到 JS 运行时。')
      options.classStyleRuntimeWarned.value = true
    }
  }

  return {
    templatePlatform: getMiniProgramTemplatePlatform(options.platform as MpPlatform),
    supportsWxs,
    wxsExtension: resolvedWxsExtension,
    classStyleRuntime,
  } as const
}

function buildCompileVueFileOptions(
  ctx: CompilerContext,
  pluginCtx: any,
  vuePath: string,
  isPage: boolean,
  isApp: boolean,
  configService: NonNullable<CompilerContext['configService']>,
  state: CompileOptionsContext,
): CompileVueFileResolvedOptions {
  const importerBaseName = removeExtensionDeep(vuePath)
  const autoImportResolveCache = new Map<string, {
    match: ReturnType<NonNullable<CompilerContext['autoImportService']>['resolve']>
    version: number
  }>()
  const scopedSlotsCompiler = configService.weappViteConfig?.vue?.template?.scopedSlotsCompiler ?? 'auto'
  const scopedSlotsRequirePropsConfig = configService.weappViteConfig?.vue?.template?.scopedSlotsRequireProps
  const scopedSlotsRequireProps = scopedSlotsRequirePropsConfig ?? false
  const slotSingleRootNoWrapper = configService.weappViteConfig?.vue?.template?.slotSingleRootNoWrapper ?? false
  const slotMultipleInstance = configService.weappViteConfig?.vue?.template?.slotMultipleInstance ?? true
  const htmlTagToWxml = configService.weappViteConfig?.vue?.template?.htmlTagToWxml
  const htmlTagToWxmlTagClass = configService.weappViteConfig?.vue?.template?.htmlTagToWxmlTagClass ?? true
  const classStyleRuntimeConfig = configService.weappViteConfig?.vue?.template?.classStyleRuntime ?? 'js'
  const objectLiteralBindMode = configService.weappViteConfig?.vue?.template?.objectLiteralBindMode ?? 'runtime'
  const mustacheInterpolation = configService.weappViteConfig?.vue?.template?.mustacheInterpolation ?? 'compact'
  const wxsEnabled = configService.weappViteConfig?.wxs !== false
  const wxsExtension = configService.outputExtensions?.wxs
  const templatePlatformOptions = resolveVueTemplatePlatformOptions({
    platform: configService.platform,
    wxsEnabled,
    wxsExtension,
    classStyleRuntime: classStyleRuntimeConfig,
    classStyleRuntimeWarned: state.classStyleRuntimeWarned,
  })
  const relativeBase = configService.relativeOutputPath(vuePath.slice(0, -4))
  const resolvedWxsExtension = templatePlatformOptions.wxsExtension
  let classStyleWxsSrc: string | undefined
  if (resolvedWxsExtension && relativeBase) {
    classStyleWxsSrc = resolveClassStyleWxsLocationForBase(ctx, relativeBase, resolvedWxsExtension, configService).src
  }
  const jsonConfig = configService.weappViteConfig?.json
  const wevuDefaults = resolveWevuDefaultsWithPreset(configService.weappViteConfig)
  const jsonKind = isApp ? 'app' : isPage ? 'page' : 'component'

  async function resolveAutoImportComponentSourceType(match: NonNullable<ReturnType<NonNullable<CompilerContext['autoImportService']>['resolve']>>) {
    if (match.kind === 'local') {
      const resolvedId = match.entry.templatePath
      const sourceType: AutoImportComponentSourceType = resolvedId?.endsWith('.vue') ? 'wevu-sfc' : 'native'
      return {
        resolvedId,
        sourceType,
      }
    }

    const explicitSourceType = (match.value as { sourceType?: AutoImportComponentSourceType }).sourceType
    const explicitResolvedId = (match.value as { resolvedId?: string }).resolvedId
    if (explicitSourceType || explicitResolvedId?.endsWith('.vue') || match.value.from.endsWith('.vue')) {
      return {
        resolvedId: explicitResolvedId,
        sourceType: explicitSourceType ?? (explicitResolvedId?.endsWith('.vue') || match.value.from.endsWith('.vue') ? 'wevu-sfc' : 'native'),
      }
    }

    let localSourceBase: string | undefined
    if (match.value.from.startsWith('/')) {
      localSourceBase = path.join(configService.absoluteSrcRoot, match.value.from.slice(1))
    }
    else if (match.value.from.startsWith('.')) {
      localSourceBase = path.resolve(path.dirname(importerBaseName), match.value.from)
    }

    if (!localSourceBase) {
      return {
        resolvedId: explicitResolvedId,
        sourceType: 'native' as const,
      }
    }

    const resolvedId = await resolveEntryPath(
      localSourceBase,
      createCachedEntryResolveOptions(configService, { kind: 'default' }),
    )
    return {
      resolvedId,
      sourceType: resolvedId?.endsWith('.vue') ? 'wevu-sfc' as const : 'native' as const,
    }
  }

  return {
    isPage,
    isApp,
    warn: (message: string) => logger.warn(message),
    autoUsingComponents: {
      enabled: true,
      warn: (message: string) => logger.warn(message),
      resolveUsingComponentPath: createUsingComponentPathResolver(pluginCtx, configService, state.reExportResolutionCache),
    },
    autoImportTags: {
      enabled: true,
      warn: (message: string) => logger.warn(message),
      resolveUsingComponent: async (tag: string) => {
        const autoImportService = ctx.autoImportService
        if (!autoImportService) {
          return undefined
        }

        const version = typeof autoImportService.getVersion === 'function'
          ? autoImportService.getVersion()
          : 0
        const cached = autoImportResolveCache.get(tag)
        const match = cached && cached.version === version
          ? cached.match
          : autoImportService.resolve(tag, importerBaseName)
        if (!cached || cached.version !== version) {
          autoImportResolveCache.set(tag, {
            match,
            version,
          })
        }
        if (!match?.value) {
          return undefined
        }
        const sourceInfo = await resolveAutoImportComponentSourceType(match)
        return {
          ...match.value,
          ...sourceInfo,
        }
      },
    },
    template: {
      platform: templatePlatformOptions.templatePlatform,
      htmlTagToWxml,
      htmlTagToWxmlTagClass,
      scopedSlotsCompiler,
      scopedSlotsRequireProps,
      slotSingleRootNoWrapper,
      slotMultipleInstance,
      classStyleRuntime: templatePlatformOptions.classStyleRuntime,
      objectLiteralBindMode,
      mustacheInterpolation,
      wxsExtension: templatePlatformOptions.wxsExtension,
      classStyleWxsSrc,
    },
    json: {
      kind: jsonKind,
      defaults: jsonConfig?.defaults,
      mergeStrategy: jsonConfig?.mergeStrategy,
    },
    sfcSrc: createSfcResolveSrcOptions(pluginCtx, configService),
    wevuDefaults,
  } as const
}

export function createCompileVueFileOptions(
  ctx: CompilerContext,
  pluginCtx: any,
  vuePath: string,
  isPage: boolean,
  isApp: boolean,
  configService: NonNullable<CompilerContext['configService']>,
  state: CompileOptionsContext,
) {
  const cacheKey = getCompileVueFileOptionsCacheKey(vuePath, isPage, isApp)
  const cached = state.compileOptionsCache?.get(cacheKey)
  if (cached) {
    return cached
  }

  const created = buildCompileVueFileOptions(ctx, pluginCtx, vuePath, isPage, isApp, configService, state)
  state.compileOptionsCache?.set(cacheKey, created)
  return created
}
