import createDebug from 'debug'

/**
 * 创建一个调试器实例，用于输出带有命名空间的调试信息。
 * @param namespace - 调试信息的命名空间，格式为 'weapp-vite:' + 自定义字符串。
 * @returns 如果调试器启用，则返回调试器实例；否则返回 undefined。
 */
export function createDebugger(namespace: `weapp-vite:${string}`) {
  const debug = createDebug(namespace)
  if (debug.enabled) {
    return debug
  }
}
