/**
 * @file 内部兼容工具集合。
 */
import { randomUUID } from 'node:crypto'
import net from 'node:net'
import process from 'node:process'

const objectToString = Object.prototype.toString
const absolutePathPattern = /^(?:[a-z]+:)?[\\/]/i
function isPlainObject(value: unknown): value is Record<string, any> {
  if (objectToString.call(value) !== '[object Object]') {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
}
function cloneDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => cloneDeep(item)) as T
  }
  if (isPlainObject(value)) {
    const result: Record<string, any> = {}
    for (const [key, item] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue
      }
      result[key] = cloneDeep(item)
    }
    return result as T
  }
  return value
}
function padZero(value: number, width = 2) {
  return String(value).padStart(width, '0')
}
function stableSerialize(value: unknown) {
  const stack: unknown[] = []
  const keys: string[] = []
  return JSON.stringify(value, function serialize(key, currentValue) {
    if (stack.length > 0) {
      const currentIndex = stack.indexOf(this)
      if (currentIndex >= 0) {
        stack.splice(currentIndex + 1)
        keys.splice(currentIndex, Infinity, key)
      }
      else {
        stack.push(this)
        keys.push(key)
      }
      const valueIndex = stack.indexOf(currentValue)
      if (valueIndex >= 0) {
        if (valueIndex === 0) {
          return '[Circular ~]'
        }
        return `[Circular ~.${keys.slice(0, valueIndex).join('.')}]`
      }
    }
    else {
      stack.push(currentValue)
    }
    if (typeof currentValue === 'function') {
      return `[Function ${currentValue.toString()}]`
    }
    if (currentValue instanceof RegExp) {
      return `[RegExp ${currentValue.toString()}]`
    }
    if (typeof currentValue === 'undefined') {
      return null
    }
    return currentValue
  })
}
/** isFn 的方法封装。 */
export function isFn(value: unknown): value is (...args: any[]) => any {
  const type = objectToString.call(value)
  return type === '[object Function]' || type === '[object AsyncFunction]' || type === '[object GeneratorFunction]'
}
/** isNum 的方法封装。 */
export function isNum(value: unknown): value is number {
  return objectToString.call(value) === '[object Number]'
}
/** isStr 的方法封装。 */
export function isStr(value: unknown): value is string {
  return objectToString.call(value) === '[object String]'
}
/** isUndef 的方法封装。 */
export function isUndef(value: unknown): value is undefined {
  return typeof value === 'undefined'
}
/** sleep 的方法封装。 */
export function sleep(timeout: number) {
  return new Promise<void>(resolve => setTimeout(resolve, timeout))
}
export async function waitUntil(condition: () => unknown | Promise<unknown>, timeout = 0, interval = 250) {
  const startTime = Date.now()
  while (true) {
    const value = await condition()
    if (value) {
      return value
    }
    if (timeout && Date.now() - startTime >= timeout) {
      throw new Error(`Wait timed out after ${timeout} ms`)
    }
    await sleep(interval)
  }
}
/** startWith 的方法封装。 */
export function startWith(value: string, prefix: string) {
  return value.startsWith(prefix)
}
/** endWith 的方法封装。 */
export function endWith(value: string, suffix: string) {
  return value.endsWith(suffix)
}
/** trim 的方法封装。 */
export function trim(value: string, chars?: string) {
  if (!chars) {
    return value.trim()
  }
  const escaped = chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return value.replace(new RegExp(`^[${escaped}]+|[${escaped}]+$`, 'g'), '')
}
/** cmpVersion 的方法封装。 */
export function cmpVersion(versionA: string, versionB: string) {
  const left = versionA.split('.')
  const right = versionB.split('.')
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const currentLeft = Number.parseInt(left[index] || '0', 10)
    const currentRight = Number.parseInt(right[index] || '0', 10)
    if (currentLeft > currentRight) {
      return 1
    }
    if (currentLeft < currentRight) {
      return -1
    }
  }
  return 0
}
/** extendDeep 的方法封装。 */
export function extendDeep<T>(target: T, ...sources: unknown[]): T {
  let result = target
  for (const source of sources) {
    if (isPlainObject(result) && isPlainObject(source)) {
      for (const [key, value] of Object.entries(source)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue
        }
        result[key as keyof T] = extendDeep((result as any)[key], value)
      }
      continue
    }
    result = cloneDeep(source) as T
  }
  return result
}
/** getPort 的方法封装。 */
export function getPort(ports: number | number[], host?: string) {
  const queue = Array.isArray(ports) ? [...ports] : [ports]
  queue.push(0)
  const checkPort = (port: number) => {
    return new Promise<number>((resolve, reject) => {
      const server = net.createServer()
      server.unref()
      server.on('error', reject)
      const options: net.ListenOptions = { port }
      if (host) {
        options.host = host
      }
      server.listen(options, () => {
        const address = server.address()
        const resolvedPort = typeof address === 'object' && address ? address.port : port
        server.close(() => {
          resolve(resolvedPort)
        })
      })
    })
  }
  return queue.reduce<Promise<number>>((sequence, port) => sequence.catch(() => checkPort(port)), Promise.reject(new Error('No available port')))
}
/** isEmpty 的方法封装。 */
export function isEmpty(value: unknown) {
  if (value == null) {
    return true
  }
  if (Array.isArray(value) || typeof value === 'string') {
    return value.length === 0
  }
  if (typeof value === 'object') {
    return Object.keys(value).length === 0
  }
  return false
}
/** isRelative 的方法封装。 */
export function isRelative(value: string) {
  return !absolutePathPattern.test(value)
}
export const isWindows = process.platform === 'win32'
/** toStr 的方法封装。 */
export function toStr(value: unknown) {
  return value == null ? '' : String(value)
}
/** dateFormat 的方法封装。 */
export function dateFormat(mask: string, value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return mask
    .replace('yyyy', String(date.getFullYear()))
    .replace('mm', padZero(date.getMonth() + 1))
    .replace('dd', padZero(date.getDate()))
    .replace('HH', padZero(date.getHours()))
    .replace('MM', padZero(date.getMinutes()))
    .replace('ss', padZero(date.getSeconds()))
    .replace('l', padZero(date.getMilliseconds(), 3))
}
/** stringify 的方法封装。 */
export function stringify(value: unknown) {
  return stableSerialize(value)
}
/** uuid 的方法封装。 */
export function uuid() {
  return randomUUID()
}
