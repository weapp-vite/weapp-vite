import type { Plugin } from 'vite'
import type { WeappBuildSession } from './session'

/** 环境钩子捕获本轮会话，旧环境关闭不能清理重启后的新会话。 */
export function createSessionEnvironmentPlugin(session: WeappBuildSession, serve: boolean): Plugin {
  return {
    name: 'weapp-vite:session-environment',
    enforce: 'pre',
    options: {
      order: 'pre',
      async handler() {
        if (serve) {
          return
        }
        try {
          await session.validateEntries()
        }
        catch (error) {
          if (!this.meta.watchMode) {
            await session.close().catch(() => {})
          }
          throw error
        }
      },
    },
    buildStart: {
      order: 'pre',
      async handler() {
        if (!serve && this.meta.watchMode) {
          await session.validateEntries()
        }
      },
    },
    generateBundle: {
      order: 'post',
      async handler() {
        if (!serve) {
          for (const asset of await session.buildDependencies()) {
            this.emitFile(asset)
          }
        }
      },
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      async handler() {
        // 开发宿主的 close/restart 统一释放会话，原生引擎关闭不能反向等待自身。
        if (!serve && !this.meta.watchMode) {
          await session.close()
        }
      },
    },
    async closeWatcher() {
      await session.close()
    },
  }
}
