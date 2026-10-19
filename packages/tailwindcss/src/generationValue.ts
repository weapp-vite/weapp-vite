import { types } from 'node:util'

/** 只复制可比较的生成配置；保留函数身份、属性描述与原型，拒绝不可安全封存的输入。 */
export function copyTailwindGenerationValue<T>(value: T, parents = new Set<object>()): T {
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
      return [key, copyTailwindGenerationValue(descriptor.value, parents)]
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
