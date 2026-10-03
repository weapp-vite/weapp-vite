import type { HmrProfileJsonSample } from '../../analyze/hmr'
import type { HmrProfileSourceEvent } from '../../utils/hmrProfile/provenance'
import { randomUUID } from 'node:crypto'
import { appendFile, mkdir } from 'node:fs/promises'
import path from 'pathe'
import { createHmrProfileEventId, resolveHmrProfileJsonEnvOption, resolveHmrProfileJsonPath } from '../../utils/hmrProfile'

type Stage = 'deliveryQueueMs' | 'prepareMs' | 'commitQueueMs' | 'commitMs' | 'publishMs' | 'snapshotBuildMs' | 'snapshotPublishMs'
type Status = 'complete' | 'failed' | 'incomplete'

interface ProfileOptions {
  root: string
  option?: boolean | string
  emit?: (sample: HmrProfileJsonSample) => void
  now?: () => number
  onError?: (error: unknown) => void
  buildId?: () => string | undefined
}

/** 记录同一批次的相邻时间边界，不把并行 provider 或嵌套 hook 再次累加。 */
export class StatefulHmrProfileBatch {
  private previous: number
  private stage: Stage
  private completed = false
  private readonly durations: Partial<Record<Stage, number>> = {}

  constructor(
    private readonly sample: HmrProfileJsonSample,
    private readonly startedAt: number,
    stage: Stage,
    private readonly now: () => number,
    private readonly emit: (sample: HmrProfileJsonSample) => void,
  ) {
    this.previous = now()
    this.stage = stage
  }

  mark(stage: Stage) {
    if (this.completed) {
      return
    }
    const now = this.now()
    this.durations[this.stage] = (this.durations[this.stage] ?? 0) + now - this.previous
    this.previous = now
    this.stage = stage
  }

  finish(status: Status) {
    if (this.completed) {
      return
    }
    this.mark(this.stage)
    this.completed = true
    const elapsedMs = this.previous - this.startedAt
    this.emit({ ...this.sample, ...this.durations, timestamp: new Date().toISOString(), status, ...(status === 'complete' ? { totalMs: elapsedMs } : { elapsedMs }) })
  }
}

/** 只观测实际源通知及交付边界；源通知前的原生工作与宿主可见时间仍由外部观测补全。 */
export class StatefulHmrProfile {
  private readonly sessionId = randomUUID()
  private readonly pending = new Map<string, HmrProfileSourceEvent>()
  private readonly active = new Set<StatefulHmrProfileBatch>()
  private readonly now: () => number
  private sequence = 0
  private writeChain = Promise.resolve()

  constructor(private readonly options: ProfileOptions, private readonly outputPath?: string) {
    this.now = options.now ?? (() => performance.now())
  }

  source(file: string) {
    this.pending.set(file, { eventId: createHmrProfileEventId(), file, receivedAtMs: this.now() })
    // 非交付输入也可能触发 watcher；限制仅诊断状态的保留量，不改变构建调度。
    if (this.pending.size > 2048) {
      this.pending.delete(this.pending.keys().next().value!)
    }
  }

  begin(files: readonly string[], mode: 'delivery' | 'full' | 'refresh') {
    const receivedAt = this.now()
    const sourceEvents = [...new Set(files)].flatMap((file) => {
      const source = this.pending.get(file)
      this.pending.delete(file)
      return source ? [source] : []
    })
    const known = files.length > 0 && sourceEvents.length === new Set(files).size
    const startedAt = sourceEvents.length ? Math.min(...sourceEvents.map(event => event.receivedAtMs)) : receivedAt
    const batchId = `${this.sessionId}:${++this.sequence}`
    const sample: HmrProfileJsonSample = {
      schemaVersion: 1,
      pipeline: 'stateful',
      profileMode: mode,
      completionBoundary: mode === 'delivery' ? 'delivery-acknowledged' : 'output-published',
      sessionId: this.sessionId,
      batchId,
      clock: { durations: 'performance.now', timestamp: 'UTC', timeOrigin: performance.timeOrigin },
      correlation: known ? 'known' : 'unknown',
      sourceEvents,
      ...(sourceEvents.length === 1 ? { eventId: sourceEvents[0]!.eventId, file: sourceEvents[0]!.file } : {}),
      ...(known ? { sourceToBatchMs: receivedAt - startedAt } : {}),
    }
    const batch = new StatefulHmrProfileBatch(sample, startedAt, mode === 'delivery' ? 'deliveryQueueMs' : 'snapshotBuildMs', this.now, (result) => {
      this.active.delete(batch)
      this.record(result)
    })
    this.active.add(batch)
    if (this.active.size > 128) {
      this.active.values().next().value!.finish('incomplete')
    }
    return batch
  }

  private record(sample: HmrProfileJsonSample) {
    try {
      sample = { ...sample, buildId: this.options.buildId?.() }
      if (this.options.emit) {
        this.options.emit(sample)
      }
      else if (this.outputPath) {
        const payload = `${JSON.stringify(sample)}\n`
        this.writeChain = this.writeChain.then(async () => {
          await mkdir(path.dirname(this.outputPath!), { recursive: true })
          await appendFile(this.outputPath!, payload, 'utf8')
        }).catch(error => this.reportError(error))
      }
    }
    catch (error) {
      this.reportError(error)
    }
  }

  private reportError(error: unknown) {
    try {
      this.options.onError?.(error)
    }
    catch {
      // 诊断接收方失败不能改变编译、交付及资源释放。
    }
  }

  async close() {
    for (const batch of this.active) {
      batch.finish('incomplete')
    }
    this.pending.clear()
    await this.writeChain
  }
}

/** 关闭时不创建观察器或读取时钟；与标准构建共用 profileJson 配置和环境变量。 */
export function createStatefulHmrProfile(options: ProfileOptions) {
  const outputPath = resolveHmrProfileJsonPath({ cwd: options.root, option: resolveHmrProfileJsonEnvOption() ?? options.option })
  return outputPath || options.emit ? new StatefulHmrProfile(options, outputPath) : undefined
}
