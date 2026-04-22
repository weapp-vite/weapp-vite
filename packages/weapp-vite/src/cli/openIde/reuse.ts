import { connectOpenedAutomator, launchAutomator, promptRetryKeypress } from 'weapp-ide-cli'
import logger, { colors } from '../../logger'

function formatReuseOpenedWechatIdePrompt() {
  const highlightedRetryKey = colors.bold(colors.green('r'))
  return `目标项目已在微信开发者工具中打开，已跳过重复打开。按 ${highlightedRetryKey} 关闭当前窗口后重新打开。`
}

async function openWechatIdeByAutomator(projectPath: string) {
  const miniProgram = await launchAutomator({
    projectPath,
    trustProject: true,
  })
  miniProgram.disconnect()
}

async function connectOpenedProject(projectPath: string) {
  try {
    return await connectOpenedAutomator({
      projectPath,
      timeout: 3_000,
    })
  }
  catch {
    return null
  }
}

/**
 * @description 若当前项目已在微信开发者工具中打开且自动化可连通，则直接复用现有会话，避免重复拉起 IDE。
 */
export async function tryReuseOpenedWechatIde(
  projectPath: string,
  closeIde: () => Promise<boolean>,
) {
  const miniProgram = await connectOpenedProject(projectPath)
  if (!miniProgram) {
    return null
  }

  miniProgram.disconnect()
  logger.info(formatReuseOpenedWechatIdePrompt())

  const action = await promptRetryKeypress({ logger })
  if (action !== 'retry') {
    return {
      reopened: false,
      reused: true,
    } as const
  }

  logger.info(colors.bold(colors.green('正在关闭当前已打开项目，并重新拉起微信开发者工具...')))
  const closed = await closeIde()
  if (!closed) {
    logger.warn('关闭当前微信开发者工具失败，仍继续尝试重新打开目标项目。')
  }

  await openWechatIdeByAutomator(projectPath)
  return {
    reopened: true,
    reused: false,
  } as const
}

/**
 * @description 对已打开的目标项目执行强制重开，以刷新最新构建产物。
 */
export async function reopenOpenedWechatIde(
  projectPath: string,
  closeIde: () => Promise<boolean>,
) {
  const miniProgram = await connectOpenedProject(projectPath)
  if (!miniProgram) {
    return false
  }

  miniProgram.disconnect()
  logger.info('目标项目已在微信开发者工具中打开，当前命令将主动重开以刷新最新构建产物。')
  const closed = await closeIde()
  if (!closed) {
    logger.warn('关闭当前微信开发者工具失败，仍继续尝试重新打开目标项目。')
  }

  await openWechatIdeByAutomator(projectPath)
  return true
}

export { openWechatIdeByAutomator }
