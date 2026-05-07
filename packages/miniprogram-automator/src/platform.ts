/**
 * @file 小程序自动化平台适配定义。
 */

export type MiniprogramAutomatorPlatform = 'wechat' | 'swan' | 'baidu'

export interface IExternalAutomatorModule {
  launch: (options: Record<string, unknown>) => Promise<unknown>
  connect?: (options: Record<string, unknown>) => Promise<unknown>
  devices?: (deviceType: string, connectType?: string) => Promise<unknown>
  file?: unknown
  image?: unknown
  log?: unknown
  time?: unknown
}

export type NormalizedMiniprogramAutomatorPlatform = Exclude<MiniprogramAutomatorPlatform, 'baidu'>

export function normalizePlatform(platform: MiniprogramAutomatorPlatform = 'wechat'): NormalizedMiniprogramAutomatorPlatform {
  return platform === 'baidu' ? 'swan' : platform
}
