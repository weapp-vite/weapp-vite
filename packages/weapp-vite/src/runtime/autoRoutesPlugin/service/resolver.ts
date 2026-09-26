import type { InlineConfig } from 'vite'
import type { MutableCompilerContext } from '../../../context'
import type { ScanRoutesOptions } from '../routes'
import { BuildEnvironment, createIdResolver, resolveConfig } from 'vite'

type PageDeclarationSourceResolver = NonNullable<ScanRoutesOptions['resolvePageDeclarationSource']>

export function createDefaultPageDeclarationSourceResolver(ctx: MutableCompilerContext): PageDeclarationSourceResolver {
  let currentConfig: InlineConfig | undefined
  let pendingResolver: Promise<PageDeclarationSourceResolver> | undefined

  return async (source, importer) => {
    const configService = ctx.configService
    if (!configService) {
      return undefined
    }
    if (!pendingResolver || currentConfig !== configService.inlineConfig) {
      currentConfig = configService.inlineConfig
      // prepare 尚无 PluginContext；只创建 Vite 内置解析器，不启动服务或监听器。
      pendingResolver = resolveConfig({
        root: configService.cwd,
        configFile: false,
        mode: configService.mode,
        resolve: currentConfig?.resolve,
        environments: currentConfig?.environments,
      }, configService.isDev ? 'serve' : 'build', configService.mode, configService.isDev ? 'development' : 'production').then((config) => {
        const environment = new BuildEnvironment('client', config)
        const resolveId = createIdResolver(config)
        return (id, importer) => resolveId(environment, id, importer)
      })
    }
    return await (await pendingResolver)(source, importer)
  }
}
