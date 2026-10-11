import type { ResolvedWechatDevtoolsTarget } from 'weapp-ide-cli'
import process from 'node:process'
import { readOfficialWechatDevtoolsVersion, WECHAT_DEVTOOLS_OFFICIAL_CHANNELS_URL } from 'weapp-ide-cli'
import { selectWechatE2EInstallation } from './devtoolsCli'

const OFFICIAL_CHANNELS_URL = WECHAT_DEVTOOLS_OFFICIAL_CHANNELS_URL
export const ACCEPTED_DEVTOOLS_VERSION_ENV = 'WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION'
export const ACCEPTED_DEVTOOLS_CHANNEL_ENV = 'WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_CHANNEL'
export const DEVTOOLS_VERSION_POLICY_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_VERSION_POLICY'
export const DEVTOOLS_SELECTED_VERSION_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_SELECTED_VERSION'
export const DEVTOOLS_SELECTED_CHANNEL_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_SELECTED_CHANNEL'
export const DEVTOOLS_OFFICIAL_ERROR_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_OFFICIAL_ERROR'
export const DEVTOOLS_OFFICIAL_CHANNEL_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_OFFICIAL_CHANNEL'
export const DEVTOOLS_OFFICIAL_VERSION_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_OFFICIAL_VERSION'
export const DEVTOOLS_ACCEPTED_VERSION_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_ACCEPTED_VERSION'
export const DEVTOOLS_OFFICIAL_SOURCE_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_OFFICIAL_SOURCE'
export const DEVTOOLS_OFFICIAL_QUERIED_AT_ENV = 'WEAPP_VITE_E2E_DEVTOOLS_OFFICIAL_QUERIED_AT'

export type DevtoolsVersionPolicyMode = 'official-stable' | 'installed-stable' | 'selected-channel' | 'selected-version-opt-in'
export type DevtoolsChannel = 'stable' | 'rc' | 'nightly'

export interface DevtoolsVersionPolicyReport {
  mode: DevtoolsVersionPolicyMode
  selectedVersion: string
  selectedChannel: DevtoolsChannel
  officialVersion: string | null
  officialError?: string
  officialChannel?: DevtoolsChannel
  acceptedVersion: string | null
  officialVersionMatches: boolean
  officialSource: string
  officialQueriedAt: string
}

