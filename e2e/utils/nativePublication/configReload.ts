import type { startDevProcess } from '../dev-process'
import { captureNativePublication } from '.'

type DevProcess = Pick<ReturnType<typeof startDevProcess>, 'getOutput' | 'waitFor'>

/** 配置重启没有 source profile；必须在最终字节收据之后观察同轮正式启动完成。 */
export function captureNativeConfigReload(dev: DevProcess, project: string, host: 'wv' | 'vite' | 'vite-plus') {
  const offset = dev.getOutput().length
  const native = captureNativePublication(dev, project)
  const completed = host === 'wv'
    ? 'Vite 配置已重新加载，小程序开发构建已重启。'
    : '[weapp-vite] 小程序开发产物已就绪 (classic)'
  return {
    async wait(timeoutMs = 90_000) {
      const receipt = await native.wait(timeoutMs)
      const observed = Promise.withResolvers<void>()
      let active = true
      const check = () => {
        if (!active) {
          return
        }
        try {
          const output = dev.getOutput()
          if (/Build failed|classic HMR 切换失败|classic 回退失败/.test(output.slice(offset))) {
            observed.reject(new Error('Classic configuration rebuild failed; preserve the original dev build error'))
            return
          }
          const readyAt = output.indexOf(completed, offset)
          if (readyAt < 0) {
            return
          }
          if (readyAt < receipt.outputOffset) {
            observed.reject(new Error('Classic configuration restart completed before the final native write; final source completion is required'))
            return
          }
          observed.resolve()
        }
        catch (error) {
          observed.reject(error)
        }
      }
      const interval = setInterval(check, 25)
      const deadline = setTimeout(() => observed.reject(new Error('Timed out waiting for current classic configuration restart completion')), timeoutMs)
      try {
        check()
        await dev.waitFor(observed.promise, 'classic configuration restart completion')
      }
      finally {
        active = false
        clearInterval(interval)
        clearTimeout(deadline)
      }
    },
  }
}
