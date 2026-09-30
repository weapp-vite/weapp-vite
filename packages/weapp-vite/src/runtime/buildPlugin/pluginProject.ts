import type { ViteBuilder } from 'vite'
import type { CompilerContext } from '../../context'
import path from 'pathe'
import { BuildEnvironment, createBuilder } from 'vite'
import { getWxmlWatchFiles } from '../../wxml/processing/dependencies'
import { CompilerSession } from '../compilerSession'
import { waitForBuildTasks } from '../compilerSession/tasks'
import { createSharedBuildConfig } from '../sharedBuildConfig'
import { collectIndependentWatchFiles } from './independentWatch'
import { cleanOutputs, shouldCleanOutputs } from './outputs'

const sessions = new WeakMap<CompilerContext, CompilerSession>()

/** 插件入口重启也属于会话任务，宿主关闭必须等待它结束。 */
export function runPluginProjectRestart(ctx: CompilerContext, restart: () => Promise<void>) {
  const session = sessions.get(ctx)
  return session?.isClosing ? Promise.resolve() : session ? session.run(restart) : restart()
}

export function isPluginProjectClosing(ctx: CompilerContext) {
  return sessions.get(ctx)?.isClosing === true
}

const options = new WeakMap<CompilerContext, { skipNpm?: boolean }>()

export function setPluginProjectBuildOptions(ctx: CompilerContext, value: { skipNpm?: boolean }) {
  options.set(ctx, value)
}

/** 两个目标可以嵌套，但插件输出不能覆盖宿主根目录。 */
export function assertPluginProjectOutput(ctx: CompilerContext) {
  const service = ctx.configService
  const pluginOutput = service.absolutePluginOutputRoot
  if (service.pluginOnly || !pluginOutput) {
    return
  }
  const relative = path.relative(pluginOutput, service.outDir)
  if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error('[weapp-vite] 插件输出目录不能等于或包含宿主应用输出目录。')
  }
}

/** 插件项目借用父会话已加载的配置，拥有自己的编译上下文和资源。 */
export async function createPluginProjectSession(ctx: CompilerContext) {
  const owner = ctx.configService
  const session = new CompilerSession()
  sessions.set(session.context, session)
  try {
    await session.initialize({
      ...owner.loadOptions,
      cwd: owner.cwd,
      mode: owner.mode,
      isDev: owner.isDev,
      pluginOnly: true,
      cliPlatform: owner.platform,
      projectConfigPath: owner.projectConfigPath,
      hostConfig: { config: owner.options.sourceConfig ?? {}, path: owner.configFilePath, dependencies: owner.configFileDependencies },
      inlineConfig: {
        ...owner.loadOptions?.inlineConfig,
        build: {
          ...owner.loadOptions?.inlineConfig?.build,
          outDir: owner.absolutePluginOutputRoot,
        },
      },
      emitDefaultAutoImportOutputs: false,
      syncSupportFiles: false,
      preloadAppEntry: false,
    })
    session.context.currentBuildTarget = 'plugin'
    return session
  }
  catch (error) {
    await session.close().catch(() => {})
    throw error
  }
}

/** 父应用完成落盘后执行插件环境，避免嵌套输出被父环境清空。 */
export async function buildPluginProject(ctx: CompilerContext, files: Map<string, Set<string>>, hostBuilder?: ViteBuilder) {
  const session = await createPluginProjectSession(ctx)
  const child = session.context
  try {
    return await session.run(() => child.autoImportService.runWithoutOutputWrites(async () => {
      await child.scanService.loadAppEntry()
      const config = child.configService.merge(undefined, createSharedBuildConfig(child.configService, child.scanService))
      config.configFile = false
      config.builder = { sharedConfigBuild: true }
      config.build = { ...config.build, watch: null, emptyOutDir: false }
      const watch = collectIndependentWatchFiles(files, 'plugin', source => [
        ...child.moduleGraphService.getEntryDependencies(source).map(entry => entry.sourceId),
        ...getWxmlWatchFiles(child),
        ...child.scanService.pluginJsonPath ? [child.scanService.pluginJsonPath] : [],
      ])
      config.plugins = [...config.plugins ?? [], watch.plugin]
      if (shouldCleanOutputs(child.configService, 'startup')) {
        await cleanOutputs(child.configService)
      }
      const local = await createBuilder(config, true)
      local.config.environments.weapp_plugin = local.config.environments.client!
      const environment = new BuildEnvironment('weapp_plugin', local.config)
      await environment.init()
      const builder = hostBuilder ?? local
      builder.environments.weapp_plugin = environment
      const [output] = await waitForBuildTasks([
        builder.build(environment),
        options.get(ctx)?.skipNpm ? Promise.resolve() : child.npmService.build(),
      ])
      watch.commit()
      return output
    }))
  }
  finally {
    await session.close()
  }
}