/** 保留旧工具入口，实际查询由公共安装 API 按所选渠道完成。 */
export async function readOfficialStableVersion(selectedChannel: DevtoolsChannel = 'stable') {
  return await readOfficialWechatDevtoolsVersion(selectedChannel)
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

function readAcceptedChannel(env = process.env): DevtoolsChannel {
  const value = env[ACCEPTED_DEVTOOLS_CHANNEL_ENV]?.trim() || 'stable'
  if (value !== 'stable' && value !== 'rc' && value !== 'nightly') {
    throw new Error(`${ACCEPTED_DEVTOOLS_CHANNEL_ENV} must be stable, rc or nightly.`)
  }
  return value
}

export function readDevtoolsVersionPolicy(env = process.env): DevtoolsVersionPolicyReport | undefined {
  const mode = env[DEVTOOLS_VERSION_POLICY_ENV]
  const selectedVersion = env[DEVTOOLS_SELECTED_VERSION_ENV]
  const selectedChannel = env[DEVTOOLS_SELECTED_CHANNEL_ENV]
  const officialVersion = env[DEVTOOLS_OFFICIAL_VERSION_ENV] || null
  const officialError = env[DEVTOOLS_OFFICIAL_ERROR_ENV] || undefined
  const officialChannel = (env[DEVTOOLS_OFFICIAL_CHANNEL_ENV] || 'stable') as DevtoolsChannel
  const acceptedVersion = env[DEVTOOLS_ACCEPTED_VERSION_ENV] || null
  const officialSource = env[DEVTOOLS_OFFICIAL_SOURCE_ENV]
  const officialQueriedAt = env[DEVTOOLS_OFFICIAL_QUERIED_AT_ENV]
  if (!mode || !selectedVersion || !['stable', 'rc', 'nightly'].includes(selectedChannel ?? '') || (!officialVersion && !officialError) || !officialSource || !officialQueriedAt) {
    return undefined
  }
  if (!['official-stable', 'installed-stable', 'selected-channel', 'selected-version-opt-in'].includes(mode)) {
    return undefined
  }
  if (mode === 'official-stable' && selectedChannel !== 'stable') {
    return undefined
  }
  return {
    mode: mode as DevtoolsVersionPolicyMode,
    officialError,
    officialChannel,
    selectedVersion,
    selectedChannel: selectedChannel as DevtoolsChannel,
    officialVersion,
    acceptedVersion,
    officialVersionMatches: selectedChannel === officialChannel && selectedVersion === officialVersion,
    officialSource,
    officialQueriedAt,
  }
}

function setDevtoolsVersionPolicyEnv(policy: DevtoolsVersionPolicyReport) {
  process.env[DEVTOOLS_VERSION_POLICY_ENV] = policy.mode
  process.env[DEVTOOLS_SELECTED_VERSION_ENV] = policy.selectedVersion
  process.env[DEVTOOLS_SELECTED_CHANNEL_ENV] = policy.selectedChannel
  process.env[DEVTOOLS_OFFICIAL_VERSION_ENV] = policy.officialVersion ?? ''
  process.env[DEVTOOLS_OFFICIAL_ERROR_ENV] = policy.officialError ?? ''
  process.env[DEVTOOLS_OFFICIAL_CHANNEL_ENV] = policy.officialChannel ?? 'stable'
  process.env[DEVTOOLS_ACCEPTED_VERSION_ENV] = policy.acceptedVersion ?? ''
  process.env[DEVTOOLS_OFFICIAL_SOURCE_ENV] = policy.officialSource
  process.env[DEVTOOLS_OFFICIAL_QUERIED_AT_ENV] = policy.officialQueriedAt
}

/** 将预检、公共 CLI 和后续子进程固定到同一安装，不修改全局配置。 */
export async function preflightSelectedWechatDevtools() {
  for (const key of [DEVTOOLS_VERSION_POLICY_ENV, DEVTOOLS_SELECTED_VERSION_ENV, DEVTOOLS_SELECTED_CHANNEL_ENV, DEVTOOLS_OFFICIAL_VERSION_ENV, DEVTOOLS_ACCEPTED_VERSION_ENV, DEVTOOLS_OFFICIAL_SOURCE_ENV, DEVTOOLS_OFFICIAL_QUERIED_AT_ENV, DEVTOOLS_OFFICIAL_ERROR_ENV, DEVTOOLS_OFFICIAL_CHANNEL_ENV]) {
    delete process.env[key]
  }
  const acceptedVersion = readAcceptedVersion()
  const acceptedChannel = readAcceptedChannel()
  const requestedChannel = process.env.WEAPP_VITE_E2E_DEVTOOLS_CHANNEL?.trim()
  const allowedChannel = requestedChannel || acceptedChannel
  const { assertWechatDevtoolsHost } = await import('weapp-ide-cli')
  const target = await selectWechatE2EInstallation()
  if (!target.version || !target.channel || target.channel === 'unknown') {
    throw new Error('DEVTOOLS_VERSION_UNKNOWN: selected installation must have known product version and channel.')
  }
  if (target.channel !== allowedChannel && (requestedChannel || process.env[ACCEPTED_DEVTOOLS_CHANNEL_ENV] || !process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH)) {
    throw new Error(`DEVTOOLS_STABLE_REQUIRED: 允许渠道为 ${allowedChannel}，选定安装为 ${target.version} / ${target.channel}。`)
  }
  if (acceptedVersion && target.version !== acceptedVersion) {
    throw new Error(`DEVTOOLS_ACCEPTED_VERSION_MISMATCH: ${ACCEPTED_DEVTOOLS_VERSION_ENV}=${acceptedVersion}，选定安装为 ${target.version}。`)
  }
  const strict = (process.env.WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST ?? process.env.WEAPP_IDE_REQUIRE_OFFICIAL_LATEST) === '1'
  const officialChannel = target.channel
  const queriedAt = new Date().toISOString()
  const official = await readOfficialStableVersion(officialChannel).then(value => ({ ...value, error: undefined as string | undefined }), (error: unknown) => ({ version: null, source: OFFICIAL_CHANNELS_URL, queriedAt, error: error instanceof Error ? error.message : String(error) }))
  const officialVersionMatches = target.channel === officialChannel && target.version === official.version
  if (strict && (!officialVersionMatches || official.error)) {
    throw new Error(`DEVTOOLS_OFFICIAL_LATEST_REQUIRED: ${official.error ?? `selected ${target.version}, official ${officialChannel}@${official.version}`}`)
  }
  const mode: DevtoolsVersionPolicyMode = acceptedVersion
    ? 'selected-version-opt-in'
    : strict && target.channel === 'stable' ? 'official-stable' : target.channel === 'stable' ? 'installed-stable' : 'selected-channel'
  const policy: DevtoolsVersionPolicyReport = {
    mode,
    selectedVersion: target.version,
    selectedChannel: target.channel,
    officialVersion: official.version,
    officialError: official.error,
    officialChannel,
    acceptedVersion: acceptedVersion ?? null,
    officialVersionMatches,
    officialSource: official.source,
    officialQueriedAt: official.queriedAt,
  }
  await assertWechatDevtoolsHost(target)
  setDevtoolsVersionPolicyEnv(policy)
  process.stdout.write(`[info] [devtools:selection] ${JSON.stringify({ ...official, officialChannel, cliPath: target.cliPath, installationId: target.installationId, channel: target.channel, versionPolicy: policy.mode, selectedVersion: policy.selectedVersion, acceptedVersion: policy.acceptedVersion, officialVersionMatches: policy.officialVersionMatches })}\n`)
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
