import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'

interface VuePluginWithApi extends Plugin {
  api?: {
    options: {
      devServer?: ViteDevServer
      [key: string]: unknown
    }
  }
}

export function createVueOxcTsconfigGuard(
  vuePlugin: VuePluginWithApi,
  pluginName = 'vue-oxc-tsconfig-guard',
): Plugin {
  let resolvedConfig: ResolvedConfig | undefined
  let previousDevServer: ViteDevServer | undefined

  function restoreDevServer() {
    const api = vuePlugin.api
    if (!api) {
      return
    }

    api.options = {
      ...api.options,
      devServer: previousDevServer,
    }
  }

  return {
    name: pluginName,
    apply: 'build',
    configResolved(config) {
      resolvedConfig = config
    },
    buildStart() {
      const api = vuePlugin.api
      if (!api || !resolvedConfig) {
        return
      }

      const { options } = api
      previousDevServer = options.devServer
      const resolvedOxc = resolvedConfig.oxc && typeof resolvedConfig.oxc === 'object'
        ? resolvedConfig.oxc
        : {}

      // plugin-vue 6 的 build 分支未向 Vite OXC 传入 resolved config，这里只关闭 OXC 自行查找 tsconfig。
      api.options = {
        ...options,
        devServer: {
          config: {
            ...resolvedConfig,
            oxc: {
              ...resolvedOxc,
              tsconfig: false,
            },
          },
          watcher: {
            on() {},
          },
        } as unknown as ViteDevServer,
      }
    },
    buildEnd() {
      restoreDevServer()
    },
    closeBundle() {
      restoreDevServer()
    },
  }
}
