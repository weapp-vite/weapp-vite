export type StatefulHmrSnapshotMode = 'full' | 'refresh'

const DEFAULT_SNAPSHOT_DEBOUNCE_MS = 40

export interface StatefulHmrSnapshotBatch {
  files: string[]
  isSuperseded: () => boolean
  mode: StatefulHmrSnapshotMode
}

interface StatefulHmrSnapshotSchedulerOptions {
  debounceMs?: number
  execute: (batch: StatefulHmrSnapshotBatch) => Promise<void>
  onError?: (error: unknown) => void
}

export class StatefulHmrSnapshotScheduler {
  private closed = false
  private readonly debounceMs: number
  private readonly execute: StatefulHmrSnapshotSchedulerOptions['execute']
  private readonly onError?: StatefulHmrSnapshotSchedulerOptions['onError']
  private readonly pendingFiles = new Set<string>()
  private pendingMode?: StatefulHmrSnapshotMode
  private revision = 0
  private runningPromise?: Promise<void>
  private timer?: ReturnType<typeof setTimeout>

  constructor(options: StatefulHmrSnapshotSchedulerOptions) {
    this.debounceMs = options.debounceMs ?? DEFAULT_SNAPSHOT_DEBOUNCE_MS
    this.execute = options.execute
    this.onError = options.onError
  }

  request(mode: StatefulHmrSnapshotMode, files: Iterable<string> = []): void {
    if (this.closed) {
      return
    }
    for (const file of files) {
      this.pendingFiles.add(file)
    }
    this.pendingMode = this.pendingMode === 'full' || mode === 'full' ? 'full' : 'refresh'
    this.revision += 1
    if (!this.runningPromise) {
      this.schedule()
    }
  }

  isPending(): boolean {
    // 失败后保留的批次处于暂停状态，后续变更仍可主动请求重试。
    return Boolean(this.timer || this.runningPromise)
  }

  async close(): Promise<void> {
    this.closed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    this.pendingFiles.clear()
    this.pendingMode = undefined
    await this.runningPromise
  }

  private schedule(): void {
    if (this.closed) {
      return
    }
    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.startPendingBatch()
    }, this.debounceMs)
  }

  private startPendingBatch(): void {
    if (this.closed || this.runningPromise || !this.pendingMode) {
      return
    }
    const batchRevision = this.revision
    const batchFiles = [...this.pendingFiles]
    const batchMode = this.pendingMode
    this.pendingFiles.clear()
    this.pendingMode = undefined

    const isSuperseded = () => this.closed || this.revision !== batchRevision
    let failed = false
    this.runningPromise = this.execute({
      files: batchFiles,
      isSuperseded,
      mode: batchMode,
    })
      .catch((error) => {
        failed = true
        try {
          this.onError?.(error)
        }
        catch {
          // 诊断回调失败不能破坏批次保留与队列回收，也不能形成未处理的拒绝。
        }
      })
      .finally(() => {
        const superseded = isSuperseded()
        if (!this.closed && (failed || superseded)) {
          for (const file of batchFiles) {
            this.pendingFiles.add(file)
          }
          this.pendingMode = this.pendingMode === 'full' || batchMode === 'full'
            ? 'full'
            : 'refresh'
        }
        this.runningPromise = undefined
        // 普通失败等待下一次请求，已有新请求则合并重试，避免永久错误形成忙循环。
        if (this.pendingMode && (!failed || superseded)) {
          this.schedule()
        }
      })
  }
}
