import type { SequenceMeasurement, SequenceStepResult } from './measurement'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { serializeSequenceError } from './errorEvidence'

export type EditAction
  = | { kind: 'write', file: string, content: string }
    | { kind: 'edit', file: string, start: number, end: number, text: string }
    | { kind: 'delete', file: string }
    | { kind: 'rename', file: string, to: string }
    | { kind: 'config', file: string, content: string }
    | { kind: 'rapid', saves: Exclude<EditAction, { kind: 'rapid' }>[] }

export interface EditSequence {
  name: string
  files: Record<string, string>
  steps: Array<{ name: string, action: EditAction }>
}

export interface SequenceInput {
  files: Readonly<Record<string, string>>
  step: number
  action?: EditAction
  signal: AbortSignal
}

export interface SequenceObserver<T> {
  name: string
  measure?: () => SequenceMeasurement | undefined
  resources?: () => { children: number }
  diagnostics?: () => unknown
  incremental: (input: SequenceInput) => Promise<T>
  fresh: (input: SequenceInput) => Promise<T>
  /** 完整观察结果比较成功后，再执行真实运行时等独立验收；失败仍终止本步。 */
  afterCompare?: (input: SequenceInput) => Promise<void>
  close: () => Promise<void>
}

export interface Divergence {
  file: string
  field: string
  incremental: unknown
  fresh: unknown
}

export type SequenceComparator<T> = (incremental: T, fresh: T) => Divergence | undefined

/** 只规范对象键顺序，供 profile 开关两次运行比较完整的成功观察结果。 */
export function hashSequenceObservation(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value, (_key, current) => current && typeof current === 'object' && !Array.isArray(current)
    ? Object.fromEntries(Object.entries(current).sort(([left], [right]) => left.localeCompare(right)))
    : current)).digest('hex')
}

export class EditSequenceDivergence extends Error {
  constructor(
    readonly sequence: string,
    readonly observer: string,
    readonly step: number,
    readonly label: string,
    readonly difference: Divergence,
    readonly replay: EditSequence,
  ) {
    super(`${sequence}: ${observer}: step ${step} (${label}), file ${difference.file}, field ${difference.field}\n${JSON.stringify({ difference, replay }, null, 2)}`)
    this.name = 'EditSequenceDivergence'
  }
}

/** 只排序对象键；数组顺序、缺失字段、位置、文件和语义都严格比较。 */
export function firstDifference(incremental: unknown, fresh: unknown, field = '', file = '<sequence>'): Divergence | undefined {
  if (Object.is(incremental, fresh)) {
    return
  }
  if (incremental !== null && fresh !== null && typeof incremental === 'object' && typeof fresh === 'object') {
    if (Array.isArray(incremental) !== Array.isArray(fresh)) {
      return { file, field, incremental, fresh }
    }
    for (const value of [incremental, fresh]) {
      const tag = Object.prototype.toString.call(value)
      if (tag !== '[object Object]' && tag !== '[object Array]') {
        throw new TypeError(`Observer must expose plain structural data, not ${tag}, at ${field}`)
      }
    }
    const left = incremental as Record<string, unknown>
    const right = fresh as Record<string, unknown>
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()
    for (const key of keys) {
      const nextFile = ['files', 'dependencies', 'entries', 'published.references.static', 'published.references.dynamic'].includes(field)
        ? key
        : typeof left.filename === 'string' ? left.filename : file
      const nextField = field ? `${field}.${key}` : key
      if (Object.hasOwn(left, key) !== Object.hasOwn(right, key)) {
        return { file: nextFile, field: nextField, incremental: left[key], fresh: right[key] }
      }
      const difference = firstDifference(left[key], right[key], nextField, nextFile)
      if (difference) {
        return difference
      }
    }
    if (Array.isArray(incremental) && Array.isArray(fresh) && incremental.length !== fresh.length) {
      return { file, field: `${field}.length`, incremental: incremental.length, fresh: fresh.length }
    }
    return
  }
  return { file, field, incremental, fresh }
}

function checkPath(file: string) {
  if (!file || file.startsWith('/') || file.includes('\\') || file.split('/').some(part => ['..', 'node_modules', '.sequence-output', '__proto__'].includes(part)) || /^[A-Z]:/i.test(file)) {
    throw new Error(`Sequence paths must stay within fixture-owned relative POSIX files: ${file}`)
  }
}

export function applyAction(files: Record<string, string>, action: EditAction): void {
  if (action.kind === 'rapid') {
    for (const save of action.saves) {
      applyAction(files, save)
    }
    return
  }
  checkPath(action.file)
  if (action.kind === 'write' || action.kind === 'config') {
    files[action.file] = action.content
    return
  }
  const content = files[action.file]
  if (!Object.hasOwn(files, action.file) || content === undefined) {
    throw new Error(`Cannot ${action.kind} missing file ${action.file}`)
  }
  if (action.kind === 'edit') {
    if (!Number.isInteger(action.start) || !Number.isInteger(action.end) || action.start < 0 || action.end < action.start || action.end > content.length) {
      throw new Error(`Invalid edit range in ${action.file}`)
    }
    files[action.file] = content.slice(0, action.start) + action.text + content.slice(action.end)
  }
  else {
    if (action.kind === 'rename') {
      checkPath(action.to)
      if (Object.hasOwn(files, action.to)) {
        throw new Error(`Rename destination exists: ${action.to}`)
      }
      files[action.to] = content
    }
    delete files[action.file]
  }
}

