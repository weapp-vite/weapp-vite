import type { CompilerContext } from '../../../context'
import { removeExtensionDeep } from '@weapp-core/shared'
import { getMiniProgramTemplatePlatform } from 'wevu/compiler'
import logger from '../../../logger'
import { getSfcCheckMtime } from '../../utils/vueSfc'
import { resolveClassStyleWxsLocationForBase } from './classStyle'
import { createUsingComponentPathResolver } from './usingComponentResolver'

interface CompileOptionsContext {
  reExportResolutionCache: Map<string, Map<string, string | undefined>>
  classStyleRuntimeWarned: { value: boolean }
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
  const scopedSlotsCompiler = configService.weappViteConfig?.vue?.template?.scopedSlotsCompiler ?? 'auto'
  const scopedSlotsRequirePropsConfig = configService.weappViteConfig?.vue?.template?.scopedSlotsRequireProps
  const scopedSlotsRequireProps = scopedSlotsRequirePropsConfig ?? (scopedSlotsCompiler !== 'augmented')
  const slotMultipleInstance = configService.weappViteConfig?.vue?.template?.slotMultipleInstance ?? true
  const classStyleRuntimeConfig = configService.weappViteConfig?.vue?.template?.classStyleRuntime ?? 'auto'
  const wxsEnabled = configService.weappViteConfig?.wxs !== false
  const wxsExtension = configService.outputExtensions?.wxs
  const supportsWxs = wxsEnabled && typeof wxsExtension === 'string' && wxsExtension.length > 0
  const relativeBase = configService.relativeOutputPath(vuePath.slice(0, -4))
  const resolvedWxsExtension = supportsWxs ? wxsExtension : undefined
  let classStyleWxsSrc: string | undefined
  if (resolvedWxsExtension && relativeBase) {
    classStyleWxsSrc = resolveClassStyleWxsLocationForBase(ctx, relativeBase, resolvedWxsExtension, configService).src
  }
  let classStyleRuntime = classStyleRuntimeConfig
  if (classStyleRuntimeConfig === 'auto') {
    classStyleRuntime = supportsWxs ? 'wxs' : 'js'
  }
  else if (classStyleRuntimeConfig === 'wxs' && !supportsWxs) {
    classStyleRuntime = 'js'
    if (!state.classStyleRuntimeWarned.value) {
      logger.warn('已配置 vue.template.classStyleRuntime = "wxs"，但当前平台不支持 WXS 或已禁用 weapp.wxs，将回退到 JS 运行时。')
      state.classStyleRuntimeWarned.value = true
    }
  }
  const jsonConfig = configService.weappViteConfig?.json
  const wevuDefaults = configService.weappViteConfig?.wevu?.defaults
  const jsonKind = isApp ? 'app' : isPage ? 'page' : 'component'
  const templatePlatform = getMiniProgramTemplatePlatform(configService.platform)
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
        const match = ctx.autoImportService?.resolve(tag, removeExtensionDeep(vuePath))
        return match?.value
      },
    },
    template: {
      platform: templatePlatform,
      scopedSlotsCompiler,
      scopedSlotsRequireProps,
      slotMultipleInstance,
      classStyleRuntime,
      wxsExtension: supportsWxs ? wxsExtension : undefined,
      classStyleWxsSrc,
    },
    json: {
      kind: jsonKind,
      defaults: jsonConfig?.defaults,
      mergeStrategy: jsonConfig?.mergeStrategy,
    },
    sfcSrc: {
      resolveId: async (source: string, importer?: string) => {
        if (typeof pluginCtx.resolve !== 'function') {
          return undefined
        }
        const resolved = await pluginCtx.resolve(source, importer)
        return resolved?.id
      },
      checkMtime: getSfcCheckMtime(configService),
    },
    wevuDefaults,
  } as const
}
