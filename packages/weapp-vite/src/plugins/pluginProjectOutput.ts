import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { realpath } from 'node:fs/promises'
import path from 'pathe'
import { getAppBuilder } from '../runtime/buildPlugin/appBuilder'
import { assertPluginProjectOutput, buildPluginProject } from '../runtime/buildPlugin/pluginProject'

/** 微信插件项目有独立输出环境，宿主应用负责调度和等待。 */
export function createPluginProjectOutputPlugin(ctx: CompilerContext): Plugin {
  const files = new Map<string, Set<string>>()
  const watchPath = async (file: string) => path.normalize(await realpath(file).catch(() => file))
  const enabled = () => !ctx.configService.pluginOnly && !ctx.configService.isDev && Boolean(ctx.configService.absolutePluginRoot)
  return {
    name: 'weapp-vite:plugin-project-output',
    config(config) {
      assertPluginProjectOutput(ctx)
      if (enabled()) {
        if (config.build?.write === false) {
          throw new Error('[weapp-vite] 微信插件双产物暂不支持 build.write=false，请使用原生 build 落盘。')
        }
        return { builder: { sharedConfigBuild: true } }
      }
    },
    async buildStart() {
      if (enabled()) {
        this.addWatchFile(await watchPath(ctx.configService.absolutePluginRoot!))
        this.addWatchFile(await watchPath(path.join(ctx.configService.absolutePluginRoot!, 'plugin.json')))
        for (const inputs of files.values()) {
          for (const file of inputs) {
            this.addWatchFile(await watchPath(file))
          }
        }
      }
    },
    writeBundle: {
      sequential: true,
      async handler() {
        if (!enabled()) {
          return
        }
        try {
          await buildPluginProject(ctx, files, getAppBuilder(ctx))
        }
        finally {
          for (const inputs of files.values()) {
            for (const file of inputs) {
              this.addWatchFile(await watchPath(file))
            }
          }
        }
      },
    },
  }
}
