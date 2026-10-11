export type HmrPreparationStage = 'provider-wait' | 'snapshot-build' | 'template-transform' | 'patch-prepare'

export interface HmrPreparationObservation {
  stage: HmrPreparationStage
  status: 'resolved' | 'rejected'
  startedAtMs: number
  elapsedMs: number
  error?: unknown
}

class HmrPreparationProfiler {
  private active?: { stage: HmrPreparationStage, startedAtMs: number }

  constructor(private readonly observe: (observation: HmrPreparationObservation) => void) {}

  begin(stage: HmrPreparationStage) {
    this.active = undefined
    try {
      this.active = { stage, startedAtMs: performance.now() }
    }
    catch {
      // 诊断时钟不可用时跳过本阶段，不改变编译或准备资源的生命周期。
    }
  }

  finish(status: HmrPreparationObservation['status'] = 'resolved', error?: unknown) {
    const active = this.active
    if (!active) {
      return
    }
    this.active = undefined
    try {
      const elapsedMs = performance.now() - active.startedAtMs
      this.observe({ ...active, status, elapsedMs, ...(status === 'rejected' ? { error } : {}) })
    }
    catch {
      // 诊断时钟或接收方失败不得改变编译结果、错误身份或准备资源的释放。
    }
  }
}

/** 私有诊断只记录实际等待区间；停用时不读时钟、不追加异步调度。 */
export function createHmrPreparationProfiler(observe?: (observation: HmrPreparationObservation) => void) {
  return observe ? new HmrPreparationProfiler(observe) : undefined
}
