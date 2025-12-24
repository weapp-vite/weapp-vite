import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { VUE_PLUGIN_NAME } from './index'

export function createVueWatchPlugin(_ctx: CompilerContext): Plugin {
  return {
    name: `${VUE_PLUGIN_NAME}:watch`,

    configureServer(server) {
      // 监听 .vue 文件变化
      const watcher = server.watcher

      watcher.on('change', (id) => {
        if (id.endsWith('.vue')) {
          // 触发 HMR
          const module = server.moduleGraph.getModuleById(id)
          if (module) {
            server.ws.send({
              type: 'full-reload',
              path: id,
            })
          }
        }
      })
    },

    async handleHotUpdate({ file }) {
      if (!file.endsWith('.vue')) {
        return
      }

      return []
    },
  }
}
