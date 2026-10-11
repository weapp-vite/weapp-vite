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
        if (serve) {
          return
        }
        if (this.meta.watchMode) {
          await session.validateEntries()
        }
        // 在扫描前登记 npm 输入，避免首次成功写出后新增监听目标重启事件流。
        const dependencies = await session.buildDependencies()
        for (const file of dependencies.watchFiles) {
          this.addWatchFile(file)
        }
      },
    },
    generateBundle: {
      order: 'post',
      async handler() {
        if (!serve) {
          const dependencies = await session.buildDependencies()
          for (const asset of dependencies.assets) {
            this.emitFile(asset)
          }
        }
      },
    },
    writeBundle: {
      order: 'post',
      sequential: true,
      async handler() {
        if (!serve) {
          await session.publishDependencies()
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
