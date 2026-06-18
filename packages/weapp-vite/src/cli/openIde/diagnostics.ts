import logger from '../../logger'

interface WechatIdeRecoveryHintOptions {
  projectPath?: string
  reason: string
}

/**
 * @description 输出微信开发者工具打开后的自助恢复步骤。
 */
export function logWechatIdeRecoveryHint(options: WechatIdeRecoveryHintOptions) {
  const lines = [
    `微信开发者工具打开后状态可能不稳定：${options.reason}`,
    '可按下面顺序恢复：',
    '1. 在微信开发者工具中确认：设置 -> 安全设置 -> 服务端口已开启。',
    '2. 仅当项目索引刷新失败时，默认会自动关闭并重开一次当前目标项目；如需跳过，传入 `--no-open-recovery` 或设置 `WEAPP_VITE_DISABLE_IDE_OPEN_RECOVERY=1`。',
    '3. 如果仍然回到项目选择页，手动导入 project.config.json 所在目录，并关闭多余的微信开发者工具窗口后重试。',
    '4. 需要查看底层错误时，设置 `WEAPP_VITE_DEBUG_AUTOMATOR_OPEN=1` 后重试。',
  ]

  if (options.projectPath) {
    lines.push(`当前目标项目目录：${options.projectPath}`)
  }

  logger.warn(lines.join('\n'))
}

/**
 * @description 输出服务端口关闭时的定向恢复提示。
 */
export function logWechatIdeServicePortDisabledHint(projectPath?: string) {
  const lines = [
    '检测到微信开发者工具服务端口当前处于关闭状态，已保留用户设置并回退到普通 open 流程。',
    '自动刷新、截图、MCP 和 IDE 联动能力需要服务端口。',
    '请在微信开发者工具中打开：设置 -> 安全设置 -> 服务端口，然后重新执行当前 dev/open 命令。',
  ]

  if (projectPath) {
    lines.push(`当前目标项目目录：${projectPath}`)
  }

  logger.warn(lines.join('\n'))
}
