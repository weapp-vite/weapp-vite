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

/** 启动前静态选版；选择后向全部子进程发布具体 CLI，不写全局配置。 */
export async function selectWechatE2EInstallation() {
  const { resolveWechatDevtoolsTarget } = await import('weapp-ide-cli')
  for (const key of ['CHANNEL', 'VERSION']) {
    const selected = process.env[`WEAPP_VITE_E2E_DEVTOOLS_${key}`]?.trim()
    const accepted = process.env[`WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_${key}`]?.trim()
    if (selected && accepted && selected !== accepted) {
      throw Object.assign(new Error(`Conflicting E2E DevTools ${key.toLowerCase()} environment values.`), { code: 'WECHAT_DEVTOOLS_INSTALLATION_SELECTION_CONFLICT' })
    }
  }
  const devtoolsChannel = process.env.WEAPP_VITE_E2E_DEVTOOLS_CHANNEL?.trim() || process.env.WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_CHANNEL?.trim()
  const devtoolsVersion = process.env.WEAPP_VITE_E2E_DEVTOOLS_VERSION?.trim() || process.env.WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION?.trim()
  const target = await resolveWechatDevtoolsTarget({
    cliPath: process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH?.trim() || undefined,
    ...(devtoolsChannel ? { devtoolsChannel: devtoolsChannel as 'stable' | 'rc' | 'nightly' } : {}),
    ...(devtoolsVersion ? { devtoolsVersion } : {}),
  })
  process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH = target.cliPath
  process.env.WEAPP_IDE_CLI_PATH = target.cliPath
  return target
}
