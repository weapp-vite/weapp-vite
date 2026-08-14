import type { CAC } from 'cac'
import type { GlobalCLIOptions } from '../types'
import process from 'node:process'
import {
  bootstrapWechatDevtoolsSettings,
  connectOpenedAutomator,
  defaultCustomConfigFilePath,
  detectWechatDevtoolsServicePort,
  getWechatIdeTestAccounts,
  getWechatIdeTicket,
  getWechatIdeToolInfo,
  isWechatIdeLoggedIn,
  refreshWechatIdeTicket,
  resolveCliPath,
  resolveProjectAutomatorPort,
  setWechatIdeTicket,
} from 'weapp-ide-cli'
import { getBackendForCapability } from '../../backends'
import { VERSION } from '../../constants'
import logger from '../../logger'
import { resolveForwardConsoleOptions, startForwardConsoleBridge } from '../forwardConsole'
import { readLatestHmrProfileSummary } from '../hmrProfileSummary'
import { openIde, resolveIdeCommandContext } from '../openIde'
import { filterDuplicateOptions, resolveConfigFile } from '../options'
import { resolveRuntimeTargets } from '../runtime'

interface IdeDoctorCheck {
  fix?: string
  message?: string
  status: 'ok' | 'warning' | 'failed' | 'unknown'
  value?: unknown
}

interface IdeDoctorReport {
  checks: {
    automator: IdeDoctorCheck
    cli: IdeDoctorCheck
    login: IdeDoctorCheck
    project: IdeDoctorCheck
    servicePort: IdeDoctorCheck
    tool: IdeDoctorCheck
  }
  configFile: string
  nodeVersion: string
  platform: string
  weappViteVersion: string
}

async function runIdeDoctor(projectPath: string | undefined, options: GlobalCLIOptions) {
  const resolvedCli = await resolveCliPath()
  const servicePort = await detectWechatDevtoolsServicePort().catch(error => ({
    servicePortEnabled: undefined,
    servicePort: undefined,
    error,
  }))
  const cliCheck: IdeDoctorCheck = resolvedCli.cliPath
    ? { status: 'ok', value: { path: resolvedCli.cliPath, source: resolvedCli.source } }
    : {
        fix: '执行 `weapp config set cliPath <path-to-cli>` 配置微信开发者工具 CLI。',
        message: '未找到可用的微信开发者工具 CLI。',
        status: 'failed',
        value: { source: resolvedCli.source },
      }
  const servicePortCheck: IdeDoctorCheck = servicePort.servicePortEnabled === false
    ? {
        fix: '在微信开发者工具中打开：设置 -> 安全设置 -> 服务端口。',
        message: '微信开发者工具服务端口已关闭。',
        status: 'failed',
        value: servicePort,
      }
    : servicePort.error
      ? {
          fix: '执行 `wv ide doctor --json` 查看底层错误，并确认微信开发者工具已安装。',
          message: servicePort.error instanceof Error ? servicePort.error.message : String(servicePort.error),
          status: 'warning',
        }
      : {
          status: servicePort.servicePortEnabled === true ? 'ok' : 'unknown',
          value: {
            enabled: servicePort.servicePortEnabled ?? null,
            port: servicePort.servicePort ?? null,
          },
        }
  let loginCheck: IdeDoctorCheck = {
    fix: '打开微信开发者工具完成登录后重试。',
    message: '暂未确认登录状态。',
    status: 'unknown',
  }
  if (resolvedCli.cliPath) {
    try {
      await isWechatIdeLoggedIn({ nonInteractive: true, silent: true })
      loginCheck = { status: 'ok', value: true }
    }
    catch (error) {
      loginCheck = {
        fix: '打开微信开发者工具完成登录后重试，或执行 `wv ide doctor --json` 查看 CLI 错误。',
        message: error instanceof Error ? error.message : String(error),
        status: 'warning',
        value: false,
      }
    }
  }
  const projectCheck: IdeDoctorCheck = projectPath
    ? { status: 'ok', value: projectPath }
    : {
        fix: '在项目目录执行命令，或显式传入 `wv ide doctor <project-root>`。',
        message: '未解析到微信开发者工具项目目录。',
        status: 'warning',
      }
  let automatorCheck: IdeDoctorCheck = {
    message: projectPath ? '当前项目没有可连接的已打开 automator 会话。' : '缺少项目目录，跳过 automator 检查。',
    status: 'unknown',
  }
  let toolCheck: IdeDoctorCheck = {
    message: '当前没有可读取的 DevTools Tool.getInfo。',
    status: 'unknown',
  }
  if (projectPath) {
    try {
      const miniProgram = await connectOpenedAutomator({
        projectPath,
        port: resolveProjectAutomatorPort(projectPath),
        timeout: 3_000,
      }) as { disconnect?: () => void, toolInfo?: () => Promise<unknown> }
      automatorCheck = { status: 'ok', value: true }
      if (typeof miniProgram.toolInfo === 'function') {
        const toolInfo = await miniProgram.toolInfo()
        toolCheck = { status: 'ok', value: toolInfo }
      }
      miniProgram.disconnect?.()
    }
    catch (error) {
      automatorCheck = {
        fix: '先执行 `wv open` 打开项目；若服务端口已开启，关闭多余 DevTools 窗口后重试。',
        message: error instanceof Error ? error.message : String(error),
        status: 'warning',
      }
    }
  }
  const report: IdeDoctorReport = {
    checks: {
      automator: automatorCheck,
      cli: cliCheck,
      login: loginCheck,
      project: projectCheck,
      servicePort: servicePortCheck,
      tool: toolCheck,
    },
    configFile: defaultCustomConfigFilePath,
    nodeVersion: process.version,
    platform: process.platform,
    weappViteVersion: VERSION,
  }
  const output = JSON.stringify(report, null, 2)
  if (options.json) {
    process.stdout.write(`${output}\n`)
  }
  else {
    logger.info(output)
  }
  if (options.strict && Object.values(report.checks).some(check => check.status === 'failed')) {
    throw new Error('微信开发者工具环境诊断未通过，请根据 doctor 输出修复失败项后重试。')
  }
  return report
}

