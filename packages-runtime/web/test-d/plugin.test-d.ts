import type { Root } from 'postcss'
import type { ModuleNode, Plugin, UserConfig, ViteDevServer } from 'vite'
import { weappWebPlugin } from '@weapp-vite/web/plugin'
import postcss from 'postcss'
import { expectAssignable, expectError, expectType } from 'tsd'

const plugin = weappWebPlugin()
const processor = postcss([])
function transform(root: Root) {
  root.walkDecls(() => {})
}
const config: UserConfig = {
  css: {
    postcss: {
      plugins: [processor, transform, { postcss: processor }, { postcssPlugin: 'existing' }],
    },
  },
}

expectAssignable<Plugin>(plugin)
expectAssignable<UserConfig | void>(plugin.config!.call({}, config))
expectError(plugin.config!.call({}, { css: { postcss: { plugins: [{ unsupported: true }] } } }))

declare const server: ViteDevServer
expectType<void>(plugin.configureServer!(server))

type PluginServer = Parameters<NonNullable<typeof plugin.configureServer>>[0]
declare const pluginServer: PluginServer
declare const module: ModuleNode
const graph = pluginServer.moduleGraph!
expectType<ModuleNode | undefined>(graph.getModuleById('entry'))
expectType<Set<ModuleNode> | undefined>(graph.getModulesByFile('entry.js'))
expectType<void>(graph.invalidateModule(module))
expectError(graph.invalidateModule({}))
