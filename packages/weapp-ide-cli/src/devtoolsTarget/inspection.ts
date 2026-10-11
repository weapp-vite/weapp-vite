/** Windows 冷启动还需初始化 PowerShell 与 CIM；显式调用预算始终优先。 */
export function resolveWechatInspectionTimeout(platform: NodeJS.Platform, timeout?: number) {
  if (timeout !== undefined && (Number.isNaN(timeout) || timeout <= 0)) {
    throw new RangeError('DevTools inspection timeout must be positive.')
  }
  const maximum = platform === 'win32' ? 10_000 : 3_000
  return Math.min(timeout ?? maximum, maximum)
}
