import { Buffer } from 'node:buffer'

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
  incremental: (input: SequenceInput) => Promise<T>
  fresh: (input: SequenceInput) => Promise<T>
  close: () => Promise<void>
}

export interface Divergence {
  file: string
  field: string
  incremental: unknown
  fresh: unknown
}

export type SequenceComparator<T> = (incremental: T, fresh: T) => Divergence | undefined

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
  options: { maxSteps?: number, maxFiles?: number, maxBytes?: number, maxSaves?: number, timeoutMs?: number, compare?: SequenceComparator<T> } = {},
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
      try {
        const incremental = await bounded(() => observer.incremental(input), signal)
        const fresh = await bounded(() => observer.fresh(input), signal)
        const difference = compare(incremental, fresh)
        if (difference) {
          throw new EditSequenceDivergence(sequence.name, observer.name, step, current?.name ?? 'initial', difference, replay)
        }
      }
      catch (error) {
        if (error instanceof EditSequenceDivergence) {
          throw error
        }
        throw new Error(`${sequence.name}: ${observer.name}: step ${step} (${current?.name ?? 'initial'}) failed before comparison\\n${JSON.stringify({ replay }, null, 2)}`, { cause: error })
      }
    }
  }
  finally {
    await observer.close()
  }
}
