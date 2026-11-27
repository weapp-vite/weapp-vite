import { isPlaceholderRequestGlobal } from './globalValue'

function assignValue(target: object, key: PropertyKey, value: unknown) {
  try {
    (target as Record<PropertyKey, unknown>)[key] = value
    return true
  }
  catch {
    return false
  }
}

function defineValue(target: object, key: PropertyKey, descriptor: PropertyDescriptor) {
  try {
    Object.defineProperty(target, key, {
      configurable: true,
      ...descriptor,
    })
    return true
  }
  catch {
    return false
  }
}

export function hasUsableConstructor(value: unknown, args: unknown[] = []) {
  if (typeof value !== 'function' || isPlaceholderRequestGlobal(value)) {
    return false
  }
  try {
    Reflect.construct(value, args)
    return true
  }
  catch {
    return false
  }
}

export function hasUsablePrototypeMethods(value: unknown, methods: string[], properties: string[] = []) {
  if (typeof value !== 'function' || isPlaceholderRequestGlobal(value)) {
    return false
  }
  const prototype = (value as { prototype?: unknown }).prototype
  if (!prototype || (typeof prototype !== 'object' && typeof prototype !== 'function')) {
    return false
  }
  const prototypeRecord = prototype as Record<string, unknown>
  return Boolean(methods.every(method => typeof prototypeRecord[method] === 'function') && properties.every(property => property in prototypeRecord))
}

/** 仅检测独立实例的增量 UTF-8 行为，不能把占位函数或单次解码器当作完整能力。 */
export function hasUsableTextDecoderConstructor(value: unknown): value is typeof globalThis.TextDecoder {
  if (typeof value !== 'function' || isPlaceholderRequestGlobal(value)) {
    return false
  }
  try {
    const decoder = new (value as typeof globalThis.TextDecoder)()
    return decoder.decode(new Uint8Array([0xE4]), { stream: true }) === ''
      && decoder.decode(new Uint8Array([0xB8, 0xAD, 0xF0, 0x9F]), { stream: true }) === '中'
      && decoder.decode(new Uint8Array([0x99, 0x82])) === '🙂'
      && decoder.decode(new Uint8Array([0xFF])) === '\uFFFD'
  }
  catch {
    return false
  }
}

function createUrlParser(URLConstructor: typeof URL) {
  return function parse(input: string | URL, base?: string | URL) {
    try {
      return new URLConstructor(input, base)
    }
    catch {
      return null
    }
  }
}

function createUrlCanParser(URLConstructor: typeof URL) {
  return function canParse(input: string | URL, base?: string | URL) {
    try {
      Reflect.construct(URLConstructor, base === undefined ? [input] : [input, base])
      return true
    }
    catch {
      return false
    }
  }
}

export function hasWebCompatibleUrlConstructor(value: unknown) {
  if (!hasUsableConstructor(value, ['https://request-globals.invalid'])) {
    return false
  }
  try {
    return new (value as typeof URL)('123', 'fake://abc').href === 'fake://abc/123'
  }
  catch {
    return false
  }
}

export function patchUrlConstructor(URLConstructor: unknown) {
  if (typeof URLConstructor !== 'function') {
    return false
  }
  const constructor = URLConstructor as typeof URL
  let patched = true
  if (typeof constructor.parse !== 'function') {
    patched = assignValue(constructor, 'parse', createUrlParser(constructor)) && patched
  }
  if (typeof constructor.canParse !== 'function') {
    patched = assignValue(constructor, 'canParse', createUrlCanParser(constructor)) && patched
  }
  return patched
}

function compareUrlSearchParamKeys(leftKey: string, rightKey: string) {
  if (leftKey < rightKey) {
    return -1
  }
  if (leftKey > rightKey) {
    return 1
  }
  return 0
}

function sortUrlSearchParams(this: URLSearchParams) {
  const entries = Array.from(this.entries()).sort(([leftKey], [rightKey]) => compareUrlSearchParamKeys(leftKey, rightKey))
  const keys = [...new Set(entries.map(([key]) => key))]
  for (const key of keys) {
    this.delete(key)
  }
  for (const [key, value] of entries) {
    this.append(key, value)
  }
}

export function patchUrlSearchParamsConstructor(value: unknown) {
  const prototype = (value as { prototype?: unknown } | undefined)?.prototype as (URLSearchParams & Record<string, unknown>) | undefined
  if (!prototype || !['append', 'delete', 'entries', 'forEach'].every(method => typeof prototype[method] === 'function')) {
    return false
  }
  let patched = true
  if (!('size' in prototype)) {
    patched = defineValue(prototype, 'size', {
      get(this: URLSearchParams) {
        let size = 0
        this.forEach(() => {
          size += 1
        })
        return size
      },
    }) && patched
  }
  if (typeof prototype.sort !== 'function') {
    patched = assignValue(prototype, 'sort', sortUrlSearchParams) && patched
  }
  return patched
}

export function patchHeadersConstructor(value: unknown) {
  const prototype = (value as { prototype?: unknown } | undefined)?.prototype
  if (!prototype || (typeof prototype !== 'object' && typeof prototype !== 'function')) {
    return false
  }
  if (typeof (prototype as Record<string, unknown>).getSetCookie === 'function') {
    return true
  }
  return assignValue(prototype, 'getSetCookie', function getSetCookie(this: Headers) {
    const value = this.get('set-cookie')
    return value == null ? [] : [value]
  })
}

/** 探测响应体的实际读取能力，避免仅凭静态 helper 保留空构造器。 */
export function hasUsableResponseConstructor(value: unknown) {
  if (!hasUsablePrototypeMethods(value, ['arrayBuffer', 'json', 'text'])) {
    return false
  }
  try {
    const response = new (value as typeof Response)('ok')
    return response.headers?.get('content-type') === 'text/plain;charset=UTF-8'
      && response.status === 200
      && response.ok === true
  }
  catch {
    return false
  }
}

export function patchResponseConstructor(value: unknown, fallback: { json?: unknown, error?: unknown }) {
  if (typeof value !== 'function') {
    return false
  }
  const constructor = value as unknown as Record<string, unknown>
  let patched = true
  if (typeof constructor.json !== 'function' && typeof fallback.json === 'function') {
    patched = assignValue(constructor, 'json', fallback.json) && patched
  }
  if (typeof constructor.error !== 'function' && typeof fallback.error === 'function') {
    patched = assignValue(constructor, 'error', fallback.error) && patched
  }
  return patched
}
