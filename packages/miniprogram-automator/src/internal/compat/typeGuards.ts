/**
 * @file 基础类型守卫工具。
 */
const objectToString = Object.prototype.toString

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

/** isPlainObject 的方法封装。 */
export function isPlainObject(value: unknown): value is Record<string, any> {
  if (objectToString.call(value) !== '[object Object]') {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
}
