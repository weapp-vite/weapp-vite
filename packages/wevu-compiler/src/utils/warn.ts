/**
 * 编译期警告处理函数。
 */
export type WarnHandler = (message: string) => void

/**
 * 解析警告处理函数，未提供时回退到 console.warn。
 */
export function resolveWarnHandler(warn?: WarnHandler): WarnHandler {
  return warn ?? ((message: string) => {
    // eslint-disable-next-line no-console -- 默认警告处理需要直接输出编译期提示
    console.warn(message)
  })
}