async function waitForTermination(cleanup: () => Promise<void>) {
  await new Promise<void>((resolve) => {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM']
    let cleaning = false
    const handlers = new Map<NodeJS.Signals, () => void>()

    const teardown = async () => {
      if (cleaning) {
        return
      }
      cleaning = true
      for (const signal of signals) {
        process.off(signal, handlers.get(signal)!)
      }
      await cleanup()
      resolve()
    }

    for (const signal of signals) {
      const handler = () => {
        void teardown()
      }
      handlers.set(signal, handler)
      process.on(signal, handler)
    }
  })
}

function formatIdeOutput(data: unknown, options: Pick<GlobalCLIOptions, 'json'>) {
  if (options.json) {
    return JSON.stringify(data, null, 2)
  }
  return JSON.stringify(data, null, 2)
}

/**
 * @description 执行 ide 子命令。
 */
export async function runIdeCommand(action: string | undefined, root: string | undefined, options: GlobalCLIOptions) {
  if (
    action !== 'logs'
    && action !== 'setup'
    && action !== 'info'
    && action !== 'test-accounts'
    && action !== 'ticket'
    && action !== 'ticket:set'
    && action !== 'ticket:refresh'
    && action !== 'doctor'
  ) {
    throw new Error(`未知 ide 子命令: ${action ?? '(empty)'}`)
  }
  filterDuplicateOptions(options)
  const configFile = resolveConfigFile(options)
  const targets = resolveRuntimeTargets(options)
  const ideBackend = getBackendForCapability(targets, 'miniprogram', 'ide')
  if (!ideBackend) {
    throw new Error('`weapp-vite ide` 当前仅支持小程序平台。')
  }
  const resolved = await resolveIdeCommandContext({
    configFile,
    mode: options.mode ?? 'development',
    platform: ideBackend.platform as typeof targets.platform,
    projectPath: root,
    cliPlatform: targets.rawPlatform,
  })

  if (action !== 'doctor' && resolved.platform !== 'weapp') {
    throw new Error('`weapp-vite ide logs` 当前仅支持微信小程序平台。')
  }
  if (action !== 'doctor' && !resolved.projectPath) {
    throw new Error('无法解析微信开发者工具项目目录，请显式传入 root 或检查 project.config.json。')
  }

  if (action === 'doctor') {
    await runIdeDoctor(resolved.projectPath, options)
    return
  }

  if (action === 'setup') {
    const result = await bootstrapWechatDevtoolsSettings({
      projectPath: resolved.projectPath,
      trustProject: options.trustProject,
    })
    logger.info(`已完成微信开发者工具配置预热：扫描实例 ${result.touchedInstanceCount} 个，检测服务端口配置 ${result.detectedSecurityCount} 处，写入项目信任 ${result.trustedProjectCount} 处。`)
    return
  }

  if (options.open) {
    await openIde(resolved.platform, resolved.projectPath, {
      openRecovery: options.openRecovery,
      trustProject: options.trustProject,
      openStrategy: options.ideOpenStrategy,
    })
  }

  if (action === 'info') {
    const result = await getWechatIdeToolInfo({
      projectPath: resolved.projectPath,
    })
    logger.info(formatIdeOutput(result, options))
    return
  }

  if (action === 'test-accounts') {
    const result = await getWechatIdeTestAccounts({
      projectPath: resolved.projectPath,
    })
    logger.info(formatIdeOutput(result, options))
    return
  }

  if (action === 'ticket') {
    const result = await getWechatIdeTicket({
      projectPath: resolved.projectPath,
    })
    logger.info(formatIdeOutput(result, options))
    return
  }

  if (action === 'ticket:set') {
    if (!options.ticket) {
      throw new Error('`weapp-vite ide ticket:set` 需要提供 --ticket。')
    }
    await setWechatIdeTicket({
      projectPath: resolved.projectPath,
      ticket: options.ticket,
    })
    logger.info(`已设置微信开发者工具 ticket：${options.ticket}`)
    return
  }

  if (action === 'ticket:refresh') {
    await refreshWechatIdeTicket({
      projectPath: resolved.projectPath,
    })
    logger.info('已刷新微信开发者工具 ticket。')
    return
  }

  const forwardConsoleOptions = await resolveForwardConsoleOptions({
    ...resolved.weappViteConfig,
    forwardConsole: resolved.weappViteConfig?.forwardConsole === false
      ? { enabled: true }
      : {
          ...(typeof resolved.weappViteConfig?.forwardConsole === 'object' ? resolved.weappViteConfig.forwardConsole : {}),
          enabled: true,
        },
  })

  const latestHmrSummary = await readLatestHmrProfileSummary({
    cwd: resolved.cwd ?? process.cwd(),
    relativeCwd: value => resolved.cwd ? value.replace(`${resolved.cwd}/`, '') : value,
    weappViteConfig: resolved.weappViteConfig,
  })
  if (latestHmrSummary) {
    logger.info(latestHmrSummary.line)
  }

  const session = await startForwardConsoleBridge({
    projectPath: resolved.projectPath,
    port: resolveProjectAutomatorPort(resolved.projectPath),
    agentName: undefined,
    logLevels: forwardConsoleOptions.logLevels,
    unhandledErrors: forwardConsoleOptions.unhandledErrors,
    onReadyMessage: '[forwardConsole] 已进入持续监听模式，按 Ctrl+C 退出。',
  })

  await waitForTermination(async () => {
    logger.info('[forwardConsole] 正在关闭日志桥接...')
    await session.close()
  })
}

/**
 * @description 注册 IDE 相关子命令。
 */
export function registerIdeCommand(cli: CAC) {
  cli
    .command('ide [action] [root]', 'run Wechat DevTools utility actions and log bridge commands')
    .option('-o, --open', '[boolean] open ide before attaching log bridge')
    .option('-p, --platform <platform>', '[string] target platform (weapp | web)')
    .option('--project-config <path>', '[string] project config path (miniprogram only)')
    .option('--json', '[boolean] output the doctor report as JSON')
    .option('--ticket <value>', '[string] ticket used by `ide ticket:set`')
    .option('--trust-project', '[boolean] auto trust Wechat DevTools project on open', { default: true })
    .option('--ide-open-strategy <strategy>', '[string] IDE open strategy (cli | automator)', { default: 'cli' })
    .option('--strict', '[boolean] fail when doctor finds blocking environment errors')
    .option('--no-open-recovery', '[boolean] disable automatic Wechat DevTools close-and-reopen recovery')
    .action(async (action: string | undefined, root: string | undefined, options: GlobalCLIOptions) => {
      await runIdeCommand(action, root, options)
    })
}
