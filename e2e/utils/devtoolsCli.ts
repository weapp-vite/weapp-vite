import process from 'node:process'

/** 所有 E2E 入口共用同一 CLI 选择，避免预检、恢复和启动混用稳定版与 RC。 */
export function resolveWechatCliPath(cliPath?: string, platform = process.platform) {
  const selected = cliPath?.trim() || process.env.WEAPP_VITE_E2E_DEVTOOLS_CLI_PATH?.trim()
  if (selected) {
    return selected
  }
  return platform === 'win32'
    ? 'C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat'
    : '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
}
