import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { addNormalizedWatchFile } from '../utils/watchFiles'
import { VUE_PLUGIN_NAME } from './index'
import { isVueLikeFile } from './transform/shared'

export function createVueWatchPlugin(_ctx: CompilerContext): Plugin {
  return {
    name: `${VUE_PLUGIN_NAME}:watch`,

    configureServer(server) {
      // 监听 vue-like 文件变化
      const watcher = server.watcher

      watcher.on('change', (id) => {
        if (isVueLikeFile(id)) {
          addNormalizedWatchFile(server.watcher as any, id)
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
      if (!isVueLikeFile(file)) {
        return
      }

      return []
    },
  }
}
