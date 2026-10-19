import type { WechatDevtoolsSelectionOptions } from 'weapp-ide-cli'
import process from 'node:process'

export const DEVTOOLS_SELECTION_ENV_KEYS = [
  'WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH',
  'WEAPP_IDE_CLI_PATH',
  'WEAPP_VITE_E2E_DEVTOOLS_CHANNEL',
  'WEAPP_VITE_E2E_DEVTOOLS_VERSION',
  'WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_CHANNEL',
  'WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION',
  'WEAPP_IDE_DEVTOOLS_CHANNEL',
  'WEAPP_IDE_DEVTOOLS_VERSION',
  'WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST',
  'WEAPP_IDE_REQUIRE_OFFICIAL_LATEST',
] as const

/** 程序化串行调用结束后原样恢复继承环境，防止下一轮误用上一安装。 */
export async function withWechatE2ESelectionEnvironment<T>(run: () => Promise<T>) {
  const previous = DEVTOOLS_SELECTION_ENV_KEYS.map(key => [key, process.env[key]] as const)
  try {
    return await run()
  }
  finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key]
      }
      else {
        process.env[key] = value
      }
    }
  }
}

/** 所有 E2E 入口共用同一 CLI 选择，避免预检、恢复和启动混用稳定版与 RC。 */
export function resolveWechatCliPath(cliPath?: string, platform = process.platform) {
  const selected = cliPath?.trim()
    || process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH?.trim()
    || process.env.WEAPP_IDE_CLI_PATH?.trim()
  if (selected) {
    return selected
  }
  return platform === 'win32'
    ? 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
    : '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
}

/** 将本轮显式选择传给公共 CLI 及其子进程，不改写用户配置文件。 */
export function applyWechatCliSelection() {
  const selected = process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH?.trim()
  if (!selected) {
    throw new Error('真实 IDE E2E 需要显式设置 WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH。')
  }
  process.env.WEAPP_IDE_CLI_PATH = selected
  return selected
}

/** 按统一优先级解析本轮 E2E 选择，并拒绝同层新旧别名冲突。 */
export function readWechatE2ESelection(env = process.env): WechatDevtoolsSelectionOptions {
  for (const key of ['CHANNEL', 'VERSION']) {
    const selected = env[`WEAPP_VITE_E2E_DEVTOOLS_${key}`]?.trim()
    const accepted = env[`WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_${key}`]?.trim()
    if (selected && accepted && selected !== accepted) {
      throw Object.assign(new Error(`Conflicting E2E DevTools ${key.toLowerCase()} environment values.`), { code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
    }
  }
  const devtoolsChannel = env.WEAPP_VITE_E2E_DEVTOOLS_CHANNEL?.trim() || env.WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_CHANNEL?.trim()
  const devtoolsVersion = env.WEAPP_VITE_E2E_DEVTOOLS_VERSION?.trim() || env.WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION?.trim()
  return {
    cliPath: env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH?.trim() || undefined,
    ...(devtoolsChannel ? { devtoolsChannel: devtoolsChannel as 'stable' | 'rc' | 'nightly' } : {}),
    ...(devtoolsVersion ? { devtoolsVersion } : {}),
  }
}

/** 将显式 E2E 选择投影到公共 CLI 环境；仅返回副本，不污染父进程。 */
export function createWechatE2EChildEnv(env = process.env): NodeJS.ProcessEnv {
  const selection = readWechatE2ESelection(env)
  const childEnv = { ...env }
  if (selection.cliPath || selection.devtoolsChannel || selection.devtoolsVersion) {
    // 与显式 selector options 一致，本轮 E2E 选择覆盖继承的公共选择。
    delete childEnv.WEAPP_IDE_CLI_PATH
    delete childEnv.WEAPP_IDE_DEVTOOLS_CHANNEL
    delete childEnv.WEAPP_IDE_DEVTOOLS_VERSION
    if (selection.cliPath) {
      childEnv.WEAPP_IDE_CLI_PATH = selection.cliPath
    }
    if (selection.devtoolsChannel) {
      childEnv.WEAPP_IDE_DEVTOOLS_CHANNEL = selection.devtoolsChannel
    }
    if (selection.devtoolsVersion) {
      childEnv.WEAPP_IDE_DEVTOOLS_VERSION = selection.devtoolsVersion
    }
  }
  if (env.WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST !== undefined) {
    childEnv.WEAPP_IDE_REQUIRE_OFFICIAL_LATEST = env.WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST
  }
  return childEnv
}

/** 启动前静态选版；选择后向全部子进程发布具体 CLI，不写全局配置。 */
export async function selectWechatE2EInstallation() {
  const selection = readWechatE2ESelection()
  const { resolveWechatDevtoolsTarget } = await import('weapp-ide-cli')
  const target = await resolveWechatDevtoolsTarget(selection)
  process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH = target.cliPath
  process.env.WEAPP_IDE_CLI_PATH = target.cliPath
  return target
}