export async function bounded<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  const aborted = Promise.withResolvers<never>()
  const onAbort = () => aborted.reject(signal.reason)
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    return await Promise.race([operation(), aborted.promise])
  }
  finally {
    signal.removeEventListener('abort', onAbort)
  }
}

/** 同一输入分别送给长期实例和全新实例；失败即停止，不做重试或差异过滤。 */
export async function verifyEditSequence<T>(
  sequence: EditSequence,
  observer: SequenceObserver<T>,
  options: { maxSteps?: number, maxFiles?: number, maxBytes?: number, maxSaves?: number, timeoutMs?: number, compare?: SequenceComparator<T>, onStep?: (result: SequenceStepResult) => void } = {},
): Promise<void> {
  const { maxSteps = 24, maxFiles = 64, maxBytes = 256 * 1024, maxSaves = 16, timeoutMs = 60_000, compare = firstDifference } = options
  if (sequence.steps.length > maxSteps) {
    throw new Error(`Sequence exceeds ${maxSteps} steps`)
  }
  for (const { action } of sequence.steps) {
    const saves = action.kind === 'rapid' ? action.saves : [action]
    if (saves.length > maxSaves) {
      throw new Error(`Sequence exceeds ${maxSaves} rapid saves`)
    }
    for (const save of saves) {
      checkPath(save.file)
      const content = save.kind === 'write' || save.kind === 'config' ? save.content : save.kind === 'edit' ? save.text : ''
      if (Buffer.byteLength(content) > maxBytes) {
        throw new Error('Sequence edit exceeds byte bound')
      }
    }
  }
  const files = { ...sequence.files }
  const signal = AbortSignal.timeout(timeoutMs)
  let failure: { error: unknown } | undefined
  try {
    for (let step = 0; step <= sequence.steps.length; step++) {
      const current = sequence.steps[step - 1]
      if (current) {
        applyAction(files, current.action)
      }
      for (const file of Object.keys(files)) {
        checkPath(file)
      }
      if (Object.keys(files).length > maxFiles || Object.values(files).reduce((size, text) => size + Buffer.byteLength(text), 0) > maxBytes) {
        throw new Error('Sequence input exceeds file/byte bounds')
      }
      const input = { files: { ...files }, step, action: current?.action, signal }
      const replay = { ...sequence, steps: sequence.steps.slice(0, step) }
      const stepResult: SequenceStepResult = { step, label: current?.name ?? 'initial', status: 'failed' }
      const startedAt = performance.now()
      let stepFailure: { error: unknown } | undefined
      let compared = false
      try {
        const incremental = await bounded(() => observer.incremental(input), signal)
        stepResult.incrementalMs = performance.now() - startedAt
        stepResult.measurement = observer.measure?.()
        const freshStartedAt = performance.now()
        const fresh = await bounded(() => observer.fresh(input), signal)
        stepResult.freshMs = performance.now() - freshStartedAt
        const difference = compare(incremental, fresh)
        if (difference) {
          throw new EditSequenceDivergence(sequence.name, observer.name, step, current?.name ?? 'initial', difference, replay)
        }
        stepResult.observationSha256 = hashSequenceObservation(incremental)
        compared = true
        if (observer.afterCompare) {
          await bounded(() => observer.afterCompare!(input), signal)
        }
        stepResult.status = 'passed'
      }
      catch (error) {
        if (error instanceof EditSequenceDivergence) {
          stepFailure = { error }
        }
        else {
          let diagnostics: unknown
          try {
            const value = observer.diagnostics?.()
            // 在清理前固定证据；不可序列化的诊断不能覆盖最初故障。
            diagnostics = value === undefined ? undefined : JSON.parse(JSON.stringify(value))
          }
          catch (diagnosticError) {
            diagnostics = { status: 'unavailable', error: serializeSequenceError(diagnosticError) }
          }
          stepFailure = { error: new Error(`${sequence.name}: ${observer.name}: step ${step} (${current?.name ?? 'initial'}) failed ${compared ? 'after' : 'before'} comparison\\n${JSON.stringify({ replay, diagnostics }, null, 2)}`, { cause: error }) }
        }
      }
      finally {
        stepResult.elapsedMs = performance.now() - startedAt
        try {
          options.onStep?.(stepResult)
        }
        catch (error) {
          // 报告断言也必须失败，但不能覆盖观察阶段的原始异常和诊断。
          stepFailure = { error: stepFailure
            ? new AggregateError([stepFailure.error, error], 'Edit sequence observation and step reporting both failed')
            : error }
        }
      }
      if (stepFailure) {
        throw stepFailure.error
      }
    }
  }
  catch (error) {
    failure = { error }
  }
  try {
    await observer.close()
  }
  catch (error) {
    if (failure) {
      throw new AggregateError([failure.error, error], 'Edit sequence and resource cleanup both failed')
    }
    throw error
  }
  if (failure) {
    throw failure.error
  }
}
