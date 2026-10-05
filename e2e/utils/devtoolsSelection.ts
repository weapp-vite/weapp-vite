import type { ResolvedWechatDevtoolsTarget } from 'weapp-ide-cli'
import process from 'node:process'
import { applyWechatCliSelection } from './devtoolsCli'

const OFFICIAL_CHANNELS_URL = 'https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json'
export const ACCEPTED_DEVTOOLS_VERSION_ENV = 'WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION'
export const DEVTOOLS_VERSION_POLICY_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_VERSION_POLICY'
export const DEVTOOLS_SELECTED_VERSION_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_SELECTED_VERSION'
export const DEVTOOLS_SELECTED_CHANNEL_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_SELECTED_CHANNEL'
export const DEVTOOLS_OFFICIAL_VERSION_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_OFFICIAL_VERSION'
export const DEVTOOLS_ACCEPTED_VERSION_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_ACCEPTED_VERSION'
export const DEVTOOLS_OFFICIAL_SOURCE_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_OFFICIAL_SOURCE'
export const DEVTOOLS_OFFICIAL_QUERIED_AT_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_OFFICIAL_QUERIED_AT'

export type DevtoolsVersionPolicyMode = 'official-stable' | 'selected-version-opt-in'

export interface DevtoolsVersionPolicyReport {
  mode: DevtoolsVersionPolicyMode
  selectedVersion: string
  selectedChannel: 'stable'
  officialVersion: string
  acceptedVersion: string | null
  officialVersionMatches: boolean
  officialSource: string
  officialQueriedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 仅查询官方稳定渠道；未知结构和网络失败不能被当成允许降级的依据。 */
export async function readOfficialStableVersion() {
  const response = await fetch(OFFICIAL_CHANNELS_URL, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) {
    throw new Error(`无法核对微信开发者工具官方稳定渠道：HTTP ${response.status}`)
  }
  const payload: unknown = await response.json()
  const stable = isRecord(payload) && Array.isArray(payload.channels)
    ? payload.channels.find((channel: unknown) => isRecord(channel) && channel.id === 'stable') as Record<string, unknown> | undefined
    : undefined
  if (typeof stable?.version !== 'string' || !/^\d+(?:\.\d+){2,}$/.test(stable.version)) {
    throw new Error('无法核对微信开发者工具官方稳定渠道：缺少有效 Stable 版本。')
  }
  return { version: stable.version, queriedAt: new Date().toISOString(), source: OFFICIAL_CHANNELS_URL }
}

function readAcceptedVersion(env = process.env) {
  const value = env[ACCEPTED_DEVTOOLS_VERSION_ENV]?.trim()
  if (!value) {
    return undefined
  }
  if (!/^\d+(?:\.\d+){2,}$/.test(value)) {
    throw new Error(`${ACCEPTED_DEVTOOLS_VERSION_ENV} must be a complete DevTools version.`)
  }
  return value
}

export function readDevtoolsVersionPolicy(env = process.env): DevtoolsVersionPolicyReport | undefined {
  const mode = env[DEVTOOLS_VERSION_POLICY_ENV]
  const selectedVersion = env[DEVTOOLS_SELECTED_VERSION_ENV]
  const selectedChannel = env[DEVTOOLS_SELECTED_CHANNEL_ENV]
  const officialVersion = env[DEVTOOLS_OFFICIAL_VERSION_ENV]
  const acceptedVersion = env[DEVTOOLS_ACCEPTED_VERSION_ENV] || null
  const officialSource = env[DEVTOOLS_OFFICIAL_SOURCE_ENV]
  const officialQueriedAt = env[DEVTOOLS_OFFICIAL_QUERIED_AT_ENV]
  if (!mode || !selectedVersion || selectedChannel !== 'stable' || !officialVersion || !officialSource || !officialQueriedAt) {
    return undefined
  }
  if (mode !== 'official-stable' && mode !== 'selected-version-opt-in') {
    return undefined
  }
  return {
    mode,
    selectedVersion,
    selectedChannel,
    officialVersion,
    acceptedVersion,
    officialVersionMatches: selectedVersion === officialVersion,
    officialSource,
    officialQueriedAt,
  }
}

function setDevtoolsVersionPolicyEnv(policy: DevtoolsVersionPolicyReport) {
  process.env[DEVTOOLS_VERSION_POLICY_ENV] = policy.mode
  process.env[DEVTOOLS_SELECTED_VERSION_ENV] = policy.selectedVersion
  process.env[DEVTOOLS_SELECTED_CHANNEL_ENV] = policy.selectedChannel
  process.env[DEVTOOLS_OFFICIAL_VERSION_ENV] = policy.officialVersion
  process.env[DEVTOOLS_ACCEPTED_VERSION_ENV] = policy.acceptedVersion ?? ''
  process.env[DEVTOOLS_OFFICIAL_SOURCE_ENV] = policy.officialSource
  process.env[DEVTOOLS_OFFICIAL_QUERIED_AT_ENV] = policy.officialQueriedAt
}

/** 将预检、公共 CLI 和后续子进程固定到同一安装，不修改全局配置。 */
export async function preflightSelectedWechatDevtools() {
  for (const key of [DEVTOOLS_VERSION_POLICY_ENV, DEVTOOLS_SELECTED_VERSION_ENV, DEVTOOLS_SELECTED_CHANNEL_ENV, DEVTOOLS_OFFICIAL_VERSION_ENV, DEVTOOLS_ACCEPTED_VERSION_ENV, DEVTOOLS_OFFICIAL_SOURCE_ENV, DEVTOOLS_OFFICIAL_QUERIED_AT_ENV]) {
    delete process.env[key]
  }
  const cliPath = applyWechatCliSelection()
  const { assertWechatDevtoolsHost, resolveWechatDevtoolsTarget } = await import('weapp-ide-cli')
  const target = await resolveWechatDevtoolsTarget({ cliPath })
  const official = await readOfficialStableVersion()
  const acceptedVersion = readAcceptedVersion()
  const officialVersionMatches = target.version === official.version
  const mode: DevtoolsVersionPolicyMode = acceptedVersion ? 'selected-version-opt-in' : 'official-stable'
  if (target.channel !== 'stable') {
    throw new Error(`DEVTOOLS_STABLE_REQUIRED: 官方 Stable 为 ${official.version}，选定安装为 ${target.version ?? 'unknown'} / ${target.channel ?? 'unknown'}；已停止，不自动换版。`)
  }
  if (acceptedVersion && target.version !== acceptedVersion) {
    throw new Error(`DEVTOOLS_ACCEPTED_VERSION_MISMATCH: ${ACCEPTED_DEVTOOLS_VERSION_ENV}=${acceptedVersion}，选定安装为 ${target.version ?? 'unknown'}。`)
  }
  if (!acceptedVersion && !officialVersionMatches) {
    throw new Error(`DEVTOOLS_STABLE_REQUIRED: 官方 Stable 为 ${official.version}，选定安装为 ${target.version ?? 'unknown'} / ${target.channel ?? 'unknown'}；已停止，不自动换版。`)
  }
  const policy: DevtoolsVersionPolicyReport = {
    mode,
    selectedVersion: target.version!,
    selectedChannel: 'stable',
    officialVersion: official.version,
    acceptedVersion: acceptedVersion ?? null,
    officialVersionMatches,
    officialSource: official.source,
    officialQueriedAt: official.queriedAt,
  }
  await assertWechatDevtoolsHost(target)
  setDevtoolsVersionPolicyEnv(policy)
  process.stdout.write(`[info] [devtools:selection] ${JSON.stringify({ ...official, cliPath: target.cliPath, installationId: target.installationId, channel: target.channel, versionPolicy: policy.mode, selectedVersion: policy.selectedVersion, acceptedVersion: policy.acceptedVersion, officialVersionMatches: policy.officialVersionMatches })}\n`)
  return target
}

/** 每次连接都复核实际宿主，防止预检后另一安装接管公共单实例锁。 */
export async function resolveSelectedWechatDevtools(cliPath: string) {
  const { assertWechatDevtoolsHost, resolveWechatDevtoolsTarget } = await import('weapp-ide-cli')
  const target = await resolveWechatDevtoolsTarget({ cliPath })
  await assertWechatDevtoolsHost(target)
  return target
}

/** 版本来自真实 Tool 协议，安装身份由系统宿主核验；二者不能互相替代。 */
export async function assertSelectedWechatDevtoolsRuntime(
  target: ResolvedWechatDevtoolsTarget,
  miniProgram: { toolInfo: () => Promise<{ version?: string, SDKVersion?: string }> },
) {
  const { assertWechatDevtoolsHost } = await import('weapp-ide-cli')
  await assertWechatDevtoolsHost(target)
  const info = await miniProgram.toolInfo()
  if (!target.version || info.version !== target.version) {
    throw new Error(`DEVTOOLS_INSTALLATION_MISMATCH: 实际宿主版本 ${info.version ?? 'unknown'} 与选定安装 ${target.version ?? 'unknown'} 不一致。`)
  }
  process.stdout.write(`[info] [devtools:runtime] ${JSON.stringify({ version: info.version, baseLibraryVersion: info.SDKVersion ?? null, installationId: target.installationId })}\n`)
}
