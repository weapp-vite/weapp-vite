import { getCurrentInstance, onUnmounted } from 'wevu'

const metrics = { setDataCalls: 0, setDataBytes: 0, lateSetData: 0, cancelledTasks: 0 }

export function resetMetrics() {
  Object.assign(metrics, { setDataCalls: 0, setDataBytes: 0, lateSetData: 0, cancelledTasks: 0 })
}

export function readMetrics() {
  return { ...metrics }
}

/** 卸载时被取消的待定任务数，用于证明清理确实发生；配合 `lateSetData` 判断是否有任务逃逸。 */
export function recordCancelledTasks(count: number) {
  metrics.cancelledTasks = count
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
