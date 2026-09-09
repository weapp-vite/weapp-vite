import type { DevEngine } from 'rolldown/experimental'

export type StatefulHmrOutputSource = 'full' | 'partial' | 'additional'

/** 完整输出确认独立于增量资产，只有原生完整回调及持久化都结束才可提交重建。 */
export class StatefulHmrOutputPublication {
  private readonly fullOutputs = new Set<(task: Promise<void>) => void>()
  private readonly pendingOutputs = new Set<Promise<void>>()

  publish(source: StatefulHmrOutputSource, publish: () => void | Promise<void>): Promise<void> {
    let task: Promise<void>
    try {
      task = Promise.resolve(publish())
    }
    catch (error) {
      task = Promise.reject(error)
    }
    // 原生回调不等待 Promise；拒绝由重建调用和日志层分别观察。
    void task.catch(() => {})
    this.pendingOutputs.add(task)
    void task.then(() => this.pendingOutputs.delete(task), () => this.pendingOutputs.delete(task))
    if (source === 'full') {
      for (const receive of this.fullOutputs) {
        receive(task)
      }
    }
    return task
  }

  async rebuild(
    engine: Pick<DevEngine, 'ensureCurrentBuildFinish' | 'triggerFullBuild' | 'ensureLatestBuildOutput'>,
    timeoutMs: number,
    prepare?: () => void | Promise<void>,
  ): Promise<void> {
    let expired = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let receiveFullOutput: ((task: Promise<void>) => void) | undefined
    const execute = async () => {
      // 先清空当前原生事务，避免 partial 输出与新完整请求共用完成屏障。
      await engine.ensureCurrentBuildFinish()
      // 旧输出仍属于旧快照；等待其持久化结束后，才允许调用方绑定新的快照批次。
      await Promise.allSettled([...this.pendingOutputs])
      if (expired) {
        return
      }
      const prepared = prepare?.()
      if (prepared) {
        await prepared
      }
      if (expired) {
        return
      }
      // 等待本次请求之后第一份完整输出及其写入；后来的 partial 不能替换这个确认。
      const fullOutput = new Promise<void>((resolve, reject) => {
        receiveFullOutput = (task) => {
          this.fullOutputs.delete(receiveFullOutput!)
          task.then(resolve, reject)
        }
        this.fullOutputs.add(receiveFullOutput)
      })
      engine.triggerFullBuild()
      await Promise.all([engine.ensureLatestBuildOutput(), fullOutput])
    }
    try {
      await Promise.race([
        execute(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            expired = true
            reject(new Error(`微信状态保持 HMR 完整重建超时（>${timeoutMs}ms），原生构建未结束或未交付原生完整输出。`))
          }, timeoutMs)
        }),
      ])
    }
    finally {
      clearTimeout(timer)
      if (receiveFullOutput) {
        this.fullOutputs.delete(receiveFullOutput)
      }
    }
  }
}
