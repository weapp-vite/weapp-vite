import type { StatefulHmrOutputFile } from './outputWriter'
import type { StatefulHmrSnapshotBatch, StatefulHmrSnapshotMode } from './snapshotScheduler'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'

interface DiagnosticOptions {
  root: string
  outDir: string
  enabled?: string
  emit?: (line: string) => void
  read?: (filename: string) => Promise<Uint8Array>
}

interface WriteContext {
  kind: 'control' | 'delta' | 'full' | 'additional' | 'refresh'
  batchId?: number
}

function summarize(content: string | Uint8Array) {
  return { bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') }
}

function errorCode(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  // 原始错误可能包含用户目录或源码，不进入可上传的诊断日志。
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]*$/.test(code) ? code : 'UNKNOWN'
}

class StatefulHmrSnapshotDiagnostics {
  private readonly sessionId = randomUUID()
  private batchSequence = 0
  private writeSequence = 0
  private eventSequence = 0
  private readonly read: NonNullable<DiagnosticOptions['read']>
  private readonly emit: NonNullable<DiagnosticOptions['emit']>

  constructor(private readonly options: DiagnosticOptions) {
    this.read = options.read ?? readFile
    this.emit = options.emit ?? (line => process.stdout.write(`${line}\n`))
  }

  private absolute(filename: string) {
    const normalized = filename.replaceAll('\\', '/')
    const root = this.options.root.replaceAll('\\', '/')
    return path.isAbsolute(normalized) ? normalized : path.resolve(root, normalized)
  }

