import { getCurrentInstance, onUnmounted } from 'wevu'

const metrics = { setDataCalls: 0, setDataBytes: 0, lateSetData: 0, disposedPendingTasks: 0 }

export function resetMetrics() {
  Object.assign(metrics, { setDataCalls: 0, setDataBytes: 0, lateSetData: 0, disposedPendingTasks: 0 })
}

export function readMetrics() {
  return { ...metrics }
}

export function recordDisposedTasks(count: number) {
  metrics.disposedPendingTasks = count
}

/** 仅供原型验收，统计页面及递归组件经过宿主 setData 的 UTF-8 数据量。 */
export function trackSetData() {
  const instance = getCurrentInstance()!
  const original = instance.setData
  let disposed = false
  instance.setData = function (patch: Record<string, unknown>, callback?: () => void) {
    metrics.setDataCalls++
    metrics.setDataBytes += encodeURIComponent(JSON.stringify(patch)).replace(/%[\dA-F]{2}/g, 'x').length
    if (disposed) {
      metrics.lateSetData++
    }
    return original.call(this, patch, callback)
  }
  onUnmounted(() => {
    disposed = true
  })
}
