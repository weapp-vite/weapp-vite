import type { WeappWebVitePlugin, WebHmrContext, WebPluginContext } from '../../../../packages-runtime/web/src/plugin/hostTypes'

export function createBarrier() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

/** 用可观察的扫描与发布阶段固定恢复竞争，不修改生产钩子结果或 Vite 模块图。 */
export function createWebRestoreScanGate(restored: string) {
  const started = createBarrier()
  const releaseApp = createBarrier()
  const sourceQueued = createBarrier()
  const sourceStarted = createBarrier()
  const releaseSource = createBarrier()
  let active = false
  let scans = 0
  return {
    started: started.promise,
    start() { active = true },
    stop() {
      active = false
      return scans
    },
    async blockScan() {
      if (active) {
        const first = ++scans === 1
        const signal = first ? started : sourceStarted
        signal.release()
        await (first ? releaseApp : releaseSource).promise
      }
    },
    observeHotUpdate(plugin: WeappWebVitePlugin) {
      const handleWebUpdate = plugin.handleHotUpdate!
      plugin.handleHotUpdate = function <Module extends object>(this: WebPluginContext, context: WebHmrContext<Module>) {
        const pending = (handleWebUpdate<Module>).call(this, context)
        // 原钩子已执行到扫描等待点；不替换其参数、this 或返回值。
        if (active && context.file === restored) {
          sourceQueued.release()
        }
        return pending
      }
    },
    async publishSource(publication: Promise<void>) {
      await sourceQueued.promise
      releaseApp.release()
      await sourceStarted.promise
      // native pre hook 可取得 reload 发布权；先等结构扫描真实提交，再让 source 完成本轮扫描。
      await publication
      releaseSource.release()
    },
    close() {
      releaseApp.release()
      releaseSource.release()
    },
  }
}
