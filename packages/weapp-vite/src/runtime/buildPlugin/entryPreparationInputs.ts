type InputKind = 'options' | 'load' | 'host' | 'vite' | 'weapp' | 'subPackages' | 'subPackage' | 'build' | 'bundler' | 'output' | 'worker' | 'css' | 'postcss' | 'plugins' | 'opaque' | 'data'

const inputFields: Partial<Record<InputKind, Record<string, InputKind>>> = {
  options: { config: 'vite', sourceConfig: 'vite', loadOptions: 'load' },
  load: { inlineConfig: 'vite', hostConfig: 'host' },
  host: { config: 'vite' },
  vite: { plugins: 'plugins', customLogger: 'opaque', weapp: 'weapp', build: 'build', worker: 'worker', css: 'css' },
  weapp: { subPackages: 'subPackages' },
  subPackage: { inlineConfig: 'vite' },
  build: { rolldownOptions: 'bundler', rollupOptions: 'bundler' },
  bundler: { plugins: 'plugins', output: 'output' },
  output: { plugins: 'plugins' },
  worker: { plugins: 'plugins' },
  css: { postcss: 'postcss' },
  postcss: { plugins: 'plugins' },
}

/**
 * 冻结配置的声明字段与引用，之后只读比较；不执行 getter 或序列化函数。
 * 插件列表检查顺序和对象身份，不遍历插件及 logger 的生命周期状态。
 * 不支持的声明对象或过大的配置保守放弃复用，不影响原构建路径。
 */
export function capturePreparationInputs(config: unknown, weappConfig: unknown): (() => boolean) | undefined {
  const seen = new WeakMap<object, Set<InputKind>>()
  const checks: Array<() => boolean> = []
  let fields = 0
  const visit = (value: unknown, kind: InputKind): boolean => {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function') || kind === 'opaque') {
      return true
    }
    // 函数和插件以父字段的引用比较，不调用函数，也不读取插件内部状态。
    if (typeof value === 'function' || (kind === 'plugins' && !Array.isArray(value))) {
      return true
    }
    const seenKinds = seen.get(value) ?? new Set<InputKind>()
    if (seenKinds.has(kind)) {
      return true
    }
    seenKinds.add(kind)
    seen.set(value, seenKinds)
    if (value instanceof RegExp) {
      const source = value.source
      const flags = value.flags
      checks.push(() => value.source === source && value.flags === flags)
      return true
    }
    const prototype = Object.getPrototypeOf(value)
    const isArray = Array.isArray(value)
    if (!isArray && prototype !== Object.prototype && prototype !== null) {
      return false
    }
    const keys = Reflect.ownKeys(value)
    fields += keys.length
    if (fields > 20_000) {
      return false
    }
    const descriptors = keys.map(key => Object.getOwnPropertyDescriptor(value, key)!)
    if (descriptors.some(descriptor => !('value' in descriptor))) {
      return false
    }
    checks.push(() => {
      const currentKeys = Reflect.ownKeys(value)
      return Object.getPrototypeOf(value) === prototype && currentKeys.length === keys.length
        && keys.every((key, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(value, key)
          return currentKeys[index] === key && descriptor !== undefined && 'value' in descriptor
            && Object.is(descriptor.value, descriptors[index]!.value)
        })
    })
    return descriptors.every((descriptor, index) => {
      const key = keys[index]!
      const nextKind = isArray ? kind : kind === 'subPackages' ? 'subPackage' : inputFields[kind]?.[String(key)] ?? 'data'
      return visit(descriptor.value, nextKind)
    })
  }
  try {
    if (!visit(config, 'options') || !visit(weappConfig, 'weapp')) {
      return
    }
  }
  catch {
    return
  }
  return () => {
    try {
      return checks.every(check => check())
    }
    catch {
      return false
    }
  }
}
