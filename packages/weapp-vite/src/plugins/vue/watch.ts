import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { VUE_PLUGIN_NAME } from './index'

const VUE_LIKE_EXTENSIONS = ['.vue', '.tsx', '.jsx']

function isVueLikeFile(id: string) {
  return VUE_LIKE_EXTENSIONS.some(ext => id.endsWith(ext))
}

export function createVueWatchPlugin(_ctx: CompilerContext): Plugin {
  return {
    name: `${VUE_PLUGIN_NAME}:watch`,

    configureServer(server) {
      // 监听 vue-like 文件变化
      const watcher = server.watcher

      watcher.on('change', (id) => {
        if (isVueLikeFile(id)) {
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
