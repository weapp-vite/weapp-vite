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

interface BatchState {
  sample: HmrProfileJsonSample
  startedAt: number
  batchStartedAt: number
  previous: number
  stage: Stage
  now: () => number
  durations: Partial<Record<Stage, number>>
  validate?: () => Promise<boolean>
}

/** 记录同一批次的相邻时间边界，不把并行 provider 或嵌套 hook 再次累加。 */
export class StatefulHmrProfileBatch {
  private owned = true

  constructor(
    private readonly state: BatchState,
    private readonly emit: (sample: HmrProfileJsonSample) => void,
  ) {}

  mark(stage: Stage) {
    if (!this.owned) {
      return
    }
    const state = this.state
    const now = state.now()
    state.durations[state.stage] = (state.durations[state.stage] ?? 0) + now - state.previous
    state.previous = now
    state.stage = stage
  }

  finish(status: Status) {
    if (this.owned) {
      this.finishAt(status, this.state.now())
    }
  }

  /** 异步诊断校验不计入真实发布边界；校验期间关闭仍可先行结束所有权。 */
  async finishPublished() {
    if (!this.owned) {
      return
    }
    const publishedAt = this.state.now()
    try {
      this.finishAt(await this.state.validate?.() === false ? 'incomplete' : 'complete', publishedAt)
    }
    catch {
      this.finishAt('failed', publishedAt)
    }
  }

  private finishAt(status: Status, endedAt: number) {
    if (!this.owned) {
      return
    }
    const state = this.state
    state.durations[state.stage] = (state.durations[state.stage] ?? 0) + endedAt - state.previous
    state.previous = endedAt
    this.owned = false
    const elapsedMs = endedAt - state.startedAt
    this.emit({ ...state.sample, ...state.durations, timestamp: new Date().toISOString(), status, ...(status === 'complete' ? { totalMs: elapsedMs } : { elapsedMs }) })
  }

  /** 移交后旧调用方不能再结束记录；完整重载继续计入快照发布阶段。 */
  detach() {
    if (!this.owned) {
      return undefined
    }
    const state = this.state
    this.mark(state.stage)
    this.owned = false
    state.sample = { ...state.sample, profileMode: 'full', completionBoundary: 'output-published' }
    state.durations = { snapshotBuildMs: state.previous - state.batchStartedAt }
    state.stage = 'snapshotPublishMs'
    return state
  }
}

/** 交接期间独占记录；取消必须等待原接收方写完，接管后只由新接收方发布。 */
export class StatefulHmrProfileHandoff {
  constructor(private state: BatchState | undefined, private readonly source: StatefulHmrProfile) {}

  sourceFiles() {
    return [...new Set(this.state?.sample.sourceEvents?.flatMap(event => event.file ? [event.file] : []))]
  }

  validateWith(validate: () => Promise<boolean>) {
    if (this.state) {
      this.state.validate = validate
    }
  }

  take(emit: (sample: HmrProfileJsonSample) => void) {
    const state = this.state
    this.state = undefined
    return state ? new StatefulHmrProfileBatch(state, emit) : undefined
  }

  async cancel(status: 'incomplete' | 'failed' = 'incomplete') {
    this.take(sample => this.source.record(sample))?.finish(status)
    await this.source.flush()
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
    const batchStartedAt = this.now()
    const batch = new StatefulHmrProfileBatch({ sample, startedAt, batchStartedAt, previous: batchStartedAt, stage: mode === 'delivery' ? 'deliveryQueueMs' : 'snapshotBuildMs', now: this.now, durations: {} }, (result) => {
      this.active.delete(batch)
      this.record(result)
    })
    this.active.add(batch)
    if (this.active.size > 128) {
      this.active.values().next().value!.finish('incomplete')
    }
    return batch
  }

  transfer(batch: StatefulHmrProfileBatch) {
    if (!this.active.delete(batch)) {
      return undefined
    }
    const state = batch.detach()
    return state ? new StatefulHmrProfileHandoff(state, this) : undefined
  }

  adopt(handoff: StatefulHmrProfileHandoff) {
    const batch = handoff.take((sample) => {
      this.active.delete(batch!)
      this.record(sample)
    })
    if (batch) {
      this.active.add(batch)
    }
    return batch
  }

  record(sample: HmrProfileJsonSample) {
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

  async close(status: 'incomplete' | 'failed' = 'incomplete') {
    for (const batch of this.active) {
      batch.finish(status)
    }
    this.pending.clear()
    await this.flush()
  }

  async flush() {
    // close 只结束本会话持有的批次，不关闭文件资源；交接取消可继续入队，并由交接方等待本次写完。
    await this.writeChain
  }
}

/** 关闭时不创建观察器或读取时钟；与标准构建共用 profileJson 配置和环境变量。 */
export function createStatefulHmrProfile(options: ProfileOptions) {
  const outputPath = resolveHmrProfileJsonPath({ cwd: options.root, option: resolveHmrProfileJsonEnvOption() ?? options.option })
  return outputPath || options.emit ? new StatefulHmrProfile(options, outputPath) : undefined
}