  private label(filename: string) {
    const relative = path.relative(this.options.root.replaceAll('\\', '/'), this.absolute(filename))
    return relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)
      ? '<external>'
      : relative || '.'
  }

  private record(stage: string, data: Record<string, unknown>) {
    try {
      this.emit(`[stateful-hmr-snapshot] ${JSON.stringify({
        sessionId: this.sessionId,
        sequence: ++this.eventSequence,
        at: new Date().toISOString(),
        stage,
        ...data,
      })}`)
    }
    catch {
      // 日志接收方失败不能影响快照、原生写入或原有错误的传播。
    }
  }

  private async files(filenames: string[]) {
    return Promise.all(filenames.map(async (filename) => {
      try {
        return { file: this.label(filename), ...summarize(await this.read(this.absolute(filename))) }
      }
      catch (error) {
        return { file: this.label(filename), error: errorCode(error) }
      }
    }))
  }

  private assets(output: Iterable<StatefulHmrOutputFile>) {
    return Array.from(output, item => ({
      file: this.label(path.resolve(this.options.outDir, item.fileName)),
      type: item.type,
      ...summarize(item.type === 'asset' ? item.source : item.code),
    }))
  }

  request(mode: StatefulHmrSnapshotMode, files: string[]) {
    this.record('request', { mode, files: files.map(file => this.label(file)) })
  }

  source(file: string, reasons: string[]) {
    // 分类只保留稳定原因名称和数量，避免未来调用方在 reason 中附带绝对路径。
    this.record('source-change', { file: this.label(file), reasons: reasons.map(reason => /^[a-z-]+(?::\d+)?$/.test(reason) ? reason : '<redacted>') })
  }

  async batch(batch: StatefulHmrSnapshotBatch, execute: (batchId: number) => Promise<void>) {
    const batchId = ++this.batchSequence
    this.record('batch-start', { batchId, mode: batch.mode, files: batch.files.map(file => this.label(file)), superseded: batch.isSuperseded() })
    this.record('source-before', { batchId, observations: await this.files(batch.files) })
    try {
      await execute(batchId)
      this.record('batch-end', { batchId, status: 'resolved', superseded: batch.isSuperseded() })
    }
    catch (error) {
      this.record('batch-end', { batchId, status: 'rejected', error: errorCode(error), superseded: batch.isSuperseded() })
      throw error
    }
    finally {
      // 这里是文件边界观察，不声称它等价于编译器实际读取的输入。
      this.record('source-after', { batchId, observations: await this.files(batch.files) })
    }
  }

  snapshot(batchId: number | undefined, output: StatefulHmrOutputFile[], superseded: boolean) {
    this.record('snapshot-ready', { batchId, superseded, assets: this.assets(output) })
  }

  entryComparison(data: {
    batchId?: number
    mode: StatefulHmrSnapshotMode
    oldEntryIds: Iterable<string>
    nextEntryIds: Iterable<string>
    oldDelegatedComponentEntryIds: Iterable<string>
    nextDelegatedComponentEntryIds: Iterable<string>
    entryGraphChanged: boolean
    entryGraphRevision: number
    rebuiltEntryGraphRevision: number
    superseded: boolean
  }) {
    const oldEntryIds = new Set(data.oldEntryIds)
    const nextEntryIds = new Set(data.nextEntryIds)
    const oldDelegated = new Set(data.oldDelegatedComponentEntryIds)
    const nextDelegated = new Set(data.nextDelegatedComponentEntryIds)
    this.record('entry-comparison', {
      batchId: data.batchId,
      mode: data.mode,
      oldEntryIds: [...oldEntryIds].map(id => this.label(id)),
      nextEntryIds: [...nextEntryIds].map(id => this.label(id)),
      addedEntryIds: [...nextEntryIds].filter(id => !oldEntryIds.has(id)).map(id => this.label(id)),
      removedEntryIds: [...oldEntryIds].filter(id => !nextEntryIds.has(id)).map(id => this.label(id)),
      oldDelegatedComponentEntryIds: [...oldDelegated].map(id => this.label(id)),
      nextDelegatedComponentEntryIds: [...nextDelegated].map(id => this.label(id)),
      addedDelegatedComponentEntryIds: [...nextDelegated].filter(id => !oldDelegated.has(id)).map(id => this.label(id)),
      removedDelegatedComponentEntryIds: [...oldDelegated].filter(id => !nextDelegated.has(id)).map(id => this.label(id)),
      entryGraphChanged: data.entryGraphChanged,
      entryGraphRevision: data.entryGraphRevision,
      rebuiltEntryGraphRevision: data.rebuiltEntryGraphRevision,
      superseded: data.superseded,
    })
  }

  diff(batchId: number | undefined, previous: Iterable<StatefulHmrOutputFile>, next: StatefulHmrOutputFile[], selected: StatefulHmrOutputFile[], superseded: boolean) {
    this.record('snapshot-diff', { batchId, superseded, previous: this.assets(previous), next: this.assets(next), selected: this.assets(selected) })
  }

  discarded(batchId: number | undefined, stage: 'after-build' | 'before-output' | 'after-transform') {
    this.record('snapshot-discarded', { batchId, boundary: stage, superseded: true })
  }

  async write(context: WriteContext, output: StatefulHmrOutputFile[], execute: () => Promise<void>) {
    const writerId = ++this.writeSequence
    const filenames = output.map(item => path.resolve(this.options.outDir, item.fileName))
    this.record('write-start', { ...context, writerId, assets: this.assets(output), disk: await this.files(filenames) })
    try {
      await execute()
      this.record('write-end', { ...context, writerId, status: 'resolved', disk: await this.files(filenames) })
    }
    catch (error) {
      this.record('write-end', { ...context, writerId, status: 'rejected', error: errorCode(error), disk: await this.files(filenames) })
      throw error
    }
  }
}

/** 仅在 Node 构建进程显式开启；默认不创建观察器、不读取文件或计算摘要。 */
export function createStatefulHmrSnapshotDiagnostics(options: DiagnosticOptions) {
  return (options.enabled ?? process.env.WEAPP_VITE_STATEFUL_HMR_SNAPSHOT_TRACE) === '1'
    ? new StatefulHmrSnapshotDiagnostics(options)
    : undefined
}
