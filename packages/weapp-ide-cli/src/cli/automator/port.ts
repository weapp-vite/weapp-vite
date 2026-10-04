/** 显式端口不能被截断或作为默认值忽略，避免连接其他项目。 */
export function assertAutomatorPort(port: unknown): asserts port is number | undefined {
  if (port !== undefined && (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535)) {
    throw Object.assign(new RangeError('Automator port must be an integer between 1 and 65535.'), { code: 'DEVTOOLS_INVALID_PORT' })
  }
}

/** CLI 只接受完整十进制数字，缺失值、尾随字符和指数写法均报错。 */
export function parseAutomatorPort(raw: string | undefined): number {
  const port = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : Number.NaN
  assertAutomatorPort(port)
  return port
}
