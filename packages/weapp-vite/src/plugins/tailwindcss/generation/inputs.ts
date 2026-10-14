import type { CompilerGenerateRequest } from 'weapp-tailwindcss/core'
import type { CompilerRawRead } from '../../compilerPlugin/rawInputs'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { types } from 'node:util'
import { CompilerHmrResyncError, compilerSourceId } from '../../compilerPlugin/hmr'
import { compilerRawFileVersion } from '../../compilerPlugin/rawInputs'

/** 只复制可比较的配置值；函数保留身份，未知对象不能参与复用。 */
export function copyGenerationValue<T>(value: T, parents = new Set<object>()): T {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (types.isProxy(value)) {
    throw new TypeError('Tailwind generation configuration must not contain proxies')
  }
  const array = Array.isArray(value)
  if (parents.has(value) || (array ? Object.getPrototypeOf(value) !== Array.prototype : Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new TypeError('Unsupported Tailwind generation configuration')
  }
  parents.add(value)
  try {
    const keys = Reflect.ownKeys(value)
    if (array && keys.some(key => key !== 'length' && (typeof key !== 'string' || !/^(?:0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) {
      throw new TypeError('Tailwind generation configuration must not contain custom array properties')
    }
    const entries: [PropertyKey, unknown][] = keys.filter(key => !array || key !== 'length').map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!
      if (!('value' in descriptor)) {
        throw new TypeError('Tailwind generation configuration must not contain accessors')
      }
      return [key, copyGenerationValue(descriptor.value, parents)]
    })
    const copy = array ? [] : Object.create(Object.getPrototypeOf(value))
    if (array) {
      copy.length = value.length
    }
    for (const [key, item] of entries) {
      Object.defineProperty(copy, key, { value: item, enumerable: Object.getOwnPropertyDescriptor(value, key)!.enumerable })
    }
    return Object.freeze(copy) as T
  }
  finally {
    parents.delete(value)
  }
}

function withGenerationProperty<T extends object>(copied: T, key: string, value: unknown): T {
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(copied)
  descriptors[key] = { value, enumerable: descriptors[key]?.enumerable ?? true }
  return Object.freeze(Object.create(Object.getPrototypeOf(copied), descriptors)) as T
}

/** 只排除缓存生命周期标记，保留其他属性、枚举性和原型，并拒绝不安全配置。 */
export function comparableGenerationRequest(request: CompilerGenerateRequest) {
  const copied = copyGenerationValue(request)
  const descriptors = Object.getOwnPropertyDescriptors(copied)
  // 先校验完整输入，避免生命周期字段自身的 getter 或 proxy 绕过封存规则。
  delete descriptors.incrementalCache
  return Object.freeze(Object.create(Object.getPrototypeOf(copied), descriptors)) as CompilerGenerateRequest
}

/** 比较实际解析的 CSS base 与完整入口选项，而不是仅比较 root id。 */
export async function generationRequest(request: CompilerGenerateRequest) {
  const comparableRequest = comparableGenerationRequest(request)
  const { resolveTailwindV4Source } = await import('weapp-tailwindcss/generator')
  const source = comparableRequest.source ?? await resolveTailwindV4Source(comparableRequest.sourceOptions)
  const sourceOptions = comparableRequest.sourceOptions
    ? withGenerationProperty(comparableRequest.sourceOptions, 'base', source.base)
    : undefined
  return withGenerationProperty(comparableRequest, 'sourceOptions', sourceOptions)
}

function sameCopiedValue(expected: unknown, current: unknown): boolean {
  if (Object.is(expected, current)) {
    return true
  }
  if (!expected || !current || typeof expected !== 'object' || typeof current !== 'object'
    || Object.getPrototypeOf(expected) !== Object.getPrototypeOf(current)) {
    return false
  }
  const keys = Reflect.ownKeys(expected)
  const currentKeys = Reflect.ownKeys(current)
  return keys.length === currentKeys.length && keys.every((key) => {
    const before = Object.getOwnPropertyDescriptor(expected, key)!
    const after = Object.getOwnPropertyDescriptor(current, key)
    return after !== undefined && before.enumerable === after.enumerable && sameCopiedValue(before.value, after.value)
  })
}

export function equalGenerationValue(expected: unknown, current: unknown): boolean {
  try {
    return sameCopiedValue(expected, copyGenerationValue(current))
  }
  catch {
    return false
  }
}

/** 依赖仍由磁盘工具消费，必须同时核对封存内容和本轮文件版本。 */
export function captureGenerationDependencies(files: readonly string[], sources: ReadonlyMap<string, string | null>, changedFiles: readonly string[], frozenReads?: ReadonlyMap<string, CompilerRawRead>) {
  const versions = new Map<string, string>()
  const validate = () => {
    for (const file of files) {
      const id = compilerSourceId(file)
      const expected = sources.get(id)
      const before = frozenReads ? compilerRawFileVersion(statSync(file, { bigint: true })) : undefined
      const bytes = frozenReads ? readFileSync(file) : readFileSync(file, 'utf8')
      const actual = typeof bytes === 'string' ? bytes : bytes.toString('utf8')
      const stat = statSync(file, { bigint: true })
      const version = compilerRawFileVersion(stat)
      const read = frozenReads?.get(id)
      const exactBytes = !frozenReads || (typeof bytes !== 'string' && (read
        ? read.digest === createHash('sha256').update(bytes).digest('hex') && read.byteLength === bytes.byteLength && read.version === version
        : typeof expected === 'string' && bytes.equals(Buffer.from(expected, 'utf8'))))
      if (typeof expected !== 'string' || expected !== actual || !exactBytes || (before !== undefined && before !== version) || (versions.has(id) && versions.get(id) !== version)) {
        throw new CompilerHmrResyncError(changedFiles, 'Tailwind snapshot dependency changed outside its frozen generation')
      }
      versions.set(id, version)
    }
  }
  validate()
  return validate
}

/** 模块解析会登记不存在的候选后缀；只有实际文件属于扫描输入。 */
export function isGenerationSourceFile(file: string): boolean {
  try {
    return statSync(file).isFile()
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}
