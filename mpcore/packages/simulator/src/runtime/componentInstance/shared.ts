const ARRAY_INDEX_PATH_RE = /\[(\d+)\]/g
const ARRAY_INDEX_SEGMENT_RE = /^\d+$/

function cloneObject<T extends Record<string, any>>(value: T) {
  return JSON.parse(JSON.stringify(value))
}

export function bindFunction(target: Record<string, any>, key: string, value: unknown) {
  if (typeof value !== 'function') {
    target[key] = value
    return
  }
  target[key] = (...args: any[]) => value.apply(target, args)
}

export function cloneValue<T>(value: T) {
  if (Array.isArray(value)) {
    return JSON.parse(JSON.stringify(value)) as T
  }
  if (value && typeof value === 'object') {
    return cloneObject(value as Record<string, any>) as T
  }
  return value
}

export function cloneRecord<T extends Record<string, any>>(value: T) {
  return cloneObject(value)
}

export function parseDataPath(path: string) {
  return path
    .replace(ARRAY_INDEX_PATH_RE, '.$1')
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean)
}

export function isArrayIndexSegment(segment: string) {
  return ARRAY_INDEX_SEGMENT_RE.test(segment)
}

function createContainerByNextSegment(nextSegment?: string) {
  return isArrayIndexSegment(nextSegment ?? '') ? [] : {}
}

export function assignByPath(target: Record<string, any>, path: string, value: unknown) {
  const segments = parseDataPath(path)
  if (segments.length === 0) {
    return
  }

  let current: any = target
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!
    const nextSegment = segments[index + 1]
    const normalizedSegment = isArrayIndexSegment(segment) ? Number(segment) : segment
    const next = current?.[normalizedSegment]
    if (!next || typeof next !== 'object') {
      current[normalizedSegment] = createContainerByNextSegment(nextSegment)
    }
    current = current[normalizedSegment]
  }

  const leafSegment = segments.at(-1)!
  const normalizedLeafSegment = isArrayIndexSegment(leafSegment) ? Number(leafSegment) : leafSegment
  current[normalizedLeafSegment] = value
}

export function mergeRecord(...records: Array<Record<string, any> | undefined>) {
  return Object.assign({}, ...records.filter(Boolean))
}
