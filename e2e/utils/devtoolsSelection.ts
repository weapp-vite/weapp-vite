import type { ResolvedWechatDevtoolsTarget } from 'weapp-ide-cli'
import process from 'node:process'
import { applyWechatCliSelection } from './devtoolsCli'

const OFFICIAL_CHANNELS_URL = 'https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json'

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

/** 将预检、公共 CLI 和后续子进程固定到同一安装，不修改全局配置。 */
export async function preflightSelectedWechatDevtools() {
  const cliPath = applyWechatCliSelection()
  const { assertWechatDevtoolsHost, resolveWechatDevtoolsTarget } = await import('weapp-ide-cli')
  const target = await resolveWechatDevtoolsTarget({ cliPath })
  const official = await readOfficialStableVersion()
  if (target.channel !== 'stable' || target.version !== official.version) {
    throw new Error(`DEVTOOLS_STABLE_REQUIRED: 官方 Stable 为 ${official.version}，选定安装为 ${target.version ?? 'unknown'} / ${target.channel ?? 'unknown'}；已停止，不自动换版。`)
  }
  await assertWechatDevtoolsHost(target)
  process.stdout.write(`[info] [devtools:selection] ${JSON.stringify({ ...official, cliPath: target.cliPath, installationId: target.installationId, channel: target.channel })}\n`)
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
