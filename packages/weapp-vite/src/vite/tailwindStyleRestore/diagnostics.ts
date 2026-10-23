import type { DevOptions } from 'rolldown/experimental'
import type { StatefulHmrOutputFile } from '../../runtime/statefulHmr/outputWriter'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { createRuntimeDiagnostics } from './runtimeDiagnostics'

interface DiagnosticOptions {
  sanitize: (value: string) => string
  phase: () => string
}

interface DiagnosticContext {
  phase: string
  publications: Array<{ mode: string, files: string[], blue: boolean, green: boolean }>
  styles?: { page: string, all: string }
}

function summarize(code: string) {
  const deltas = (expression: RegExp) => [...new Set([...code.matchAll(expression)].map(match => Number(match[1])))]
  let meta: unknown
  const literal = code.match(/\.receiveBatch\((\{[^\n]*?\}),\s*\(\)\s*=>/)
  if (literal) {
    try {
      const value: unknown = JSON.parse(literal[1]!)
      if (value && typeof value === 'object') {
        meta = value
      }
    }
    catch {
      meta = { unavailable: true }
    }
  }
  return {
    sha256: createHash('sha256').update(code).digest('hex'),
    bytes: Buffer.byteLength(code),
    // 原 fixture 的 increment 是稳定名称；分开记录真实函数与 raw sidecar 字符串中的语义。
    compiledIncrement: deltas(/(?:^|\n)\s*function increment\s*\([^)]*\)\s*\{\s*count\.value\s*\+=\s*(\d+)/g),
    allIncrement: deltas(/function increment\s*\([^)]*\)\s*\{\s*count\.value\s*\+=\s*(\d+)/g),
    ...(meta ? { meta } : {}),
  }
}

/** 测试诊断只保留内存记录，失败时再计算源码摘要并合并重复客户端状态。 */
export function createStyleRestoreDiagnostics(options: DiagnosticOptions) {
  const epoch = Date.now()
  const events: Array<Record<string, unknown>> = []
  const snapshots: unknown[] = []
  const requests: unknown[] = []
  const logs: unknown[] = []
  let omitted = 0
  let lastCount: number | undefined
  const record = (event: string, details: Record<string, unknown> = {}, at = Date.now() - epoch) => {
    events.push({ at, event, phase: options.phase(), ...details })
    if (events.length > 80) {
      events.shift()
      omitted += 1
    }
  }
  const runtime = createRuntimeDiagnostics(record, epoch)
  const stringify = (value: unknown) => JSON.stringify(value, (key, entry: unknown) => {
    if (['code', 'message', 'error'].includes(key) && typeof entry === 'string') {
      return summarize(entry)
    }
    if (entry instanceof Error) {
      return { name: entry.name, message: summarize(entry.message) }
    }
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return Object.fromEntries(Object.entries(entry).map(([name, value]) => [options.sanitize(name).slice(0, 240), value]))
    }
    return typeof entry === 'string' ? options.sanitize(entry).slice(0, 240) : entry
  })
  const relevantFiles = (files: string[]) => files.filter(file => file.endsWith('.wxss') || file === WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE)
  return {
    record,
    runtime,
    source(code: string) { record('save-input', { code }) },
    render(wxml: string) {
      const count = wxml.match(/count: (\d+)/)?.[1]
      if (count !== undefined && Number(count) !== lastCount) {
        lastCount = Number(count)
        record('original-render-observed', { count: lastCount })
      }
      return wxml
    },
    batch(result: Exclude<Parameters<NonNullable<DevOptions['onHmrUpdates']>>[0], Error>) {
      record('native-patch', {
        changedFiles: result.changedFiles,
        updates: result.updates.map(({ update }) => ({
          type: update.type,
          ...(update.type === 'Patch' ? { changedIds: update.changedIds, filename: update.filename, code: update.code } : {}),
        })),
      })
    },
    output(output: StatefulHmrOutputFile[]) {
      for (const file of output) {
        if (file.fileName === WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE) {
          const source = file.type === 'chunk' ? file.code : file.source
          record('native-update-written', { code: typeof source === 'string' ? source : Buffer.from(source).toString('utf8') })
        }
      }
    },
    snapshot(line: string) {
      try {
        const value: unknown = JSON.parse(line.slice('[stateful-hmr-snapshot] '.length))
        if (value && typeof value === 'object') {
          const { stage, revision, batchId, status } = value as Record<string, unknown>
          snapshots.push({ stage, revision, batchId, status })
          if (snapshots.length > 4) {
            snapshots.shift()
          }
        }
      }
      catch {
        record('observation-failed', { observation: 'snapshot' })
      }
    },
    request(mode: string, files: Iterable<string> | undefined) {
      requests.push({ mode, files: files === undefined ? [] : Array.isArray(files) || files instanceof Set ? [...files] : '<iterable>' })
      if (requests.length > 4) {
        requests.shift()
      }
    },
    log(source: string, level: string, values: unknown[]) {
      if (level === 'info' && !values.some(value => typeof value === 'string' && /HMR|重同步/.test(value))) {
        return
      }
      logs.push({ source, level, values: values.filter(value => typeof value === 'string' || value instanceof Error).slice(0, 2).map(value => typeof value === 'string' ? { message: value } : value) })
      if (logs.length > 3) {
        logs.shift()
      }
    },
    json(context: DiagnosticContext) {
      try {
        const states: unknown[] = []
        const stateIds = new Map<string, number>()
        const timeline = [...events].sort((a, b) => Number(a.at) - Number(b.at)).map((observation) => {
          const { state, files, ...entry } = observation
          if (Array.isArray(files)) {
            entry.files = relevantFiles(files as string[])
          }
          if (state !== undefined) {
            const serialized = stringify(state)
            let stateId = stateIds.get(serialized)
            if (stateId === undefined) {
              stateId = states.length
              stateIds.set(serialized, stateId)
              states.push(JSON.parse(serialized) as unknown)
            }
            entry.state = stateId
          }
          return entry
        })
        const report = {
          phase: context.phase,
          omitted,
          publications: context.publications.map(({ files, ...publication }) => ({ ...publication, files: relevantFiles(files) })),
          snapshots,
          requests,
          logs,
          styles: context.styles ? { page: summarize(context.styles.page), all: summarize(context.styles.all) } : undefined,
        }
        const serialize = () => {
          const activeStates: unknown[] = []
          const activeIds = new Map<number, number>()
          const activeEvents = timeline.map((entry) => {
            if (typeof entry.state !== 'number') {
              return entry
            }
            let id = activeIds.get(entry.state)
            if (id === undefined) {
              id = activeStates.length
              activeIds.set(entry.state, id)
              activeStates.push(states[entry.state])
            }
            return { ...entry, state: id }
          })
          return stringify({ ...report, events: activeEvents, states: activeStates })
        }
        let result = serialize()
        // 单行日志保持在 CI 截断阈值内；同步移除失去事件引用的状态，并显式记录缺失数量。
        while (Buffer.byteLength(result) > 11_000 && timeline.length) {
          const optional = timeline.findIndex(entry => /^(?:devengine-watchChange|stateful-output-written|classic-|save:renamed)/.test(String(entry.event)))
          timeline.splice(optional < 0 ? 0 : optional, 1)
          report.omitted += 1
          result = serialize()
        }
        return Buffer.byteLength(result) <= 11_000
          ? result
          : stringify({ phase: context.phase, omitted: report.omitted, observation: 'report-budget-exceeded' })
      }
      catch {
        return '{"observation":"diagnostic-serialization-failed"}'
      }
    },
  }
}
