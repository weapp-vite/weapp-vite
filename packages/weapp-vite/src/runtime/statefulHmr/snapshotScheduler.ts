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
    return Boolean(this.timer || this.runningPromise || this.pendingMode)
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
    this.runningPromise = this.execute({
      files: batchFiles,
      isSuperseded,
      mode: batchMode,
    })
      .catch(error => this.onError?.(error))
      .finally(() => {
        if (!this.closed && isSuperseded()) {
          for (const file of batchFiles) {
            this.pendingFiles.add(file)
          }
          this.pendingMode = this.pendingMode === 'full' || batchMode === 'full'
            ? 'full'
            : 'refresh'
        }
        this.runningPromise = undefined
        if (this.pendingMode) {
          this.schedule()
        }
      })
  }
}
