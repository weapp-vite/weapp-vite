type RuntimeRoot = Record<string, any>

declare const wx: any
declare const my: any
declare const tt: any
declare const swan: any
declare const jd: any
declare const xhs: any
declare const qq: any
declare const ks: any
declare const dd: any
declare const qa: any
declare const qapp: any
declare const uni: any
declare const __wxConfig: any

/**
 * @description 静态解析当前运行环境的全局根对象，兼容不提供 globalThis 的小程序 worker。
 */
export function resolveRuntimeRoots(): RuntimeRoot[] {
  const roots: RuntimeRoot[] = []
  const appendRoot = (root: RuntimeRoot | undefined) => {
    if (root && !roots.includes(root)) {
      roots.push(root)
    }
  }
  if (typeof globalThis !== 'undefined') {
    appendRoot(globalThis as RuntimeRoot)
  }
  // eslint-disable-next-line no-restricted-globals
  if (typeof self !== 'undefined') {
    // eslint-disable-next-line no-restricted-globals
    appendRoot(self as RuntimeRoot)
  }
  if (typeof window !== 'undefined') {
    appendRoot(window as RuntimeRoot)
  }
  // eslint-disable-next-line no-restricted-globals
  if (typeof global !== 'undefined') {
    // eslint-disable-next-line no-restricted-globals
    appendRoot(global as RuntimeRoot)
  }
  return roots
}

/**
 * @description 静态解析当前运行环境的首个全局根对象。
 */
export function resolveRuntimeRoot(): RuntimeRoot | undefined {
  return resolveRuntimeRoots()[0]
}

function resolveTopLevelRuntimeValue(key: string): unknown {
  switch (key) {
    case 'wx':
      return typeof wx !== 'undefined' ? wx : undefined
    case 'my':
      return typeof my !== 'undefined' ? my : undefined
    case 'tt':
      return typeof tt !== 'undefined' ? tt : undefined
    case 'swan':
      return typeof swan !== 'undefined' ? swan : undefined
    case 'jd':
      return typeof jd !== 'undefined' ? jd : undefined
    case 'xhs':
      return typeof xhs !== 'undefined' ? xhs : undefined
    case 'qq':
      return typeof qq !== 'undefined' ? qq : undefined
    case 'ks':
      return typeof ks !== 'undefined' ? ks : undefined
    case 'dd':
      return typeof dd !== 'undefined' ? dd : undefined
    case 'qa':
      return typeof qa !== 'undefined' ? qa : undefined
    case 'qapp':
      return typeof qapp !== 'undefined' ? qapp : undefined
    case 'uni':
      return typeof uni !== 'undefined' ? uni : undefined
    case '__wxConfig':
      return typeof __wxConfig !== 'undefined' ? __wxConfig : undefined
    default:
      return undefined
  }
}

/**
 * @description 从全局根对象或小程序顶层全局变量读取运行时值。
 */
export function resolveRuntimeGlobalValue(key: string, root: RuntimeRoot | undefined = resolveRuntimeRoot()) {
  const roots = root ? [root, ...resolveRuntimeRoots().filter(item => item !== root)] : resolveRuntimeRoots()
  for (const item of roots) {
    const value = item[key]
    if (value !== undefined) {
      return value
    }
  }
  return resolveTopLevelRuntimeValue(key)
}
