import type { MiniProgramPerformance } from './types/compatibility'
import { emitRuntimeWarning } from '../warning'

export type { MiniProgramPerformance, MiniProgramPerformanceEntry, MiniProgramPerformanceObserver } from './types/compatibility'

/** 浏览器指标不等同于微信指标；保留完整接口，不返回虚构的测量结果。 */
export function getPerformance(): MiniProgramPerformance {
  emitRuntimeWarning('[@weapp-vite/web] wx.getPerformance 在 Web 端仅兼容调用，微信性能指标和监听结果为空。', { key: 'getPerformance' })
  return {
    getEntries: () => [],
    getEntriesByName: () => [],
    getEntriesByType: () => [],
    setBufferSize() {},
    createObserver() {
      return {
        supportedEntryTypes: [],
        observe() {},
        disconnect() {},
      }
    },
  }
}
