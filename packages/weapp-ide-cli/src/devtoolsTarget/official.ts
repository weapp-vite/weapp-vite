import type { ResolvedWechatDevtoolsTarget, WechatDevtoolsChannel } from './types'

export const WECHAT_DEVTOOLS_OFFICIAL_CHANNELS_URL = 'https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json'

/** 官方查询只提供版本证据，默认选择不依赖网络可用性。 */
export async function readOfficialWechatDevtoolsVersion(channel: WechatDevtoolsChannel = 'stable') {
  const queriedAt = new Date().toISOString()
  const response = await fetch(WECHAT_DEVTOOLS_OFFICIAL_CHANNELS_URL, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) {
    throw new Error(`Unable to query official DevTools versions: HTTP ${response.status}`)
  }
  const value: unknown = await response.json()
  const channels = value && typeof value === 'object' && 'channels' in value && Array.isArray(value.channels) ? value.channels : []
  const entry: unknown = channels.find((entry: unknown) => entry && typeof entry === 'object' && 'id' in entry && entry.id === channel)
  if (!entry || typeof entry !== 'object' || !('version' in entry) || typeof entry.version !== 'string' || !/^\d+(?:\.\d+){2,}$/.test(entry.version)) {
    throw new Error(`Official DevTools metadata has no valid ${channel} version.`)
  }
  return { version: entry.version, source: WECHAT_DEVTOOLS_OFFICIAL_CHANNELS_URL, queriedAt }
}

/** 仅显式严格模式要求所选安装匹配官方渠道最新版本。 */
export async function assertOfficialWechatDevtoolsVersion(target: ResolvedWechatDevtoolsTarget) {
  if (!target.channel || target.channel === 'unknown') {
    throw new Error('Cannot verify the official latest version for an unknown DevTools channel.')
  }
  const official = await readOfficialWechatDevtoolsVersion(target.channel)
  if (target.version !== official.version) {
    throw new Error(`DEVTOOLS_OFFICIAL_LATEST_REQUIRED: selected ${target.version}, official ${target.channel}@${official.version}.`)
  }
  return official
}
