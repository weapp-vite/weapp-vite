/** Windows 查询预算包含 PowerShell 冷启动及内核/CIM 初始化；显式较小预算始终优先。 */
export function resolveWechatInspectionTimeout(platform: NodeJS.Platform, timeout?: number) {
  if (timeout !== undefined && (Number.isNaN(timeout) || timeout <= 0)) {
    throw new RangeError('DevTools inspection timeout must be positive.')
  }
  const maximum = platform === 'win32' ? 30_000 : 3_000
  return Math.min(timeout ?? maximum, maximum)
}
