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
  const classStyleRuntimeConfig = configService.weappViteConfig?.vue?.template?.classStyleRuntime ?? 'js'
  const wxsEnabled = configService.weappViteConfig?.wxs !== false
  const wxsExtension = configService.outputExtensions?.wxs
  // class/style 的 WXS 可用条件：
  // 1) 未禁用 weapp.wxs；
  // 2) 当前平台存在合法的 wxs/sjs 扩展名。
  // 只有满足这两个条件，auto 才会优先选择 wxs。
  const supportsWxs = wxsEnabled && typeof wxsExtension === 'string' && wxsExtension.length > 0
  const relativeBase = configService.relativeOutputPath(vuePath.slice(0, -4))
  const resolvedWxsExtension = supportsWxs ? wxsExtension : undefined
  let classStyleWxsSrc: string | undefined
  if (resolvedWxsExtension && relativeBase) {
    classStyleWxsSrc = resolveClassStyleWxsLocationForBase(ctx, relativeBase, resolvedWxsExtension, configService).src
  }
  let classStyleRuntime = classStyleRuntimeConfig
  if (classStyleRuntimeConfig === 'auto') {
    // auto 的切换规则：支持 WXS => wxs；不支持 => js。
    // 注意：这是“编译配置级别”的默认决策。
    // 具体某个 :class/:style 表达式在模板编译阶段仍可能从 wxs 回退到 js。
    classStyleRuntime = supportsWxs ? 'wxs' : 'js'
  }
  else if (classStyleRuntimeConfig === 'wxs' && !supportsWxs) {
    // 用户强制配置 wxs，但平台不具备 WXS 能力时，安全回退到 js。
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
