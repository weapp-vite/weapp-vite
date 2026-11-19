import type { CompilerContext } from '../../context'

const skipped = new WeakSet<CompilerContext>()

/** 每次 CLI 构建独立设置 npm 发布开关，不让上次调用的 skipNpm 泄漏。 */
export function configureNpmPublication(ctx: CompilerContext, options: { skipNpm?: boolean }) {
  if (options.skipNpm) {
    skipped.add(ctx)
  }
  else {
    skipped.delete(ctx)
  }
}

/** 生产应用由 bundler 统一发布 npm，开发与独立插件继续使用各自的构建入口。 */
export function usesBundlerNpmPublication(ctx: CompilerContext) {
  const config = ctx.configService
  return !config.isDev && !config.pluginOnly && !config.weappLibConfig?.enabled
}

export function isNpmPublicationEnabled(ctx: CompilerContext) {
  return !skipped.has(ctx) && ctx.configService.weappViteConfig.npm?.enable !== false
}
